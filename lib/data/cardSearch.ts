// Live card search — JP market only. Queries TCGdex JP (catalog/name/image)
// and the 遊々亭 price worker (catchstack-jp.starving-effort.com) for the
// matching sell price, and maps results to the shared SeedCard shape.
import type { SeedCard } from '@/lib/data/seedCards';

const FETCH_TIMEOUT_MS = 8000;
const TCGDEX_BASE = 'https://api.tcgdex.net/v2/ja/cards';
const PRICE_WORKER = 'https://catchstack-jp.starving-effort.com/';

function firstFinite(...values: (number | undefined | null)[]): number {
  for (const v of values) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

function combineSignals(a: AbortSignal, b: AbortSignal): AbortSignal {
  const ctrl = new AbortController();
  const abort = () => ctrl.abort();
  if (a.aborted || b.aborted) {
    ctrl.abort();
    return ctrl.signal;
  }
  a.addEventListener('abort', abort, { once: true });
  b.addEventListener('abort', abort, { once: true });
  return ctrl.signal;
}

// Fetch JSON with a per-attempt timeout and one retry for transient CDN
// failures (yuyu-tei sits behind Cloudflare and intermittently 403s burst
// requests). Never throws — returns the parsed JSON, or null on give-up.
async function fetchJson(url: string, signal: AbortSignal): Promise<unknown | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const timeoutCtrl = new AbortController();
    const timer = setTimeout(() => timeoutCtrl.abort(), FETCH_TIMEOUT_MS);
    const combined = combineSignals(signal, timeoutCtrl.signal);
    try {
      const res = await fetch(url, { signal: combined, headers: { 'User-Agent': 'Catchstack-JP/1.0', Accept: 'application/json' } });
      if (res.ok) return await res.json();
      if (attempt === 0 && (res.status === 403 || res.status === 429 || res.status >= 500)) continue;
      return null;
    } catch {
      if (signal.aborted) return null;
      if (attempt === 0) continue;
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

function normNumber(n: string | undefined): string {
  return (n ?? '').split('/')[0].replace(/^0+/, '') || '0';
}

// Search TCGdex JP by Japanese name. Returns the catalog identity (name,
// image, set, number) for each printing — no price yet.
async function searchTcgdex(query: string, signal: AbortSignal): Promise<Array<{
  id: string; name: string; localId: string; image: string; set: string; rarity: string;
}>> {
  const url = `${TCGDEX_BASE}?name=${encodeURIComponent(query)}`;
  const json = await fetchJson(url, signal);
  if (!Array.isArray(json)) return [];
  return (json as Record<string, unknown>[])
    .filter((c) => typeof c.image === 'string' && c.image)
    .slice(0, 24)
    .map((c) => ({
      id: String(c.id ?? ''),
      name: String(c.name ?? ''),
      localId: String(c.localId ?? ''),
      image: String(c.image ?? ''),
      set: '',
      rarity: '',
    }));
}

// Fetch 遊々亭 sell/buy prices for a given query (returns every printing the
// shop has under that name, keyed by number so the caller can match exactly).
async function fetchYuyuteiPrices(query: string, signal: AbortSignal): Promise<Array<{
  name: string; number: string; sellJpy: number | null;
}>> {
  const url = `${PRICE_WORKER}?q=${encodeURIComponent(query)}`;
  const json = await fetchJson(url, signal);
  const cards = (json as { cards?: unknown })?.cards;
  if (!Array.isArray(cards)) return [];
  return (cards as Record<string, unknown>[]).map((c) => ({
    name: String(c.name ?? ''),
    number: String(c.number ?? ''),
    sellJpy: typeof c.sellJpy === 'number' ? c.sellJpy : null,
  }));
}

export async function searchCards(query: string, signal?: AbortSignal): Promise<SeedCard[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const callerSignal = signal ?? new AbortController().signal;

  const [tcgdexResult, priceResult] = await Promise.allSettled([
    searchTcgdex(q, callerSignal),
    fetchYuyuteiPrices(q, callerSignal),
  ]);

  const tcgdexCards = tcgdexResult.status === 'fulfilled' ? tcgdexResult.value : [];
  const prices = priceResult.status === 'fulfilled' ? priceResult.value : [];

  return tcgdexCards
    .map((c): SeedCard | null => {
      // Exact match: same name string AND number (zero-stripped) — same
      // precision rule validated end-to-end in jpPrice.ts (6/6 unique hits).
      const hit = prices.find((p) => p.name === c.name && normNumber(p.number) === normNumber(c.localId));
      const marketJpy = firstFinite(hit?.sellJpy);
      return {
        id: c.id,
        category: 'Pokemon',
        name: c.name,
        set: c.set,
        number: c.localId,
        rarity: c.rarity,
        image: `${c.image}/high.png`,
        marketJpy,
      };
    })
    .filter((c): c is SeedCard => c !== null);
}

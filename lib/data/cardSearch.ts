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

const SEARCH_RESULT_CAP = 50;

// Search TCGdex JP by Japanese name. Returns the catalog identity (name,
// image, localId) for each printing — the list endpoint does not include
// set name or rarity (verified live: it only returns id/localId/name/image),
// so those are backfilled by fetchCardDetails() below, bounded to the
// results we actually display.
async function searchTcgdex(query: string, signal: AbortSignal): Promise<Array<{
  id: string; name: string; localId: string; image: string; set: string; rarity: string;
}>> {
  const url = `${TCGDEX_BASE}?name=${encodeURIComponent(query)}`;
  const json = await fetchJson(url, signal);
  if (!Array.isArray(json)) return [];
  return (json as Record<string, unknown>[])
    .filter((c) => typeof c.image === 'string' && c.image)
    .slice(0, SEARCH_RESULT_CAP)
    .map((c) => ({
      id: String(c.id ?? ''),
      name: String(c.name ?? ''),
      localId: String(c.localId ?? ''),
      image: String(c.image ?? ''),
      set: '',
      rarity: '',
    }));
}

// Backfill set name + rarity from the per-card detail endpoint, bounded to
// the cards actually shown (never more than SEARCH_RESULT_CAP calls). Best
// effort — a failed detail fetch just leaves that card's set/rarity blank,
// it never blocks the base search result from showing.
async function fetchCardDetails(
  cards: Array<{ id: string }>,
  signal: AbortSignal
): Promise<Map<string, { set: string; rarity: string }>> {
  const out = new Map<string, { set: string; rarity: string }>();
  await Promise.all(
    cards.map(async (c) => {
      const json = await fetchJson(`${TCGDEX_BASE}/${encodeURIComponent(c.id)}`, signal);
      if (!json || typeof json !== 'object') return;
      const d = json as Record<string, unknown>;
      const set = d.set && typeof d.set === 'object' ? String((d.set as Record<string, unknown>).name ?? '') : '';
      // TCGdex literally returns the string "None" for cards with no assigned
      // rarity classification (verified live) — treat it the same as blank.
      const rawRarity = typeof d.rarity === 'string' ? d.rarity : '';
      const rarity = rawRarity && rawRarity !== 'None' ? rawRarity : '';
      if (set || rarity) out.set(c.id, { set, rarity });
    })
  );
  return out;
}

// Fetch 遊々亭 sell/buy prices for a given query (returns every printing the
// shop has under that name, keyed by number so the caller can match exactly).
// ver+id are yuyu-tei's own catalog keys — kept so cards yuyu-tei sells but
// TCGdex JP doesn't catalog (verified: e.g. リーリエ / SM4+ / 998,000円 —
// TCGdex has 0 populated cards for that set) can still be surfaced as a
// fallback search result instead of silently disappearing.
async function fetchYuyuteiPrices(query: string, signal: AbortSignal): Promise<Array<{
  ver: string; wid: string; name: string; number: string; sellJpy: number | null;
}>> {
  const url = `${PRICE_WORKER}?q=${encodeURIComponent(query)}`;
  const json = await fetchJson(url, signal);
  const cards = (json as { cards?: unknown })?.cards;
  if (!Array.isArray(cards)) return [];
  return (cards as Record<string, unknown>[]).map((c) => ({
    ver: String(c.ver ?? ''),
    wid: String(c.id ?? ''),
    name: String(c.name ?? ''),
    number: String(c.number ?? ''),
    sellJpy: typeof c.sellJpy === 'number' ? c.sellJpy : null,
  }));
}

const FALLBACK_CAP = 20;

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

  // Backfill set name + rarity (list endpoint doesn't have them) for the
  // cards we're about to show. Best-effort — never blocks the base result.
  const detailsResult = await Promise.allSettled([fetchCardDetails(tcgdexCards, callerSignal)]);
  const details = detailsResult[0].status === 'fulfilled' ? detailsResult[0].value : new Map();

  const matched = new Set<number>(); // index into `prices` consumed by a TCGdex match

  const tcgdexResults = tcgdexCards
    .map((c): SeedCard | null => {
      // Exact match: same name string AND number (zero-stripped) — same
      // precision rule validated end-to-end in jpPrice.ts (6/6 unique hits).
      const hitIdx = prices.findIndex((p) => p.name === c.name && normNumber(p.number) === normNumber(c.localId));
      if (hitIdx >= 0) matched.add(hitIdx);
      const marketJpy = firstFinite(hitIdx >= 0 ? prices[hitIdx].sellJpy : null);
      const detail = details.get(c.id);
      return {
        id: c.id,
        category: 'Pokemon',
        name: c.name,
        set: detail?.set || c.set,
        number: c.localId,
        rarity: detail?.rarity || c.rarity,
        image: `${c.image}/high.png`,
        marketJpy,
      };
    })
    .filter((c): c is SeedCard => c !== null);

  // Fallback: 遊々亭 prices with no TCGdex JP catalog counterpart. These are
  // real, sellable cards (verified live) that would otherwise never appear in
  // search just because the free catalog source hasn't indexed that set/era.
  // No image (never re-publish 遊々亭's own card photos — price numbers +
  // source link only, per apps/catchstack-jp-worker/src/index.js's compliance
  // stance) and no set/rarity (yuyu-tei's search page doesn't expose them).
  const fallbackResults: SeedCard[] = prices
    .map((p, i) => ({ p, i }))
    .filter(({ i, p }) => !matched.has(i) && p.sellJpy != null && p.name)
    .slice(0, FALLBACK_CAP)
    .map(({ p }): SeedCard => ({
      id: `yuyu:${p.ver}:${p.wid}`,
      category: 'Pokemon',
      name: p.name,
      set: '',
      number: normNumber(p.number),
      rarity: '',
      image: '',
      marketJpy: firstFinite(p.sellJpy),
    }));

  return [...tcgdexResults, ...fallbackResults];
}

// Live ungraded reference prices — 遊々亭 (yuyu-tei.jp), JPY.
// Sell (販売 = store ask) AND buyback (買取 = store bid, NM想定) per card.
//
// These are PUBLIC, UNGRADED market figures — exactly what the app presents as
// "reference value" (never an appraisal). They replace the bundled snapshot when
// a live fetch succeeds, and fall back to the bundled price on any failure or
// offline. Results are cached in AsyncStorage for a few hours so the app is fast
// and we stay polite to the upstream price worker (catchstack-jp.starving-effort.com,
// which itself daily-caches yuyu-tei — see apps/catchstack-jp-worker/).

import AsyncStorage from '@react-native-async-storage/async-storage';
import { resolveCard } from '@/lib/data/catalog';

// v2: adds buyPrices; key bumped so a v1-shaped cache is never misread.
const CACHE_KEY = 'catchstack.prices.v2';
const TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const PRICE_WORKER = 'https://catchstack-jp.starving-effort.com/';

export type PriceMap = Record<string, number>;
export interface LivePriceData {
  prices: PriceMap;    // 販売参考価格 (store ask)
  buyPrices: PriceMap; // 買取参考価格 (store bid, NM想定)
}
interface CacheShape extends LivePriceData { fetchedAt: number }

function normNumber(n: string | undefined): string {
  return (n ?? '').split('/')[0].replace(/^0+/, '') || '0';
}

// ---- cache ---------------------------------------------------------------

export async function loadCachedPriceData(): Promise<LivePriceData> {
  const c = await readCache();
  return { prices: c?.prices ?? {}, buyPrices: c?.buyPrices ?? {} };
}

// Returns when the cached price map was last written, or null if absent.
export async function loadCachedFetchedAt(): Promise<number | null> {
  const c = await readCache();
  return c?.fetchedAt ?? null;
}

function isFresh(fetchedAt: number): boolean {
  return Date.now() - fetchedAt < TTL_MS;
}

async function readCache(): Promise<CacheShape | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as CacheShape;
    if (!c || typeof c.fetchedAt !== 'number' || !c.prices) return null;
    return { fetchedAt: c.fetchedAt, prices: c.prices, buyPrices: c.buyPrices ?? {} };
  } catch {
    return null;
  }
}

async function writeCache(data: LivePriceData): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), ...data } satisfies CacheShape));
  } catch {
    /* ignore */
  }
}

// ---- upstream fetcher -----------------------------------------------------

// Fetch 遊々亭 sell + buyback prices for the given catalog ids, one worker
// query per distinct card name (the worker returns every printing under that
// name; we pick the exact one by number, same precision rule as cardSearch.ts).
// Resolves ids via resolveCard — covers user-added (live-searched) cards, not
// just the bundled seed. (The old SEED_CARDS-only lookup silently skipped
// every user-added card, so their prices never refreshed.)
async function fetchYuyutei(ids: string[]): Promise<LivePriceData> {
  const out: LivePriceData = { prices: {}, buyPrices: {} };
  if (!ids.length) return out;
  // De-dupe by name so two printings sharing a card name don't double-fetch.
  const byName = new Map<string, string[]>();
  for (const id of ids) {
    const card = resolveCard(id);
    if (!card) continue;
    const list = byName.get(card.name) ?? [];
    list.push(id);
    byName.set(card.name, list);
  }

  await Promise.all(
    Array.from(byName.entries()).map(async ([name, cardIds]) => {
      try {
        const res = await fetch(`${PRICE_WORKER}?q=${encodeURIComponent(name)}`, {
          headers: { 'User-Agent': 'Catchstack-JP/1.0', Accept: 'application/json' },
        });
        if (!res.ok) return;
        const json = await res.json();
        const cards = (json?.cards ?? []) as Array<{ name?: string; number?: string; sellJpy?: number; buyJpy?: number }>;
        for (const cardId of cardIds) {
          const card = resolveCard(cardId);
          if (!card) continue;
          const hit = cards.find((c) => c.name === name && normNumber(c.number) === normNumber(card.number));
          if (hit?.sellJpy) out.prices[cardId] = hit.sellJpy;
          if (hit?.buyJpy) out.buyPrices[cardId] = hit.buyJpy;
        }
      } catch {
        /* skip this name on failure */
      }
    })
  );
  return out;
}

// ---- public API ----------------------------------------------------------

// Fetch fresh live prices for the given catalog ids. Uses cache when fresh
// (skip with `force: true` for a user-triggered manual refresh — always hits
// the worker regardless of the 6h TTL). Always returns (possibly partial)
// maps; never throws.
export async function fetchLivePrices(ids: string[], opts: { force?: boolean } = {}): Promise<LivePriceData> {
  const cache = await readCache();
  if (!opts.force && cache && isFresh(cache.fetchedAt) && ids.every((id) => id in cache.prices)) {
    return { prices: cache.prices, buyPrices: cache.buyPrices };
  }

  const live = await fetchYuyutei(ids);
  const fresh: LivePriceData = {
    prices: { ...(cache?.prices ?? {}), ...live.prices },
    buyPrices: { ...(cache?.buyPrices ?? {}), ...live.buyPrices },
  };
  if (Object.keys(fresh.prices).length || Object.keys(fresh.buyPrices).length) {
    await writeCache(fresh);
  }
  return fresh;
}

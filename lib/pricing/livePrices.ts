// Live ungraded reference prices — 遊々亭 (yuyu-tei.jp) sell prices, JPY.
//
// These are PUBLIC, UNGRADED market figures — exactly what the app presents as
// "reference value" (never an appraisal). They replace the bundled snapshot when
// a live fetch succeeds, and fall back to the bundled price on any failure or
// offline. Results are cached in AsyncStorage for a few hours so the app is fast
// and we stay polite to the upstream price worker (catchstack-jp.starving-effort.com,
// which itself daily-caches yuyu-tei — see apps/catchstack-jp-worker/).

import AsyncStorage from '@react-native-async-storage/async-storage';
import { SEED_CARDS } from '@/lib/data/seedCards';

const CACHE_KEY = 'catchstack.prices.v1';
const TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const PRICE_WORKER = 'https://catchstack-jp.starving-effort.com/';

export type PriceMap = Record<string, number>;
interface CacheShape { fetchedAt: number; prices: PriceMap }

const CARD_BY_ID = Object.fromEntries(SEED_CARDS.map((c) => [c.id, c]));

function normNumber(n: string | undefined): string {
  return (n ?? '').split('/')[0].replace(/^0+/, '') || '0';
}

// ---- cache ---------------------------------------------------------------

export async function loadCachedPrices(): Promise<PriceMap> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const c = JSON.parse(raw) as CacheShape;
    if (!c || typeof c.fetchedAt !== 'number' || !c.prices) return {};
    return c.prices;
  } catch {
    return {};
  }
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
    return raw ? (JSON.parse(raw) as CacheShape) : null;
  } catch {
    return null;
  }
}

async function writeCache(prices: PriceMap): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), prices } satisfies CacheShape));
  } catch {
    /* ignore */
  }
}

// ---- upstream fetcher -----------------------------------------------------

// Fetch 遊々亭 sell prices for the given seed-card ids, one worker query per
// distinct card name (the worker returns every printing under that name; we
// pick the exact one by number, same precision rule as cardSearch.ts).
async function fetchYuyutei(ids: string[]): Promise<PriceMap> {
  if (!ids.length) return {};
  const out: PriceMap = {};
  // De-dupe by name so two printings sharing a card name don't double-fetch.
  const byName = new Map<string, string[]>();
  for (const id of ids) {
    const card = CARD_BY_ID[id];
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
        const cards = (json?.cards ?? []) as Array<{ name?: string; number?: string; sellJpy?: number }>;
        for (const cardId of cardIds) {
          const seed = CARD_BY_ID[cardId];
          if (!seed) continue;
          const hit = cards.find((c) => c.name === name && normNumber(c.number) === normNumber(seed.number));
          if (hit?.sellJpy) out[cardId] = hit.sellJpy;
        }
      } catch {
        /* skip this name on failure */
      }
    })
  );
  return out;
}

// ---- public API ----------------------------------------------------------

// Fetch fresh live prices for the given seed-card ids. Uses cache when fresh.
// Always returns a (possibly partial) map; never throws.
export async function fetchLivePrices(ids: string[]): Promise<PriceMap> {
  const cache = await readCache();
  if (cache && isFresh(cache.fetchedAt) && ids.every((id) => id in cache.prices)) {
    return cache.prices;
  }

  const fresh = { ...(cache?.prices ?? {}), ...(await fetchYuyutei(ids)) };
  if (Object.keys(fresh).length) {
    await writeCache(fresh);
  }
  return fresh;
}

import { useEffect, useMemo, useState } from 'react';
import { loadCachedPriceData, loadCachedFetchedAt, fetchLivePrices, type PriceMap, type LivePriceData } from '@/lib/pricing/livePrices';

export interface LivePricesResult {
  prices: PriceMap;    // 販売参考価格 (store ask)
  buyPrices: PriceMap; // 買取参考価格 (store bid, NM想定)
  fetchedAt: number | null; // ms epoch when the cache was last written (live data timestamp)
  refreshing: boolean;
  refresh: () => Promise<void>; // manual refresh — bypasses the 6h app cache
}

type PriceState = { prices: PriceMap; buyPrices: PriceMap; fetchedAt: number | null };

// Returns live ungraded market-price maps (cache first, then network) for the
// given catalog ids, plus the timestamp of the most recent successful fetch.
// Shared by the portfolio dataset and the alerts engine so both evaluate
// against the same real prices.
export function useLivePrices(ids: string[]): LivePricesResult {
  const idsKey = useMemo(() => Array.from(new Set(ids)).sort().join(','), [ids]);
  const [state, setState] = useState<PriceState>({ prices: {}, buyPrices: {}, fetchedAt: null });
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const list = idsKey ? idsKey.split(',') : [];
    if (!list.length) return;
    let cancelled = false;

    const apply = (data: LivePriceData, at: number | null) => {
      if (cancelled) return;
      const sell: PriceMap = {};
      const buy: PriceMap = {};
      for (const id of list) {
        if (id in data.prices) sell[id] = data.prices[id];
        if (id in data.buyPrices) buy[id] = data.buyPrices[id];
      }
      if (Object.keys(sell).length || Object.keys(buy).length || at != null) {
        setState((prev) => ({
          prices: Object.keys(sell).length ? { ...prev.prices, ...sell } : prev.prices,
          buyPrices: Object.keys(buy).length ? { ...prev.buyPrices, ...buy } : prev.buyPrices,
          fetchedAt: at ?? prev.fetchedAt,
        }));
      }
    };

    // 1) instant: cached prices + their fetchedAt.
    Promise.all([loadCachedPriceData(), loadCachedFetchedAt()]).then(([d, at]) => apply(d, at));
    // 2) background: refresh from the live catalogs. fetchLivePrices() writes
    //    the cache on success — re-read fetchedAt afterwards so the UI clock
    //    advances to "now" when a live refresh lands.
    fetchLivePrices(list).then(async (d) => {
      const at = await loadCachedFetchedAt();
      apply(d, at);
    });

    return () => {
      cancelled = true;
    };
  }, [idsKey]);

  const refresh = useMemo(() => async () => {
    const list = idsKey ? idsKey.split(',') : [];
    if (!list.length) return;
    setRefreshing(true);
    try {
      const d = await fetchLivePrices(list, { force: true });
      const at = await loadCachedFetchedAt();
      const sell: PriceMap = {};
      const buy: PriceMap = {};
      for (const id of list) {
        if (id in d.prices) sell[id] = d.prices[id];
        if (id in d.buyPrices) buy[id] = d.buyPrices[id];
      }
      setState((prev) => ({
        prices: Object.keys(sell).length ? { ...prev.prices, ...sell } : prev.prices,
        buyPrices: Object.keys(buy).length ? { ...prev.buyPrices, ...buy } : prev.buyPrices,
        fetchedAt: at ?? prev.fetchedAt,
      }));
    } finally {
      setRefreshing(false);
    }
  }, [idsKey]);

  return { ...state, refreshing, refresh };
}

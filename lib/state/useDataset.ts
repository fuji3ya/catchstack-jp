import { useMemo, useState, useEffect } from 'react';
import { buildDatasetFromHoldings } from '@/lib/data/buildRealDataset';
import { useHoldings } from '@/lib/state/useHoldings';
import { useLivePrices } from '@/lib/state/useLivePrices';
import { MockPriceProvider } from '@/lib/pricing/provider';
import { buildPortfolioView, HoldingRow } from '@/lib/state/store';
import { resolveCard } from '@/lib/data/catalog';
import type { PriceQuote } from '@/lib/domain/types';

type PortfolioView = ReturnType<typeof buildPortfolioView>;

export interface BuybackSummary {
  totalJpy: number;   // 買取参考総額 (NM想定) — covered holdings only
  covered: number;    // holdings with a buyback price (live or bundled)
  totalCount: number; // all holdings
}

interface DatasetResult {
  view: PortfolioView | null;
  byHolding: Record<string, HoldingRow>;
  buyback: BuybackSummary;
  buyPrices: Record<string, number>; // per-catalog-id 買取参考価格 (live over bundled)
  pricesLive: boolean; // true once any live price has been applied
  pricesFetchedAt: number | null; // ms epoch when the live price cache was last written
  pricesRefreshing: boolean;
  refreshPrices: () => Promise<void>; // manual refresh — bypasses the 6h app cache
}

export function useDataset(): DatasetResult {
  const userHoldings = useHoldings();

  // Live ungraded market prices keyed by catalog id (cache first, then network).
  const ownedIds = useMemo(() => userHoldings.map((h) => h.catalogItemId), [userHoldings]);
  const { prices: overrides, buyPrices: liveBuy, fetchedAt: pricesFetchedAt, refreshing: pricesRefreshing, refresh: refreshPrices } = useLivePrices(ownedIds);
  const pricesLive = Object.keys(overrides).length > 0;

  // Per-card 買取参考価格: live worker value wins, bundled seed snapshot as
  // fallback. Cards with neither stay absent (honest coverage count below).
  const buyPrices = useMemo(() => {
    const m: Record<string, number> = {};
    for (const h of userHoldings) {
      const id = h.catalogItemId;
      const live = liveBuy[id];
      const bundled = resolveCard(id)?.buyJpy;
      const v = live ?? bundled;
      if (v != null && v > 0) m[id] = v;
    }
    return m;
  }, [userHoldings, liveBuy]);

  // 買取参考総額 — sums each HOLDING (duplicates count once each), only over
  // holdings that actually have a buyback price. covered/totalCount lets the
  // UI say "12/15枚分" instead of passing off a partial sum as complete.
  const buyback = useMemo<BuybackSummary>(() => {
    let total = 0;
    let covered = 0;
    for (const h of userHoldings) {
      const v = buyPrices[h.catalogItemId];
      if (v != null) { total += v; covered++; }
    }
    return { totalJpy: total, covered, totalCount: userHoldings.length };
  }, [userHoldings, buyPrices]);

  const dataset = useMemo(
    () => buildDatasetFromHoldings(userHoldings, overrides),
    [userHoldings, overrides]
  );

  const [result, setResult] = useState<Pick<DatasetResult, 'view' | 'byHolding'>>({ view: null, byHolding: {} });

  useEffect(() => {
    const { catalog, holdings, history } = dataset;

    const catalogById = Object.fromEntries(catalog.map((c) => [c.id, c]));
    const provider = new MockPriceProvider(history);
    const catalogIds = catalog.map((c) => c.id);

    Promise.all(
      catalogIds.map((id) => provider.getQuote(id).then((q) => [id, q] as [string, PriceQuote | null]))
    ).then((entries) => {
      const quotesByCatalogId = Object.fromEntries(entries);
      const view = buildPortfolioView(holdings, catalogById, quotesByCatalogId);

      const byHolding: Record<string, HoldingRow> = {};
      for (const row of view.rows) {
        byHolding[row.holdingId] = row;
      }

      setResult({ view, byHolding });
    });
  }, [dataset]);

  return { ...result, buyback, buyPrices, pricesLive, pricesFetchedAt, pricesRefreshing, refreshPrices };
}

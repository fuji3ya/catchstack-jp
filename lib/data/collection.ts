// Browsable collection model — JP-market curated Pokémon cards, presented
// with grade/cert/day-move, for the Collection + Add screens.
import { SEED_CARDS } from '@/lib/data/seedCards';
import type { UserHolding } from '@/lib/state/holdingsStore';
import { cleanName, gradeFor, gradeNum, dayMove, certFor } from '@/lib/design/cardPresentation';
import { resolveCard } from '@/lib/data/catalog';

export interface CollectionCard {
  id: string;
  holdingId?: string;      // present when this card is an owned holding
  category: string;        // 'Pokemon' | 'MTG' | ...
  tcg: string;             // 'pokemon' | 'mtg'
  title: string;
  set: string;
  number?: string;         // card number within its set (for version disambiguation)
  rarity?: string;         // e.g. "Double rare", "SR" — for disambiguating same-name printings
  imageUrl: string;
  marketJpy: number;
  grade: string;
  gradeNum: string;
  cert: string;
  dayPct: number;
  alert: boolean;
}

// JP v1 ships Pokémon only — yuyu-tei's verified price source (this seed
// catalog + cardSearch.ts) doesn't cover MTG yet, so showing it as
// "supported" would be misleading. Re-add 'MTG' here once a verified JP MTG
// price source exists.
export const COLLECTION_CATEGORIES = ['All', 'Pokemon'] as const;
export type CollectionCategory = (typeof COLLECTION_CATEGORIES)[number];
export const CATEGORY_LABEL: Record<string, string> = { All: 'すべて', Pokemon: 'ポケモン' };

// A few cards carry a price alert (deterministic) — matches the mockup.
const ALERTS = new Set(['SV5K-088', 'SV1V-102', 'S12-079', 'S9-014']);

function tcgOf(category: string): string {
  return category === 'MTG' ? 'mtg' : category === 'Pokemon' ? 'pokemon' : category.toLowerCase();
}

// Full browsable catalog (for the Add screen's search).
export function buildCollection(): CollectionCard[] {
  return SEED_CARDS.map((c) => {
    const grade = gradeFor(c.id);
    return {
      id: c.id,
      category: c.category,
      tcg: tcgOf(c.category),
      title: cleanName(c.name),
      set: c.set,
      number: c.number,
      rarity: c.rarity || undefined,
      imageUrl: c.image,
      marketJpy: c.marketJpy,
      grade,
      gradeNum: gradeNum(grade),
      cert: certFor(c.id),
      dayPct: dayMove(c.id),
      alert: ALERTS.has(c.id),
    };
  }).sort((a, b) => b.marketJpy - a.marketJpy);
}

// The user's OWNED collection (from the persisted holdings store).
// Uses resolveCard so holdings that reference live-searched cards (not in the
// bundled seed) still render correctly after the userCatalog is hydrated.
export function buildCollectionFromHoldings(userHoldings: UserHolding[]): CollectionCard[] {
  return userHoldings
    .map((h): CollectionCard | null => {
      const c = resolveCard(h.catalogItemId);
      if (!c) return null;
      return {
        id: c.id,
        holdingId: h.id,
        category: c.category,
        tcg: tcgOf(c.category),
        title: cleanName(c.name),
        set: c.set,
        number: c.number,
        rarity: c.rarity || undefined,
        imageUrl: h.frontImageUrl ?? c.image,
        marketJpy: c.marketJpy,
        grade: h.grade,
        gradeNum: gradeNum(h.grade),
        cert: certFor(c.id),
        dayPct: dayMove(c.id),
        alert: ALERTS.has(c.id),
      };
    })
    .filter((x): x is CollectionCard => x != null)
    .sort((a, b) => b.marketJpy - a.marketJpy);
}

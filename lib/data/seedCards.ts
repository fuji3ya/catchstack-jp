// Verified Japan-market seed catalog. Every card here was cross-checked
// EXACTLY (TCGdex JP name+localId match) against a live 遊々亭 sell price —
// see generated/research/catchstack-jp-price-data-feasibility-2026-06-30.md.
// No synthesized/guessed prices. JP v1 ships Pokémon-only (no verified JP
// price source for MTG yet); category stays a union for forward compat.
export interface SeedCard {
  id: string; category: 'Pokemon' | 'MTG'; name: string; set: string;
  number: string; rarity: string; image: string; marketJpy: number;
  buyJpy?: number; // 遊々亭買取参考価格 (美品NM想定) — live refresh overrides
}

export const SEED_CARDS: SeedCard[] = [
  { id: "SV5K-088", category: "Pokemon", name: "ゲンガーex", set: "ワイルドフォース", number: "088", rarity: "", image: "https://assets.tcgdex.net/ja/SV/SV5K/088/high.png", marketJpy: 7980, buyJpy: 5600 },
  { id: "SV1V-102", category: "Pokemon", name: "ミライドンex", set: "バイオレットex", number: "102", rarity: "", image: "https://assets.tcgdex.net/ja/SV/SV1V/102/high.png", marketJpy: 6980, buyJpy: 3500 },
  { id: "SV1S-103", category: "Pokemon", name: "コライドンex", set: "スカーレットex", number: "103", rarity: "", image: "https://assets.tcgdex.net/ja/SV/SV1S/103/high.png", marketJpy: 6980, buyJpy: 3500 },
  { id: "SV5a-078", category: "Pokemon", name: "イーブイ", set: "クリムゾンヘイズ", number: "078", rarity: "", image: "https://assets.tcgdex.net/ja/SV/SV5a/078/high.png", marketJpy: 6980, buyJpy: 5000 },
  { id: "S12-109", category: "Pokemon", name: "ルギアV", set: "パラダイムトリガー", number: "109", rarity: "", image: "https://assets.tcgdex.net/ja/S/S12/109/high.png", marketJpy: 4980, buyJpy: 3000 },
  { id: "S12-079", category: "Pokemon", name: "ルギアV", set: "パラダイムトリガー", number: "079", rarity: "Double rare", image: "https://assets.tcgdex.net/ja/S/S12/079/high.png", marketJpy: 1980, buyJpy: 600 },
  { id: "SV1S-106", category: "Pokemon", name: "コライドンex", set: "スカーレットex", number: "106", rarity: "", image: "https://assets.tcgdex.net/ja/SV/SV1S/106/high.png", marketJpy: 1780, buyJpy: 900 },
  { id: "S12-080", category: "Pokemon", name: "ルギアVSTAR", set: "パラダイムトリガー", number: "080", rarity: "", image: "https://assets.tcgdex.net/ja/S/S12/080/high.png", marketJpy: 1480, buyJpy: 400 },
  { id: "S12a-013", category: "Pokemon", name: "リザードンV", set: "VSTARユニバース", number: "013", rarity: "Double rare", image: "https://assets.tcgdex.net/ja/S/S12a/013/high.png", marketJpy: 1280, buyJpy: 400 },
  { id: "S9-014", category: "Pokemon", name: "リザードンV", set: "スターバース", number: "014", rarity: "Double rare", image: "https://assets.tcgdex.net/ja/S/S9/014/high.png", marketJpy: 1280, buyJpy: 500 },
  { id: "SV1S-094", category: "Pokemon", name: "コライドンex", set: "スカーレットex", number: "094", rarity: "", image: "https://assets.tcgdex.net/ja/SV/SV1S/094/high.png", marketJpy: 980, buyJpy: 500 },
  { id: "SV2a-006", category: "Pokemon", name: "リザードンex", set: "ポケモンカード151", number: "006", rarity: "Double rare", image: "https://assets.tcgdex.net/ja/SV/SV2a/006/high.png", marketJpy: 780, buyJpy: 250 },
  { id: "S12a-050", category: "Pokemon", name: "ミュウツーV", set: "VSTARユニバース", number: "050", rarity: "Double rare", image: "https://assets.tcgdex.net/ja/S/S12a/050/high.png", marketJpy: 500, buyJpy: 100 },
  { id: "SV1V-094", category: "Pokemon", name: "ミライドンex", set: "バイオレットex", number: "094", rarity: "", image: "https://assets.tcgdex.net/ja/SV/SV1V/094/high.png", marketJpy: 580, buyJpy: 100 },
  { id: "SV2a-094", category: "Pokemon", name: "ゲンガー", set: "ポケモンカード151", number: "094", rarity: "Rare", image: "https://assets.tcgdex.net/ja/SV/SV2a/094/high.png", marketJpy: 580, buyJpy: 150 },
];

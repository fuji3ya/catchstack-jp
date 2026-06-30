// Unit tests for cardSearch.ts (JP: TCGdex JP + 遊々亭 worker) and
// userCatalog.ts / catalog.ts. Uses vitest with a mocked global fetch — no
// real network calls.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------- helpers --------------------------------------------------------

type FetchMock = ReturnType<typeof vi.fn>;

function makeFetch(responses: Map<string, unknown>): FetchMock {
  return vi.fn(async (url: string) => {
    let body: unknown = null;
    for (const [key, val] of responses) {
      if (url.includes(key)) { body = val; break; }
    }
    if (body === null) {
      return { ok: false, json: async () => ({}) };
    }
    return { ok: true, json: async () => body };
  });
}

// ---------- TCGdex JP + 遊々亭 mapping --------------------------------------

describe('searchCards — TCGdex JP + 遊々亭 mapping', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('maps name / localId / image and attaches the exact-match yuyu-tei sell price', async () => {
    const tcgdexData = [
      { id: 'SV2a-006', name: 'リザードンex', localId: '006', image: 'https://assets.tcgdex.net/ja/SV/SV2a/006' },
    ];
    const workerData = {
      cards: [
        { ver: 'sv2a', id: '10006', name: 'リザードンex', number: '006/165', sellJpy: 780, buyJpy: 250 },
      ],
    };
    const fetch = makeFetch(new Map<string, unknown>([
      ['api.tcgdex.net', tcgdexData],
      ['catchstack-jp.starving-effort.com', workerData],
    ]));
    vi.stubGlobal('fetch', fetch);

    const { searchCards } = await import('@/lib/data/cardSearch');
    const results = await searchCards('リザードン');

    expect(results).toHaveLength(1);
    const card = results[0];
    expect(card.id).toBe('SV2a-006');
    expect(card.category).toBe('Pokemon');
    expect(card.name).toBe('リザードンex');
    expect(card.number).toBe('006');
    expect(card.image).toBe('https://assets.tcgdex.net/ja/SV/SV2a/006/high.png');
    expect(card.marketJpy).toBe(780);
  });

  it('does not attach a price when name matches but number does not (precision)', async () => {
    const tcgdexData = [
      { id: 'SV2a-006', name: 'リザードンex', localId: '006', image: 'https://assets.tcgdex.net/ja/SV/SV2a/006' },
    ];
    // Same name, different printing/number — must NOT be treated as a match.
    const workerData = {
      cards: [
        { ver: 'sv4a', id: '10071', name: 'リザードンex', number: '071/165', sellJpy: 5000, buyJpy: 2000 },
      ],
    };
    const fetch = makeFetch(new Map<string, unknown>([
      ['api.tcgdex.net', tcgdexData],
      ['catchstack-jp.starving-effort.com', workerData],
    ]));
    vi.stubGlobal('fetch', fetch);

    const { searchCards } = await import('@/lib/data/cardSearch');
    const results = await searchCards('リザードン');
    expect(results[0].marketJpy).toBe(0);
  });

  it('strips leading zeros when matching number to localId', async () => {
    const tcgdexData = [
      { id: 'SVK-006', name: 'ミュウex', localId: '006', image: 'https://assets.tcgdex.net/ja/SV/SVK/006' },
    ];
    const workerData = {
      cards: [
        { ver: 'svk', id: '10006', name: 'ミュウex', number: '6/078', sellJpy: 120, buyJpy: 30 },
      ],
    };
    const fetch = makeFetch(new Map<string, unknown>([
      ['api.tcgdex.net', tcgdexData],
      ['catchstack-jp.starving-effort.com', workerData],
    ]));
    vi.stubGlobal('fetch', fetch);

    const { searchCards } = await import('@/lib/data/cardSearch');
    const results = await searchCards('ミュウ');
    expect(results[0].marketJpy).toBe(120);
  });
});

// ---------- edge cases -----------------------------------------------------

describe('searchCards — edge cases', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('returns [] for query shorter than 2 chars without calling fetch', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const { searchCards } = await import('@/lib/data/cardSearch');
    expect(await searchCards('')).toEqual([]);
    expect(await searchCards('a')).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns [] and does not throw when both providers fail', async () => {
    const fetch = vi.fn(async () => { throw new Error('Network error'); });
    vi.stubGlobal('fetch', fetch);
    const { searchCards } = await import('@/lib/data/cardSearch');
    await expect(searchCards('ピカチュウ')).resolves.toEqual([]);
  });

  it('returns TCGdex results (priced 0) when the price worker fails', async () => {
    const tcgdexData = [
      { id: 'SV2a-094', name: 'ゲンガー', localId: '094', image: 'https://assets.tcgdex.net/ja/SV/SV2a/094' },
    ];
    const fetch = vi.fn(async (url: string) => {
      if (url.includes('api.tcgdex.net')) return { ok: true, json: async () => tcgdexData };
      throw new Error('worker down');
    });
    vi.stubGlobal('fetch', fetch);
    const { searchCards } = await import('@/lib/data/cardSearch');
    const results = await searchCards('ゲンガー');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].category).toBe('Pokemon');
    expect(results[0].marketJpy).toBe(0);
  });

  it('filters out TCGdex entries with no image', async () => {
    const tcgdexData = [
      { id: 'no-image', name: 'Ghost Card', localId: '1' }, // no image field
      { id: 'has-image', name: 'Real Card', localId: '2', image: 'https://assets.tcgdex.net/ja/test/2' },
    ];
    const fetch = makeFetch(new Map<string, unknown>([
      ['api.tcgdex.net', tcgdexData],
      ['catchstack-jp.starving-effort.com', { cards: [] }],
    ]));
    vi.stubGlobal('fetch', fetch);
    const { searchCards } = await import('@/lib/data/cardSearch');
    const results = await searchCards('Real');
    expect(results.every((c) => c.image !== '')).toBe(true);
    expect(results.find((c) => c.id === 'no-image')).toBeUndefined();
  });
});

// ---------- userCatalog + resolveCard --------------------------------------

describe('userCatalog', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.doMock('@react-native-async-storage/async-storage', () => ({
      default: {
        getItem: vi.fn(async () => null),
        setItem: vi.fn(async () => {}),
      },
    }));
    vi.doMock('react', async (importOriginal) => {
      const actual = await importOriginal<typeof import('react')>();
      return { ...actual };
    });
  });
  afterEach(() => { vi.restoreAllMocks(); vi.resetModules(); });

  it('addUserCard then getUserCard resolves the added card', async () => {
    const { addUserCard, getUserCard } = await import('@/lib/data/userCatalog');
    const card = {
      id: 'SV9-099',
      category: 'Pokemon' as const,
      name: 'テストカード',
      set: 'テストセット',
      number: '099',
      rarity: 'rare',
      image: 'https://assets.tcgdex.net/ja/test/99/high.png',
      marketJpy: 999,
    };
    addUserCard(card);
    expect(getUserCard('SV9-099')).toEqual(card);
  });

  it('getUserCard returns undefined for unknown id', async () => {
    const { getUserCard } = await import('@/lib/data/userCatalog');
    expect(getUserCard('not-a-real-id')).toBeUndefined();
  });
});

describe('resolveCard', () => {
  beforeEach(() => { vi.resetModules(); });
  afterEach(() => { vi.restoreAllMocks(); vi.resetModules(); });

  it('prefers userCatalog over seed for the same id', async () => {
    vi.doMock('@react-native-async-storage/async-storage', () => ({
      default: { getItem: vi.fn(async () => null), setItem: vi.fn(async () => {}) },
    }));
    vi.doMock('react', async (importOriginal) => {
      const actual = await importOriginal<typeof import('react')>();
      return { ...actual };
    });

    const { addUserCard } = await import('@/lib/data/userCatalog');
    const { resolveCard } = await import('@/lib/data/catalog');

    const overrideCard = {
      id: 'SV5K-088', // an id that also exists in the JP seed catalog
      category: 'Pokemon' as const,
      name: '上書きカード',
      set: '上書きセット',
      number: '088',
      rarity: 'Rare',
      image: 'https://assets.tcgdex.net/ja/test/override/high.png',
      marketJpy: 1234,
    };
    addUserCard(overrideCard);
    const resolved = resolveCard('SV5K-088');
    expect(resolved?.name).toBe('上書きカード');
  });

  it('falls back to seed when id not in userCatalog', async () => {
    vi.doMock('@react-native-async-storage/async-storage', () => ({
      default: { getItem: vi.fn(async () => null), setItem: vi.fn(async () => {}) },
    }));
    vi.doMock('react', async (importOriginal) => {
      const actual = await importOriginal<typeof import('react')>();
      return { ...actual };
    });

    const { resolveCard } = await import('@/lib/data/catalog');
    const resolved = resolveCard('SV5K-088');
    expect(resolved).toBeDefined();
    expect(resolved?.name).toBe('ゲンガーex');
  });

  it('returns undefined for completely unknown id', async () => {
    vi.doMock('@react-native-async-storage/async-storage', () => ({
      default: { getItem: vi.fn(async () => null), setItem: vi.fn(async () => {}) },
    }));
    vi.doMock('react', async (importOriginal) => {
      const actual = await importOriginal<typeof import('react')>();
      return { ...actual };
    });
    const { resolveCard } = await import('@/lib/data/catalog');
    expect(resolveCard('totally-unknown-id')).toBeUndefined();
  });
});

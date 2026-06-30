import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { goBack } from '@/lib/ui/nav';
import Svg, { Path } from 'react-native-svg';
import { useTheme, useThemedStyles, type Theme } from '@/lib/design/theme';
import { useDataset } from '@/lib/state/useDataset';
import { catMeta } from '@/lib/design/cardPresentation';
import { fmtJPY } from '@/lib/format';

function money(v: number): string {
  return (v < 0 ? '-' : '') + fmtJPY(Math.abs(v));
}

export default function InsightsScreen() {
  const styles = useThemedStyles(makeStyles);
  const tokens = useTheme();
  const { view } = useDataset();

  const data = useMemo(() => {
    if (!view) return null;
    const rows = view.rows;
    const total = view.totalValue;
    const withChange = rows.filter((r) => r.dayChangePct != null);
    const best = [...withChange].sort((a, b) => (b.dayChangePct ?? 0) - (a.dayChangePct ?? 0))[0];
    const worst = [...withChange].sort((a, b) => (a.dayChangePct ?? 0) - (b.dayChangePct ?? 0))[0];

    const byCat: Record<string, { count: number; value: number }> = {};
    for (const r of rows) {
      const k = r.tcg ?? 'other';
      byCat[k] = byCat[k] || { count: 0, value: 0 };
      byCat[k].count += 1;
      byCat[k].value += r.median;
    }
    const cats = Object.entries(byCat).map(([k, v]) => ({ tcg: k, ...v, share: total > 0 ? (v.value / total) * 100 : 0 })).sort((a, b) => b.value - a.value);

    const top = [...rows].sort((a, b) => b.median - a.median)[0];
    const concentration = total > 0 && top ? (top.median / total) * 100 : 0;

    const conf = { high: 0, medium: 0, low: 0, unknown: 0 } as Record<string, number>;
    for (const r of rows) conf[r.confidenceLevel] = (conf[r.confidenceLevel] ?? 0) + 1;

    return { rows, total, pl: view.unrealizedPnl, plPct: view.costBasis > 0 ? (view.unrealizedPnl / view.costBasis) * 100 : 0, count: rows.length, best, worst, cats, top, concentration, conf };
  }, [view]);

  if (!data) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <View style={styles.navbar}><Text style={styles.navTitle}>ポートフォリオの状況</Text></View>
        <View style={styles.loading}><Text style={styles.loadingTxt}>読み込み中…</Text></View>
      </SafeAreaView>
    );
  }

  // Empty-collection state (no holdings yet) — avoid undefined access in renders.
  if (data.count === 0) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <View style={styles.navbar}>
          <TouchableOpacity style={styles.navbtn} onPress={() => goBack()} activeOpacity={0.7}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none"><Path d="M15 5l-7 7 7 7" stroke={tokens.color.textPrimary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>
          </TouchableOpacity>
          <Text style={styles.navTitle}>ポートフォリオの状況</Text>
          <View style={styles.navbtn} />
        </View>
        <View style={styles.loading}>
          <Text style={styles.loadingTxt}>カードを追加するとポートフォリオの状況が表示されます。</Text>
        </View>
      </SafeAreaView>
    );
  }

  const plUp = data.pl >= 0;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.navbar}>
        <TouchableOpacity style={styles.navbtn} onPress={() => goBack()} activeOpacity={0.7}>
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none"><Path d="M15 5l-7 7 7 7" stroke={tokens.color.textPrimary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>
        </TouchableOpacity>
        <Text style={styles.navTitle}>ポートフォリオの状況</Text>
        <View style={styles.navbtn} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* hero */}
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>含み損益</Text>
          <Text style={[styles.heroBig, { color: plUp ? tokens.color.gain : tokens.color.loss }]}>{(plUp ? '+' : '') + money(data.pl)}</Text>
          <View style={styles.heroRow}>
            <View style={[styles.plPill, { backgroundColor: plUp ? tokens.color.gainBg : tokens.color.lossBg }]}>
              <Text style={[styles.plPillTxt, { color: plUp ? tokens.color.gain : tokens.color.loss }]}>取得価格比 {(plUp ? '+' : '') + data.plPct.toFixed(1)}%</Text>
            </View>
            <Text style={styles.heroMeta}>{data.count}枚 · {money(data.total)}</Text>
          </View>
        </View>

        {/* best / worst */}
        <Text style={styles.secTitle}>本日の値動き</Text>
        <View style={styles.row2}>
          {data.best && (
            <View style={styles.moverCard}>
              <Text style={[styles.moverTag, { color: tokens.color.gain }]}>値上がり</Text>
              <Text style={styles.moverName} numberOfLines={1}>{data.best.title}</Text>
              <Text style={[styles.moverPct, { color: tokens.color.gain }]}>{(data.best.dayChangePct! >= 0 ? '+' : '') + data.best.dayChangePct!.toFixed(2)}%</Text>
            </View>
          )}
          {data.worst && (
            <View style={styles.moverCard}>
              <Text style={[styles.moverTag, { color: tokens.color.loss }]}>値下がり</Text>
              <Text style={styles.moverName} numberOfLines={1}>{data.worst.title}</Text>
              <Text style={[styles.moverPct, { color: data.worst.dayChangePct! >= 0 ? tokens.color.gain : tokens.color.loss }]}>{(data.worst.dayChangePct! >= 0 ? '+' : '') + data.worst.dayChangePct!.toFixed(2)}%</Text>
            </View>
          )}
        </View>

        {/* diversification */}
        <Text style={styles.secTitle}>カードゲーム構成</Text>
        <View style={styles.card}>
          {data.cats.map((c, i) => {
            const m = catMeta(c.tcg);
            return (
              <View key={c.tcg} style={[styles.divRow, i > 0 && styles.divSep]}>
                <View style={[styles.dot, { backgroundColor: m.dot }]} />
                <Text style={styles.divName}>{m.tag}</Text>
                <Text style={styles.divCount}>{c.count}枚</Text>
                <View style={styles.barTrack}><View style={[styles.barFill, { width: `${Math.max(4, c.share)}%`, backgroundColor: m.dot }]} /></View>
                <Text style={styles.divShare}>{c.share.toFixed(0)}%</Text>
              </View>
            );
          })}
        </View>

        {/* concentration */}
        <Text style={styles.secTitle}>集中度</Text>
        <View style={styles.card}>
          <View style={styles.concRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.concLabel}>最大保有カード</Text>
              <Text style={styles.concName}>{data.top?.title}</Text>
            </View>
            <Text style={styles.concPct}>{data.concentration.toFixed(0)}%</Text>
          </View>
          <Text style={styles.concNote}>
            {data.concentration >= 40
              ? '評価額の大部分が1枚のカードに集中しています — 集中リスクが高い状態です。'
              : '評価額は保有カード全体に適度に分散されています。'}
          </Text>
        </View>

        {/* confidence */}
        <Text style={styles.secTitle}>価格の信頼度</Text>
        <View style={styles.card}>
          <View style={styles.confRow}>
            {([['high', tokens.color.gain, '高'], ['medium', tokens.color.gold, '中'], ['low', tokens.color.loss, '低'], ['unknown', tokens.color.textTertiary, '不明']] as const).map(([k, color, label]) => (
              <View key={k} style={styles.confCell}>
                <Text style={[styles.confNum, { color }]}>{data.conf[k] ?? 0}</Text>
                <Text style={styles.confLabel}>{label}</Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={styles.disclaim}>インサイトは公開されている参考価格に基づく情報であり、投資助言ではありません。</Text>
        <View style={{ height: tokens.space.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (tokens: Theme) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.color.bg },
  navbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 8, paddingBottom: 8 },
  navbtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  navTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '600', letterSpacing: -0.3, color: tokens.color.textPrimary },
  content: { paddingBottom: 24, maxWidth: 440, width: '100%', alignSelf: 'center' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingTxt: { color: tokens.color.textSecondary },

  hero: { paddingHorizontal: 24, paddingTop: 8 },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', color: tokens.color.textTertiary },
  heroBig: { fontSize: 40, fontWeight: '700', letterSpacing: -1.2, marginTop: 8 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  plPill: { paddingVertical: 6, paddingHorizontal: 11, borderRadius: 999 },
  plPillTxt: { fontSize: 13, fontWeight: '600' },
  heroMeta: { fontSize: 13, color: tokens.color.textTertiary },

  secTitle: { fontSize: 19, fontWeight: '600', letterSpacing: -0.4, color: tokens.color.textPrimary, paddingHorizontal: 24, paddingTop: 28, paddingBottom: 12 },
  card: { marginHorizontal: 24, backgroundColor: tokens.color.surface, borderRadius: 18, padding: 16, ...tokens.shadow.card },
  row2: { flexDirection: 'row', gap: 12, paddingHorizontal: 24 },
  moverCard: { flex: 1, backgroundColor: tokens.color.surface, borderRadius: 16, padding: 14, ...tokens.shadow.card },
  moverTag: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.5 },
  moverName: { fontSize: 15, fontWeight: '600', letterSpacing: -0.3, color: tokens.color.textPrimary, marginTop: 8 },
  moverPct: { fontSize: 16, fontWeight: '700', marginTop: 4 },

  divRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 10 },
  divSep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tokens.color.border },
  dot: { width: 9, height: 9, borderRadius: 4.5 },
  divName: { fontSize: 14, fontWeight: '700', color: tokens.color.textPrimary, width: 48 },
  divCount: { fontSize: 12.5, color: tokens.color.textTertiary, width: 58 },
  barTrack: { flex: 1, height: 7, borderRadius: 4, backgroundColor: tokens.color.surfaceSunken, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  divShare: { fontSize: 13, fontWeight: '600', color: tokens.color.textSecondary, width: 36, textAlign: 'right' },

  concRow: { flexDirection: 'row', alignItems: 'center' },
  concLabel: { fontSize: 12, color: tokens.color.textTertiary },
  concName: { fontSize: 16, fontWeight: '700', letterSpacing: -0.3, color: tokens.color.textPrimary, marginTop: 3 },
  concPct: { fontSize: 26, fontWeight: '700', letterSpacing: -0.8, color: tokens.color.textPrimary },
  concNote: { fontSize: 12.5, lineHeight: 18, color: tokens.color.textTertiary, marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tokens.color.border },

  confRow: { flexDirection: 'row' },
  confCell: { flex: 1, alignItems: 'center' },
  confNum: { fontSize: 24, fontWeight: '700', letterSpacing: -0.5 },
  confLabel: { fontSize: 11.5, color: tokens.color.textTertiary, marginTop: 4 },

  disclaim: { paddingHorizontal: 24, paddingTop: 24, fontSize: 11, lineHeight: 16, color: tokens.color.textTertiary },
});

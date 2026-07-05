import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { goBack } from '@/lib/ui/nav';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { useTheme, useThemedStyles, type Theme } from '@/lib/design/theme';
import { useDataset } from '@/lib/state/useDataset';
import { removeHolding } from '@/lib/state/holdingsStore';
import { GradeBadge } from '@/components/GradeBadge';
import { PortfolioChart } from '@/components/PortfolioChart';
import { certFor } from '@/lib/design/cardPresentation';
import { windowChange } from '@/lib/pricing/calc';
import { FEATURES } from '@/lib/features';
import { fmtJPY } from '@/lib/format';

function money(v: number | undefined): string {
  if (v == null) return '—';
  return fmtJPY(v);
}

function formatDate(iso?: string): string {
  if (!iso) return '未設定';
  const d = new Date(iso.length === 10 ? iso + 'T00:00:00Z' : iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

// Relative-time label for the live-price fetch timestamp.
function formatFetchedAt(ms: number | null): string {
  if (!ms) return '参考データ';
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return 'たった今';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}分前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}時間前`;
  const d = Math.floor(h / 24);
  return `${d}日前`;
}

function Signal({ icon, color, bg, label, children }: { icon: any; color: string; bg: string; label: string; children: React.ReactNode }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.signalRow}>
      <View style={[styles.signalIcon, { backgroundColor: bg }]}><Ionicons name={icon} size={16} color={color} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.signalLabel}>{label}</Text>
        <Text style={styles.signalText}>{children}</Text>
      </View>
    </View>
  );
}

function Cell({ k, v, small }: { k: string; v: string; small?: boolean }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.cell}>
      <Text style={styles.cellK}>{k}</Text>
      <Text style={[styles.cellV, small && styles.cellVSmall]}>{v}</Text>
    </View>
  );
}

export default function HoldingDetailScreen() {
  const styles = useThemedStyles(makeStyles);
  const tokens = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const { byHolding, buyPrices, pricesFetchedAt } = useDataset();
  const row = typeof id === 'string' ? byHolding[id] : undefined;

  const screenW = Math.min(width, 440);

  if (!row) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <TouchableOpacity style={styles.navbar} onPress={() => goBack()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={tokens.color.textPrimary} />
        </TouchableOpacity>
        <View style={styles.unavailable}>
          <Ionicons name="card-outline" size={28} color={tokens.color.textTertiary} />
          <Text style={styles.unavailableT}>カードが見つかりません</Text>
          <Text style={styles.unavailableS}>このカードはまだコレクションに登録されていません。追加タブから登録できます。</Text>
        </View>
      </SafeAreaView>
    );
  }

  const cert = certFor(row.catalogItemId);
  const dayPct = row.dayChangePct ?? 0;
  const dayUsd = row.median * (dayPct / 100);
  const up = dayUsd >= 0;
  const dayColor = up ? tokens.color.gain : tokens.color.loss;

  const highs = row.history.map((p) => p.median);
  const high90 = Math.max(...highs);
  const low90 = Math.min(...highs);
  const pctBelowHigh = high90 > 0 ? ((high90 - row.median) / high90) * 100 : 0;
  const mom30 = windowChange(row.history, 30).pct ?? windowChange(row.history, row.history.length - 1).pct ?? 0;
  const vsCost = row.cost ? ((row.median - row.cost) / row.cost) * 100 : null;
  const pl = row.cost != null ? row.median - row.cost : null;
  const dataPoints = Math.min(row.history.length, 30);
  const confLabel = row.confidenceLevel.charAt(0).toUpperCase() + row.confidenceLevel.slice(1);

  // 買取参考価格 (store bid, NM想定) + 販売との差 — the "if I sold today"
  // number and how far below the ask it sits.
  const buyJpy = buyPrices[row.catalogItemId];
  const spreadPct = buyJpy != null && row.median > 0 ? ((row.median - buyJpy) / row.median) * 100 : null;

  const heroSlabW = Math.min(220, screenW * 0.58);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {/* nav bar */}
      <View style={styles.navbar}>
        <TouchableOpacity style={styles.navbtn} onPress={() => goBack()} activeOpacity={0.7}>
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none"><Path d="M15 5l-7 7 7 7" stroke={tokens.color.textPrimary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>
        </TouchableOpacity>
        <Text style={styles.navTitle} numberOfLines={1}>{row.title}</Text>
        <View style={styles.navbtn} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* HERO — slab or bare card */}
        <View style={styles.hero}>
          {FEATURES.SHOW_SLAB_UI ? (
            <LinearGradient colors={['#FFFFFF', '#F6F6F4', '#ECECEA']} locations={[0, 0.52, 1]} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={[styles.slab, { width: heroSlabW }]}>
              {FEATURES.SHOW_GRADES ? (
                <View style={styles.label}>
                  <GradeBadge grade={row.grade} size={36} />
                  <View style={styles.ltxt}>
                    <Text style={styles.gradeName} numberOfLines={1}>{row.grade}</Text>
                    <Text style={styles.cardName} numberOfLines={1}>{row.title}</Text>
                    <Text style={styles.cert} numberOfLines={1}>CERT {cert}</Text>
                  </View>
                </View>
              ) : null}
              <View style={styles.window}>
                {row.imageUrl ? <Image source={{ uri: row.imageUrl }} style={styles.windowImg} contentFit="cover" contentPosition="top" transition={150} /> : null}
              </View>
            </LinearGradient>
          ) : (
            <View style={[styles.bareHero, { width: heroSlabW }]}>
              {row.imageUrl ? <Image source={{ uri: row.imageUrl }} style={styles.bareHeroImg} contentFit="cover" contentPosition="top" transition={150} /> : null}
            </View>
          )}
          <View style={styles.refImage}>
            <Ionicons name="camera-outline" size={13} color={tokens.color.textTertiary} />
            <Text style={styles.refImageTxt}>{row.imageUrl?.startsWith('file:') || row.imageUrl?.startsWith('blob:') || row.imageUrl?.startsWith('data:') ? '自分の写真' : '参考画像 · 編集から自分の写真に変更できます'}</Text>
          </View>
        </View>

        {/* title block */}
        <View style={styles.titleblock}>
          <Text style={styles.cn}>{row.title}</Text>
          <Text style={styles.meta}>{row.setName}</Text>
          {FEATURES.SHOW_GRADES ? (
            <View style={styles.gradeRow}>
              <View style={styles.gradeChip}>
                <View style={styles.gcDot} />
                <Text style={styles.gcTxt}>{row.grade}</Text>
              </View>
              <Text style={styles.gradeRowCert}>CERT {cert}</Text>
            </View>
          ) : null}
        </View>

        {/* value block */}
        <View style={styles.valueblock}>
          <Text style={styles.vlabel}>参考販売価格</Text>
          <Text style={styles.vbig}>{money(row.median)}</Text>
          <View style={styles.vrow}>
            <View style={[styles.daypill, { backgroundColor: up ? tokens.color.gainBg : tokens.color.lossBg }]}>
              <Text style={[styles.dayArrow, { color: dayColor }]}>{up ? '▲' : '▼'}</Text>
              <Text style={[styles.dayChg, { color: dayColor }]}>{(up ? '+' : '-') + money(Math.abs(dayUsd))} · {(up ? '+' : '') + dayPct.toFixed(2)}%</Text>
            </View>
            <Text style={styles.period}>本日</Text>
          </View>
          {buyJpy != null && (
            <View style={styles.buyBand}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.buyBandK}>今日売ったら（買取参考）</Text>
                <Text style={styles.buyBandNote}>
                  美品(NM)想定 · 遊々亭買取価格
                  {spreadPct != null ? ` · 販売価格との差 -${spreadPct.toFixed(0)}%` : ''}
                </Text>
              </View>
              <Text style={styles.buyBandV}>{money(buyJpy)}</Text>
            </View>
          )}
          <Text style={styles.vsrc}>参考販売価格 · 未鑑定 · 遊々亭(yuyu-tei.jp)の公開価格。現在価格のみライブ取得 — 履歴グラフの形状はイメージです。</Text>
        </View>

        {/* chart */}
        <View style={styles.chartHolder}>
          <PortfolioChart total={row.median} width={screenW - 48 - 32} history={row.history} />
        </View>

        {/* signals */}
        <Text style={styles.secTitle}>シグナル</Text>
        <View style={styles.card}>
          <Signal icon="trending-up" color={tokens.color.gain} bg={tokens.color.gainBg} label="90日高値に接近">
            90日高値（{money(high90)}）まで<Text style={styles.strong}>{pctBelowHigh.toFixed(0)}%</Text>。
          </Signal>
          <View style={styles.signalSep} />
          <Signal icon="arrow-forward" color="rgba(59,130,246,0.95)" bg="rgba(59,130,246,0.1)" label="モメンタム">
            過去30日間で<Text style={styles.strong}>{Math.abs(mom30).toFixed(1)}%</Text>{mom30 >= 0 ? '上昇' : '下落'}。
          </Signal>
          {vsCost != null && (
            <>
              <View style={styles.signalSep} />
              <Signal icon="cash-outline" color={tokens.color.goldDeep} bg={tokens.color.goldSoft} label="取得価格との比較">
                取得価格より<Text style={styles.strong}>{Math.abs(vsCost).toFixed(1)}%</Text>{vsCost >= 0 ? '高い' : '安い'}。
              </Signal>
            </>
          )}
          <View style={styles.signalSep} />
          <Signal icon="information-circle-outline" color={tokens.color.textTertiary} bg={tokens.color.surfaceSunken} label="信頼度">
            直近<Text style={styles.strong}>{dataPoints}</Text>件のデータに基づく — 信頼度{row.confidenceLevel}。
          </Signal>
          <Text style={styles.signalsDisclaimer}>シグナルは公開市場データに基づく参考情報であり、投資助言ではありません。</Text>
        </View>

        {/* price basis */}
        <Text style={styles.secTitle}>価格の根拠</Text>
        <View style={styles.card}>
          <View style={styles.grid2}>
            <Cell k="中央値" v={money(row.median)} />
            <Cell k="レンジ" v={`${money(low90)} – ${money(high90)}`} small />
            <Cell k="30日間のデータ数" v={String(dataPoints)} />
            <Cell k="更新" v={formatFetchedAt(pricesFetchedAt)} small />
            <View style={styles.cell}>
              <Text style={styles.cellK}>信頼度</Text>
              <View style={styles.confChip}><View style={styles.confDot} /><Text style={styles.confTxt}>{confLabel}</Text></View>
            </View>
            <Cell k="出典" v="遊々亭" small />
          </View>
          <Text style={styles.basisNote}>直近の販売価格から算出した参考値です。価格を保証するものではありません。</Text>
        </View>

        {/* your holding */}
        <Text style={styles.secTitle}>所有情報</Text>
        <View style={styles.card}>
          <View style={styles.grid2}>
            <Cell k="取得価格" v={money(row.cost)} />
            <Cell k="取得日" v={formatDate(row.acquisitionDate)} small />
            <Cell k="保管場所" v={row.storage || '未設定'} small />
            <Cell k="数量" v="1" />
          </View>
          {row.notes ? (
            <View style={styles.notesBlock}>
              <Text style={styles.cellK}>メモ</Text>
              <Text style={styles.notesText}>{row.notes}</Text>
            </View>
          ) : null}
          {pl != null && (
            <View style={styles.plband}>
              <Text style={styles.plK}>含み損益</Text>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.plV, { color: pl >= 0 ? tokens.color.gain : tokens.color.loss }]}>{(pl >= 0 ? '+' : '-') + money(Math.abs(pl))}</Text>
                {vsCost != null && <Text style={[styles.plPct, { color: pl >= 0 ? tokens.color.gain : tokens.color.loss }]}>{(vsCost >= 0 ? '+' : '') + vsCost.toFixed(1)}%</Text>}
              </View>
            </View>
          )}
        </View>

        {/* actions */}
        <View style={styles.actions}>
          <TouchableOpacity style={[styles.btn, styles.btnPrimary]} activeOpacity={0.9} onPress={() => router.push({ pathname: '/alerts', params: { card: row.catalogItemId } })} accessibilityRole="button" accessibilityLabel={`${row.title}の価格アラートを設定`}>
            <Ionicons name="notifications-outline" size={18} color="#fff" />
            <Text style={styles.btnPrimaryTxt}>価格アラートを設定</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.btnGhost]} activeOpacity={0.7} onPress={() => router.push({ pathname: '/add', params: { edit: row.holdingId } })} accessibilityRole="button" accessibilityLabel={`${row.title}を編集`}>
            <Ionicons name="create-outline" size={18} color={tokens.color.textSecondary} />
            <Text style={styles.btnGhostTxt}>編集する</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.removeBtn} activeOpacity={0.7} onPress={() => {
            removeHolding(row.holdingId);
            // goBack() handles the deep-link case (no back stack → Collection).
            goBack();
          }} accessibilityRole="button" accessibilityLabel={`${row.title}をコレクションから削除`}>
            <Ionicons name="trash-outline" size={16} color={tokens.color.loss} />
            <Text style={styles.removeTxt}>コレクションから削除</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.disclaim}>本アプリは任天堂株式会社・株式会社ポケモン・Wizards of the Coast・PSA・TCGplayer・遊々亭とは提携していません。</Text>
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

  unavailable: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 },
  unavailableT: { fontSize: 17, fontWeight: '700', color: tokens.color.textPrimary },
  unavailableS: { fontSize: 14, color: tokens.color.textSecondary, textAlign: 'center', lineHeight: 20 },

  hero: { alignItems: 'center', paddingTop: 8, paddingBottom: 4 },
  slab: { borderRadius: 16, padding: 8, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.8)', shadowColor: '#1C1C1E', shadowOpacity: 0.22, shadowRadius: 26, shadowOffset: { width: 0, height: 16 }, elevation: 6 },
  bareHero: {
    aspectRatio: 3 / 4.05,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#EEF2F8',
    shadowColor: '#1C1C1E',
    shadowOpacity: 0.22,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 16 },
    elevation: 6,
  },
  bareHeroImg: { width: '100%', height: '100%' },
  label: { backgroundColor: '#FFFFFF', borderRadius: 9, paddingVertical: 9, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 1, shadowOffset: { width: 0, height: 1 } },
  ltxt: { flex: 1, minWidth: 0, gap: 3 },
  // Slab label sits on a forced-light surface (white→#ECECEA gradient), so its
  // text must stay dark even when the app theme is dark.
  gradeName: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4, color: '#6E6E73', textTransform: 'uppercase' },
  cardName: { fontSize: 13, fontWeight: '600', letterSpacing: -0.2, color: '#1C1C1E' },
  cert: { fontSize: 11, fontWeight: '500', letterSpacing: 0.3, color: '#A1A1A6' },
  window: { marginTop: 7, borderRadius: 9, overflow: 'hidden', aspectRatio: 3 / 4.05, backgroundColor: '#EEF2F8' },
  windowImg: { width: '100%', height: '100%' },
  refImage: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14 },
  refImageTxt: { fontSize: 11.5, fontWeight: '500', color: tokens.color.textTertiary, letterSpacing: -0.05 },

  titleblock: { paddingHorizontal: 24, paddingTop: 22 },
  cn: { fontSize: 24, fontWeight: '700', letterSpacing: -0.6, color: tokens.color.textPrimary },
  meta: { fontSize: 14, color: tokens.color.textSecondary, marginTop: 5 },
  gradeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 11 },
  gradeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: tokens.color.goldSoft, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999 },
  gcDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: tokens.color.gold },
  gcTxt: { fontSize: 12, fontWeight: '700', letterSpacing: 0.4, color: tokens.color.goldDeep, textTransform: 'uppercase' },
  gradeRowCert: { fontSize: 12, fontWeight: '500', letterSpacing: 0.3, color: tokens.color.textTertiary },

  valueblock: { paddingHorizontal: 24, paddingTop: 24 },
  vlabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', color: tokens.color.textTertiary },
  vbig: { fontSize: 40, fontWeight: '700', letterSpacing: -1.2, color: tokens.color.textPrimary, marginTop: 8 },
  vrow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  daypill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 11, borderRadius: 999 },
  dayArrow: { fontSize: 10 },
  dayChg: { fontSize: 13.5, fontWeight: '600', letterSpacing: -0.1 },
  period: { fontSize: 13, color: tokens.color.textTertiary, fontWeight: '500' },
  vsrc: { fontSize: 12, color: tokens.color.textTertiary, marginTop: 12 },
  buyBand: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    marginTop: 14, paddingVertical: 12, paddingHorizontal: 14,
    backgroundColor: tokens.color.goldSoft, borderRadius: 12,
  },
  buyBandK: { fontSize: 12.5, fontWeight: '700', letterSpacing: -0.1, color: tokens.color.goldDeep },
  buyBandNote: { fontSize: 10.5, fontWeight: '500', color: tokens.color.textTertiary, marginTop: 3 },
  buyBandV: { fontSize: 19, fontWeight: '700', letterSpacing: -0.5, color: tokens.color.goldDeep },

  chartHolder: { paddingHorizontal: 24, marginTop: 22 },

  secTitle: { fontSize: 19, fontWeight: '600', letterSpacing: -0.4, color: tokens.color.textPrimary, paddingHorizontal: 24, paddingTop: 30, paddingBottom: 14 },
  card: { marginHorizontal: 24, backgroundColor: tokens.color.surface, borderRadius: 18, padding: 16, ...tokens.shadow.card },

  signalRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 4 },
  signalIcon: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  signalLabel: { fontSize: 14.5, fontWeight: '600', letterSpacing: -0.2, color: tokens.color.textPrimary },
  signalText: { fontSize: 13, color: tokens.color.textSecondary, lineHeight: 19, marginTop: 2 },
  strong: { fontWeight: '700', color: tokens.color.textPrimary },
  signalSep: { height: StyleSheet.hairlineWidth, backgroundColor: tokens.color.border, marginVertical: 10, marginLeft: 44 },
  signalsDisclaimer: { fontSize: 11, color: tokens.color.textTertiary, lineHeight: 16, marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tokens.color.border },

  grid2: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '50%', paddingVertical: 9 },
  cellK: { fontSize: 12, color: tokens.color.textTertiary, letterSpacing: 0.1 },
  cellV: { fontSize: 17, fontWeight: '700', letterSpacing: -0.4, color: tokens.color.textPrimary, marginTop: 4 },
  cellVSmall: { fontSize: 14, fontWeight: '600' },
  confChip: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', marginTop: 5, backgroundColor: tokens.color.gainBg, paddingVertical: 3, paddingHorizontal: 9, borderRadius: 999 },
  confDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: tokens.color.gain },
  confTxt: { fontSize: 12, fontWeight: '600', color: tokens.color.gain },
  basisNote: { fontSize: 11, color: tokens.color.textTertiary, lineHeight: 16, marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tokens.color.border },

  notesBlock: { marginTop: 12, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tokens.color.border, gap: 5 },
  notesText: { fontSize: 14.5, lineHeight: 21, color: tokens.color.textPrimary },
  plband: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tokens.color.border },
  plK: { fontSize: 13.5, fontWeight: '600', color: tokens.color.textSecondary },
  plV: { fontSize: 18, fontWeight: '700', letterSpacing: -0.4 },
  plPct: { fontSize: 12.5, fontWeight: '600', marginTop: 2 },

  actions: { paddingHorizontal: 24, paddingTop: 22, gap: 10 },
  btn: { flexDirection: 'row', width: '100%', paddingVertical: 14, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 9 },
  btnPrimary: { backgroundColor: '#1C1C1E' },
  btnPrimaryTxt: { color: '#fff', fontSize: 15.5, fontWeight: '600', letterSpacing: -0.2 },
  btnGhost: { backgroundColor: tokens.color.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: tokens.color.border },
  btnGhostTxt: { color: tokens.color.textSecondary, fontSize: 15, fontWeight: '500' },
  removeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 12, marginTop: 2 },
  removeTxt: { color: tokens.color.loss, fontSize: 14, fontWeight: '500' },
  disclaim: { paddingHorizontal: 24, paddingTop: 14, fontSize: 10.5, lineHeight: 16, color: tokens.color.textTertiary, textAlign: 'center' },
});

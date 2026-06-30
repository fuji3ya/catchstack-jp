import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { goBack } from '@/lib/ui/nav';
import Svg, { Path } from 'react-native-svg';
import { useTheme, useThemedStyles, type Theme } from '@/lib/design/theme';

interface Section {
  h?: string;
  p: string;
}
interface Topic {
  title: string;
  updated?: string;
  sections: Section[];
}

// Content mirrors the canonical legal site (apps/catchstack-jp/legal/) — same
// real facts: starving-effort / support@starving-effort.com, accurate to
// Catchstack JPの実際の挙動（遊々亭・TCGdex JPの公開未鑑定参考価格）。
const SUPPORT = 'support@starving-effort.com';

const TOPICS: Record<string, Topic> = {
  disclaimer: {
    title: '免責事項',
    sections: [
      { p: 'Catchstackに表示される価格は、遊々亭(yuyu-tei.jp)・TCGdex JPから取得した公開・未鑑定の参考価格です。あくまで参考情報であり、鑑定評価・買取保証・価格保証ではありません。' },
      { h: '未鑑定の参考価格です', p: '本アプリの価格は遊々亭・TCGdex JPの公開・未鑑定の参考価格です。鑑定（PSA / BGS / CGC等）後の市場価値を反映するものではありません。鑑定済みカードの価格対応は、利用可能なデータソースが整い次第の検討事項です。' },
      { h: '投資助言ではありません', p: 'シグナル（モメンタム・高値接近・取得価格比など）は公開市場データに基づき算出された情報提供のみを目的としたものです。Catchstack内のいかなる情報も投資・金融に関する助言ではありません。' },
      { h: '提携関係について', p: 'Catchstackは任天堂株式会社・株式会社ポケモン・Wizards of the Coast・PSA・TCGplayer・遊々亭のいずれとも提携・公認・後援関係にありません。すべての商品名・商標は各権利者に帰属します。' },
    ],
  },
  about: {
    title: 'このアプリについて',
    sections: [
      { p: 'Catchstackは、あなたのトレーディングカードコレクションを記録するための個人用アプリです。所有カードを記録し、参考価格の推移を見守り、整理されたエクスポート可能な台帳として管理できます。' },
      { h: 'ローカルファースト', p: 'コレクションデータは端末内に保存されます。Catchstackはオフラインでも動作し、ネットワーク接続時に参考価格を更新します。' },
      { h: '価格データの出典', p: '参考価格は遊々亭(yuyu-tei.jp)の公開販売価格と、TCGdex JPのカードカタログ情報に基づいています。価格は公開されている未鑑定の参考相場であり、鑑定評価ではありません。' },
      { h: 'カード画像について', p: 'カード画像はTCGdex JPから参考画像として取得しています。ご自身で撮影した写真に差し替えることもでき、その写真は端末内にのみ保存されます。' },
      { p: `© 2026 starving-effort. お問い合わせ: ${SUPPORT}` },
    ],
  },
  privacy: {
    title: 'プライバシーポリシー',
    sections: [
      { p: '概要：アカウント登録不要、トラッキングなし、広告なし。コレクションデータは端末内にのみ保存されます。本アプリは遊々亭・TCGdex JPから公開カード価格・画像を取得します。' },
      { h: '収集する情報', p: '個人情報は一切収集しません。Catchstackにはアカウント機能もユーザーデータベースもありません — 氏名・メールアドレス・電話番号・位置情報は取得せず、解析・広告ID・トラッキングも行いません。' },
      { h: 'データの保存場所', p: '所有カード・鑑定情報・取得価格・保管場所・メモ・アラート・登録した写真など、コレクションデータは端末のローカルストレージにのみ保存されます。外部に送信されることはなく、運営者が閲覧することもありません。' },
      { h: 'カード画像取得時の通信', p: 'カード画像を表示するため、CatchstackはTCGdex JPと遊々亭(yuyu-tei.jp)の価格情報配信用サーバー（catchstack-jp.starving-effort.com経由）に公開カード情報を要求します。この通信には必要な公開カード識別子のみが含まれ、お客様の氏名・コレクション内容・個人情報は一切含まれません。これらの提供元は、各社のプライバシーポリシーに基づきIPアドレス等の標準的な技術情報を受け取る場合があります。' },
      { h: 'カメラと写真', p: 'カードの写真を選択した場合、その写真は端末内にそのカードの画像として保存されます。写真が運営者や第三者にアップロードされることはありません。' },
      { h: '購入について', p: 'Pro機能（任意）の決済はApp Storeを通じてApple社が処理します。お客様の氏名や決済情報を運営者が取得することはありません。' },
      { h: 'データの管理', p: 'すべてのデータは端末内にのみ保存されるため、アプリを削除するとすべてのデータが端末から削除されます。' },
      { h: 'お問い合わせ', p: SUPPORT },
    ],
  },
  terms: {
    title: '利用規約',
    sections: [
      { h: '同意', p: 'Catchstack（以下「本アプリ」）をダウンロードまたは利用することにより、本規約に同意したものとみなします。同意いただけない場合は本アプリをご利用いただけません。' },
      { h: '本アプリについて', p: '本アプリはトレーディングカードコレクションを記録するための個人用ツールです。参考価格は遊々亭・TCGdex JPから取得した公開・未鑑定の市場情報を「現状有姿」で提供するものであり、鑑定評価・買取保証・価格保証ではありません。' },
      { h: '投資助言ではありません', p: 'シグナルおよび価格情報は公開市場データに基づき算出された情報提供のみを目的としたものです。本アプリ内のいかなる情報も金融・投資・取引に関する助言ではありません。' },
      { h: '購入について', p: 'Pro機能（任意のサブスクリプション）はApp Storeを通じて提供される場合があります。決済はAppleが処理し、サブスクリプションは解約されるまで自動更新されます。管理はApple IDの設定から行えます。Appleの標準利用許諾契約が適用されます。' },
      { h: '第三者コンテンツ・商標について', p: 'カードデータおよび画像はTCGdex JPおよび遊々亭(yuyu-tei.jp)から提供されています。すべての商品名・カード画像・商標は各権利者に帰属します。Catchstackは任天堂株式会社・株式会社ポケモン・Wizards of the Coast・PSA・TCGplayerのいずれとも提携関係にありません。' },
      { h: '免責・責任制限', p: '本アプリはいかなる保証もなく提供されます。法律で許容される最大限の範囲において、本アプリの利用に起因する損害について運営者は責任を負いません。' },
      { h: 'お問い合わせ', p: SUPPORT },
    ],
  },
  contact: {
    title: 'お問い合わせ',
    sections: [
      { p: 'ご質問・ご意見・データの訂正依頼など、お気軽にお問い合わせください。' },
      { h: 'サポート', p: SUPPORT },
      { h: '返信について', p: '数営業日以内の返信を心がけています。' },
    ],
  },
};

export default function InfoScreen() {
  const styles = useThemedStyles(makeStyles);
  const tokens = useTheme();
  const { topic } = useLocalSearchParams<{ topic: string }>();
  const data = (topic && TOPICS[topic]) || TOPICS.about;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.navbar}>
        <TouchableOpacity style={styles.navbtn} onPress={() => goBack()} activeOpacity={0.7}>
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none"><Path d="M15 5l-7 7 7 7" stroke={tokens.color.textPrimary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>
        </TouchableOpacity>
        <Text style={styles.navTitle} numberOfLines={1}>{data.title}</Text>
        <View style={styles.navbtn} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.h1}>{data.title}</Text>
        {data.sections.map((s, i) => (
          <View key={i} style={styles.section}>
            {s.h ? <Text style={styles.h2}>{s.h}</Text> : null}
            <Text style={styles.body}>{s.p}</Text>
          </View>
        ))}
        <Text style={styles.foot}>Catchstack 1.0.0</Text>
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
  content: { paddingHorizontal: 24, paddingBottom: 24, maxWidth: 440, width: '100%', alignSelf: 'center' },
  h1: { fontSize: 28, fontWeight: '700', letterSpacing: -0.8, color: tokens.color.textPrimary, paddingTop: 8, paddingBottom: 8 },
  section: { paddingTop: 18 },
  h2: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2, color: tokens.color.textPrimary, paddingBottom: 6 },
  body: { fontSize: 14.5, lineHeight: 22, color: tokens.color.textSecondary, letterSpacing: -0.1 },
  foot: { fontSize: 12, color: tokens.color.textTertiary, paddingTop: 28 },
});

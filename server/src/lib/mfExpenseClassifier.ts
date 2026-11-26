export interface ProfileForMatch {
  id: string;
  display_name: string;
}

export interface CertificationForMatch {
  id: number;
  name: string;
  aliases: string[];
}

export interface MfExpenseClassification {
  outcome: 'acquired_set' | 'needs_review' | 'ignored';
  matchedUserId: string | null;
  matchedCertificationId: number | null;
  applicantNameGuess: string | null;
  certificationNameGuess: string | null;
  mfApplicationUrl: string | null;
}

// 日本語の文章にはURLの前後に空白が無いことが多く(\Sベースの切り出しだと
// 全角括弧や「を確認ください」まで一緒に拾ってしまう)、URLに現れ得る
// ASCII文字だけを許可する文字クラスで区切る。
const MF_APPLICATION_URL_RE = /https?:\/\/expense\.moneyforward\.com[A-Za-z0-9\-._~:/?#@!$&'*+,;=%]*/;

/** メール本文中の「申請を確認する」等のリンクをそのまま抜き出す(URLを自前で組み立てない)。 */
export function extractMfApplicationUrl(text: string): string | null {
  const match = text.match(MF_APPLICATION_URL_RE);
  if (!match) return null;
  // ASCII文末記号(.,;:)が文の句読点として続けて書かれているケースだけ軽く削る
  return match[0].replace(/[.,;:]+$/, '');
}

/**
 * MF経費の資格受験料フォームの承認通知メールを解析し、申請者・資格名を
 * user_certifications への自動反映に使えるかどうか判定する。
 *
 * 実際の通知メール(件名・本文の実物)をまだ入手できていないため、氏名・資格名の
 * 突合ロジックは未実装。advisor指摘: 実物が無いまま正規表現を組んでも
 * 見当違いになるだけなので、今は安全側に倒し、常に needs_review を返す
 * （Slack #dx推進室 に通知されるのみで、user_certifications への書き込みは発生しない）。
 *
 * 実メール入手後にここを実装する。想定する注意点(advisor指摘):
 *   - 件名/本文には承認者(山口さん・川上・雷)の名前も載っている可能性が高い。
 *     申請者氏名は「申請者」欄などにアンカーして取り出すこと(本文全体への
 *     profiles.display_name の単純な部分一致は、承認者の名前に誤爆する)。
 *   - 承認依頼・承認完了・差し戻しは同じ申請について複数回メールが飛んでくる。
 *     件名から「承認完了」であることを確認してから処理する。
 *   - 資格名はメールに具体名が載らず、フォームのタイトルでしか分からない
 *     構成もあり得る。その場合はMF経費側の手順(専用フォーム名)で担保する。
 */
export function classifyMfExpenseMail(
  subject: string,
  body: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _profiles: ProfileForMatch[],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _certifications: CertificationForMatch[],
): MfExpenseClassification {
  return {
    outcome: 'needs_review',
    matchedUserId: null,
    matchedCertificationId: null,
    applicantNameGuess: null,
    certificationNameGuess: null,
    mfApplicationUrl: extractMfApplicationUrl(`${subject}\n${body}`),
  };
}

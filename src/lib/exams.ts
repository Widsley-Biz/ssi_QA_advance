/**
 * 模擬試験（筆記）のデータアクセス層。
 *
 * 正解と解説はサーバーが提出後にしか返さない。
 * 受験中のレスポンス（ExamSession）には correct_keys / explanation が存在しないので、
 * ここでも型に含めていない。UI側で「正解を先に取っておく」ことはできない。
 */

import { getAuthHeader } from './firebase';

const API_URL = import.meta.env.VITE_API_URL as string | undefined;

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!API_URL) throw new Error('APIが設定されていません（VITE_API_URL）');
  const authHeader = await getAuthHeader();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...authHeader, ...(options.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `API error: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

/**
 * 'written'   … クリックすると出題が始まる（従来の筆記）
 * 'practical' … 説明ページを1枚挟んで、GitHubリポジトリと練習サイトへ送る。
 *               採点はPRレビュー側で行うので、ここでは点数を持たない。
 * 'material'  … テストを持たない教材のみのコース（スライド・外部リンク等）。
 *               受験ボタン・問題数等のメタ情報は出さない。
 */
export type ExamKind = 'written' | 'practical' | 'material';

/**
 * 学習/模擬/社内認定試験のタブ分け用。NULLの場合はExamList側で
 * kind・日程設定から推定する(過去データ・設定忘れへのフォールバック)。
 */
export type ExamCategory = 'learning' | 'mock' | 'certification';

export interface ExamSummary {
  id: string;
  name: string;
  description: string;
  group_name: string;
  kind: ExamKind;
  category: ExamCategory | null;
  pass_score: number;
  time_limit_min: number | null;
  is_published: boolean;
  question_count: number;
  total_points: number;
  my_attempts: number;
  my_best_score: number | null;
  /** 実技のみ。自己申告の回数と最終日時 */
  my_practical_count: number;
  my_practical_at: string | null;
  /** 正式試験。NULLなら常時公開・無制限 */
  opens_at: string | null;
  closes_at: string | null;
  max_attempts: number | null;
  materials: ExamMaterial[] | null;
  /** 対象者(exam_targets)の設定件数。0件=全員対象 */
  target_count: number;
  /** guide(jsonb)が設定されているか。trueならExamListに案内ページへのボタンを出す */
  has_guide: boolean;
  /** guide.button_label。未設定時のボタン文言はExamList側の既定値（はじめにを読む）に委ねる */
  guide_button_label: string | null;
}

/**
 * スライド等の参考資料。idとpagesが両方揃っているものだけ、
 * アプリ内ビューア(進捗管理つき)の対象になる。無ければ旧来通り外部リンクとして扱う。
 */
export interface ExamMaterial {
  id?: string;
  label: string;
  /** 未設定 = 準備中（動画がまだ無い等）。ExamListでは非リンクのテキスト表示になる */
  url?: string;
  note?: string;
  pages?: number;
}

/**
 * スライドのページ画像を取得し、Blob URLにして返す。
 *
 * バケットは非公開のため、<img src>に直接GCSのURLを渡すことはできない
 * （<img>はAuthorizationヘッダを送れない）。このAPIを認証つきでfetchし、
 * 取得したバイト列をBlob URLに変換して<img src>に使う。
 */
export async function fetchMaterialPageBlob(examId: string, materialId: string, page: number): Promise<string> {
  if (!API_URL) throw new Error('APIが設定されていません（VITE_API_URL）');
  const authHeader = await getAuthHeader();
  const res = await fetch(
    `${API_URL}/exams/${encodeURIComponent(examId)}/materials/${encodeURIComponent(materialId)}/pages/${page}`,
    { headers: { ...authHeader } },
  );
  if (!res.ok) throw new Error(`ページの取得に失敗しました（${res.status}）`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

/** 教材1件ぶんの視聴進捗 */
export interface MaterialProgress {
  exam_id: string;
  material_id: string;
  viewed_pages: number[];
  last_page: number;
  updated_at: string;
}

/**
 * 案内（実技模擬・教材の「はじめにガイド」・各回の後日演習課題の案内）の中身。
 * 文言とリンクはサーバー（DBのguide列）が持っている。
 *
 * *_heading は見出し文言の上書き用（省略時はGuideSections側の既定値＝実技模擬の
 * 見た目をそのまま使う）。linksのurlが"/"始まりならアプリ内リンクとして扱われる。
 */
export interface PracticalGuide {
  intro: string;
  what_we_see?: string[];
  what_we_see_heading?: string;
  steps?: { no: number; title: string; body: string; code?: string }[];
  steps_heading?: string;
  links?: { label: string; url: string; note?: string; primary?: boolean }[];
  contents?: { path: string; body: string }[];
  contents_heading?: string;
  grading?: string;
  grading_heading?: string;
  answers_policy?: string;
  answers_policy_heading?: string;
  note?: string;
  /** ExamListの案内ボタンの文言（例:「後日演習課題を見る」）。省略時は「はじめにを読む」 */
  button_label?: string;
}

export interface PracticalSubmission {
  id: number;
  pr_url: string;
  note: string;
  submitted_at: string;
}

export interface PracticalDetail {
  exam: {
    id: string;
    name: string;
    description: string;
    group_name: string;
    kind: ExamKind;
    guide: PracticalGuide;
    is_published: boolean;
  };
  my_submissions: PracticalSubmission[];
}

/** 受験中の設問。正解は含まれない */
export interface ExamQuestion {
  id: number;
  no: number;
  category: string;
  question: string;
  choices: Record<string, string>;
  allow_multiple: boolean;
  points: number;
  difficulty: number | null;
}

export interface ExamSession {
  attempt_id: number;
  started_at: string;
  total_points: number;
  exam: { id: string; name: string; description: string; pass_score: number; time_limit_min: number | null };
  questions: ExamQuestion[];
}

/** 提出後の1問ぶんの結果。ここで初めて正解と解説が付く */
export interface ExamResultRow extends Omit<ExamQuestion, 'id'> {
  question_id: number;
  selected_keys: string[];
  correct_keys: string[];
  is_correct: boolean;
  earned_points: number;
  explanation: string;
}

export interface ExamResult {
  attempt_id: number;
  exam: { id: string; name: string; pass_score: number };
  earned_points: number;
  total_points: number;
  passed: boolean;
  submitted_at: string;
  results: ExamResultRow[];
}

/** 正式試験で closes_at 前に提出した場合、score/results の代わりにこれが返る */
export interface ExamPending {
  attempt_id: number;
  exam: { id: string; name: string };
  status: 'submitted';
  reveal_at: string;
}

export type ExamResultOrPending = ExamResult | ExamPending;

export function isExamResult(r: ExamResultOrPending): r is ExamResult {
  return 'results' in r;
}

export interface AttemptSummary {
  id: number;
  exam_id: string;
  exam_name: string;
  user_id: string;
  display_name: string;
  submitted_at: string;
  /** 正式試験で終了日時前はnull（pending_revealがtrue） */
  earned_points: number | null;
  total_points: number | null;
  passed: boolean | null;
  pending_reveal: boolean;
}

export const listExams = () => api<ExamSummary[]>('/exams');
export const startExam = (examId: string) =>
  api<ExamSession>(`/exams/${encodeURIComponent(examId)}/start`, { method: 'POST' });
export const submitExam = (attemptId: number, answers: Record<number, string[]>) =>
  api<ExamResultOrPending>(`/exams/attempts/${attemptId}/submit`, {
    method: 'POST',
    body: JSON.stringify({ answers }),
  });
export const getAttemptResult = (attemptId: number) =>
  api<ExamResultOrPending>(`/exams/attempts/${attemptId}`);
export const listAttempts = (userId?: string) =>
  api<AttemptSummary[]>(`/exams/attempts${userId ? `?user_id=${encodeURIComponent(userId)}` : ''}`);

/** 管理者向けレポート：メンバー×試験のマトリクス（1行=1セル） */
export interface ExamReportCell {
  user_id: string;
  display_name: string;
  team_id: number | null;
  exam_id: string;
  exam_name: string;
  group_name: string;
  sort_order: number;
  excluded: boolean;
  attempt_id: number | null;
  earned_points: number | null;
  total_points: number | null;
  passed: boolean | null;
  submitted_at: string | null;
}
export const getExamReport = () => api<ExamReportCell[]>('/exams/report');

/** 自分の教材進捗を全件取得。一覧の%バッジとビューアの再開位置の両方で使う */
export const getMyMaterialProgress = () =>
  api<MaterialProgress[]>('/exams/materials/progress/mine');

export const saveMaterialProgress = (examId: string, materialId: string, page: number) =>
  api<{ ok: true }>(
    `/exams/${encodeURIComponent(examId)}/materials/${encodeURIComponent(materialId)}/progress`,
    { method: 'PUT', body: JSON.stringify({ page }) },
  );

/** 管理者向け：対象試験の全メンバー×教材の進捗（未着手者もmaterial_id=nullの行で含まれる） */
export interface AdminMaterialProgressRow {
  user_id: string;
  display_name: string;
  material_id: string | null;
  viewed_pages: number[] | null;
  last_page: number | null;
  updated_at: string | null;
}
export const getExamMaterialProgress = (examId: string) =>
  api<AdminMaterialProgressRow[]>(`/exams/${encodeURIComponent(examId)}/materials/progress`);

export interface AdminExamSchedule {
  id: string;
  name: string;
  group_name: string;
  is_published: boolean;
  opens_at: string | null;
  closes_at: string | null;
  max_attempts: number | null;
  materials: ExamMaterial[] | null;
  target_emails: string[];
}
export const getAdminExamSchedule = (examId: string) =>
  api<AdminExamSchedule>(`/admin/exams/${encodeURIComponent(examId)}`);
export const putAdminExamSchedule = (
  examId: string,
  body: {
    is_published: boolean;
    opens_at: string | null;
    closes_at: string | null;
    max_attempts: number | null;
  },
) =>
  api<{ id: string; is_published: boolean; opens_at: string | null; closes_at: string | null; max_attempts: number | null }>(
    `/admin/exams/${encodeURIComponent(examId)}/schedule`,
    { method: 'PUT', body: JSON.stringify(body) },
  );
export const putAdminExamTargets = (examId: string, emails: string[]) =>
  api<{ exam_id: string; emails: string[] }>(`/admin/exams/${encodeURIComponent(examId)}/targets`, {
    method: 'PUT',
    body: JSON.stringify({ emails }),
  });

/**
 * 複数予定(exam_schedules)。1試験に複数の開催回(予定)を持たせ、
 * それぞれ別の日程・受験回数上限・対象者を設定できるようにしたもの。
 * 1件もまだ作っていない試験は、従来通り AdminExamSchedule の
 * 単一スケジュール(opens_at等)で動く。
 */
export interface ExamScheduleSummary {
  id: number;
  label: string;
  opens_at: string | null;
  closes_at: string | null;
  max_attempts: number | null;
  target_count: number;
  attempt_count: number;
  is_past: boolean;
}
export interface ExamScheduleMember {
  user_id: string;
  email: string;
  display_name: string;
  attempt_id: number | null;
  status: 'in_progress' | 'submitted' | null;
  earned_points: number | null;
  total_points: number | null;
  passed: boolean | null;
  submitted_at: string | null;
}
export interface ExamScheduleDetail {
  exam_id: string;
  schedule: { id: number; label: string; opens_at: string | null; closes_at: string | null; max_attempts: number | null };
  target_count: number;
  /** 対象者ロスター(membersはprofilesが無いemailを含まないため、編集時の対象者プリフィルには使わない) */
  target_emails: string[];
  members: ExamScheduleMember[];
}
export interface ExamScheduleBody {
  label: string;
  opens_at: string | null;
  closes_at: string | null;
  max_attempts: number | null;
  emails: string[];
}

export const listAdminExamSchedules = (examId: string) =>
  api<ExamScheduleSummary[]>(`/admin/exams/${encodeURIComponent(examId)}/schedules`);
export const getAdminExamScheduleDetail = (examId: string, scheduleId: number) =>
  api<ExamScheduleDetail>(`/admin/exams/${encodeURIComponent(examId)}/schedules/${scheduleId}`);
export const createAdminExamSchedule = (examId: string, body: ExamScheduleBody) =>
  api<{ id: number; label: string; opens_at: string | null; closes_at: string | null; max_attempts: number | null; target_emails: string[] }>(
    `/admin/exams/${encodeURIComponent(examId)}/schedules`,
    { method: 'POST', body: JSON.stringify(body) },
  );
export const updateAdminExamSchedule = (examId: string, scheduleId: number, body: ExamScheduleBody) =>
  api<{ id: number; label: string; opens_at: string | null; closes_at: string | null; max_attempts: number | null; target_emails: string[] }>(
    `/admin/exams/${encodeURIComponent(examId)}/schedules/${scheduleId}`,
    { method: 'PUT', body: JSON.stringify(body) },
  );
export const deleteAdminExamSchedule = async (examId: string, scheduleId: number) => {
  const authHeader = await getAuthHeader();
  const res = await fetch(`${API_URL}/admin/exams/${encodeURIComponent(examId)}/schedules/${scheduleId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', ...authHeader },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? '削除に失敗しました');
  }
};

/** 教材・実技共通の案内ページ。kindの制限は無い（practical専用のPracticalDetailとは別物） */
export interface GuideDetail {
  exam: {
    id: string;
    name: string;
    description: string;
    group_name: string;
    kind: ExamKind;
    guide: PracticalGuide;
    is_published: boolean;
  };
}
export const getGuide = (examId: string) =>
  api<GuideDetail>(`/exams/${encodeURIComponent(examId)}/guide`);

export const getPractical = (examId: string) =>
  api<PracticalDetail>(`/exams/${encodeURIComponent(examId)}/practical`);
export const submitPractical = (examId: string, prUrl: string, note: string) =>
  api<PracticalSubmission>(`/exams/${encodeURIComponent(examId)}/practical/submissions`, {
    method: 'POST',
    body: JSON.stringify({ pr_url: prUrl, note }),
  });
export const deletePracticalSubmission = async (id: number) => {
  // 204 が返るので json() を呼ばない
  const authHeader = await getAuthHeader();
  const res = await fetch(`${API_URL}/exams/practical/submissions/${id}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', ...authHeader },
  });
  if (!res.ok) throw new Error('取り消しに失敗しました');
};

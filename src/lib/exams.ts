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
 */
export type ExamKind = 'written' | 'practical';

export interface ExamSummary {
  id: string;
  name: string;
  description: string;
  group_name: string;
  kind: ExamKind;
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
  materials: { label: string; url: string; note?: string }[] | null;
}

/** 実技の案内。文言とリンクはサーバー（DBのguide列）が持っている */
export interface PracticalGuide {
  intro: string;
  what_we_see?: string[];
  steps?: { no: number; title: string; body: string }[];
  links?: { label: string; url: string; note?: string; primary?: boolean }[];
  contents?: { path: string; body: string }[];
  grading?: string;
  answers_policy?: string;
  note?: string;
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

export interface AdminExamSchedule {
  id: string;
  name: string;
  opens_at: string | null;
  closes_at: string | null;
  max_attempts: number | null;
  materials: { label: string; url: string; note?: string }[] | null;
  target_emails: string[];
}
export const getAdminExamSchedule = (examId: string) =>
  api<AdminExamSchedule>(`/admin/exams/${encodeURIComponent(examId)}`);
export const putAdminExamSchedule = (
  examId: string,
  body: { opens_at: string | null; closes_at: string | null; max_attempts: number | null },
) =>
  api<{ id: string; opens_at: string | null; closes_at: string | null; max_attempts: number | null }>(
    `/admin/exams/${encodeURIComponent(examId)}/schedule`,
    { method: 'PUT', body: JSON.stringify(body) },
  );
export const putAdminExamTargets = (examId: string, emails: string[]) =>
  api<{ exam_id: string; emails: string[] }>(`/admin/exams/${encodeURIComponent(examId)}/targets`, {
    method: 'PUT',
    body: JSON.stringify({ emails }),
  });

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

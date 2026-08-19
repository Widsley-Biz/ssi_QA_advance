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

export interface ExamSummary {
  id: string;
  name: string;
  description: string;
  group_name: string;
  pass_score: number;
  time_limit_min: number | null;
  is_published: boolean;
  question_count: number;
  total_points: number;
  my_attempts: number;
  my_best_score: number | null;
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

export interface AttemptSummary {
  id: number;
  exam_id: string;
  exam_name: string;
  user_id: string;
  display_name: string;
  submitted_at: string;
  earned_points: number;
  total_points: number;
  passed: boolean;
}

export const listExams = () => api<ExamSummary[]>('/exams');
export const startExam = (examId: string) =>
  api<ExamSession>(`/exams/${encodeURIComponent(examId)}/start`, { method: 'POST' });
export const submitExam = (attemptId: number, answers: Record<number, string[]>) =>
  api<ExamResult>(`/exams/attempts/${attemptId}/submit`, {
    method: 'POST',
    body: JSON.stringify({ answers }),
  });
export const getAttemptResult = (attemptId: number) =>
  api<ExamResult>(`/exams/attempts/${attemptId}`);
export const listAttempts = (userId?: string) =>
  api<AttemptSummary[]>(`/exams/attempts${userId ? `?user_id=${encodeURIComponent(userId)}` : ''}`);

/**
 * ダッシュボード(旧「全社」)専用のデータアクセス層。
 * 試験の点数・教材進捗の個別取得は src/lib/exams.ts 側に既存のものを使う。
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

export interface MaterialsSummaryRow {
  user_id: string;
  group_name: string;
  viewed_pages: number;
  total_pages: number;
}

export const fetchMaterialsSummary = () =>
  api<MaterialsSummaryRow[]>('/dashboard/materials-summary');

export interface ExamEvent {
  user_id: string;
  display_name: string;
  team_id: number | null;
  day: string; // 'YYYY-MM-DD'（JST）
  submitted_at: string; // 提出日時(ISO)
  exam_id: string;
  exam_name: string;
  kind: 'written' | 'practical';
  passed: boolean | null;
  earned_points: number | null;
}

export interface SkillmapEvent {
  user_id: string;
  display_name: string;
  team_id: number | null;
  day: string;
  submitted_at: string;
  course_id: string;
  course_name: string;
}

export interface MaterialDailyRow {
  user_id: string;
  day: string;
  /** その日のうち最後にページを既読した日時(ISO) */
  last_viewed_at: string;
  pages: number;
}

export interface DailyActivity {
  examEvents: ExamEvent[];
  skillmapEvents: SkillmapEvent[];
  materialDaily: MaterialDailyRow[];
  recordStart: string | null;
}

export const fetchDailyActivity = (days = 90) =>
  api<DailyActivity>(`/dashboard/daily-activity?days=${days}`);

/**
 * Data access layer - talks to the ssi-qa-advance-api backend (Identity Platform + Cloud SQL).
 * When VITE_API_URL is unset, falls back to mock data for local development/demo.
 */

import type { Course, Level, Skill, Team, Profile, Assessment, Answer } from '../types';
import { getAuthHeader } from './firebase';

const API_URL = import.meta.env.VITE_API_URL as string | undefined;

function isApiMode(): boolean {
  return !!API_URL;
}

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const authHeader = await getAuthHeader();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeader,
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `API error: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ── Mock data imports (tree-shaken in production with API configured) ──
async function getMockData() {
  const mod = await import('../data/mockData');
  return mod;
}

// ══════════════════════════════════════
// Current user profile (auto-created on first login)
// ══════════════════════════════════════
export async function fetchMe(): Promise<Profile> {
  return api<Profile>('/me');
}

// ══════════════════════════════════════
// Courses
// ══════════════════════════════════════
export async function fetchCourses(): Promise<Course[]> {
  if (isApiMode()) return api<Course[]>('/courses');
  const mock = await getMockData();
  return mock.courses;
}

// ══════════════════════════════════════
// Levels
// ══════════════════════════════════════
export async function fetchLevels(courseId?: string): Promise<Level[]> {
  if (isApiMode()) {
    const qs = courseId ? `?course_id=${encodeURIComponent(courseId)}` : '';
    return api<Level[]>(`/levels${qs}`);
  }
  const mock = await getMockData();
  return courseId ? mock.levels.filter(l => l.course_id === courseId) : mock.levels;
}

// ══════════════════════════════════════
// Skills
// ══════════════════════════════════════
export async function fetchSkills(courseId?: string): Promise<Skill[]> {
  if (isApiMode()) {
    const qs = courseId ? `?course_id=${encodeURIComponent(courseId)}` : '';
    const data = await api<Record<string, unknown>[]>(`/skills${qs}`);
    return data.map((s) => ({
      ...s,
      answer_type: s.answer_type ?? 'scale5',
      score_excluded: s.score_excluded ?? false,
    })) as Skill[];
  }
  const mock = await getMockData();
  const skills = courseId ? mock.skills.filter(s => s.course_id === courseId) : mock.skills;
  // Add default values for mock data compatibility
  return skills.map(s => ({
    ...s,
    answer_type: (s as Skill).answer_type ?? 'scale5',
    score_excluded: (s as Skill).score_excluded ?? false,
  }));
}

// ══════════════════════════════════════
// Teams
// ══════════════════════════════════════
export async function fetchTeams(): Promise<Team[]> {
  if (isApiMode()) return api<Team[]>('/teams');
  const mock = await getMockData();
  return mock.teams;
}

// ══════════════════════════════════════
// Profiles
// ══════════════════════════════════════
export async function fetchProfiles(teamId?: number): Promise<Profile[]> {
  if (isApiMode()) {
    const qs = teamId ? `?team_id=${teamId}` : '';
    return api<Profile[]>(`/profiles${qs}`);
  }
  const mock = await getMockData();
  const profiles = mock.profiles.filter(p => p.role !== 'retired');
  return teamId ? profiles.filter(p => p.team_id === teamId) : profiles;
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  if (isApiMode()) {
    try {
      return await api<Profile>(`/profiles/${encodeURIComponent(userId)}`);
    } catch {
      return null;
    }
  }
  const mock = await getMockData();
  return mock.profiles.find(p => p.id === userId) ?? null;
}

export async function updateProfile(userId: string, updates: Partial<Profile>): Promise<void> {
  if (isApiMode()) {
    await api(`/profiles/${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }
}

// ══════════════════════════════════════
// Assessments
// ══════════════════════════════════════
export async function fetchAssessments(userId?: string, courseId?: string): Promise<Assessment[]> {
  if (isApiMode()) {
    const params = new URLSearchParams();
    if (userId) params.set('user_id', userId);
    if (courseId) params.set('course_id', courseId);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return api<Assessment[]>(`/assessments${qs}`);
  }
  const mock = await getMockData();
  let assessments = [...mock.assessments];
  if (userId) assessments = assessments.filter(a => a.user_id === userId);
  if (courseId) assessments = assessments.filter(a => a.course_id === courseId);
  return assessments;
}

export async function fetchLatestAssessment(userId: string, courseId: string): Promise<Assessment | null> {
  const assessments = await fetchAssessments(userId, courseId);
  return assessments.length > 0 ? assessments[0] : null;
}

// ══════════════════════════════════════
// Answers
// ══════════════════════════════════════
export async function fetchAnswers(assessmentId: number): Promise<Answer[]> {
  if (isApiMode()) return api<Answer[]>(`/answers?assessment_id=${assessmentId}`);
  const mock = await getMockData();
  return mock.answers.filter(a => a.assessment_id === assessmentId);
}

export async function fetchLatestAnswers(userId: string, courseId: string): Promise<Answer[]> {
  const assessment = await fetchLatestAssessment(userId, courseId);
  if (!assessment) return [];
  return fetchAnswers(assessment.id);
}

// ══════════════════════════════════════
// Submit Assessment
// ══════════════════════════════════════
export async function submitAssessment(
  userId: string,
  courseId: string,
  answerMap: Record<number, number>,
  scoreSnapshot: Record<string, unknown>,
): Promise<{ assessmentId: number }> {
  if (isApiMode()) {
    return api<{ assessmentId: number }>('/assessments', {
      method: 'POST',
      body: JSON.stringify({ course_id: courseId, answers: answerMap, score_snapshot: scoreSnapshot }),
    });
  }

  // Mock mode
  const mock = await getMockData();
  const newId = Math.max(...mock.assessments.map(a => a.id), 0) + 1;
  const newAssessment: Assessment = {
    id: newId,
    user_id: userId,
    course_id: courseId,
    status: 'submitted',
    submitted_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    score_snapshot: scoreSnapshot,
  };
  mock.assessments.push(newAssessment);

  for (const [skillIdStr, score] of Object.entries(answerMap)) {
    const newAnswerId = Math.max(...mock.answers.map(a => a.id), 0) + 1;
    mock.answers.push({
      id: newAnswerId,
      assessment_id: newId,
      skill_id: Number(skillIdStr),
      score,
    });
  }

  return { assessmentId: newId };
}

// ══════════════════════════════════════
// Delete Assessment (leader/board only)
// ══════════════════════════════════════
export async function deleteAssessment(assessmentId: number): Promise<void> {
  if (isApiMode()) {
    await api(`/assessments/${assessmentId}`, { method: 'DELETE' });
  }
}

// ══════════════════════════════════════
// Admin: Teams CRUD
// ══════════════════════════════════════
export async function createTeam(name: string): Promise<Team> {
  if (isApiMode()) return api<Team>('/teams', { method: 'POST', body: JSON.stringify({ name }) });
  throw new Error('Admin operations require the API backend');
}

export async function updateTeam(id: number, name: string): Promise<void> {
  if (isApiMode()) {
    await api(`/teams/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) });
  }
}

export async function deleteTeam(id: number): Promise<void> {
  if (isApiMode()) {
    await api(`/teams/${id}`, { method: 'DELETE' });
  }
}

// ══════════════════════════════════════
// Invitations
// ══════════════════════════════════════
export interface Invitation {
  id: number;
  email: string;
  role: string;
  team_id: number | null;
  invited_by: string | null;
  status: string;
  created_at: string;
}

export async function fetchInvitations(): Promise<Invitation[]> {
  if (isApiMode()) return api<Invitation[]>('/invitations');
  return [];
}

export async function createInvitation(email: string, role: string, teamId: number | null, invitedBy: string): Promise<Invitation> {
  if (isApiMode()) {
    return api<Invitation>('/invitations', {
      method: 'POST',
      body: JSON.stringify({ email: email.toLowerCase().trim(), role, team_id: teamId, invited_by: invitedBy }),
    });
  }
  throw new Error('Invitations require the API backend');
}

export async function deleteInvitation(id: number): Promise<void> {
  if (isApiMode()) {
    await api(`/invitations/${id}`, { method: 'DELETE' });
  }
}

const GAS_INVITE_URL = 'https://script.google.com/a/macros/widsley.com/s/AKfycbzm_K0PS3tCbnCl9TUPWWUuhsoaAyJwP18rWwBfmKFT2QY_nwFanfptmAW-wiCMSAzD/exec';

export async function sendInviteEmail(
  email: string,
  role: string,
  teamName: string,
  appUrl = 'https://ssi-qa-advance-239789192031.asia-northeast1.run.app',
): Promise<{ success: boolean }> {
  const roleLabelMap: Record<string, string> = { member: 'メンバー', leader: 'リーダー', board: '管理者' };
  try {
    const params = new URLSearchParams({
      email,
      role: roleLabelMap[role] ?? role,
      team: teamName || '未割当',
      appUrl,
    });
    const url = `${GAS_INVITE_URL}?${params.toString()}`;

    // Use Image beacon - most reliable way to hit GAS without CORS issues
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ success: true });
      img.onerror = () => resolve({ success: true }); // GAS returns JSON, not image, so onerror fires but request was sent
      img.src = url;
      // Fallback timeout
      setTimeout(() => resolve({ success: true }), 5000);
    });
  } catch (err) {
    console.error('Failed to send invite email:', err);
    return { success: false };
  }
}

// ══════════════════════════════════════
// Certifications
// ══════════════════════════════════════

export interface CertificationRecord {
  id: number;
  name: string;
  description: string;
  level: string;
  category: string;
  reward: string | null;
  sort_order: number;
  active: boolean;
}

export interface UserCertification {
  id: number;
  user_id: string;
  certification_id: number;
  status: 'interested' | 'studying' | 'acquired';
  updated_at: string;
}

export async function fetchCertifications(): Promise<CertificationRecord[]> {
  if (isApiMode()) return api<CertificationRecord[]>('/certifications');
  return [];
}

export async function fetchUserCertifications(userId?: string): Promise<UserCertification[]> {
  if (isApiMode()) {
    const qs = userId ? `?user_id=${encodeURIComponent(userId)}` : '';
    return api<UserCertification[]>(`/user_certifications${qs}`);
  }
  return [];
}

export async function upsertUserCertification(_userId: string, certId: number, status: string): Promise<void> {
  if (isApiMode()) {
    await api('/user_certifications', {
      method: 'PUT',
      body: JSON.stringify({ certification_id: certId, status }),
    });
    return;
  }
  throw new Error('Certification operations require the API backend');
}

export async function removeUserCertification(_userId: string, certId: number): Promise<void> {
  if (isApiMode()) {
    await api(`/user_certifications/${certId}`, { method: 'DELETE' });
    return;
  }
  throw new Error('Certification operations require the API backend');
}

// ── Admin CRUD for certifications ──

export async function createCertification(cert: Omit<CertificationRecord, 'id' | 'active'> & { active?: boolean }): Promise<CertificationRecord> {
  if (isApiMode()) {
    return api<CertificationRecord>('/certifications', { method: 'POST', body: JSON.stringify(cert) });
  }
  throw new Error('Admin operations require the API backend');
}

export async function updateCertification(id: number, updates: Partial<CertificationRecord>): Promise<void> {
  if (isApiMode()) {
    await api(`/certifications/${id}`, { method: 'PATCH', body: JSON.stringify(updates) });
    return;
  }
  throw new Error('Admin operations require the API backend');
}

export async function deleteCertification(id: number): Promise<void> {
  if (isApiMode()) {
    await api(`/certifications/${id}`, { method: 'DELETE' });
    return;
  }
  throw new Error('Admin operations require the API backend');
}

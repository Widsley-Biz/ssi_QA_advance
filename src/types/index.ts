export type CourseType = 'single' | 'leveled';
export type RoleType = 'member' | 'leader' | 'board' | 'retired';
export type AssessmentStatus = 'submitted';
export type AnswerType = 'scale5' | 'binary';

export interface Course {
  id: string;
  name: string;
  type: CourseType;
  goal: string;
  description: string;
  sort_order: number;
}

export interface Level {
  id: number;
  course_id: string;
  name: string;
  sort_order: number;
  kind: 'level' | 'category';
}

export interface Skill {
  id: number;
  course_id: string;
  level_id: number;
  no: number;
  category: string;
  name: string;
  description: string;
  weight: number;
  importance: number | null;
  ref_note: string | null;
  answer_type: 'scale5' | 'binary';
  score_excluded: boolean;
}

export interface Team {
  id: number;
  name: string;
}

export interface Profile {
  id: string;
  display_name: string;
  email: string;
  role: RoleType;
  team_id: number | null;
  slack_id: string | null;
}

export interface Assessment {
  id: number;
  user_id: string;
  course_id: string;
  status: AssessmentStatus;
  submitted_at: string | null;
  score_snapshot: Record<string, unknown> | null;
  created_at: string;
}

export interface Answer {
  id: number;
  assessment_id: number;
  skill_id: number;
  score: number;
}

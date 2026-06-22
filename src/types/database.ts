export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      courses: {
        Row: {
          id: string;
          name: string;
          type: 'single' | 'leveled';
          goal: string;
          description: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id: string;
          name: string;
          type: 'single' | 'leveled';
          goal?: string;
          description?: string;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          type?: 'single' | 'leveled';
          goal?: string;
          description?: string;
          sort_order?: number;
          created_at?: string;
        };
      };
      levels: {
        Row: {
          id: number;
          course_id: string;
          name: string;
          sort_order: number;
          kind: 'level' | 'category';
          created_at: string;
        };
        Insert: {
          id?: number;
          course_id: string;
          name: string;
          sort_order?: number;
          kind?: 'level' | 'category';
          created_at?: string;
        };
        Update: {
          id?: number;
          course_id?: string;
          name?: string;
          sort_order?: number;
          kind?: 'level' | 'category';
          created_at?: string;
        };
      };
      skills: {
        Row: {
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
          created_at: string;
        };
        Insert: {
          id?: number;
          course_id: string;
          level_id: number;
          no: number;
          category?: string;
          name: string;
          description?: string;
          weight?: number;
          importance?: number | null;
          ref_note?: string | null;
          answer_type?: 'scale5' | 'binary';
          score_excluded?: boolean;
          created_at?: string;
        };
        Update: {
          id?: number;
          course_id?: string;
          level_id?: number;
          no?: number;
          category?: string;
          name?: string;
          description?: string;
          weight?: number;
          importance?: number | null;
          ref_note?: string | null;
          answer_type?: 'scale5' | 'binary';
          score_excluded?: boolean;
          created_at?: string;
        };
      };
      teams: {
        Row: {
          id: number;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: number;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: number;
          name?: string;
          created_at?: string;
        };
      };
      profiles: {
        Row: {
          id: string;
          display_name: string;
          email: string;
          role: 'member' | 'leader' | 'board' | 'retired';
          team_id: number | null;
          slack_id: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          display_name: string;
          email: string;
          role?: 'member' | 'leader' | 'board' | 'retired';
          team_id?: number | null;
          slack_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string;
          email?: string;
          role?: 'member' | 'leader' | 'board' | 'retired';
          team_id?: number | null;
          slack_id?: string | null;
          created_at?: string;
        };
      };
      assessments: {
        Row: {
          id: number;
          user_id: string;
          course_id: string;
          status: 'submitted';
          submitted_at: string | null;
          score_snapshot: Json | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          user_id: string;
          course_id: string;
          status?: 'submitted';
          submitted_at?: string | null;
          score_snapshot?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          user_id?: string;
          course_id?: string;
          status?: 'submitted';
          submitted_at?: string | null;
          score_snapshot?: Json | null;
          created_at?: string;
        };
      };
      answers: {
        Row: {
          id: number;
          assessment_id: number;
          skill_id: number;
          score: number;
          created_at: string;
        };
        Insert: {
          id?: number;
          assessment_id: number;
          skill_id: number;
          score: number;
          created_at?: string;
        };
        Update: {
          id?: number;
          assessment_id?: number;
          skill_id?: number;
          score?: number;
          created_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}

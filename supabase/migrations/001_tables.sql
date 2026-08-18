-- ============================================================
-- 001_tables.sql  –  Widsley SkillCheck core schema
-- ============================================================

-- courses
CREATE TABLE courses (
  id text PRIMARY KEY,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('single', 'leveled')),
  goal text NOT NULL,
  description text NOT NULL,
  sort_order int NOT NULL DEFAULT 0
);

-- levels
CREATE TABLE levels (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  course_id text NOT NULL REFERENCES courses(id),
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  kind text NOT NULL CHECK (kind IN ('level', 'category'))
);

-- skills
CREATE TABLE skills (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  course_id text NOT NULL REFERENCES courses(id),
  level_id bigint NOT NULL REFERENCES levels(id),
  no int NOT NULL,
  category text NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  weight numeric NOT NULL DEFAULT 1.0,
  importance int,
  ref_note text,
  answer_type text NOT NULL DEFAULT 'scale5' CHECK (answer_type IN ('scale5', 'binary')),
  score_excluded boolean NOT NULL DEFAULT false
);

-- teams
CREATE TABLE teams (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL UNIQUE
);

-- profiles (linked to auth.users)
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'leader', 'board', 'retired')),
  team_id bigint REFERENCES teams(id),
  slack_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- assessments
CREATE TABLE assessments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_id text NOT NULL REFERENCES courses(id),
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  score_snapshot jsonb
);

-- answers
CREATE TABLE answers (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  assessment_id bigint NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  skill_id bigint NOT NULL REFERENCES skills(id),
  score int NOT NULL CHECK (score BETWEEN 1 AND 5),
  UNIQUE (assessment_id, skill_id)
);

-- Indexes
CREATE INDEX idx_assessments_user ON assessments(user_id, course_id);
CREATE INDEX idx_answers_assessment ON answers(assessment_id);
CREATE INDEX idx_skills_course ON skills(course_id);
CREATE INDEX idx_profiles_team ON profiles(team_id);

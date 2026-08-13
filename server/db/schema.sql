-- ============================================================
-- Cloud SQL schema for Widsley SkillCheck (GCPネイティブ移行後)
-- Supabaseの001_tables.sql/005_invitations.sql/006_certifications.sqlを統合。
-- RLS・ビュー・auth.usersトリガーは含まない(認可はAPI層で実装)。
-- profiles.id等はIdentity PlatformのUID(text)を格納するためtext型。
-- ============================================================

CREATE TABLE courses (
  id text PRIMARY KEY,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('single', 'leveled')),
  goal text NOT NULL,
  description text NOT NULL,
  sort_order int NOT NULL DEFAULT 0
);

CREATE TABLE levels (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  course_id text NOT NULL REFERENCES courses(id),
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  kind text NOT NULL CHECK (kind IN ('level', 'category'))
);

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

CREATE TABLE teams (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL UNIQUE
);

-- id = Identity PlatformのUID(移行ユーザーは旧SupabaseのUUID文字列を再利用)
CREATE TABLE profiles (
  id text PRIMARY KEY,
  display_name text NOT NULL,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'leader', 'board', 'retired')),
  team_id bigint REFERENCES teams(id),
  slack_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE assessments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_id text NOT NULL REFERENCES courses(id),
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  score_snapshot jsonb
);

CREATE TABLE answers (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  assessment_id bigint NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  skill_id bigint NOT NULL REFERENCES skills(id),
  score int NOT NULL CHECK (score BETWEEN 1 AND 5),
  UNIQUE (assessment_id, skill_id)
);

CREATE TABLE invitations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'leader', 'board')),
  team_id bigint REFERENCES teams(id),
  invited_by text REFERENCES profiles(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (email, status)
);

CREATE TABLE certifications (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  level text NOT NULL CHECK (level IN ('academia', 'entry', 'associate', 'professional', 'expert')),
  category text NOT NULL,
  reward text,
  sort_order int NOT NULL DEFAULT 0,
  -- false: 資格表(新規選択)には表示しないが、既に取得状況が記録されている
  -- ユーザーのマイページには引き続き表示する(廃止・改称された資格用)
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_certifications (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  certification_id bigint NOT NULL REFERENCES certifications(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('interested', 'studying', 'acquired')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, certification_id)
);

-- Indexes
CREATE INDEX idx_assessments_user ON assessments(user_id, course_id);
CREATE INDEX idx_answers_assessment ON answers(assessment_id);
CREATE INDEX idx_skills_course ON skills(course_id);
CREATE INDEX idx_profiles_team ON profiles(team_id);
CREATE INDEX idx_user_certs_user ON user_certifications(user_id);
CREATE INDEX idx_user_certs_cert ON user_certifications(certification_id);

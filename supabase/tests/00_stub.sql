-- SkillCheck の依存部分だけを再現したスタブ（001_tables.sql / 002_rls.sql より抜粋）
CREATE SCHEMA IF NOT EXISTS auth;

-- Supabase の auth.uid() 相当。テストではセッション変数から読む
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('test.uid', true), '')::uuid;
$$;

CREATE TABLE courses (
  id text PRIMARY KEY,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('single','leveled')),
  goal text NOT NULL,
  description text NOT NULL,
  sort_order int NOT NULL DEFAULT 0
);

CREATE TABLE teams (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL UNIQUE
);

CREATE TABLE profiles (
  id uuid PRIMARY KEY,
  display_name text NOT NULL,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('member','leader','board','retired')),
  team_id bigint REFERENCES teams(id),
  slack_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 002_rls.sql と同一
CREATE OR REPLACE FUNCTION public.current_user_role() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_user_team_id() RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT team_id FROM profiles WHERE id = auth.uid();
$$;

-- Supabase 相当のロールと権限（テーブル権限は広く与え、制御はRLSに任せる）
DO $$ BEGIN
  CREATE ROLE authenticated;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT USAGE ON SCHEMA public, auth TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

-- テストデータ
INSERT INTO teams (name) VALUES ('QA'), ('Dev');
INSERT INTO courses (id, name, type, goal, description)
VALUES ('academia','Academia','single','共通ベース','共通ベースコース');

INSERT INTO profiles (id, display_name, email, role, team_id) VALUES
  ('11111111-1111-1111-1111-111111111111','受講者A','a@widsley.com','member', 1),
  ('22222222-2222-2222-2222-222222222222','受講者B','b@widsley.com','member', 1),
  ('33333333-3333-3333-3333-333333333333','リーダー','l@widsley.com','leader', 1),
  ('44444444-4444-4444-4444-444444444444','管理者','o@widsley.com','board',  1),
  ('55555555-5555-5555-5555-555555555555','別チーム','x@widsley.com','member', 2);

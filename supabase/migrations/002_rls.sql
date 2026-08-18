-- ============================================================
-- 002_rls.sql  –  Row Level Security policies
-- ============================================================

-- Helper: get the current user's role from profiles
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

-- Helper: get the current user's team_id from profiles
CREATE OR REPLACE FUNCTION public.current_user_team_id()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT team_id FROM profiles WHERE id = auth.uid();
$$;

-- ============================================================
-- courses  –  authenticated read, board write
-- ============================================================
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "courses_select" ON courses
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "courses_insert" ON courses
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() = 'board');

CREATE POLICY "courses_update" ON courses
  FOR UPDATE TO authenticated
  USING (public.current_user_role() = 'board')
  WITH CHECK (public.current_user_role() = 'board');

CREATE POLICY "courses_delete" ON courses
  FOR DELETE TO authenticated
  USING (public.current_user_role() = 'board');

-- ============================================================
-- levels  –  authenticated read, board write
-- ============================================================
ALTER TABLE levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "levels_select" ON levels
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "levels_insert" ON levels
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() = 'board');

CREATE POLICY "levels_update" ON levels
  FOR UPDATE TO authenticated
  USING (public.current_user_role() = 'board')
  WITH CHECK (public.current_user_role() = 'board');

CREATE POLICY "levels_delete" ON levels
  FOR DELETE TO authenticated
  USING (public.current_user_role() = 'board');

-- ============================================================
-- skills  –  authenticated read, board write
-- ============================================================
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "skills_select" ON skills
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "skills_insert" ON skills
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() = 'board');

CREATE POLICY "skills_update" ON skills
  FOR UPDATE TO authenticated
  USING (public.current_user_role() = 'board')
  WITH CHECK (public.current_user_role() = 'board');

CREATE POLICY "skills_delete" ON skills
  FOR DELETE TO authenticated
  USING (public.current_user_role() = 'board');

-- ============================================================
-- teams  –  authenticated read, board write
-- ============================================================
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teams_select" ON teams
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "teams_insert" ON teams
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() = 'board');

CREATE POLICY "teams_update" ON teams
  FOR UPDATE TO authenticated
  USING (public.current_user_role() = 'board')
  WITH CHECK (public.current_user_role() = 'board');

CREATE POLICY "teams_delete" ON teams
  FOR DELETE TO authenticated
  USING (public.current_user_role() = 'board');

-- ============================================================
-- profiles
--   member  : read self + same-team display_name only
--   leader  : read own team full rows
--   board   : read/write all
--   retired : blocked
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select" ON profiles
  FOR SELECT TO authenticated
  USING (
    CASE public.current_user_role()
      WHEN 'board' THEN true
      WHEN 'leader' THEN
        team_id = public.current_user_team_id()
      WHEN 'member' THEN
        id = auth.uid()
        OR team_id = public.current_user_team_id()
      ELSE false  -- retired
    END
  );

CREATE POLICY "profiles_insert" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    -- Users can insert their own profile (auto-creation) or board can insert any
    id = auth.uid() OR public.current_user_role() = 'board'
  );

CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE TO authenticated
  USING (
    CASE public.current_user_role()
      WHEN 'board' THEN true
      WHEN 'leader' THEN id = auth.uid()
      WHEN 'member' THEN id = auth.uid()
      ELSE false
    END
  )
  WITH CHECK (
    CASE public.current_user_role()
      WHEN 'board' THEN true
      WHEN 'leader' THEN id = auth.uid()
      WHEN 'member' THEN id = auth.uid()
      ELSE false
    END
  );

CREATE POLICY "profiles_delete" ON profiles
  FOR DELETE TO authenticated
  USING (public.current_user_role() = 'board');

-- ============================================================
-- assessments
--   member  : read/write own
--   leader  : read own team + delete own team
--   board   : read all + delete all
--   retired : blocked
-- ============================================================
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assessments_select" ON assessments
  FOR SELECT TO authenticated
  USING (
    CASE public.current_user_role()
      WHEN 'board' THEN true
      WHEN 'leader' THEN
        user_id IN (
          SELECT id FROM profiles WHERE team_id = public.current_user_team_id()
        )
      WHEN 'member' THEN user_id = auth.uid()
      ELSE false
    END
  );

CREATE POLICY "assessments_insert" ON assessments
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.current_user_role() IN ('member', 'leader', 'board')
  );

CREATE POLICY "assessments_update" ON assessments
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    AND public.current_user_role() IN ('member', 'leader', 'board')
  )
  WITH CHECK (
    user_id = auth.uid()
    AND public.current_user_role() IN ('member', 'leader', 'board')
  );

CREATE POLICY "assessments_delete" ON assessments
  FOR DELETE TO authenticated
  USING (
    CASE public.current_user_role()
      WHEN 'board' THEN true
      WHEN 'leader' THEN
        user_id IN (
          SELECT id FROM profiles WHERE team_id = public.current_user_team_id()
        )
      ELSE false
    END
  );

-- ============================================================
-- answers
--   member  : read/write own (via assessment ownership)
--   leader  : read own team + delete own team
--   board   : read all + delete all
--   retired : blocked
-- ============================================================
ALTER TABLE answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "answers_select" ON answers
  FOR SELECT TO authenticated
  USING (
    CASE public.current_user_role()
      WHEN 'board' THEN true
      WHEN 'leader' THEN
        assessment_id IN (
          SELECT a.id FROM assessments a
          JOIN profiles p ON p.id = a.user_id
          WHERE p.team_id = public.current_user_team_id()
        )
      WHEN 'member' THEN
        assessment_id IN (
          SELECT id FROM assessments WHERE user_id = auth.uid()
        )
      ELSE false
    END
  );

CREATE POLICY "answers_insert" ON answers
  FOR INSERT TO authenticated
  WITH CHECK (
    assessment_id IN (
      SELECT id FROM assessments WHERE user_id = auth.uid()
    )
    AND public.current_user_role() IN ('member', 'leader', 'board')
  );

CREATE POLICY "answers_update" ON answers
  FOR UPDATE TO authenticated
  USING (
    assessment_id IN (
      SELECT id FROM assessments WHERE user_id = auth.uid()
    )
    AND public.current_user_role() IN ('member', 'leader', 'board')
  )
  WITH CHECK (
    assessment_id IN (
      SELECT id FROM assessments WHERE user_id = auth.uid()
    )
    AND public.current_user_role() IN ('member', 'leader', 'board')
  );

CREATE POLICY "answers_delete" ON answers
  FOR DELETE TO authenticated
  USING (
    CASE public.current_user_role()
      WHEN 'board' THEN true
      WHEN 'leader' THEN
        assessment_id IN (
          SELECT a.id FROM assessments a
          JOIN profiles p ON p.id = a.user_id
          WHERE p.team_id = public.current_user_team_id()
        )
      ELSE false
    END
  );

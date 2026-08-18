-- ============================================================
-- 006_certifications.sql  –  Certification tables & RLS
-- ============================================================

-- ============================================================
-- certifications  –  master table (replaces hardcoded data)
-- ============================================================
CREATE TABLE certifications (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  level text NOT NULL CHECK (level IN ('academia', 'entry', 'associate', 'professional', 'expert')),
  category text NOT NULL,
  reward text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- user_certifications  –  user certification status tracking
-- ============================================================
CREATE TABLE user_certifications (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  certification_id bigint NOT NULL REFERENCES certifications(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('interested', 'studying', 'acquired')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, certification_id)
);

CREATE INDEX idx_user_certs_user ON user_certifications(user_id);
CREATE INDEX idx_user_certs_cert ON user_certifications(certification_id);

-- ============================================================
-- RLS: certifications  –  authenticated read, board write
-- ============================================================
ALTER TABLE certifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "certifications_select" ON certifications
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "certifications_insert" ON certifications
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() = 'board');

CREATE POLICY "certifications_update" ON certifications
  FOR UPDATE TO authenticated
  USING (public.current_user_role() = 'board')
  WITH CHECK (public.current_user_role() = 'board');

CREATE POLICY "certifications_delete" ON certifications
  FOR DELETE TO authenticated
  USING (public.current_user_role() = 'board');

-- ============================================================
-- RLS: user_certifications
--   member  : CRUD own rows
--   leader  : SELECT own team members' rows
--   board   : SELECT all rows
-- ============================================================
ALTER TABLE user_certifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_certifications_select" ON user_certifications
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

CREATE POLICY "user_certifications_insert" ON user_certifications
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.current_user_role() IN ('member', 'leader', 'board')
  );

CREATE POLICY "user_certifications_update" ON user_certifications
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    AND public.current_user_role() IN ('member', 'leader', 'board')
  )
  WITH CHECK (
    user_id = auth.uid()
    AND public.current_user_role() IN ('member', 'leader', 'board')
  );

CREATE POLICY "user_certifications_delete" ON user_certifications
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    AND public.current_user_role() IN ('member', 'leader', 'board')
  );

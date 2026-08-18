-- ============================================================
-- 005: Invitations table for pre-registration + invite flow
-- ============================================================

-- invitations: admin pre-registers email + role + team before user logs in
CREATE TABLE invitations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'leader', 'board')),
  team_id bigint REFERENCES teams(id),
  invited_by uuid REFERENCES profiles(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (email, status)  -- one pending invitation per email
);

-- RLS
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- Only board can manage invitations
CREATE POLICY "invitations_select_board" ON invitations
  FOR SELECT TO authenticated
  USING (current_user_role() = 'board');

CREATE POLICY "invitations_insert_board" ON invitations
  FOR INSERT TO authenticated
  WITH CHECK (current_user_role() = 'board');

CREATE POLICY "invitations_update_board" ON invitations
  FOR UPDATE TO authenticated
  USING (current_user_role() = 'board');

CREATE POLICY "invitations_delete_board" ON invitations
  FOR DELETE TO authenticated
  USING (current_user_role() = 'board');

-- Update the handle_new_user trigger to check invitations
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _display_name text;
  _email text;
  _inv record;
BEGIN
  _display_name := coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    split_part(new.email, '@', 1)
  );
  _email := coalesce(new.email, '');

  -- Check if there's a pending invitation for this email
  SELECT * INTO _inv
  FROM invitations
  WHERE email = _email AND status = 'pending'
  LIMIT 1;

  IF _inv IS NOT NULL THEN
    -- Create profile with invited role and team
    INSERT INTO profiles (id, display_name, email, role, team_id)
    VALUES (new.id, _display_name, _email, _inv.role, _inv.team_id)
    ON CONFLICT (id) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      role = _inv.role,
      team_id = _inv.team_id;

    -- Mark invitation as accepted
    UPDATE invitations SET status = 'accepted' WHERE id = _inv.id;
  ELSE
    -- No invitation: create with default member role
    INSERT INTO profiles (id, display_name, email, role)
    VALUES (new.id, _display_name, _email, 'member')
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN new;
END;
$$;

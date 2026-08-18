-- ============================================================
-- 004_functions.sql  –  Helper functions & triggers
-- ============================================================

-- --------------------------------------------------------
-- Auto-create profile on first Google login
-- Triggered on INSERT into auth.users
-- Extracts display_name and email from raw_user_meta_data
-- --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _display_name text;
  _email text;
BEGIN
  -- Extract from Google OAuth raw_user_meta_data
  _display_name := COALESCE(
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'name',
    NEW.raw_user_meta_data ->> 'email',
    'Unknown'
  );

  _email := COALESCE(
    NEW.raw_user_meta_data ->> 'email',
    NEW.email,
    ''
  );

  INSERT INTO public.profiles (id, display_name, email, role)
  VALUES (NEW.id, _display_name, _email, 'member')
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Trigger on auth.users insert
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

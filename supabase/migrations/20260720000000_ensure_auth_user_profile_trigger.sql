-- Ensure new auth users always get a user_profiles row (invite/signup safety net).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  meta_first TEXT;
  meta_last TEXT;
  meta_full TEXT;
BEGIN
  meta_first := NEW.raw_user_meta_data->>'first_name';
  meta_last := NEW.raw_user_meta_data->>'last_name';
  meta_full := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NULLIF(trim(concat_ws(' ', meta_first, meta_last)), ''),
    split_part(NEW.email, '@', 1)
  );

  INSERT INTO public.user_profiles (
    id,
    email,
    full_name,
    first_name,
    last_name,
    role,
    invite_status
  )
  VALUES (
    NEW.id,
    NEW.email,
    meta_full,
    COALESCE(meta_first, split_part(meta_full, ' ', 1)),
    COALESCE(meta_last, NULLIF(trim(substring(meta_full FROM position(' ' IN meta_full) + 1)), '')),
    'member',
    CASE
      WHEN NEW.invited_at IS NOT NULL AND NEW.email_confirmed_at IS NULL THEN 'pending'::invite_status
      ELSE 'active'::invite_status
    END
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

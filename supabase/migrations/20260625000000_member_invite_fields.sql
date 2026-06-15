-- Member invite fields: first/last name split and invite status tracking

DO $$ BEGIN
  CREATE TYPE invite_status AS ENUM ('pending', 'active');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS invite_status invite_status NOT NULL DEFAULT 'active';

-- Backfill first/last from full_name where possible
UPDATE user_profiles
SET
  first_name = COALESCE(first_name, split_part(COALESCE(full_name, ''), ' ', 1)),
  last_name = COALESCE(
    last_name,
    NULLIF(trim(substring(COALESCE(full_name, '') FROM position(' ' IN COALESCE(full_name, '')) + 1)), '')
  )
WHERE first_name IS NULL OR last_name IS NULL;

CREATE OR REPLACE FUNCTION handle_new_user()
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
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mark invite as active once email is confirmed
CREATE OR REPLACE FUNCTION mark_profile_active_on_confirm()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL AND (OLD.email_confirmed_at IS NULL OR OLD.email_confirmed_at IS DISTINCT FROM NEW.email_confirmed_at) THEN
    UPDATE public.user_profiles
    SET invite_status = 'active', updated_at = NOW()
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_email_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_email_confirmed
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION mark_profile_active_on_confirm();

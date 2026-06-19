-- Track successful member-portal sign-in separately from Supabase auth activity
-- (reset/invite links can update auth.last_sign_in_at without opening the app).

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS last_member_sign_in_at TIMESTAMPTZ;

COMMENT ON COLUMN user_profiles.last_member_sign_in_at IS
  'Set when the member completes Sign In (or restores a session) in the foxcreek.golf app.';

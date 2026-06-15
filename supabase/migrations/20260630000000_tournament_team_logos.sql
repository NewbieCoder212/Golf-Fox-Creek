-- Team logo URLs for tournament match play (uploaded via admin dashboard)

ALTER TABLE tournament_teams
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Public bucket for team logo images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'team-logos',
  'team-logos',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Team logos public read" ON storage.objects;
CREATE POLICY "Team logos public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'team-logos');

DROP POLICY IF EXISTS "Authenticated upload team logos" ON storage.objects;
CREATE POLICY "Authenticated upload team logos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'team-logos');

DROP POLICY IF EXISTS "Authenticated update team logos" ON storage.objects;
CREATE POLICY "Authenticated update team logos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'team-logos');

DROP POLICY IF EXISTS "Authenticated delete team logos" ON storage.objects;
CREATE POLICY "Authenticated delete team logos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'team-logos');

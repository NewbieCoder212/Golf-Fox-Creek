-- Sponsor ad rotation settings (carousel when multiple active ads share a slot)

INSERT INTO app_settings (setting_key, setting_value, description)
VALUES (
  'ad_rotation',
  '{"enabled": false, "interval_seconds": 12}'::jsonb,
  'Rotate sponsor ads when multiple active ads share the same placement slot'
)
ON CONFLICT (setting_key) DO NOTHING;

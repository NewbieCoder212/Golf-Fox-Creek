-- Turn break messaging (admin-editable) and GM announcement placeholder defaults

INSERT INTO app_settings (setting_key, setting_value, description)
VALUES (
  'turn_messaging',
  '{
    "scorecard_title": "Enjoy the Turn",
    "scorecard_countdown_label": "Back 9 starts in...",
    "scorecard_body": "Grab a snack, refresh your drink, and get ready for the back nine",
    "scorecard_skip_label": "Skip & Start Hole 10",
    "hub_title": "The Turn",
    "hub_prompt": "Stop by the canteen for refreshments?"
  }'::jsonb,
  'Built-in turn break copy shown on scorecard and home hub'
)
ON CONFLICT (setting_key) DO NOTHING;

UPDATE app_settings
SET setting_value = setting_value
  || '{
    "placeholder_enabled": true,
    "placeholder_title": "More Information Coming Soon",
    "placeholder_message": "We''re preparing club updates. More information to follow."
  }'::jsonb,
  updated_at = NOW()
WHERE setting_key = 'gm_announcements'
  AND NOT (setting_value ? 'placeholder_enabled');

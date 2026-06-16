-- Disable the default "More Information Coming Soon" placeholder banner on the home screen.
-- Real GM announcements still show when enabled in admin.

UPDATE app_settings
SET setting_value = setting_value || '{"placeholder_enabled": false}'::jsonb,
    updated_at = NOW()
WHERE setting_key = 'gm_announcements';

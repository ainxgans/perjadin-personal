-- Allow google_id to be NULL for pre-registered/invited users before first OAuth login
ALTER TABLE users ALTER COLUMN google_id DROP NOT NULL;

-- 1. Create workspaces table
CREATE TABLE IF NOT EXISTS workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama TEXT NOT NULL,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    join_code VARCHAR(12) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create workspace_members table
CREATE TABLE IF NOT EXISTS workspace_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'member',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_workspace_member UNIQUE (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_ws ON workspace_members(workspace_id);

-- 3. Backfill workspaces for existing users
INSERT INTO workspaces (id, nama, owner_id, join_code)
SELECT 
    gen_random_uuid(),
    'Workspace ' || u.name,
    u.id,
    UPPER(SUBSTRING(MD5(u.id::text || now()::text || random()::text) FROM 1 FOR 6))
FROM users u
ON CONFLICT DO NOTHING;

-- Backfill owners into workspace_members
INSERT INTO workspace_members (workspace_id, user_id, role)
SELECT id, owner_id, 'owner' FROM workspaces
ON CONFLICT (workspace_id, user_id) DO NOTHING;

-- 4. Alter trips table
ALTER TABLE trips ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;

-- Backfill trips.workspace_id using owner's workspace
UPDATE trips t
SET workspace_id = w.id
FROM workspaces w
WHERE w.owner_id = t.user_id AND t.workspace_id IS NULL;

-- 5. Drop legacy trip_members table
DROP TABLE IF EXISTS trip_members;

-- 6. Trigger to auto-assign default workspace if workspace_id is null
CREATE OR REPLACE FUNCTION trg_set_default_trip_workspace()
RETURNS TRIGGER AS $$
DECLARE
    v_ws_id UUID;
BEGIN
    IF NEW.workspace_id IS NULL THEN
        SELECT id INTO v_ws_id FROM workspaces WHERE owner_id = NEW.user_id ORDER BY created_at ASC LIMIT 1;
        IF v_ws_id IS NULL THEN
            INSERT INTO workspaces (nama, owner_id, join_code)
            VALUES ('Workspace Pribadi', NEW.user_id, UPPER(SUBSTRING(MD5(NEW.user_id::text || now()::text || random()::text) FROM 1 FOR 6)))
            RETURNING id INTO v_ws_id;

            INSERT INTO workspace_members (workspace_id, user_id, role)
            VALUES (v_ws_id, NEW.user_id, 'owner')
            ON CONFLICT (workspace_id, user_id) DO NOTHING;
        END IF;
        NEW.workspace_id := v_ws_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_default_trip_workspace ON trips;
CREATE TRIGGER set_default_trip_workspace
BEFORE INSERT ON trips
FOR EACH ROW
EXECUTE FUNCTION trg_set_default_trip_workspace();


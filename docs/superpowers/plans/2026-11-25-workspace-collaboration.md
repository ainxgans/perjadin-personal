# Notion-Style Workspace Collaboration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform trip collaboration from fragmented per-trip invitations (`trip_members`) into Notion-style shared Workspaces (`workspaces`, `workspace_members`), allowing users to switch workspaces and record trips/expenses for each other.

**Architecture:** Database schema introduces `workspaces` and `workspace_members`, tying `trips.workspace_id` to the active workspace. The backend inspects `X-Workspace-ID` on incoming requests with automatic fallback to the user's primary workspace. Frontend introduces a navbar Workspace Switcher dropdown, join-via-code modal, and workspace settings, while removing legacy per-trip collaborator controls.

**Tech Stack:** Go 1.22+, PostgreSQL (pq driver), SolidJS + Vite, TypeScript, Playwright MCP for E2E.

**Spec:** `docs/superpowers/specs/2026-11-25-workspace-collaboration-design.md`

## Global Constraints
- Migration must be non-destructive: existing users get a personal workspace; existing trips are assigned to their owner's workspace.
- `trips.workspace_id` must be NOT NULL once backfilled.
- Legacy `trip_members` table and routes must be dropped completely.
- Join codes are 6 alphanumeric uppercase characters (e.g. `A9B2X1`).
- All Go tests and frontend build must pass after every task.

## Review Focus
1. User supplies an invalid/unauthorized `X-Workspace-ID` in the request header -> Handler returns HTTP 403 Forbidden or 404 instead of leaking unauthorized trips.
2. User tries to join a workspace with an invalid or lowercase join code -> Backend normalizes to uppercase, rejects non-existent code with 404 "workspace tidak ditemukan".
3. User joins a workspace they are already a member of -> Idempotent operation returning 200 OK without database error.
4. User switches workspace on frontend -> All trip lists, dashboard totals, and analytics update immediately to match the newly selected workspace.
5. Deleting or dropping `trip_members` does not delete existing trips or expenses (expenses retain `expenses.user_id`).

---

### Task 1: Migration 009 - Workspaces Schema & Backfill

**Files:**
- Create: `internal/db/migrations/009_create_workspaces.sql`
- Modify: `internal/db/migrations_test.go` (or run migration test)

**Interfaces:**
- Produces: `workspaces`, `workspace_members` tables, `trips.workspace_id` column, drops `trip_members`.

- [ ] **Step 1: Write migration `internal/db/migrations/009_create_workspaces.sql`**
```sql
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
```

- [ ] **Step 2: Run migration on test database**
Run: `TEST_DATABASE_URL="postgres:///perjadin_test?host=/run/postgresql&port=5433&sslmode=disable" go test ./internal/db/... -v`
Expected: PASS

- [ ] **Step 3: Commit**
```bash
git add internal/db/migrations/009_create_workspaces.sql
git commit -m "feat(db): add 009_create_workspaces migration and drop trip_members"
```

---

### Task 2: Go Models, Context Helper & Auto-Provisioning

**Files:**
- Modify: `internal/model/models.go`
- Create: `internal/handler/workspace_context.go`
- Modify: `internal/handler/auth.go`
- Test: `internal/handler/workspace_context_test.go`

**Interfaces:**
- Produces: `model.Workspace`, `model.WorkspaceMember`
- Produces: `ResolveWorkspaceID(r *http.Request, db *sql.DB, userID string) (string, error)`
- Produces: `EnsurePersonalWorkspace(db *sql.DB, userID, userName string) (string, error)`

- [ ] **Step 1: Update `internal/model/models.go`**
Add `Workspace`, `WorkspaceMember`, and update `Trip` with `WorkspaceID string`:
```go
type Workspace struct {
    ID          string    `json:"id"`
    Nama        string    `json:"nama"`
    OwnerID     string    `json:"owner_id"`
    JoinCode    string    `json:"join_code,omitempty"`
    Role        string    `json:"role,omitempty"`
    MemberCount int       `json:"member_count,omitempty"`
    CreatedAt   time.Time `json:"created_at"`
    UpdatedAt   time.Time `json:"updated_at"`
}

type WorkspaceMember struct {
    ID          string    `json:"id"`
    WorkspaceID string    `json:"workspace_id"`
    UserID      string    `json:"user_id"`
    Name        string    `json:"name"`
    Email       string    `json:"email"`
    AvatarURL   string    `json:"avatar_url"`
    Role        string    `json:"role"`
    CreatedAt   time.Time `json:"created_at"`
}
```

- [ ] **Step 2: Implement `internal/handler/workspace_context.go`**
- `ResolveWorkspaceID`: reads `X-Workspace-ID` header. If set, verifies user is in `workspace_members`. If not set or invalid, queries the user's first workspace. Returns `(workspaceID, nil)` or error if user has no workspace.
- `EnsurePersonalWorkspace`: ensures user has at least one workspace. If none, inserts into `workspaces` and `workspace_members`.

- [ ] **Step 3: Hook `EnsurePersonalWorkspace` in `internal/handler/auth.go`**
In `devLoginHandler` and `googleCallbackHandler`, invoke `EnsurePersonalWorkspace` right after user creation/fetch.

- [ ] **Step 4: Write unit test in `internal/handler/workspace_context_test.go`**
Test resolving header workspace, resolving default workspace, and unauthorized workspace access.

- [ ] **Step 5: Run tests and commit**
Run: `TEST_DATABASE_URL="postgres:///perjadin_test?host=/run/postgresql&port=5433&sslmode=disable" go test ./internal/handler/... -v -run TestResolveWorkspace`
Expected: PASS
```bash
git add internal/model/ internal/handler/
git commit -m "feat(api): add workspace models, context resolver, and auto-provisioning"
```

---

### Task 3: Workspace CRUD & Join Endpoints

**Files:**
- Create: `internal/handler/workspace.go`
- Modify: `cmd/server/main.go`
- Test: `internal/handler/workspace_test.go`

**Interfaces:**
- Produces:
  - `ListWorkspaces(db *sql.DB) http.HandlerFunc` -> `GET /api/workspaces`
  - `CreateWorkspace(db *sql.DB) http.HandlerFunc` -> `POST /api/workspaces`
  - `GetCurrentWorkspace(db *sql.DB) http.HandlerFunc` -> `GET /api/workspaces/current`
  - `JoinWorkspace(db *sql.DB) http.HandlerFunc` -> `POST /api/workspaces/join`
  - `RegenerateJoinCode(db *sql.DB) http.HandlerFunc` -> `POST /api/workspaces/regenerate-code`
  - `RemoveWorkspaceMember(db *sql.DB) http.HandlerFunc` -> `DELETE /api/workspaces/{id}/members/{userID}`

- [ ] **Step 1: Write failing tests in `internal/handler/workspace_test.go`**
Test:
1. `TestListWorkspaces`: returns workspaces user is a member of.
2. `TestCreateWorkspace`: creates workspace with random 6-char uppercase join code.
3. `TestJoinWorkspace_Success`: user B joins user A's workspace with code.
4. `TestJoinWorkspace_CaseInsensitive`: lowercase code matches uppercase join code.
5. `TestJoinWorkspace_Idempotent`: joining twice returns 200 without error.
6. `TestJoinWorkspace_NotFound`: invalid code returns 404.

- [ ] **Step 2: Implement handlers in `internal/handler/workspace.go`**
Implement the handlers with proper query scanning and error handling.

- [ ] **Step 3: Register routes in `cmd/server/main.go`**
Wire routes with `authMW`.

- [ ] **Step 4: Run tests and commit**
Run: `TEST_DATABASE_URL="postgres:///perjadin_test?host=/run/postgresql&port=5433&sslmode=disable" go test ./internal/handler/... -v -run TestWorkspace`
Expected: PASS
```bash
git add internal/handler/workspace.go internal/handler/workspace_test.go cmd/server/main.go
git commit -m "feat(api): implement workspace CRUD and join endpoints"
```

---

### Task 4: Scope Trips, Dashboard, and Analytics to Active Workspace

**Files:**
- Modify: `internal/handler/trip.go` (include `workspace_id` in SELECT, INSERT, filter by `workspace_id`)
- Modify: `internal/handler/dashboard.go` (filter trips by `workspace_id`)
- Modify: `internal/handler/analytics.go` (filter trips by `workspace_id`)
- Delete: `internal/handler/collaborator.go` & `internal/handler/collaborator_test.go`
- Modify: `cmd/server/main.go` (remove `/api/trips/{id}/members` routes)
- Modify: `internal/handler/trip_test.go`

**Interfaces:**
- Consumes: `ResolveWorkspaceID(r, db, userID)`
- Modifies: `ListTrips`, `CreateTrip`, `GetDashboard`, `GetAnalytics` queries to filter by `workspace_id = $1`.

- [ ] **Step 1: Delete `internal/handler/collaborator.go` and remove routes from `cmd/server/main.go`**
Remove legacy `trip_members` handlers.

- [ ] **Step 2: Update `internal/handler/trip.go`**
- In `ListTrips`: resolve active workspace ID; query `WHERE t.workspace_id = $1`.
- In `CreateTrip`: resolve active workspace ID; insert with `workspace_id = $1`.
- In `GetTrip`, `UpdateTrip`, `DeleteTrip`: ensure trip belongs to active workspace where user is a member.

- [ ] **Step 3: Update `internal/handler/dashboard.go` and `internal/handler/analytics.go`**
Filter dashboard and analytics calculations to `trips.workspace_id = $1`.

- [ ] **Step 4: Update test suites in `internal/handler/`**
Update `trip_test.go`, `dashboard_test.go`, and `analytics_test.go` to assign trips to the user's workspace.
Add test: `TestWorkspaceIsolation`: trips created in Workspace 1 do not appear in Workspace 2.

- [ ] **Step 5: Run all backend tests and commit**
Run: `TEST_DATABASE_URL="postgres:///perjadin_test?host=/run/postgresql&port=5433&sslmode=disable" go test ./... -count=1`
Expected: ALL PASS
```bash
git add internal/handler/ cmd/server/
git commit -m "feat(api): scope trips, dashboard, and analytics to active workspace"
```

---

### Task 5: Frontend API Client & Workspace State Store

**Files:**
- Modify: `web/src/api.ts`
- Create: `web/src/store/workspace.ts`

**Interfaces:**
- Produces:
  - `web/src/api.ts`: `getWorkspaces()`, `createWorkspace()`, `getCurrentWorkspace()`, `joinWorkspace(code)`, `regenerateJoinCode()`, `removeWorkspaceMember(userId)`
  - Header injection in `apiFetch`: `X-Workspace-ID`
  - `web/src/store/workspace.ts`: `activeWorkspace`, `workspacesList`, `setActiveWorkspaceId(id)`, `refreshWorkspaces()`

- [ ] **Step 1: Update `web/src/api.ts`**
- Add `Workspace` and `WorkspaceMember` interfaces.
- Remove old `TripMember` methods (`getTripMembers`, `addTripMember`, `removeTripMember`).
- In `apiFetch`: read `localStorage.getItem('active_workspace_id')` and attach header `X-Workspace-ID`.
- Export workspace API methods.

- [ ] **Step 2: Implement `web/src/store/workspace.ts`**
SolidJS reactive store/signals holding `workspaces`, `activeWorkspaceId`, `activeWorkspace`, and helper functions.

- [ ] **Step 3: Verify build**
Run: `npm --prefix web run build`
Expected: PASS (or note any caller changes needed in Task 6).

- [ ] **Step 4: Commit**
```bash
git add web/src/api.ts web/src/store/
git commit -m "feat(web): add workspace API client and reactive state store"
```

---

### Task 6: Frontend Navbar Workspace Switcher & Modals

**Files:**
- Create: `web/src/components/WorkspaceSwitcher.tsx`
- Modify: `web/src/components/Navbar.tsx` (or top layout)
- Modify: `web/src/pages/TripDetail.tsx` (remove member card and collaborator modals)
- Modify: `web/src/components/Icons.tsx` (add Briefcase / Building / Copy icons if needed)

- [ ] **Step 1: Implement `web/src/components/WorkspaceSwitcher.tsx`**
- Dropdown menu showing active workspace name + badge.
- List of workspaces user belongs to.
- Trigger modal "Buat Workspace Baru" (input nama).
- Trigger modal "Gabung Workspace" (input 6-char code).
- Trigger modal "Pengaturan Workspace" (display Join Code, copy link button, list members).

- [ ] **Step 2: Embed `WorkspaceSwitcher` in Navbar**
Position on the left side of user avatar in `web/src/components/Navbar.tsx`.

- [ ] **Step 3: Clean up `web/src/pages/TripDetail.tsx`**
Remove legacy collaborator invite UI and members drawer/card.

- [ ] **Step 4: Test frontend build**
Run: `npm --prefix web run build`
Expected: PASS with 0 errors.

- [ ] **Step 5: Commit**
```bash
git add web/src/
git commit -m "feat(web): add WorkspaceSwitcher dropdown, modals, and clean up TripDetail"
```

---

### Task 7: End-to-End Verification with Playwright

**Files:**
- Test via Playwright execution

- [ ] **Step 1: Start local backend server**
Run: `go run cmd/server/main.go` on port 8888.

- [ ] **Step 2: Playwright automated verification**
1. User A logs in -> Has default personal workspace.
2. User A opens Workspace Settings -> Copies Join Code.
3. User B logs in (different session/cookie).
4. User B opens Workspace Switcher -> Clicks "Gabung Workspace" -> Enters Join Code.
5. User B switches to User A's workspace.
6. User B creates a new trip ("Dinas Koordinasi Semarang") in User A's workspace.
7. User A refreshes dashboard in User A's workspace -> Verifies "Dinas Koordinasi Semarang" appears.
8. User B switches back to Personal Workspace -> Verifies "Dinas Koordinasi Semarang" does not appear in personal space.

- [ ] **Step 3: Final commit and push**
```bash
git add .
git commit -m "feat: complete Notion-style workspace collaboration"
git push origin main
```

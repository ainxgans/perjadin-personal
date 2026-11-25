# Admin User Management, Pre-Registration / Invite, Sole Admin Guard & SBM Chips Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide an interactive chips/tags input for SBM cities in Admin Master, protect the sole admin from demotion in User Management, and allow Admins to pre-register/invite new users by email so they can immediately be added as collaborators on trips.

**Architecture:**
- DB migration drops `NOT NULL` constraint on `users.google_id` to allow pre-registered users.
- Backend adds `POST /api/admin/users` to create users with email, name, role; Google OAuth upsert links `google_id` when the pre-registered user logs in.
- Frontend introduces `ChipsInput.tsx` for managing city tags in SBM, guards the sole admin in `AdminUsers.tsx`, marks current user with `(Anda)`, and provides a "+ Tambah Pengguna" modal.

**Tech Stack:** Go 1.24, PostgreSQL, SolidJS, Vite, TypeScript, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-25-admin-user-collab-master-chips-design.md`

## Global Constraints
- Do not introduce heavy npm dependencies for chips; build a focused, lightweight native SolidJS component.
- Ensure sole admin cannot be demoted under any circumstance.
- Ensure pre-registered users with no `google_id` can be queried, listed, and added as trip members (`trip_members`).

## Review Focus
- **Email collision on OAuth login:** When an invited user logs in via Google OAuth for the first time, their existing record by email must be updated with `google_id` rather than failing on unique constraint.
- **Sole admin demotion attempt:** Disabling the button in UI must be backed by backend rejection (`cannot demote the sole admin`).
- **Duplicate city chip in SBM:** ChipsInput must trim input, ignore empty strings, and reject existing cities case-insensitively.
- **Empty cities payload:** SBM save must work gracefully with zero or multiple cities.
- **Chip deletion:** Backspace on empty input removes the last chip; clicking `×` removes the targeted chip.

---

### Task 1: Database Migration `006_users_pre_register.sql`

**Files:**
- Create: `internal/db/migrations/006_users_pre_register.sql`
- Modify: `internal/db/migrations_test.go`

**Interfaces:**
- Produces: `ALTER TABLE users ALTER COLUMN google_id DROP NOT NULL;`

- [ ] **Step 1: Write migration file `internal/db/migrations/006_users_pre_register.sql`**
```sql
-- Allow google_id to be NULL for pre-registered/invited users
ALTER TABLE users ALTER COLUMN google_id DROP NOT NULL;
```

- [ ] **Step 2: Add migration test case in `internal/db/migrations_test.go`**
Test that `006_users_pre_register.sql` syntax is checked.

- [ ] **Step 3: Run migration test and apply to test DB**
Run: `TEST_DATABASE_URL="postgres:///perjadin_test?host=/run/postgresql&port=5433&sslmode=disable" go test ./internal/db -v`
Expected: PASS

- [ ] **Step 4: Commit**
```bash
git add internal/db/migrations/006_users_pre_register.sql internal/db/migrations_test.go
git commit -m "feat(db): migration 006 make google_id nullable for user pre-registration"
```

---

### Task 2: Backend `POST /api/admin/users` & Google OAuth Linking

**Files:**
- Modify: `internal/handler/admin_user.go`
- Modify: `internal/auth/google.go`
- Modify: `cmd/server/main.go`
- Test: `internal/handler/admin_user_test.go`

**Interfaces:**
- Consumes: `users` table with nullable `google_id`
- Produces:
  - `CreateAdminUser(db *sql.DB) http.HandlerFunc` mapped to `POST /api/admin/users`
  - Body: `{"email": string, "name": string, "role": "admin"|"user"}`
  - Returns `201 Created` with user record.

- [ ] **Step 1: Write failing test in `internal/handler/admin_user_test.go`**
```go
func TestCreateAdminUser_Success(t *testing.T) { ... }
func TestCreateAdminUser_DuplicateEmail(t *testing.T) { ... }
func TestCreateAdminUser_ForbiddenForRegularUser(t *testing.T) { ... }
```

- [ ] **Step 2: Run test to verify it fails**
Run: `TEST_DATABASE_URL="postgres:///perjadin_test?host=/run/postgresql&port=5433&sslmode=disable" go test ./internal/handler -run "TestCreateAdminUser" -v`
Expected: FAIL

- [ ] **Step 3: Implement `CreateAdminUser` in `internal/handler/admin_user.go` and register route in `cmd/server/main.go`**
Validate email & name, insert into `users (email, name, role)`, return user object. Also update `internal/auth/google.go` to link `google_id` if email already exists with empty/null `google_id`.

- [ ] **Step 4: Run backend tests to verify they pass**
Run: `TEST_DATABASE_URL="postgres:///perjadin_test?host=/run/postgresql&port=5433&sslmode=disable" go test ./internal/handler -run "TestCreateAdminUser" -v`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add internal/handler/admin_user.go internal/auth/google.go cmd/server/main.go internal/handler/admin_user_test.go
git commit -m "feat(api): add CreateAdminUser endpoint and oauth google_id linking"
```

---

### Task 3: Frontend `ChipsInput.tsx` & Master SBM Integration

**Files:**
- Create: `web/src/components/ChipsInput.tsx`
- Modify: `web/src/pages/admin/AdminMaster.tsx`

**Interfaces:**
- Produces:
  - `<ChipsInput values={() => string[]} onChange={(vals: string[]) => void} placeholder?: string />`
  - Chips with delete button `×`, Enter/comma to add, backspace to delete last chip.
- Consumes in `AdminMaster.tsx`: replaces plain text input in SBM modal. Renders neat badges in SBM list.

- [ ] **Step 1: Create `web/src/components/ChipsInput.tsx`**
Implement SolidJS component with keyboard events (`Enter`, `,`, `Backspace`), duplicate prevention, trim.

- [ ] **Step 2: Update `web/src/pages/admin/AdminMaster.tsx`**
- Replace `formKota` comma-delimited string with string array / `ChipsInput`.
- Update list view in `AdminMaster.tsx` to render chips with overflow truncation (e.g. 3 chips + "+X lainnya" expandable).
- Add quick search filter for Kategori & Metode Pembayaran tabs.

- [ ] **Step 3: Verify frontend build**
Run: `cd web && npm run build`
Expected: build succeeds without type errors.

- [ ] **Step 4: Commit**
```bash
git add web/src/components/ChipsInput.tsx web/src/pages/admin/AdminMaster.tsx
git commit -m "feat(web): add ChipsInput component and integrate into AdminMaster SBM"
```

---

### Task 4: Frontend `AdminUsers.tsx` Sole Admin Guard & User Invite Modal

**Files:**
- Modify: `web/src/api.ts`
- Modify: `web/src/pages/admin/AdminUsers.tsx`

**Interfaces:**
- Produces:
  - `createAdminUser(data: { email: string; name: string; role: 'admin' | 'user' })` in `api.ts`
  - Sole admin disabled button + warning text in `AdminUsers.tsx`.
  - Label badge `(Anda)` for current active user.
  - Role filter tabs: `Semua`, `Admin`, `User`.
  - "+ Tambah Pengguna" modal.

- [ ] **Step 1: Add `createAdminUser` in `web/src/api.ts`**
Add API helper for `POST /api/admin/users`.

- [ ] **Step 2: Implement UI updates in `web/src/pages/admin/AdminUsers.tsx`**
- Compute `totalAdmins`: `users().filter(u => u.role === 'admin').length`.
- If `u.role === 'admin' && totalAdmins <= 1`, disable "Jadikan User" button with title / tooltip "Admin tunggal tidak dapat didemosi".
- If `u.id === currentUser()?.id`, display badge `(Anda)` next to user name.
- Add Role Filter tabs (`Semua`, `Admin`, `User`).
- Add "+ Tambah Pengguna" modal with fields for Email, Nama Lengkap, Role.

- [ ] **Step 3: Verify frontend build**
Run: `cd web && npm run build`
Expected: PASS

- [ ] **Step 4: Commit**
```bash
git add web/src/api.ts web/src/pages/admin/AdminUsers.tsx
git commit -m "feat(web): add sole admin guard, user badge, and invite user modal in AdminUsers"
```

---

### Task 5: End-to-End Verification with Go Tests & Playwright

**Files:**
- Verify: Full Go test suite
- Verify: Playwright browser tests on `/admin/master`, `/admin/users`, and `/trips/:id` collaborator search.

- [ ] **Step 1: Run full Go test suite**
Run: `TEST_DATABASE_URL="postgres:///perjadin_test?host=/run/postgresql&port=5433&sslmode=disable" go test ./... -v`
Expected: PASS

- [ ] **Step 2: Run Playwright verification**
1. Test `/admin/master`: Add/edit SBM with `ChipsInput`, add chips, remove chip, save.
2. Test `/admin/users`: Check sole admin button is disabled. Click "+ Tambah Pengguna", add new user `rekan.baru@kantor.go.id` ("Rekan Baru").
3. Test `/trips/:id`: Go to a trip, click "+ Undang Rekan", search `rekan.baru@kantor.go.id`, invite, verify added to roster.

- [ ] **Step 3: Push changes to `origin/main`**
```bash
git push origin main
```

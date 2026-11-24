# Perjadin Super-App Upgrade & Dedicated Admin Terminal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Perjadin into a feature-rich mobile super-app with a dedicated multi-page Admin terminal (user directory, role management, master data), analytics dashboard, and deep search/filter capabilities.

**Architecture:** Extend Go backend with admin user management, system statistics, and financial analytics endpoints. Overhaul SolidJS frontend into a thumb-zone super-app with persistent bottom navigation dock, dedicated sub-routed Admin portal (`/admin`, `/admin/users`, `/admin/master`), and visual breakdown charts.

**Tech Stack:** Go 1.22 (`net/http`, `lib/pq`), PostgreSQL 16, SolidJS 1.9, TypeScript 5.7, Vite 6.

**Spec:** `docs/superpowers/specs/2026-11-24-perjadin-upgrade-design.md`

## Global Constraints
- All backend routes follow `{"data": ...}` or `{"error": "..."}` JSON envelope.
- IDs are UUIDs; money values are `int64` Rupiah.
- Go path pattern matching (`r.PathValue(...)`).
- Max container width `480px` for mobile-first terminal viewport.

## Review Focus
- Demoting self as the sole admin must return 400 Bad Request to prevent lockout.
- Querying `/api/admin/users` as regular user must return 403 Forbidden.
- Search filter on dashboard must match both trip name and destination case-insensitively.
- Status filter chips (All, Berlangsung, Urus Berkas, Selesai) must correctly filter trips without page reload.
- Non-admin users navigating to `/admin/*` must be redirected safely to dashboard.

---

### Task 1: Backend Admin User Management & System Stats API

**Files:**
- Create: `internal/handler/admin_user.go`
- Create: `internal/handler/admin_user_test.go`
- Modify: `cmd/server/main.go`

**Interfaces:**
- Produces:
  - `ListAdminUsers(db *sql.DB) http.HandlerFunc`: Returns list of users with total trips.
  - `UpdateUserRole(db *sql.DB) http.HandlerFunc`: Toggles user role (`admin` | `user`).
  - `GetAdminStats(db *sql.DB) http.HandlerFunc`: Returns total users, trips, expenses.

- [ ] **Step 1: Write failing tests in `internal/handler/admin_user_test.go`**
  - `TestListAdminUsers_ForbiddenForRegularUser`
  - `TestListAdminUsers_SuccessForAdmin`
  - `TestUpdateUserRole_Success`
  - `TestUpdateUserRole_PreventSelfDemotionIfSoleAdmin`
  - `TestGetAdminStats`

- [ ] **Step 2: Run test to verify it fails**
  `go test ./internal/handler -run TestListAdminUsers`

- [ ] **Step 3: Implement handlers in `internal/handler/admin_user.go`**
  - Query `users` joined with `trips`.
  - Validate role values (`admin`, `user`).
  - Prevent sole admin demotion.

- [ ] **Step 4: Wire routes in `cmd/server/main.go`**
  - `GET /api/admin/users` -> `authMW(adminMW(ListAdminUsers))`
  - `PUT /api/admin/users/{id}/role` -> `authMW(adminMW(UpdateUserRole))`
  - `GET /api/admin/stats` -> `authMW(adminMW(GetAdminStats))`

- [ ] **Step 5: Run tests to verify they pass**
  `go test ./internal/handler -v -run "TestListAdminUsers|TestUpdateUserRole|TestGetAdminStats"`

- [ ] **Step 6: Commit**
  ```bash
  git add internal/handler/admin_user* cmd/server/main.go
  git commit -m "feat(api): admin users management and system stats endpoints"
  ```

---

### Task 2: Backend Financial Analytics API

**Files:**
- Create: `internal/handler/analytics.go`
- Create: `internal/handler/analytics_test.go`
- Modify: `cmd/server/main.go`

**Interfaces:**
- Produces:
  - `GetAnalytics(db *sql.DB) http.HandlerFunc`: Returns user's category breakdown & payment method distribution.

- [ ] **Step 1: Write failing tests in `internal/handler/analytics_test.go`**
  - `TestGetAnalytics_Success`
  - `TestGetAnalytics_EmptyData`

- [ ] **Step 2: Run test to verify failure**
  `go test ./internal/handler -run TestGetAnalytics`

- [ ] **Step 3: Implement `GetAnalytics` in `internal/handler/analytics.go`**
  - Query category totals for user's trips.
  - Query payment method totals for user's trips.

- [ ] **Step 4: Wire route in `cmd/server/main.go`**
  - `GET /api/analytics` -> `authMW(GetAnalytics)`

- [ ] **Step 5: Run tests and verify PASS**
  `go test ./internal/handler -v -run TestGetAnalytics`

- [ ] **Step 6: Commit**
  ```bash
  git add internal/handler/analytics* cmd/server/main.go
  git commit -m "feat(api): financial analytics endpoint"
  ```

---

### Task 3: Frontend API & Persistent Bottom Dock Navigation

**Files:**
- Modify: `web/src/api.ts`
- Create: `web/src/components/BottomNav.tsx`
- Modify: `web/src/App.tsx`
- Modify: `web/src/styles/global.css`

**Interfaces:**
- Produces:
  - `getAdminUsers()`, `updateUserRole(id, role)`, `getAdminStats()`, `getAnalytics()`.
  - `<BottomNav user={user()} />` component.

- [ ] **Step 1: Add new API client functions in `web/src/api.ts`**
  - Types: `AdminUser`, `AdminStats`, `AnalyticsData`.
  - Export fetch functions for admin users, role update, stats, and analytics.

- [ ] **Step 2: Create `web/src/components/BottomNav.tsx`**
  - Floating bottom dock with 3 primary tabs:
    - 🛫 **Perjalanan** (`/`)
    - 📊 **Analitik** (`/analytics`)
    - ⚙️ **Admin** (`/admin`) *(rendered conditionally when `user.role === 'admin'`)*.
  - Active route highlighting.

- [ ] **Step 3: Integrate BottomNav in `web/src/App.tsx` layout and add bottom dock styles in `global.css`**

- [ ] **Step 4: Verify build**
  `cd web && npm run build`

- [ ] **Step 5: Commit**
  ```bash
  git add web/src/api.ts web/src/components/BottomNav.tsx web/src/App.tsx web/src/styles/global.css
  git commit -m "feat(ui): persistent bottom dock navigation and extended api clients"
  ```

---

### Task 4: Frontend Rich Feed & Filtering on Dashboard

**Files:**
- Modify: `web/src/pages/Dashboard.tsx`

**Interfaces:**
- Consumes: `getDashboard()`, `getTrips()`.

- [ ] **Step 1: Implement search bar & filter chips state in `Dashboard.tsx`**
  - `searchQuery` signal: filters trips by `trip.nama` and `trip.tujuan`.
  - `statusFilter` signal: filters by `all`, `berlangsung`, `urus_berkas`, `selesai`.
  - Filter chips bar with active pill styling.

- [ ] **Step 2: Add category mini-progress bar to each ticket card**
  - Visual indicator showing expenditure vs uang dinas burn-down.

- [ ] **Step 3: Verify build**
  `cd web && npm run build`

- [ ] **Step 4: Commit**
  ```bash
  git add web/src/pages/Dashboard.tsx
  git commit -m "feat(ui): add search, status filter chips, and burn-down gauge to dashboard"
  ```

---

### Task 5: Frontend Dedicated Multi-Page Admin Terminal

**Files:**
- Create: `web/src/pages/admin/AdminHub.tsx`
- Create: `web/src/pages/admin/AdminUsers.tsx`
- Create: `web/src/pages/admin/AdminMaster.tsx`
- Modify: `web/src/App.tsx`

**Interfaces:**
- Routes:
  - `/admin`: Hub overview & system stats.
  - `/admin/users`: User directory & role assignment.
  - `/admin/master`: Categories & payment methods master data.

- [ ] **Step 1: Create `web/src/pages/admin/AdminHub.tsx`**
  - Display system stats (`total_users`, `total_trips`, `total_expenses_rp`).
  - Quick action portal cards to `/admin/users` and `/admin/master`.

- [ ] **Step 2: Create `web/src/pages/admin/AdminUsers.tsx`**
  - User search & list.
  - Avatar, email, joined date, total trips count.
  - Role switcher button (`admin` <-> `user`) with confirmation modal.

- [ ] **Step 3: Create `web/src/pages/admin/AdminMaster.tsx`**
  - Tab selector: Kategori vs Metode Pembayaran.
  - Full CRUD with instant feedback.

- [ ] **Step 4: Register routes in `web/src/App.tsx`**

- [ ] **Step 5: Verify build**
  `cd web && npm run build`

- [ ] **Step 6: Commit**
  ```bash
  git add web/src/pages/admin/* web/src/App.tsx
  git commit -m "feat(ui): dedicated multi-page admin terminal with user directory and master hub"
  ```

---

### Task 6: Frontend Analytics & Visual Breakdown Page

**Files:**
- Create: `web/src/pages/Analytics.tsx`
- Modify: `web/src/App.tsx`

**Interfaces:**
- Consumes: `getAnalytics()`.
- Route: `/analytics`.

- [ ] **Step 1: Create `web/src/pages/Analytics.tsx`**
  - Category spending distribution with visual percentage bars.
  - Payment method cashflow allocation (Pribadi, Koperasi, Talangan).
  - Stat cards: Total spent, Average per trip, Highest category.

- [ ] **Step 2: Register route in `web/src/App.tsx`**

- [ ] **Step 3: Verify build**
  `cd web && npm run build`

- [ ] **Step 4: Commit**
  ```bash
  git add web/src/pages/Analytics.tsx web/src/App.tsx
  git commit -m "feat(ui): financial analytics and visual category spending page"
  ```

---

### Task 7: Full Verification, Docker Test & Push to Remote

**Files:**
- All modified files

- [ ] **Step 1: Run full Go test suite**
  `go test ./... -v`

- [ ] **Step 2: Run frontend production build**
  `cd web && npm run build`

- [ ] **Step 3: Push all commits to `origin/main`**
  `git push origin main`

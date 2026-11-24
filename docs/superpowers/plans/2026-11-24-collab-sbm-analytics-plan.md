# Trip Collaborators, SBM Uang Harian Master, & UX Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menambahkan fitur kolaborator perjalanan dinas (shared trip workspace), master tarif SBM uang harian per provinsi dengan creatable select dan kalkulasi estimasi otomatis di formulir, ekspansi 4 card analitik finansial, serta perbaikan tombol shortcut pengeluaran mobile agar tidak tertutup navbar dock.

**Architecture:** 
1. Database PostgreSQL dimigrasi dengan tabel `sbm_rates` (seeder 38 provinsi), `trip_members` untuk relasi N-to-N trip dan user, serta penambahan kolom `user_id` pada `expenses`.
2. Router Go stdlib `net/http` ditambah endpoint SBM CRUD, user search untuk modal picker, dan manajemen kolaborator trip dengan hak akses berbasis role (owner/admin vs member).
3. Frontend SolidJS + Vite diperkaya dengan komponen `CreatableSelect`, floating action docklet yang aman dari bottom nav dock (`bottom: 5.5rem`), tab master SBM di terminal admin, dan visualisasi 4 metrik baru di halaman analitik.

**Tech Stack:** Go 1.22 (stdlib net/http, database/sql), PostgreSQL 16 (raw SQL migrations), SolidJS, TypeScript, Vite, CSS design tokens.

**Spec:** `docs/superpowers/specs/2026-11-24-collab-sbm-analytics-design.md`

## Global Constraints
- Bahasa kode: Go stdlib untuk backend, SolidJS + TypeScript untuk frontend.
- Tidak menambah third-party CSS library atau icon library eksternal (tetap menggunakan SVG icon system native `Icons.tsx` dan CSS `global.css`).
- Zero slop: warna palet matte slate/obsidian, font JetBrains Mono untuk angka mata uang (`amount`), sans-serif clean.
- Idempotent database migrations: migrasi otomatis dijalankan saat start aplikasi via `db.Migrate()`.

## Review Focus
1. **Pemisahan Pengeluaran Kolaborator di Analitik**: Memastikan `GET /api/analytics` hanya menghitung pengeluaran milik user login (`e.user_id = auth_user`) sehingga tidak terjadi duplikasi pembukuan antar anggota trip.
2. **Otorisasi Modifikasi Pengeluaran**: Memastikan anggota kolaborator hanya dapat mengedit/menghapus pengeluaran miliknya sendiri, sedangkan owner dan admin memiliki wewenang mengoreksi semua pengeluaran di trip tersebut.
3. **Isolasi Metadata Trip**: Memastikan anggota kolaborator tidak dapat mengubah anggaran/nama trip (`PUT /api/trips/{id}`) ataupun menghapus trip (`DELETE /api/trips/{id}`).
4. **Kalkulasi Rasio Realisasi Pagu**: Memastikan pembilang (expenses) dan penyebut (uang dinas) hanya menyaring trip berstatus `lunas` agar rasio tidak terdistorsi oleh trip yang belum selesai.
5. **Ergonomi Layar Sentuh Mobile**: Memastikan tombol tambah pengeluaran memiliki touch-target minimal 48px dan `bottom: 5.5rem` dengan z-index di atas konten dan di bawah modal, sehingga tidak tumpang tindih dengan bottom dock (`z-index: 50`).

---

### Task 1: Database Migration 004 & SBM Initial Seeder

**Files:**
- Create: `internal/db/migrations/004_collab_and_sbm.sql`
- Test: `internal/db/migrations_test.go`

**Interfaces:**
- Produces: Tables `sbm_rates`, `trip_members`, and column `expenses.user_id` in PostgreSQL.

- [ ] **Step 1: Write SQL migration file `internal/db/migrations/004_collab_and_sbm.sql`**

Isi migration:
- `CREATE TABLE IF NOT EXISTS sbm_rates (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), provinsi TEXT NOT NULL, ibukota TEXT NOT NULL DEFAULT '', uang_harian BIGINT NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());`
- `CREATE UNIQUE INDEX IF NOT EXISTS idx_sbm_provinsi ON sbm_rates (LOWER(provinsi));`
- `CREATE TABLE IF NOT EXISTS trip_members (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, role VARCHAR(20) NOT NULL DEFAULT 'member', created_at TIMESTAMPTZ NOT NULL DEFAULT now(), CONSTRAINT uq_trip_member UNIQUE(trip_id, user_id));`
- `CREATE INDEX IF NOT EXISTS idx_trip_members_user ON trip_members (user_id);`
- `CREATE INDEX IF NOT EXISTS idx_trip_members_trip ON trip_members (trip_id);`
- `ALTER TABLE expenses ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;`
- Backfill 38 provinsi tarif SBM PMK (DKI Jakarta: 530000, Jawa Barat: 430000, Jawa Tengah: 370000, DI Yogyakarta: 420000, Jawa Timur: 410000, Bali: 480000, Banten: 370000, Aceh: 360000, Sumut: 370000, Sumbar: 380000, Riau: 370000, Kepri: 370000, Jambi: 370000, Sumsel: 380000, Babel: 410000, Bengkulu: 380000, Lampung: 380000, Kalbar: 380000, Kalteng: 360000, Kalsel: 380000, Kaltim: 430000, Kaltara: 430000, Sulut: 370000, Gorontalo: 370000, Sulteng: 370000, Sulsel: 430000, Sulbar: 340000, Sultra: 380000, Maluku: 380000, Malut: 430000, Papua: 580000, Papua Barat: 480000, Papua Selatan: 580000, Papua Tengah: 580000, Papua Pegunungan: 580000, Papua Barat Daya: 480000, NTB: 440000, NTT: 430000).

- [ ] **Step 2: Write test to verify migration runs cleanly**

Write `TestMigration004` in `internal/db/migrations_test.go` to verify table creation and row seeding.

- [ ] **Step 3: Run test**

Run: `go test ./internal/db/ -run TestMigration004 -v`

- [ ] **Step 4: Commit**

```bash
git add internal/db/migrations/004_collab_and_sbm.sql internal/db/migrations_test.go
git commit -m "feat(db): migration 004 for sbm_rates, trip_members, and expenses.user_id"
```

---

### Task 2: Backend SBM Master & User Search Endpoints

**Files:**
- Create: `internal/handler/sbm.go`
- Create: `internal/handler/user_search.go`
- Modify: `main.go`
- Test: `internal/handler/sbm_test.go`

**Interfaces:**
- Produces:
  - `GET /api/sbm`: list of all SBM rates.
  - `POST /api/sbm`, `PUT /api/sbm/{id}`, `DELETE /api/sbm/{id}` (admin only).
  - `GET /api/users?q=`: authenticated search of users (id, name, email, avatar_url).

- [ ] **Step 1: Implement `internal/handler/sbm.go`**

Functions:
- `ListSBM(db *sql.DB) http.HandlerFunc`
- `CreateSBM(db *sql.DB) http.HandlerFunc`
- `UpdateSBM(db *sql.DB) http.HandlerFunc`
- `DeleteSBM(db *sql.DB) http.HandlerFunc`

- [ ] **Step 2: Implement `internal/handler/user_search.go`**

Function:
- `SearchUsers(db *sql.DB) http.HandlerFunc`: returns matching users by query string `q` (filtering out confidential fields, returning id, name, email, avatar_url, role).

- [ ] **Step 3: Register routes in `main.go`**

Register routes under `authMW` and `adminMW` appropriately.

- [ ] **Step 4: Run Go test**

Run: `go test ./internal/handler/ -run TestSBM -v`

- [ ] **Step 5: Commit**

```bash
git add internal/handler/sbm.go internal/handler/user_search.go main.go internal/handler/sbm_test.go
git commit -m "feat(api): add sbm rates CRUD and authenticated user search endpoints"
```

---

### Task 3: Trip Collaborators Management & Access Control

**Files:**
- Create: `internal/handler/collaborator.go`
- Modify: `internal/handler/trip.go`
- Modify: `internal/handler/expense.go`
- Modify: `main.go`
- Test: `internal/handler/collaborator_test.go`

**Interfaces:**
- Produces:
  - `GET /api/trips/{id}/members`: List of members for a trip.
  - `POST /api/trips/{id}/members`: Add collaborator by email or user ID.
  - `DELETE /api/trips/{id}/members/{userId}`: Remove collaborator.
- Modifies:
  - `ListTrips`: includes trips where user is owner OR collaborator.
  - `GetTrip`: allows collaborator read access, sets `is_owner`.
  - `UpdateTrip` / `DeleteTrip`: strictly owner or admin.
  - `CreateExpense`: stores `user_id` of caller.
  - `UpdateExpense` / `DeleteExpense`: allowed if caller is expense author OR trip owner OR admin.

- [ ] **Step 1: Implement `internal/handler/collaborator.go`**

Functions:
- `ListTripMembers(db *sql.DB) http.HandlerFunc`
- `AddTripMember(db *sql.DB) http.HandlerFunc`
- `RemoveTripMember(db *sql.DB) http.HandlerFunc`

- [ ] **Step 2: Update `internal/handler/trip.go` for collaborator support**

Update `ListTrips` SQL query to include member trips. Update `GetTrip` scan to return `is_owner` boolean and `collaborators_count`. Restrict `UpdateTrip` and `DeleteTrip` to owner and admin.

- [ ] **Step 3: Update `internal/handler/expense.go` for user attribution & permission checks**

Set `user_id` on `INSERT INTO expenses`. On `UpdateExpense` and `DeleteExpense`, verify caller is expense creator, trip owner, or admin. On `ListExpenses`, join `users` to return `user_name` and `user_avatar`.

- [ ] **Step 4: Run Go tests**

Run: `go test ./internal/handler/ -run TestCollaborator -v`

- [ ] **Step 5: Commit**

```bash
git add internal/handler/collaborator.go internal/handler/trip.go internal/handler/expense.go main.go
git commit -m "feat(collab): add trip collaborator management and authorization matrix"
```

---

### Task 4: Backend Financial Analytics Expansion

**Files:**
- Modify: `internal/handler/analytics.go`
- Test: `internal/handler/analytics_test.go`

**Interfaces:**
- Modifies: `GET /api/analytics` response to include:
  - `total_days`: integer (count of travel days participated by user)
  - `daily_burn_rate`: int64 (total expenses / total travel days)
  - `personal_share_pct`: int (percentage of user's personal outlay vs total outlay)
  - `budget_realization_pct`: int (serapan belanja pada trip lunas)

- [ ] **Step 1: Update SQL aggregations in `internal/handler/analytics.go`**

Add queries calculating `total_days`, `daily_burn_rate`, `personal_share_pct`, and `budget_realization_pct` filtering properly to isolate user's individual expenses.

- [ ] **Step 2: Run test**

Run: `go test ./internal/handler/ -run TestAnalytics -v`

- [ ] **Step 3: Commit**

```bash
git add internal/handler/analytics.go internal/handler/analytics_test.go
git commit -m "feat(analytics): add travel duration, burn rate, personal share, and realization metrics"
```

---

### Task 5: Frontend API Client & Types

**Files:**
- Modify: `web/src/api.ts`

**Interfaces:**
- Produces: TypeScript types `SBMRate`, `TripMember`, `UserSearchItem`, updated `AnalyticsData`, updated `Trip`, and corresponding API client methods:
  - `getSBMRates`, `createSBMRate`, `updateSBMRate`, `deleteSBMRate`
  - `searchUsers`
  - `getTripMembers`, `addTripMember`, `removeTripMember`

- [ ] **Step 1: Add new interfaces and API functions in `web/src/api.ts`**

Define `SBMRate`, `TripMember`, `UserSearchItem`, extend `AnalyticsData` and `Trip` (`is_owner`, `collaborators_count`), export new fetch methods.

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npm --prefix web run build`

- [ ] **Step 3: Commit**

```bash
git add web/src/api.ts
git commit -m "feat(web/api): add sbm, collaborator, and extended analytics api client methods"
```

---

### Task 6: Creatable SBM City Select in TripForm

**Files:**
- Create: `web/src/components/CreatableSelect.tsx`
- Modify: `web/src/pages/TripForm.tsx`

**Interfaces:**
- Produces: `CreatableSelect` component supporting search, selection, and custom entry.
- Modifies: `TripForm.tsx` to autocomplete destination from SBM rates and auto-calculate daily allowance preview with 1-click apply.

- [ ] **Step 1: Build `web/src/components/CreatableSelect.tsx`**

Features:
- Search filter over options (Provinsi & Kota).
- Option to select existing or enter custom text.
- Keyboard accessible (Esc to close, Enter to select).

- [ ] **Step 2: Integrate into `web/src/pages/TripForm.tsx`**

Load SBM rates via `createResource(getSBMRates)`. When destination and dates are filled, compute `durasi_hari * sbm_rate.uang_harian`. Display SBM preview chip with button "Gunakan Estimasi Ini".

- [ ] **Step 3: Verify build**

Run: `npm --prefix web run build`

- [ ] **Step 4: Commit**

```bash
git add web/src/components/CreatableSelect.tsx web/src/pages/TripForm.tsx
git commit -m "feat(form): add creatable sbm city select and auto-estimate calculation"
```

---

### Task 7: TripDetail Action Bar & Collaborator Management

**Files:**
- Modify: `web/src/pages/TripDetail.tsx`
- Modify: `web/src/pages/Dashboard.tsx`
- Modify: `web/src/styles/global.css`

**Interfaces:**
- Produces:
  - Elevated floating action docklet for adding expenses (`bottom: 5.5rem; z-index: 45`), guaranteed clear from bottom dock.
  - Collaborator roster section on `TripDetail` with member chips and "+ Undang" modal.
  - Expense row attribution ("dicatat oleh X").
  - Quick expense action for active trips on `Dashboard`.

- [ ] **Step 1: Update CSS in `web/src/styles/global.css`**

Add styles for:
- `.floating-action-dock`: bottom 5.5rem, elevated shadow, z-index 45.
- `.collaborator-roster`: avatar stack, collaborator pills, role badges.
- `.expense-author-tag`: muted small pill showing who logged the expense.

- [ ] **Step 2: Update `web/src/pages/TripDetail.tsx`**

Add prominent floating "Tambah Pengeluaran" button. Add Collaborators section with modal to search users and add/remove members. Show expense recorder name.

- [ ] **Step 3: Add quick expense trigger on active trips in `web/src/pages/Dashboard.tsx`**

For trips with `status === 'berlangsung'`, add a 1-tap "Catat Pengeluaran" button directly on the card.

- [ ] **Step 4: Verify build**

Run: `npm --prefix web run build`

- [ ] **Step 5: Commit**

```bash
git add web/src/pages/TripDetail.tsx web/src/pages/Dashboard.tsx web/src/styles/global.css
git commit -m "feat(ui): add elevated expense action dock, collaborator roster, and quick triggers"
```

---

### Task 8: Admin SBM Master CRUD & Extended Analytics Cards

**Files:**
- Modify: `web/src/pages/admin/AdminMaster.tsx`
- Modify: `web/src/pages/Analytics.tsx`

**Interfaces:**
- Produces:
  - Tab "SBM Uang Harian" in `/admin/master` with search, table list, and modal CRUD for province rates.
  - 4 new metric cards in `Analytics.tsx` (Total Hari Dinas, Burn Rate Harian, Porsi Talangan Pribadi, Rasio Realisasi Pagu).

- [ ] **Step 1: Update `web/src/pages/admin/AdminMaster.tsx`**

Add third segmented tab "SBM Uang Harian". Allow searching provinces, editing daily rate, adding custom territory rate, and deletion.

- [ ] **Step 2: Update `web/src/pages/Analytics.tsx`**

Display a responsive 2x2 grid of metric cards:
1. Total Hari Dinas (e.g. `24 Hari`)
2. Burn Rate Harian (e.g. `Rp 480.000 / hari`)
3. Porsi Talangan Pribadi (e.g. `38%`)
4. Rasio Realisasi Pagu (e.g. `82%`)

- [ ] **Step 3: Verify build**

Run: `npm --prefix web run build`

- [ ] **Step 4: Commit**

```bash
git add web/src/pages/admin/AdminMaster.tsx web/src/pages/Analytics.tsx
git commit -m "feat(admin/analytics): add sbm rates management tab and 4 new analytical metric cards"
```

---

### Task 9: End-to-End Verification, Docker Check, & Push

**Files:**
- Modify: (any remaining touch-ups)

- [ ] **Step 1: Run full Go test suite**

Run: `go test ./... -v`

- [ ] **Step 2: Run frontend production build**

Run: `npm --prefix web run build`

- [ ] **Step 3: Push to `origin/main`**

```bash
git push origin main
```

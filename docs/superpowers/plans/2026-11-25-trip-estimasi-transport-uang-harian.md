# Estimasi Transport, Pergantian Istilah SBM ke Uang Harian & Kalkulator Monita Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store `estimasi_transport` on trips, replace confusing "SBM" terminology with "Uang Harian" across the application, and provide an accurate Monita budget calculator (Uang Harian + Transport) on the trip form and detail page.

**Architecture:**
- DB migration `007_add_estimasi_transport.sql` adds nullable `estimasi_transport BIGINT` to `trips`.
- Backend Go model `Trip` and trip handlers accept, return, and update `estimasi_transport`.
- Frontend updates `CreatableSelect`, `TripForm`, `TripDetail`, and `AdminMaster` to replace "SBM" with "Uang Harian" and compute Monita budget accurately.

**Tech Stack:** Go 1.24, PostgreSQL, SolidJS, Vite, TypeScript, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-25-trip-estimasi-transport-uang-harian-design.md`

## Global Constraints
- Do not rename database table `sbm_rates` (maintain DB stability).
- Replace all visible UI labels of "SBM" with "Uang Harian" / "Tarif Uang Harian".
- `estimasi_transport` must be optional (nullable/omitted if unset).

## Review Focus
- **Empty or zero estimasi_transport:** Trips created without transport estimation must store NULL or 0 without validation errors.
- **Calculator auto-sum:** Form Trip calculator must properly add Uang Harian (hari × tarif) + Transport to populate Nominal Monita.
- **Detail page rendering:** Trip Detail must show transport and uang harian breakdown only when configured.
- **Dropdown label consistency:** `CreatableSelect` must display "Uang Harian: Rp ... / hari".
- **Admin tab consistency:** `AdminMaster` must display "Uang Harian" on tabs and headings.

---

### Task 1: Database Migration `007_add_estimasi_transport.sql`

**Files:**
- Create: `internal/db/migrations/007_add_estimasi_transport.sql`
- Modify: `internal/db/migrations_test.go`

**Interfaces:**
- Produces: `ALTER TABLE trips ADD COLUMN IF NOT EXISTS estimasi_transport BIGINT;`

- [ ] **Step 1: Write migration `internal/db/migrations/007_add_estimasi_transport.sql`**
```sql
ALTER TABLE trips ADD COLUMN IF NOT EXISTS estimasi_transport BIGINT;
```

- [ ] **Step 2: Add migration test case in `internal/db/migrations_test.go`**
Add check for `007_add_estimasi_transport.sql` and `estimasi_transport BIGINT`.

- [ ] **Step 3: Run migration test and apply to test DB**
Run: `TEST_DATABASE_URL="postgres:///perjadin_test?host=/run/postgresql&port=5433&sslmode=disable" go test ./internal/db -v`
Expected: PASS

- [ ] **Step 4: Commit**
```bash
git add internal/db/migrations/007_add_estimasi_transport.sql internal/db/migrations_test.go
git commit -m "feat(db): migration 007 add estimasi_transport to trips"
```

---

### Task 2: Backend `Trip` Model, Handler & Tests

**Files:**
- Modify: `internal/model/models.go`
- Modify: `internal/handler/trip.go`
- Test: `internal/handler/trip_test.go`

**Interfaces:**
- Consumes: `trips.estimasi_transport` column
- Produces:
  - `model.Trip.EstimasiTransport *int64`
  - `CreateTrip` and `UpdateTrip` bind & persist `estimasi_transport`
  - `tripSelectCols` reads `t.estimasi_transport`

- [ ] **Step 1: Write failing test in `internal/handler/trip_test.go`**
Add test asserting `CreateTrip` and `GetTrip` return `estimasi_transport`.

- [ ] **Step 2: Run test to verify it fails**
Run: `TEST_DATABASE_URL="postgres:///perjadin_test?host=/run/postgresql&port=5433&sslmode=disable" go test ./internal/handler -run "TestTrip_EstimasiTransport" -v`
Expected: FAIL

- [ ] **Step 3: Implement in `internal/model/models.go` and `internal/handler/trip.go`**
Add field to model, add column to `tripSelectCols`, update scan and insert/update statements.

- [ ] **Step 4: Run test to verify it passes**
Run: `TEST_DATABASE_URL="postgres:///perjadin_test?host=/run/postgresql&port=5433&sslmode=disable" go test ./internal/handler -run "TestTrip_EstimasiTransport" -v`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add internal/model/models.go internal/handler/trip.go internal/handler/trip_test.go
git commit -m "feat(api): support estimasi_transport in trip model and endpoints"
```

---

### Task 3: Frontend API & Terminology Updates (CreatableSelect & AdminMaster)

**Files:**
- Modify: `web/src/api.ts`
- Modify: `web/src/components/CreatableSelect.tsx`
- Modify: `web/src/pages/admin/AdminMaster.tsx`

**Interfaces:**
- Produces:
  - `Trip.estimasi_transport?: number` in `web/src/api.ts`
  - Dropdown badge: "Uang Harian: Rp ... / hari" in `CreatableSelect.tsx`
  - Tab "Uang Harian" and modal "Tarif Uang Harian" in `AdminMaster.tsx`

- [ ] **Step 1: Update `web/src/api.ts`**
Add `estimasi_transport?: number` to `Trip` interface.

- [ ] **Step 2: Update `web/src/components/CreatableSelect.tsx`**
Replace `"Standar Biaya:"` label with `"Uang Harian:"`.

- [ ] **Step 3: Update `web/src/pages/admin/AdminMaster.tsx`**
Replace all visible user-facing "Tarif SBM" / "SBM" strings with "Uang Harian" / "Tarif Uang Harian".

- [ ] **Step 4: Run frontend build check**
Run: `cd web && npm run build`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add web/src/api.ts web/src/components/CreatableSelect.tsx web/src/pages/admin/AdminMaster.tsx
git commit -m "feat(web): update SBM terminology to Uang Harian in api, select, and admin master"
```

---

### Task 4: TripForm Monita Budget Calculator & TripDetail Breakdown

**Files:**
- Modify: `web/src/pages/TripForm.tsx`
- Modify: `web/src/pages/TripDetail.tsx`

**Interfaces:**
- Produces:
  - In `TripForm.tsx`:
    - Uang Harian subtotal card (`hari × tarif wilayah`).
    - Input `estimasiTransport` (Taksi / Transportasi Riil).
    - Total Pagu Monita sum preview.
    - One-click button "Gunakan Total Pagu (Rp ...)" that updates `nominalMonita`.
    - Payload sends `estimasi_transport` on submit.
  - In `TripDetail.tsx`:
    - Display breakdown in financial summary if `estimasi_transport` or uang harian exists.

- [ ] **Step 1: Implement Monita calculator in `web/src/pages/TripForm.tsx`**
Add `estimasiTransport` signal, replace SBM box with Monita calculator box, wire `nominalMonita` sync, send payload.

- [ ] **Step 2: Implement breakdown display in `web/src/pages/TripDetail.tsx`**
Render sub-badges for Uang Harian and Estimasi Transport under Pagu Monita if available.

- [ ] **Step 3: Run frontend build check**
Run: `cd web && npm run build`
Expected: PASS

- [ ] **Step 4: Commit**
```bash
git add web/src/pages/TripForm.tsx web/src/pages/TripDetail.tsx
git commit -m "feat(web): add Monita calculator in TripForm and budget breakdown in TripDetail"
```

---

### Task 5: End-to-End Verification with Go Tests & Playwright

**Files:**
- Verify: Full Go test suite
- Verify: Playwright browser verification

- [ ] **Step 1: Run full Go test suite**
Run: `TEST_DATABASE_URL="postgres:///perjadin_test?host=/run/postgresql&port=5433&sslmode=disable" go test ./... -v`
Expected: PASS

- [ ] **Step 2: Run Playwright test**
1. Test `/trips/new`: Select Bandung (3 hari, Rp 430k = Rp 1.290k). Enter transport Rp 540k. Total Monita = Rp 1.830k. Click "Gunakan", submit.
2. Test `/trips/:id`: Verify detail page shows Pagu Rp 1.830k with breakdown (Uang Harian Rp 1.290k, Transport Rp 540k).
3. Test `/admin/master`: Verify tabs display "Uang Harian" instead of "Tarif SBM".

- [ ] **Step 3: Push changes to `origin/main`**
```bash
git push origin main
```

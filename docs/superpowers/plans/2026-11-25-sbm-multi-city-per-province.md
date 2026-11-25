# SBM Multi-City per Province Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable multiple cities/districts per province in SBM master data (`kota TEXT[]`), so trips to any city within a province (e.g., Bogor, Bekasi, Bandung in Jawa Barat) automatically match the province's PMK daily allowance rate in autocomplete and cost estimation.

**Architecture:** Add `kota TEXT[]` to `sbm_rates` via migration `005_sbm_multi_city.sql`. Update Go handlers in `internal/handler/sbm.go` to scan and persist `kota` with PostgreSQL array semantics (`pq.Array`). In the frontend, update `CreatableSelect.tsx` to expand and filter all cities per province, update `TripForm.tsx` to match any city name in the array, and update `AdminMaster.tsx` to allow managing comma-separated or list of cities.

**Tech Stack:** PostgreSQL (arrays `TEXT[]`), Go 1.22+, `github.com/lib/pq`, SolidJS, TypeScript, Vite.

**Spec:** `docs/superpowers/specs/2026-11-25-sbm-multi-city-per-province-design.md`

## Global Constraints
- Database column: `sbm_rates.kota TEXT[] NOT NULL DEFAULT '{}'`.
- Backward compatibility: Keep `ibukota TEXT` column in DB and JSON response (`ibukota = kota[0]` fallback).
- Search support: Query `?q=` in `GET /api/sbm` must match `provinsi ILIKE %q%` or unnested city `k ILIKE %q%`.
- Autocomplete behavior: Selecting a city (e.g. "Bogor, Jawa Barat") sets destination value and binds the province's `SBMRate` object.
- All Go tests must pass against Postgres test DB on port 5433 socket.

## Review Focus
1. Empty city array on new record creation: Must default to empty array or derive from `ibukota` without error.
2. Case-insensitive substring matching: Typing "bogor" or "BOGOR" must match "Bogor, Jawa Barat".
3. Multiple spaces or trailing commas in Admin input: Admin typing `Bandung,  Bogor , Bekasi,` must trim whitespace and omit empty strings.
4. Legacy trips with existing `tujuan` strings (e.g., "Dinas Bogor 11-12 Agustus 2026"): `matchedRate()` in `TripForm.tsx` must identify "Bogor" as Jawa Barat.
5. Deletion/Update of SBM rate in Admin: Updates to `kota` must immediately reflect in autocomplete list upon refetch.

---

### Task 1: Database Migration `005_sbm_multi_city.sql` & Migration Test

**Files:**
- Create: `internal/db/migrations/005_sbm_multi_city.sql`
- Modify: `internal/db/migrations_test.go`
- Test: `internal/db/migrations_test.go`

**Interfaces:**
- Produces: Column `kota TEXT[] NOT NULL DEFAULT '{}'` on `sbm_rates` table populated with initial city lists for 38 provinces.

- [ ] **Step 1: Write migration test asserting 005 migration file exists and contains `kota TEXT[]`**

In `internal/db/migrations_test.go`, add assertion in `TestMigrationFilesSyntax`:
```go
if !strings.Contains(s, "kota") {
    t.Errorf("005 missing kota column")
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `TEST_DATABASE_URL="postgres:///perjadin_test?host=/run/postgresql&port=5433&sslmode=disable" go test ./internal/db -run TestMigrationFilesSyntax -v`
Expected: FAIL (file `005_sbm_multi_city.sql` not found or missing `kota`)

- [ ] **Step 3: Create `internal/db/migrations/005_sbm_multi_city.sql`**

Write SQL migration:
1. `ALTER TABLE sbm_rates ADD COLUMN IF NOT EXISTS kota TEXT[] NOT NULL DEFAULT '{}';`
2. `UPDATE sbm_rates SET kota = ARRAY[ibukota] WHERE ibukota <> '' AND kota = '{}';`
3. Update popular cities for top provinces:
   - Jawa Barat: `ARRAY['Bandung', 'Bogor', 'Bekasi', 'Depok', 'Cirebon', 'Sukabumi', 'Tasikmalaya', 'Karawang', 'Cimahi']`
   - DKI Jakarta: `ARRAY['Jakarta', 'Jakarta Pusat', 'Jakarta Selatan', 'Jakarta Barat', 'Jakarta Timur', 'Jakarta Utara', 'Kepulauan Seribu']`
   - Banten: `ARRAY['Serang', 'Tangerang', 'Tangerang Selatan', 'Cilegon', 'Pandeglang', 'Lebak']`
   - Jawa Tengah: `ARRAY['Semarang', 'Surakarta (Solo)', 'Magelang', 'Purwokerto', 'Salatiga', 'Tegal', 'Pekalongan', 'Kudus']`
   - DI Yogyakarta: `ARRAY['Yogyakarta', 'Sleman', 'Bantul', 'Kulon Progo', 'Gunungkidul']`
   - Jawa Timur: `ARRAY['Surabaya', 'Malang', 'Banyuwangi', 'Madiun', 'Kediri', 'Batu', 'Jember', 'Sidoarjo']`
   - Bali: `ARRAY['Denpasar', 'Badung', 'Gianyar', 'Ubud', 'Buleleng', 'Tabanan']`
   - Sumatera Utara: `ARRAY['Medan', 'Binjai', 'Pematangsiantar', 'Deli Serdang', 'Toba']`
   - Sumatera Barat: `ARRAY['Padang', 'Bukittinggi', 'Padang Panjang', 'Payakumbuh']`
   - Kepulauan Riau: `ARRAY['Tanjung Pinang', 'Batam', 'Bintan']`
   - Riau: `ARRAY['Pekanbaru', 'Dumai']`
   - Sulawesi Selatan: `ARRAY['Makassar', 'Gowa', 'Maros', 'Parepare', 'Palopo']`

- [ ] **Step 4: Run migration test and verify passes**

Run: `TEST_DATABASE_URL="postgres:///perjadin_test?host=/run/postgresql&port=5433&sslmode=disable" go test ./internal/db -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add internal/db/migrations/005_sbm_multi_city.sql internal/db/migrations_test.go
git commit -m "feat(db): migration 005 for sbm_rates kota text array and popular cities seed"
```

---

### Task 2: Backend Go `internal/handler/sbm.go` & Unit Tests

**Files:**
- Modify: `internal/handler/sbm.go`
- Modify: `internal/handler/sbm_test.go`
- Test: `internal/handler/sbm_test.go`

**Interfaces:**
- Consumes: `sbm_rates` table with `kota TEXT[]`.
- Produces: `SBMRate` JSON with `kota: string[]` on `GET /api/sbm`, `POST /api/admin/sbm`, `PUT /api/admin/sbm/:id`.

- [ ] **Step 1: Write failing unit test in `internal/handler/sbm_test.go`**

Add tests:
- `TestListSBMRates_WithKotaArray`: checks that `kota` slice is returned with elements like `["Bandung", "Bogor", "Bekasi"]`.
- `TestListSBMRates_SearchByCity`: checks that `?q=bogor` returns the Jawa Barat record.
- `TestCreateAndUpdateSBMRate_WithKota`: checks creating and updating a rate with multiple cities in `kota`.

- [ ] **Step 2: Run test to verify it fails**

Run: `TEST_DATABASE_URL="postgres:///perjadin_test?host=/run/postgresql&port=5433&sslmode=disable" go test ./internal/handler -run TestListSBMRates -v`
Expected: FAIL (struct field or query missing `kota`)

- [ ] **Step 3: Update `internal/handler/sbm.go`**

1. Update `SBMRate` struct:
   ```go
   type SBMRate struct {
       ID          string   `json:"id"`
       Provinsi    string   `json:"provinsi"`
       Ibukota     string   `json:"ibukota"`
       Kota        []string `json:"kota"`
       UangHarian  int64    `json:"uang_harian"`
       CreatedAt   string   `json:"created_at"`
       UpdatedAt   string   `json:"updated_at"`
   }
   ```
2. Update `ListSBMRates`:
   - Query: `SELECT id, provinsi, ibukota, kota, uang_harian, created_at, updated_at FROM sbm_rates WHERE ($1 = '' OR provinsi ILIKE $2 OR ibukota ILIKE $2 OR EXISTS (SELECT 1 FROM unnest(kota) k WHERE k ILIKE $2)) ORDER BY provinsi ASC`
   - Scan with `pq.Array(&r.Kota)`.
   - If `r.Kota == nil`, set `r.Kota = []string{}`.
3. Update `CreateSBMRate`:
   - Accept `Kota []string`. If `Ibukota == ""` and len(Kota) > 0, set `Ibukota = Kota[0]`.
   - Insert with `pq.Array(req.Kota)`.
4. Update `UpdateSBMRate`:
   - Accept `Kota []string`.
   - Update with `pq.Array(req.Kota)`.

- [ ] **Step 4: Run unit tests to verify they pass**

Run: `TEST_DATABASE_URL="postgres:///perjadin_test?host=/run/postgresql&port=5433&sslmode=disable" go test ./internal/handler -run "TestListSBMRates|TestCreateAndUpdateSBMRate" -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add internal/handler/sbm.go internal/handler/sbm_test.go
git commit -m "feat(api): support kota string array in sbm rates endpoints"
```

---

### Task 3: Frontend API & Autocomplete Component (`CreatableSelect.tsx`, `api.ts`)

**Files:**
- Modify: `web/src/api.ts`
- Modify: `web/src/components/CreatableSelect.tsx`
- Build check: `cd web && npm run build`

**Interfaces:**
- Consumes: `SBMRate.kota?: string[]` from backend.
- Produces: Flattened options in `CreatableSelect` representing individual cities `"<Kota>, <Provinsi>"` and fallback province options.

- [ ] **Step 1: Update `SBMRate` interface in `web/src/api.ts`**

Add `kota?: string[];` to `SBMRate`.

- [ ] **Step 2: Update `CreatableSelect.tsx` option indexing and filtering**

1. Create a helper that flattens `props.options` into selectable items:
   ```ts
   interface SelectOptionItem {
     display: string;
     city?: string;
     provinsi: string;
     rate: SBMRate;
   }
   ```
   For each `rate`:
   - If `rate.kota` has items, add each city as `{ display: `${city}, ${rate.provinsi}`, city, provinsi: rate.provinsi, rate }`.
   - Also add the province option `{ display: rate.provinsi, provinsi: rate.provinsi, rate }`.
2. Filter matches query against `item.display.toLowerCase()`.
3. Selecting an item calls `props.onChange(item.display, item.rate)`.
4. Badge displays `item.rate.uang_harian` formatted as `Rp ... / hari`.

- [ ] **Step 3: Run frontend build check**

Run: `cd web && npm run build`
Expected: Build succeeds with 0 errors.

- [ ] **Step 4: Commit**

```bash
git add web/src/api.ts web/src/components/CreatableSelect.tsx
git commit -m "feat(web): expand multi-city options per province in CreatableSelect"
```

---

### Task 4: Frontend TripForm (`TripForm.tsx`) & Admin Master (`AdminMaster.tsx`)

**Files:**
- Modify: `web/src/pages/TripForm.tsx`
- Modify: `web/src/pages/admin/AdminMaster.tsx`
- Build check: `cd web && npm run build`

**Interfaces:**
- Consumes: `rate.kota` array.
- Produces: Auto-detection of SBM rate in `TripForm.tsx` when destination mentions any city in `kota`. Admin UI to view and edit comma-separated cities.

- [ ] **Step 1: Update `matchedRate()` in `web/src/pages/TripForm.tsx`**

Update `matchedRate`:
```ts
const matchedRate = () => {
  if (selectedRate()) return selectedRate();
  const dest = tujuan().toLowerCase();
  if (!dest) return undefined;
  return sbmRates()?.find(
    (r) =>
      dest.includes(r.provinsi.toLowerCase()) ||
      (r.ibukota && dest.includes(r.ibukota.toLowerCase())) ||
      (r.kota && r.kota.some((k) => dest.includes(k.toLowerCase())))
  );
};
```

- [ ] **Step 2: Update `SBMRateManager` in `web/src/pages/admin/AdminMaster.tsx`**

1. In table list: Display `r.kota?.length ? r.kota.join(', ') : r.ibukota`.
2. In form:
   - State `formKota` (comma-separated string, e.g. `Bandung, Bogor, Bekasi, Depok`).
   - On edit/open: `setFormKota(rate.kota?.join(', ') || rate.ibukota || '')`.
   - On save: Parse `formKota` by splitting by `,`, trimming whitespace, filtering out empty strings. Send `kota: parsedKota`.
   - Keep `ibukota: parsedKota[0] || ''` for backward compatibility.

- [ ] **Step 3: Run frontend build check**

Run: `cd web && npm run build`
Expected: Build succeeds with 0 errors.

- [ ] **Step 4: Commit**

```bash
git add web/src/pages/TripForm.tsx web/src/pages/admin/AdminMaster.tsx
git commit -m "feat(web): match cities in TripForm and manage city list in AdminMaster"
```

---

### Task 5: End-to-End Verification with Playwright & Go Tests

**Files:**
- Verify all Go packages and Playwright browser tests.

- [ ] **Step 1: Run full Go test suite**

Run: `TEST_DATABASE_URL="postgres:///perjadin_test?host=/run/postgresql&port=5433&sslmode=disable" go test ./... -v`
Expected: PASS for all packages.

- [ ] **Step 2: Start local server and test with Playwright**

1. Run server on port 8888 with test DB.
2. Navigate to `/trips/new`.
3. Type "Bogor" in `Kota / Wilayah Tujuan`.
4. Verify dropdown suggests "Bogor, Jawa Barat" with rate `Rp 430.000 / hari`.
5. Select "Bogor, Jawa Barat", fill dates (e.g. 3 days), verify estimated SBM calculates Rp 1.290.000.
6. Check Admin Master SBM table (`/admin`), verify Jawa Barat displays list of cities.

- [ ] **Step 3: Push changes to `origin/main`**

```bash
git push origin main
```

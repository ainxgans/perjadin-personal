# Dashboard, Analytics & UX Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 5 ergonomic improvements from Playwright UAT: Dashboard header "+ Perjalanan" CTA, smart default expense dates based on trip duration, fiscal year filter for analytics with available years list, auto-normalizing Monita link protocols, and redirecting authenticated users on `/login`.

**Architecture:** Extend backend `GET /api/analytics` to accept an optional `?year=` query parameter and return `available_years`, with parameterized SQL queries for year extraction. Update frontend SolidJS pages (`Dashboard.tsx`, `TripDetail.tsx`, `TripForm.tsx`, `Login.tsx`, `Analytics.tsx`) and API client to provide fast, mobile-friendly trip actions and period filtering.

**Tech Stack:** Go (net/http, database/sql), PostgreSQL, SolidJS, TypeScript, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-25-dashboard-analytics-ux-improvements-design.md`

## Global Constraints
- Preserve backward compatibility: `GET /api/analytics` with no `?year=` query must return unfiltered data across all years.
- No new external runtime dependencies.
- All Go tests must pass with `go test ./...`.
- Vite build must succeed with `npm run build` without TypeScript errors.

## Review Focus
1. Malformed `year` query parameter (e.g. `?year=abc`, negative or extreme years): must safely fallback or return empty/default without SQL injection or 500 error.
2. Trips spanning multi-year boundaries: year filter filters on `tanggal_mulai`.
3. Monita link with leading/trailing whitespaces or already having `http://` or `https://`: must not result in `https://https://...`.
4. Empty trip list in `available_years`: must return empty slice `[]int{}`, not null.
5. User already logged in visiting `/login`: must immediately redirect to `/` without flashing login buttons.

---

### Task 1: Backend Analytics Year Filter & Available Years

**Files:**
- Modify: `internal/handler/analytics.go`
- Test: `internal/handler/analytics_test.go`

**Interfaces:**
- Produces: `AnalyticsData.AvailableYears []int` in response JSON and support for `?year=YYYY` query param on `GET /api/analytics`.

- [ ] **Step 1: Write failing tests in `internal/handler/analytics_test.go`**

Add tests `TestGetAnalytics_YearFilter` and `TestGetAnalytics_AvailableYears`:
- Seed trips for user across year 2025 (1 trip, 500k expense) and year 2026 (1 trip, 1jt expense).
- Request `GET /api/analytics?year=2025` -> verify `total_expenses_rp` is 500k, `available_years` contains `[2026, 2025]`.
- Request `GET /api/analytics?year=2026` -> verify `total_expenses_rp` is 1jt.
- Request `GET /api/analytics` -> verify `total_expenses_rp` is 1.5jt.

- [ ] **Step 2: Run test to verify it fails**

Run: `TEST_DATABASE_URL="postgres:///perjadin_test?host=/run/postgresql&port=5433&sslmode=disable" go test ./internal/handler -run TestGetAnalytics_YearFilter -v`  
Expected: FAIL (filter not implemented, field `AvailableYears` missing).

- [ ] **Step 3: Implement year filtering and `available_years` in `internal/handler/analytics.go`**

- Add `AvailableYears []int` json field to `AnalyticsData`.
- Parse optional `year` param: `year, _ := strconv.Atoi(r.URL.Query().Get("year"))`.
- If `year > 0`, append `AND EXTRACT(YEAR FROM t.tanggal_mulai) = $X` to SQL queries (or use conditional SQL builder).
- Query distinct years:
  ```sql
  SELECT DISTINCT EXTRACT(YEAR FROM t.tanggal_mulai)::int AS y
  FROM trips t
  WHERE (t.user_id = $1 OR EXISTS (SELECT 1 FROM trip_members tm WHERE tm.trip_id = t.id AND tm.user_id = $1))
  ORDER BY y DESC
  ```
- Populate `data.AvailableYears`.

- [ ] **Step 4: Run test to verify it passes**

Run: `TEST_DATABASE_URL="postgres:///perjadin_test?host=/run/postgresql&port=5433&sslmode=disable" go test ./internal/handler -run TestGetAnalytics -v`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add internal/handler/analytics.go internal/handler/analytics_test.go
git commit -m "feat(analytics): add year filter query parameter and available years to response"
```

---

### Task 2: Monita Link Normalization & Auto-Redirect on Login

**Files:**
- Modify: `web/src/pages/TripForm.tsx`
- Modify: `web/src/pages/TripDetail.tsx`
- Modify: `web/src/pages/Login.tsx`

**Interfaces:**
- Helper `normalizeMonitaUrl(url: string): string` prepending `https://` if protocol missing.
- In `Login.tsx`: `createEffect(() => { if (user()) navigate('/', { replace: true }); })`.

- [ ] **Step 1: Implement URL normalization in `TripForm.tsx` and `TripDetail.tsx`**

- In `TripForm.tsx` submit handler:
  ```ts
  let normalizedLink = linkMonita().trim();
  if (normalizedLink && !/^https?:\/\//i.test(normalizedLink)) {
    normalizedLink = 'https://' + normalizedLink;
  }
  ```
- In `TripDetail.tsx`: ensure the href rendered in `<a href={...} target="_blank">` is guaranteed to have `https://` if raw database link lacked it.

- [ ] **Step 2: Implement auto-redirect in `Login.tsx`**

- In `Login.tsx`:
  ```ts
  import { useNavigate } from '@solidjs/router';
  import { createEffect } from 'solid-js';
  // ...
  const navigate = useNavigate();
  createEffect(() => {
    if (user()) {
      navigate('/', { replace: true });
    }
  });
  ```

- [ ] **Step 3: Run web typecheck and build**

Run: `cd web && npm run build`  
Expected: Build passes with 0 errors.

- [ ] **Step 4: Commit**

```bash
git add web/src/pages/TripForm.tsx web/src/pages/TripDetail.tsx web/src/pages/Login.tsx
git commit -m "fix(web): normalize monita link scheme and auto-redirect authenticated users on login"
```

---

### Task 3: Dashboard Header CTA & Smart Default Expense Date

**Files:**
- Modify: `web/src/pages/Dashboard.tsx`
- Modify: `web/src/pages/TripDetail.tsx`

**Interfaces:**
- In `Dashboard.tsx`: Header button `<A href="/trips/new" class="btn btn-primary btn-sm">+ Perjalanan</A>` placed alongside section heading.
- In `TripDetail.tsx`: Initial date for `ExpenseForm` set to start of trip if today is outside duration.

- [ ] **Step 1: Add "+ Perjalanan" CTA in `Dashboard.tsx` header**

- In `Dashboard.tsx`, locate the section `<div class="section-header"><h2>Daftar Perjalanan</h2>...</div>`.
- Add an action button right in the header:
  ```tsx
  <div style="display: flex; align-items: center; gap: 0.75rem;">
    <A href="/trips/new" class="btn btn-primary btn-sm">
      <PlusIcon size={16} />
      <span>Perjalanan</span>
    </A>
  </div>
  ```

- [ ] **Step 2: Smart default date in `TripDetail.tsx`**

- In `TripDetail.tsx`, update `ExpenseForm` `tanggal` signal initialization:
  ```ts
  const getInitialExpenseDate = () => {
    const today = new Date().toISOString().split('T')[0];
    const tripData = trip();
    if (!tripData) return today;
    const start = tripData.tanggal_mulai;
    const end = tripData.tanggal_selesai || start;
    if (today >= start && today <= end) return today;
    return start;
  };
  ```
- Set `tanggal` signal in `ExpenseForm` using `props.expense ? props.expense.tanggal : getInitialExpenseDate()`.

- [ ] **Step 3: Run web typecheck and build**

Run: `cd web && npm run build`  
Expected: Build passes with 0 errors.

- [ ] **Step 4: Commit**

```bash
git add web/src/pages/Dashboard.tsx web/src/pages/TripDetail.tsx
git commit -m "feat(web): add header trip CTA on dashboard and smart default expense date"
```

---

### Task 4: Analytics Frontend Year Filter Chips

**Files:**
- Modify: `web/src/api.ts`
- Modify: `web/src/pages/Analytics.tsx`

**Interfaces:**
- `getAnalytics(year?: number): Promise<AnalyticsData>`
- In `AnalyticsData` interface: `available_years?: number[]`.
- `selectedYear` signal in `Analytics.tsx` driving `createResource(selectedYear, (yr) => getAnalytics(yr))`.

- [ ] **Step 1: Update `AnalyticsData` and `getAnalytics` in `web/src/api.ts`**

- In `web/src/api.ts`:
  ```ts
  export interface AnalyticsData {
    // ...existing fields...
    available_years?: number[];
  }

  export const getAnalytics = (year?: number) => {
    const query = year && year > 0 ? `?year=${year}` : '';
    return apiFetch<AnalyticsData>(`/api/analytics${query}`);
  };
  ```

- [ ] **Step 2: Add year filter chips in `web/src/pages/Analytics.tsx`**

- In `web/src/pages/Analytics.tsx`:
  - Add signal `const [selectedYear, setSelectedYear] = createSignal<number | undefined>(undefined);`
  - Wrap resource: `const [analytics] = createResource(selectedYear, (yr) => getAnalytics(yr));`
  - Render chip bar under page title:
    ```tsx
    <div class="filter-chips" style="display: flex; gap: 0.5rem; margin-bottom: 1.5rem; overflow-x: auto;">
      <button
        class={`chip ${selectedYear() === undefined ? 'active' : ''}`}
        onClick={() => setSelectedYear(undefined)}
      >
        Semua Tahun
      </button>
      <For each={analytics()?.available_years || []}>
        {(yr) => (
          <button
            class={`chip ${selectedYear() === yr ? 'active' : ''}`}
            onClick={() => setSelectedYear(yr)}
          >
            {yr}
          </button>
        )}
      </For>
    </div>
    ```

- [ ] **Step 3: Run web typecheck and build**

Run: `cd web && npm run build`  
Expected: Build passes with 0 errors.

- [ ] **Step 4: Commit**

```bash
git add web/src/api.ts web/src/pages/Analytics.tsx
git commit -m "feat(analytics): add year filter tabs on analytics page"
```

---

### Task 5: End-to-End Verification with Playwright & Go Tests

**Files:**
- Test: Full Go test suite
- Verification: Playwright browser verification

- [ ] **Step 1: Run full Go test suite**

Run: `TEST_DATABASE_URL="postgres:///perjadin_test?host=/run/postgresql&port=5433&sslmode=disable" go test ./... -v`  
Expected: All packages pass.

- [ ] **Step 2: Run Playwright browser UAT**

Verify using Playwright tools in Code Mode:
1. Navigate to `/` -> verify "+ Perjalanan" button is visible immediately in the header without scrolling.
2. Navigate to `/trips/3b8f5d22-e6d4-4dce-ac8a-81c4e75196a5` (Dinas Bandung Sep 2026) -> click "Catat Pengeluaran" -> verify default transaction date is `2026-09-24` (start of trip, not today).
3. Navigate to `/analytics` -> verify "Semua Tahun", "2026", "2025" filter chips appear; click "2026" and "2025" -> verify stats update accordingly.
4. Navigate to `/login` with active dev session -> verify immediate redirect back to `/`.

- [ ] **Step 3: Commit and Push**

```bash
git push origin main
```

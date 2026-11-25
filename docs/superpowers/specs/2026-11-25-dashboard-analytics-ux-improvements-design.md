# Perjadin UX & Analytics Improvements Design

**Date:** 2026-11-25  
**Status:** Approved  

## 1. Intent & Context
Following Playwright end-to-end UAT on desktop and mobile viewports with 19 realistic seeded trips, 5 high-impact ergonomic and reporting gaps were identified that impede daily user workflow.

## 2. Goals, Non-Goals & Anti-Goals
- **Goals:**
  1. Add quick access CTA "+ Perjalanan" in Dashboard header to avoid scrolling past 19+ trip cards.
  2. Smart default date on expense creation modal (`TripDetail.tsx`): use trip start date if today is outside trip duration.
  3. Support fiscal year filtering on `/analytics` (backend `GET /api/analytics?year=YYYY` & frontend tabs) and expose `available_years`.
  4. Auto-normalize Monita transaction URLs so missing `https://` doesn't break into a relative link.
  5. Auto-redirect authenticated users away from `/login` to `/`.
- **Non-Goals:**
  - Redesigning entire analytics charting engine or database schema.
  - Modifying Google OAuth scopes or flow.
- **Anti-Goals:**
  - Breaking existing test suites or backwards compatibility of `GET /api/analytics` when no `year` parameter is passed.

## 3. Approaches Considered
1. **Analytics Year Filter:**
   - *Option 1 (Frontend-only filter):* Fetch all raw data and filter in browser. Rejected because `GET /api/analytics` returns pre-aggregated SQL metrics (averages, sums, percentages), so frontend cannot reliably recalculate metrics without fetching every raw trip and expense.
   - *Option 2 (Backend query param `?year=`):* Filter SQL queries in `internal/handler/analytics.go` by `EXTRACT(YEAR FROM t.tanggal_mulai) = $2`. Selected: exact, performant, clean.

2. **Dashboard CTA Placement:**
   - Put "+ Perjalanan" right inside the "Daftar Perjalanan" section header alongside the counter badge, accessible without scrolling.

## 4. Detailed Specifications

### A. Dashboard Header CTA
In `web/src/pages/Dashboard.tsx`:
- Render `<A href="/trips/new" class="btn btn-primary btn-sm">+ Perjalanan</A>` in the header row next to `<h2>Daftar Perjalanan</h2>`.

### B. Smart Default Date in Expense Modal
In `web/src/pages/TripDetail.tsx`:
- Determine initial expense date:
  ```ts
  const today = new Date().toISOString().split('T')[0];
  const start = trip()?.tanggal_mulai || today;
  const end = trip()?.tanggal_selesai || start;
  const defaultDate = (today >= start && today <= end) ? today : start;
  ```

### C. Analytics Fiscal Year Filter
- **Backend (`internal/handler/analytics.go`):**
  - Read optional `yearStr := r.URL.Query().Get("year")`.
  - Validate year (e.g. 2000–2100). If provided, filter SQL by `AND EXTRACT(YEAR FROM t.tanggal_mulai) = $year`.
  - Also query `SELECT DISTINCT EXTRACT(YEAR FROM tanggal_mulai)::int FROM trips WHERE ... ORDER BY 1 DESC` and return `available_years []int` in response.
  - When `year` is omitted or 0, return all years (backward compatible).
- **Frontend (`web/src/api.ts` & `web/src/pages/Analytics.tsx`):**
  - Update `getAnalytics(year?: number)`.
  - Add year filter chip buttons ("Semua", "2026", "2025", etc.).

### D. Monita Link Protocol Normalization
In `web/src/pages/TripForm.tsx` & `TripDetail.tsx`:
- Helper `normalizeUrl(url: string)`:
  - If trimmed string is non-empty and lacks `http://` or `https://`, prepend `https://`.

### E. Login Page Auto-Redirect
In `web/src/pages/Login.tsx`:
- If `user()` is truthy, redirect to `/` using `navigate('/', { replace: true })`.

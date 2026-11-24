# Perjadin Personal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Full-stack app pencatatan keuangan perjalanan dinas — Go API + PostgreSQL + SolidJS frontend, Google OAuth, admin-managed master data, Docker deploy.

**Architecture:** Go REST API serves auth (Google OAuth → JWT cookie), admin endpoints for master data, user endpoints for trips + expenses scoped per user. Status trip computed dari tanggal dan pembayaran. SolidJS SPA mobile-first. Docker Compose runs Go + Postgres. Go serves SolidJS static build in production.

**Tech Stack:** Go 1.22+, PostgreSQL 16, SolidJS 1.8+, SolidJS Router, Docker Compose

**Spec:** `docs/superpowers/specs/2026-11-24-perjadin-design.md`

## Global Constraints

- Go modules, no framework — stdlib `net/http` (Go 1.22 pattern matching)
- PostgreSQL — `lib/pq` driver, raw SQL migrations (no ORM)
- SolidJS — TypeScript, vanilla CSS, mobile-first
- All money values integer (rupiah, no decimal)
- All IDs uuid
- JWT in httpOnly cookie
- API responses JSON: `{"data": ...}` or `{"error": "..."}`
- Minimize free-text: use foreign keys to master tables where possible
- User role: `admin` or `user` (string field on users table)
- First Google login user = admin (seed), rest = user

## Review Focus

1. **Unauthorized cross-user access** — every trip/expense query must filter by user_id from JWT. Test: user A cannot see/modify user B's data.
2. **Admin-only enforcement** — non-admin user hitting `/api/admin/*` → 403. Test: regular user CRUD on categories → 403.
3. **Referential integrity on expense** — category_id and payment_method_id must exist. Deleting a category/payment_method used by expenses → 409 conflict (not cascade).
4. **Negative or zero amounts** — jumlah must be > 0 on create/update expense. uang_dinas must be >= 0 on trip.
5. **Status computation correctness** — test all three states with edge cases (today = tanggal_mulai, today = tanggal_selesai, partial fill of uang_dinas/tanggal_dibayar).

---

## File Structure

```
perjadin-personal/
├── docker-compose.yml
├── Dockerfile
├── go.mod, go.sum
├── cmd/
│   └── server/
│       └── main.go
├── internal/
│   ├── config/
│   │   └── config.go
│   ├── db/
│   │   ├── db.go
│   │   └── migrations/
│   │       └── 001_init.sql
│   ├── auth/
│   │   ├── google.go
│   │   ├── jwt.go
│   │   └── middleware.go        # AuthMiddleware + AdminMiddleware
│   ├── handler/
│   │   ├── trip.go
│   │   ├── expense.go
│   │   ├── category.go          # admin CRUD + user read
│   │   ├── payment_method.go    # admin CRUD + user read
│   │   ├── dashboard.go
│   │   └── handler_test.go      # test helpers (setup DB, create test user)
│   └── model/
│       └── models.go
├── web/
│   ├── package.json
│   ├── vite.config.ts
│   ├── index.html
│   └── src/
│       ├── index.tsx
│       ├── App.tsx
│       ├── api.ts
│       ├── pages/
│       │   ├── Login.tsx
│       │   ├── Dashboard.tsx
│       │   ├── TripDetail.tsx
│       │   ├── TripForm.tsx
│       │   └── Admin.tsx
│       ├── components/
│       │   ├── ExpenseList.tsx
│       │   ├── ExpenseForm.tsx
│       │   ├── Navbar.tsx
│       │   └── StatusBadge.tsx
│       └── styles/
│           └── global.css
└── docs/
```

---

### Task 1: Project Scaffold + DB Schema + Docker Compose

**Files:**
- Create: `go.mod`, `cmd/server/main.go`, `internal/config/config.go`, `internal/db/db.go`, `internal/db/migrations/001_init.sql`, `internal/model/models.go`, `docker-compose.yml`, `Dockerfile`, `.env.example`

**Interfaces:**
- Produces: `config.Load() Config`, `db.Connect(databaseURL string) (*sql.DB, error)`, `db.Migrate(db *sql.DB, dir string) error`, model structs `User`, `Trip`, `Expense`, `Category`, `PaymentMethod`

- [ ] **Step 1: Init Go module**

```bash
go mod init github.com/maulana/perjadin-personal
```

- [ ] **Step 2: Create `internal/config/config.go`**

`Load() Config` — reads env vars: `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URL`, `JWT_SECRET`, `PORT` (default 8080). Panic if required vars missing.

- [ ] **Step 3: Create `internal/model/models.go`**

```go
type User struct { ID, GoogleID, Email, Name, AvatarURL, Role string; CreatedAt time.Time }
type Category struct { ID, Nama string; CreatedAt time.Time }
type PaymentMethod struct { ID, Nama string; CreatedAt time.Time }
type Trip struct {
    ID, UserID, Nama, Tujuan string
    TanggalMulai, TanggalSelesai time.Time
    UangDinas *int64          // nullable
    TanggalDibayar *time.Time // nullable
    CreatedAt, UpdatedAt time.Time
}
type Expense struct {
    ID, TripID, CategoryID, PaymentMethodID, Deskripsi string
    Jumlah int64; Tanggal time.Time; CreatedAt time.Time
}
```

Add `Trip.Status() string` method — returns "berlangsung", "urus_berkas", or "selesai" based on `time.Now()`.

- [ ] **Step 4: Write test for `Trip.Status()` in `internal/model/models_test.go`**

```go
func TestTripStatus_Berlangsung(t *testing.T) // today in range
func TestTripStatus_UrusBerkas(t *testing.T)  // past end, no payment
func TestTripStatus_Selesai(t *testing.T)     // has uang_dinas + tanggal_dibayar
func TestTripStatus_UrusBerkas_PartialPayment(t *testing.T) // only uang_dinas set, no tanggal_dibayar
```

- [ ] **Step 5: Run tests, verify pass**

```bash
go test ./internal/model/ -v
```

- [ ] **Step 6: Create `internal/db/migrations/001_init.sql`**

Tables: `users` (with role default 'user'), `categories`, `payment_methods`, `trips` (fk user_id, nullable uang_dinas + tanggal_dibayar), `expenses` (fk trip_id, category_id, payment_method_id). UUID pkeys via `gen_random_uuid()`. `ON DELETE CASCADE` on trips→users. `ON DELETE RESTRICT` on expenses→categories, expenses→payment_methods. Seed categories (Makan, Transportasi, Hotel, Lainnya) and payment methods (Pribadi, Koperasi, Talangan).

- [ ] **Step 7: Create `internal/db/db.go`**

`Connect(databaseURL string) (*sql.DB, error)` — open, ping.
`Migrate(db *sql.DB, migrationsDir string) error` — read and exec SQL files.

- [ ] **Step 8: Create `cmd/server/main.go`**

Load config, connect DB, run migrations, start HTTP server. Health check `GET /healthz` → `{"status":"ok"}`.

- [ ] **Step 9: Create `docker-compose.yml` + `Dockerfile` + `.env.example`**

docker-compose: `db` (postgres:16, volume, env), `app` (build Dockerfile, depends_on db, env_file, port 8080).
Dockerfile: multi-stage (Go build + copy binary + migrations).
.env.example: all vars with placeholders.

- [ ] **Step 10: Verify — docker compose up, /healthz returns 200**

```bash
docker compose up --build -d
curl http://localhost:8080/healthz
```

- [ ] **Step 11: Commit**

```bash
git init && git add -A && git commit -m "feat: project scaffold, DB schema, Docker Compose"
```

---

### Task 2: Google OAuth + JWT Auth + Admin Middleware

**Files:**
- Create: `internal/auth/jwt.go`, `internal/auth/jwt_test.go`, `internal/auth/google.go`, `internal/auth/middleware.go`
- Modify: `cmd/server/main.go` (add auth routes)

**Interfaces:**
- Consumes: `config.Config`, `db *sql.DB`
- Produces: `auth.CreateToken(userID, role, secret string, expiry time.Duration) (string, error)`, `auth.ValidateToken(tokenStr, secret string) (userID, role string, err error)`, `auth.GoogleLoginHandler(cfg Config) http.HandlerFunc`, `auth.GoogleCallbackHandler(cfg Config, db *sql.DB) http.HandlerFunc`, `auth.MeHandler(db *sql.DB) http.HandlerFunc`, `auth.LogoutHandler() http.HandlerFunc`, `auth.AuthMiddleware(jwtSecret string) func(http.Handler) http.Handler`, `auth.AdminMiddleware() func(http.Handler) http.Handler`, `auth.UserIDFromContext(ctx) string`, `auth.UserRoleFromContext(ctx) string`

- [ ] **Step 1: Create `internal/auth/jwt.go`**

`CreateToken(userID, role, secret, expiry)` — JWT with userID + role claims.
`ValidateToken(tokenStr, secret)` → returns userID, role.

- [ ] **Step 2: Write tests in `internal/auth/jwt_test.go`**

```go
func TestJWTRoundTrip(t *testing.T)       // create + validate, assert userID + role match
func TestJWTExpired(t *testing.T)          // negative expiry → error
func TestJWTInvalidSignature(t *testing.T) // validate with wrong secret → error
```

- [ ] **Step 3: Run tests, verify pass**

```bash
go test ./internal/auth/ -v
```

- [ ] **Step 4: Create `internal/auth/google.go`**

`GoogleLoginHandler(cfg)` — redirect to Google OAuth with email+profile scopes.
`GoogleCallbackHandler(cfg, db)` — exchange code, fetch user info, upsert user (first user ever → role=admin, rest → role=user), create JWT with role, set httpOnly cookie, redirect to `/`.

- [ ] **Step 5: Create `internal/auth/middleware.go`**

`AuthMiddleware(jwtSecret)` — extract JWT from cookie, validate, put userID + role in context. 401 on failure.
`AdminMiddleware()` — check role from context == "admin". 403 on failure.
`UserIDFromContext(ctx) string`, `UserRoleFromContext(ctx) string`.

- [ ] **Step 6: Create `MeHandler(db)` and `LogoutHandler()`**

Me: return user info + role from DB. Logout: clear cookie.

- [ ] **Step 7: Wire auth routes in `cmd/server/main.go`**

```
GET  /auth/google          → GoogleLoginHandler
GET  /auth/google/callback → GoogleCallbackHandler
GET  /auth/me              → AuthMiddleware → MeHandler
POST /auth/logout          → LogoutHandler
```

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: Google OAuth + JWT auth + admin middleware"
```

---

### Task 3: Admin Master Data API (Categories + Payment Methods)

**Files:**
- Create: `internal/handler/category.go`, `internal/handler/payment_method.go`, `internal/handler/handler_test.go`
- Modify: `cmd/server/main.go` (add admin + user-read routes)

**Interfaces:**
- Consumes: `auth.AuthMiddleware`, `auth.AdminMiddleware`, `db *sql.DB`
- Produces: `handler.ListCategories(db)`, `handler.CreateCategory(db)`, `handler.UpdateCategory(db)`, `handler.DeleteCategory(db)`, same for PaymentMethod. User-read: `handler.ListCategories` reused.

- [ ] **Step 1: Create `internal/handler/handler_test.go`**

Test helpers: setup test DB (use env `TEST_DATABASE_URL`), create test user (admin + regular), get auth cookie for user. These helpers reused by all handler tests.

- [ ] **Step 2: Write tests for category CRUD**

In `internal/handler/category_test.go`:
```go
func TestAdminCreateCategory(t *testing.T)       // admin POST → 201
func TestAdminUpdateCategory(t *testing.T)       // admin PUT → 200
func TestAdminDeleteCategory(t *testing.T)       // admin DELETE → 204
func TestUserCreateCategory_Forbidden(t *testing.T) // regular user POST → 403
func TestDeleteCategory_InUse(t *testing.T)      // category used by expense → 409
func TestListCategories(t *testing.T)            // any authed user → 200 + list
```

- [ ] **Step 3: Run tests, verify fail**

- [ ] **Step 4: Implement `internal/handler/category.go`**

CRUD handlers. DeleteCategory checks for existing expenses referencing it → 409 if found.

- [ ] **Step 5: Write + implement payment_method (same pattern)**

`internal/handler/payment_method.go` + `internal/handler/payment_method_test.go`. Same tests as category.

- [ ] **Step 6: Wire routes in `main.go`**

```
# Admin
POST   /api/admin/categories        → AdminMiddleware → CreateCategory
PUT    /api/admin/categories/{id}   → AdminMiddleware → UpdateCategory
DELETE /api/admin/categories/{id}   → AdminMiddleware → DeleteCategory

POST   /api/admin/payment-methods        → AdminMiddleware → CreatePaymentMethod
PUT    /api/admin/payment-methods/{id}   → AdminMiddleware → UpdatePaymentMethod
DELETE /api/admin/payment-methods/{id}   → AdminMiddleware → DeletePaymentMethod

# User read
GET /api/categories       → AuthMiddleware → ListCategories
GET /api/payment-methods  → AuthMiddleware → ListPaymentMethods
```

- [ ] **Step 7: Run all tests, verify pass**

```bash
go test ./... -v
```

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: admin master data API (categories, payment methods)"
```

---

### Task 4: Trip CRUD API + Dashboard

**Files:**
- Create: `internal/handler/trip.go`, `internal/handler/trip_test.go`, `internal/handler/dashboard.go`, `internal/handler/dashboard_test.go`
- Modify: `cmd/server/main.go`

**Interfaces:**
- Consumes: `auth.AuthMiddleware`, `auth.UserIDFromContext`, `db *sql.DB`, model `Trip`
- Produces: `handler.ListTrips(db)`, `handler.CreateTrip(db)`, `handler.GetTrip(db)`, `handler.UpdateTrip(db)`, `handler.DeleteTrip(db)`, `handler.GetDashboard(db)`

ListTrips returns trips with computed status. GetTrip returns trip + expenses + total pengeluaran + saldo.
GetDashboard returns `{ belum_lunas: int64, pemasukan_bulan_lalu: int64 }`.

- [ ] **Step 1: Write tests in `internal/handler/trip_test.go`**

```go
func TestCreateTrip(t *testing.T)              // POST → 201
func TestCreateTrip_InvalidDates(t *testing.T) // end < start → 400
func TestListTrips(t *testing.T)               // only own trips, includes status field
func TestGetTrip(t *testing.T)                 // returns trip + totals
func TestGetTrip_OtherUser(t *testing.T)       // other user's trip → 404
func TestUpdateTrip(t *testing.T)              // PUT uang_dinas + tanggal_dibayar
func TestDeleteTrip(t *testing.T)              // DELETE → 204
```

- [ ] **Step 2: Write tests in `internal/handler/dashboard_test.go`**

```go
func TestDashboard_BelumLunas(t *testing.T)        // sum expenses with payment_method=Pribadi from non-selesai trips
func TestDashboard_PemasukanBulanLalu(t *testing.T) // sum uang_dinas from selesai trips last month
```

- [ ] **Step 3: Run tests, verify fail**

- [ ] **Step 4: Implement `internal/handler/trip.go`**

All queries filter `user_id`. ListTrips: query trips, compute status via model method. GetTrip: join with expenses, return sums.

- [ ] **Step 5: Implement `internal/handler/dashboard.go`**

`GetDashboard(db)`:
- belum_lunas: `SELECT SUM(e.jumlah) FROM expenses e JOIN trips t ON e.trip_id = t.id JOIN payment_methods pm ON e.payment_method_id = pm.id WHERE t.user_id = $1 AND pm.nama = 'Pribadi' AND (t.tanggal_dibayar IS NULL OR t.uang_dinas IS NULL)`
- pemasukan_bulan_lalu: `SELECT SUM(t.uang_dinas) FROM trips t WHERE t.user_id = $1 AND t.tanggal_dibayar IS NOT NULL AND t.uang_dinas IS NOT NULL AND date_trunc('month', t.tanggal_dibayar) = date_trunc('month', now() - interval '1 month')`

- [ ] **Step 6: Wire routes**

```
GET    /api/trips        → ListTrips
POST   /api/trips        → CreateTrip
GET    /api/trips/{id}   → GetTrip
PUT    /api/trips/{id}   → UpdateTrip
DELETE /api/trips/{id}   → DeleteTrip
GET    /api/dashboard    → GetDashboard
```

- [ ] **Step 7: Run all tests, verify pass**

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: trip CRUD + dashboard API"
```

---

### Task 5: Expense CRUD API

**Files:**
- Create: `internal/handler/expense.go`, `internal/handler/expense_test.go`
- Modify: `cmd/server/main.go`

**Interfaces:**
- Consumes: `auth.AuthMiddleware`, `auth.UserIDFromContext`, `db *sql.DB`
- Produces: `handler.ListExpenses(db)`, `handler.CreateExpense(db)`, `handler.UpdateExpense(db)`, `handler.DeleteExpense(db)`

- [ ] **Step 1: Write tests in `internal/handler/expense_test.go`**

```go
func TestCreateExpense(t *testing.T)                // POST → 201, with valid category_id + payment_method_id
func TestCreateExpense_ZeroAmount(t *testing.T)     // jumlah = 0 → 400
func TestCreateExpense_NegativeAmount(t *testing.T) // jumlah = -1000 → 400
func TestCreateExpense_InvalidCategory(t *testing.T)// non-existent category_id → 400
func TestCreateExpense_OtherUserTrip(t *testing.T)  // trip belongs to other user → 404
func TestListExpenses(t *testing.T)                 // returns expenses for trip, joined with category + payment_method names
func TestUpdateExpense(t *testing.T)                // PUT → 200
func TestUpdateExpense_OtherUser(t *testing.T)      // expense's trip belongs to other user → 404
func TestDeleteExpense(t *testing.T)                // DELETE → 204
```

- [ ] **Step 2: Run tests, verify fail**

- [ ] **Step 3: Implement `internal/handler/expense.go`**

Create/Update: validate jumlah > 0, verify category_id + payment_method_id exist, verify trip belongs to user.
List: join with categories + payment_methods to return names alongside IDs.

- [ ] **Step 4: Wire routes**

```
GET    /api/trips/{tripID}/expenses  → ListExpenses
POST   /api/trips/{tripID}/expenses  → CreateExpense
PUT    /api/expenses/{id}            → UpdateExpense
DELETE /api/expenses/{id}            → DeleteExpense
```

- [ ] **Step 5: Run all tests, verify pass**

```bash
go test ./... -v
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: expense CRUD API"
```

---

### Task 6: SolidJS Frontend — Scaffold + Auth + Dashboard + Trip List

**Files:**
- Create: `web/` — `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/index.tsx`, `src/App.tsx`, `src/api.ts`, `src/pages/Login.tsx`, `src/pages/Dashboard.tsx`, `src/components/Navbar.tsx`, `src/components/StatusBadge.tsx`, `src/styles/global.css`

**Interfaces:**
- Consumes: Backend `/auth/*`, `/api/trips`, `/api/dashboard`
- Produces: Working SPA with login, dashboard (summary cards + trip list)

- [ ] **Step 1: Scaffold SolidJS project**

```bash
cd web && npx degit solidjs/templates/ts . && npm install
npm install @solidjs/router
```

- [ ] **Step 2: Create `src/api.ts`**

```typescript
async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T>
```
Wrapper: prepends base path, handles JSON, credentials `same-origin`, throws on non-ok.

- [ ] **Step 3: Create `src/pages/Login.tsx`**

Google login button → `window.location.href = '/auth/google'`. Centered, mobile-first.

- [ ] **Step 4: Create `src/components/Navbar.tsx`**

User name + avatar, logout button. Sticky top. Admin link if role=admin.

- [ ] **Step 5: Create `src/components/StatusBadge.tsx`**

Colored badge: berlangsung (blue), urus_berkas (orange), selesai (green).

- [ ] **Step 6: Create `src/pages/Dashboard.tsx`**

Top: two summary cards (Belum Lunas Rp X, Pemasukan Bulan Lalu Rp X) from `/api/dashboard`.
Below: trip list from `/api/trips`. Each card: nama, tujuan, tanggal, StatusBadge, saldo. FAB to add trip.

- [ ] **Step 7: Create `src/App.tsx` with router**

Routes: `/login` → Login, `/` → Dashboard (protected). Redirect to `/login` if `/auth/me` fails.

- [ ] **Step 8: Create `src/styles/global.css`**

Mobile-first. System font stack, max-width 480px centered, 44px min tap targets, card styles.

- [ ] **Step 9: Configure `vite.config.ts` proxy**

Proxy `/api` and `/auth` to `http://localhost:8080`.

- [ ] **Step 10: Verify — `npm run dev`, login, see dashboard**

- [ ] **Step 11: Commit**

```bash
git add -A && git commit -m "feat: SolidJS scaffold, auth, dashboard + trip list"
```

---

### Task 7: SolidJS Frontend — Trip Detail + Expense Forms + Admin

**Files:**
- Create: `src/pages/TripDetail.tsx`, `src/pages/TripForm.tsx`, `src/pages/Admin.tsx`, `src/components/ExpenseList.tsx`, `src/components/ExpenseForm.tsx`

**Interfaces:**
- Consumes: `api.ts`, backend trip/expense/admin endpoints, `/api/categories`, `/api/payment-methods`
- Produces: Complete CRUD UI

- [ ] **Step 1: Create `src/pages/TripForm.tsx`**

Form: nama, tujuan, tanggal_mulai, tanggal_selesai, uang_dinas (optional), tanggal_dibayar (optional). Validate end >= start. POST or PUT.

- [ ] **Step 2: Create `src/pages/TripDetail.tsx`**

Trip info + status badge. Summary: total pengeluaran, uang dinas, saldo. ExpenseList below. Edit/delete trip buttons. Button to mark as paid (set uang_dinas + tanggal_dibayar).

- [ ] **Step 3: Create `src/components/ExpenseList.tsx`**

Expenses grouped by category name. Each row: deskripsi, payment method badge, jumlah (Rp formatted), tanggal. Edit/delete per row. Add button.

- [ ] **Step 4: Create `src/components/ExpenseForm.tsx`**

Modal/bottom-sheet form. Fields: deskripsi, jumlah (number), tanggal (date), category (select from `/api/categories`), payment method (select from `/api/payment-methods`). Validate jumlah > 0.

- [ ] **Step 5: Create `src/pages/Admin.tsx`**

Two sections: Categories, Payment Methods. Each: list + inline add/edit/delete. Only accessible if role=admin.

- [ ] **Step 6: Wire routes in `App.tsx`**

```
/trips/new      → TripForm (create)
/trips/:id      → TripDetail
/trips/:id/edit → TripForm (edit)
/admin          → Admin (protected, admin only)
```

- [ ] **Step 7: Verify — full CRUD flow end-to-end**

Create trip → add expenses with different categories and payment methods → see saldo → set uang_dinas + tanggal_dibayar → status changes to selesai → dashboard updates.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: trip detail, expense forms, admin panel"
```

---

### Task 8: Production Build + Docker

**Files:**
- Modify: `Dockerfile`, `cmd/server/main.go`, `docker-compose.yml`

**Interfaces:**
- Consumes: All previous tasks
- Produces: Single Docker image serving Go API + SolidJS static

- [ ] **Step 1: Update `Dockerfile` — multi-stage**

Stage 1: Node 20, `npm ci && npm run build` → `web/dist/`.
Stage 2: Go, build binary.
Stage 3: Alpine, copy binary + migrations + `web/dist/`.

- [ ] **Step 2: Update `cmd/server/main.go` — serve static**

Serve `web/dist/` at `/`. SPA fallback to `index.html`. API routes take priority.

- [ ] **Step 3: Update `docker-compose.yml`**

`restart: unless-stopped`. Proper env_file. Remove dev-only config.

- [ ] **Step 4: Verify — `docker compose up --build`, full flow works**

```bash
docker compose up --build -d
curl http://localhost:8080/healthz
# Full OAuth + CRUD flow in browser
```

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: production Docker build"
```

---

## Review Focus Tests

Added to respective task test files:

**Task 4 — trip_test.go:**
- `TestGetTrip_OtherUser` → 404
- `TestCreateTrip_InvalidDates` → 400

**Task 5 — expense_test.go:**
- `TestCreateExpense_OtherUserTrip` → 404
- `TestCreateExpense_NegativeAmount` → 400
- `TestUpdateExpense_OtherUser` → 404

**Task 3 — category_test.go:**
- `TestUserCreateCategory_Forbidden` → 403
- `TestDeleteCategory_InUse` → 409

**Task 2 — jwt_test.go:**
- `TestJWTExpired` → error
- `TestJWTInvalidSignature` → error

**Task 1 — models_test.go:**
- `TestTripStatus_*` — all three states + partial payment edge case

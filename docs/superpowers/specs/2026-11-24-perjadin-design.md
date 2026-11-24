# Perjadin Personal — Design Doc

## Intent & Why
Aplikasi web multi-user untuk mencatat keuangan perjalanan dinas. Tiap user login via Google OAuth, catat pengeluaran per komponen per trip, lihat saldo dan status pembayaran. Admin manage master data. Mobile-first, dipakai langsung dari HP waktu di perjalanan.

## Goals
- Multi-user, login via Google OAuth 2.0
- Admin role untuk manage master data (categories, payment methods)
- Catat trip: nama, tujuan, tanggal mulai/selesai, uang dinas, tanggal dibayar
- Catat pengeluaran per trip, per kategori, per metode pembayaran
- Status trip otomatis (berlangsung / urus berkas / selesai)
- Dashboard: belum lunas, pemasukan bulan lalu
- Mobile-first UI
- Deploy via Docker Compose

## Non-goals
- Upload bukti/foto struk
- Reporting/grafik kompleks
- Offline support

## Anti-goals
- Over-engineered enterprise app
- Lambat di HP

## Tech Stack
- **Backend:** Go (REST API, stdlib net/http)
- **Database:** PostgreSQL
- **Frontend:** SolidJS (SPA, mobile-first)
- **Deploy:** Docker Compose (Go + Postgres)
- **Auth:** Google OAuth 2.0, session via JWT httpOnly cookie

## Data Model

```
User
├── id (uuid), google_id, email, name, avatar_url, role (admin/user)
├── created_at

Category (master, admin-managed)
├── id (uuid), nama
├── created_at
│   Seed: Makan, Transportasi, Hotel, Lainnya

PaymentMethod (master, admin-managed)
├── id (uuid), nama
├── created_at
│   Seed: Pribadi, Koperasi, Talangan

Trip
├── id (uuid), user_id (fk), nama, tujuan
├── tanggal_mulai, tanggal_selesai
├── uang_dinas (integer, nullable — jumlah yang akan diterima)
├── tanggal_dibayar (nullable — null = belum lunas)
├── created_at, updated_at

Expense
├── id (uuid), trip_id (fk), category_id (fk), payment_method_id (fk)
├── deskripsi, jumlah (integer, rupiah), tanggal
├── created_at
```

Semua jumlah disimpan dalam integer (rupiah, tanpa desimal).

## Status Trip (computed, bukan kolom)

```
berlangsung  → today >= tanggal_mulai AND today <= tanggal_selesai
urus berkas  → today > tanggal_selesai AND (tanggal_dibayar IS NULL OR uang_dinas IS NULL)
selesai      → tanggal_dibayar IS NOT NULL AND uang_dinas IS NOT NULL
```

## Dashboard Summary

- **Belum Lunas** — total pengeluaran dengan payment_method = Pribadi dari semua trip yang belum selesai
- **Pemasukan Bulan Lalu** — sum uang_dinas dari trip selesai di bulan sebelumnya

## API Endpoints

```
# Auth
GET  /auth/google            → redirect ke Google
GET  /auth/google/callback   → handle callback, set JWT cookie
GET  /auth/me                → current user info
POST /auth/logout            → clear cookie

# Admin — Master Data
GET    /api/admin/categories        → list categories
POST   /api/admin/categories        → create category
PUT    /api/admin/categories/:id    → update category
DELETE /api/admin/categories/:id    → delete category

GET    /api/admin/payment-methods        → list payment methods
POST   /api/admin/payment-methods        → create payment method
PUT    /api/admin/payment-methods/:id    → update payment method
DELETE /api/admin/payment-methods/:id    → delete payment method

# User — Master Data (read-only)
GET /api/categories                → list categories
GET /api/payment-methods           → list payment methods

# Trips
GET    /api/trips             → list trips (user's own) + status computed
POST   /api/trips             → create trip
GET    /api/trips/:id         → get trip detail + expenses + saldo
PUT    /api/trips/:id         → update trip (termasuk uang_dinas, tanggal_dibayar)
DELETE /api/trips/:id         → delete trip

# Expenses
GET    /api/trips/:id/expenses  → list expenses for trip
POST   /api/trips/:id/expenses  → add expense
PUT    /api/expenses/:id        → update expense
DELETE /api/expenses/:id        → delete expense

# Dashboard
GET    /api/dashboard           → belum_lunas + pemasukan_bulan_lalu
```

Semua /api/* (kecuali admin) scoped per user dari JWT.
Admin endpoints require role = admin.

## UI Screens (mobile-first)
1. **Login** — Google login button
2. **Dashboard / Trip list** — summary cards (belum lunas, pemasukan bulan lalu) + daftar trip dengan status badge
3. **Trip detail** — info trip, status, uang dinas, list expenses grouped by kategori, saldo
4. **Form tambah/edit** trip, expense
5. **Admin** — manage categories, payment methods (simple list + form)

## Env Vars
```
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_REDIRECT_URL=https://domain/auth/google/callback
JWT_SECRET=xxx
DATABASE_URL=postgres://user:pass@host:5432/perjadin
```

# Design Spec: Workspace Collaboration (Notion-style)

## 1. Context & Motivation
Saat ini kolaborasi perjalanan dinas menggunakan tabel `trip_members` (per-trip invitation). Model ini kaku dan merepotkan:
- User A harus mengundang User B secara manual di setiap trip baru.
- Tidak ada ruang kerja bersama (shared workspace).
- Rekan kerja atau sekretaris/asisten (User B) tidak bisa dengan mudah membuat dan mencatatkan perjalanan dinas untuk User A dari akun User B sendiri.

Sistem akan beralih ke model **Workspace ala Notion/Slack**:
- Perjalanan dinas bernaung di bawah sebuah **Workspace** (`trips.workspace_id`).
- User A memiliki Workspace A. User A dapat mengundang User B ke Workspace A via **Join Code / Link**.
- User B yang telah bergabung dapat berpindah workspace via dropdown di navbar.
- Saat berada di Workspace A, User B dapat melihat semua trip, membuat trip baru atas nama workspace tersebut, dan mencatat pengeluaran.
- Fitur lama `trip_members` dihapus sepenuhnya.

---

## 2. Goals & Non-Goals

### Goals
1. **Entitas Workspaces & Membership**:
   - Tabel `workspaces` (`id`, `nama`, `owner_id`, `join_code`, `created_at`, `updated_at`).
   - Tabel `workspace_members` (`id`, `workspace_id`, `user_id`, `role`, `created_at`).
   - Relasi `trips.workspace_id REFERENCES workspaces(id)`.
2. **Auto-provisioning & Seamless Migration**:
   - Migration membuat workspace personal default untuk setiap user yang sudah ada.
   - Semua trip yang sudah ada dimigrasikan ke workspace milik owner trip tersebut.
   - User baru saat login/registrasi otomatis dibuatkan 1 personal workspace.
3. **Workspace Switching & Context**:
   - Frontend memiliki Workspace Switcher di navbar.
   - Backend membaca active workspace via header `X-Workspace-ID` (dengan fallback otomatis ke personal workspace jika header kosong).
   - Validasi otorisasi: user harus menjadi member di workspace tersebut untuk membaca/menulis trip & dashboard.
4. **Join Workspace**:
   - Owner dapat melihat kode unik 6-karakter (misal `WK-8X92`) dan share link `/join/:code`.
   - User lain memasukkan kode atau membuka link untuk langsung bergabung ke workspace.
5. **Pembersihan `trip_members`**:
   - Hapus tabel `trip_members`, handler invite trip member, dan UI member di `TripDetail`.
   - Siapa yang mencatat pengeluaran tetap tercatat di `expenses.user_id`.

### Non-Goals
- Permission granular (read-only member vs editor): semua member workspace memiliki hak edit/catat.
- Multiple owners per workspace: 1 workspace = 1 owner (pemilik utama), sisanya role `member`.

---

## 3. Database Schema Changes (Migration 009)

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
    role VARCHAR(20) NOT NULL DEFAULT 'member', -- 'owner' | 'member'
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_workspace_member UNIQUE (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_ws ON workspace_members(workspace_id);

-- 3. Backfill workspaces for existing users
-- Create personal workspace for each existing user
INSERT INTO workspaces (id, nama, owner_id, join_code)
SELECT 
    gen_random_uuid(),
    'Workspace ' || u.name,
    u.id,
    UPPER(SUBSTRING(MD5(u.id::text || now()::text) FROM 1 FOR 6))
FROM users u;

-- Add owners to workspace_members
INSERT INTO workspace_members (workspace_id, user_id, role)
SELECT id, owner_id, 'owner' FROM workspaces;

-- 4. Alter trips table
ALTER TABLE trips ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;

-- Backfill trips.workspace_id using owner's workspace
UPDATE trips t
SET workspace_id = w.id
FROM workspaces w
WHERE w.owner_id = t.user_id AND t.workspace_id IS NULL;

-- Make workspace_id NOT NULL after backfill
ALTER TABLE trips ALTER COLUMN workspace_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trips_workspace ON trips(workspace_id);

-- 5. Drop legacy trip_members table
DROP TABLE IF EXISTS trip_members;
```

---

## 4. API Endpoints

### Workspace Management
- `GET /api/workspaces`
  - Mengembalikan daftar workspace yang diikuti user (beserta status role: owner/member dan jumlah member).
- `POST /api/workspaces`
  - Membuat workspace baru. Body: `{ "nama": "Tim Operasi BBM" }`. Otomatis assign user sebagai `owner`.
- `GET /api/workspaces/current`
  - Detail workspace aktif berdasarkan header `X-Workspace-ID` (termasuk `join_code` jika owner, daftar anggota).
- `POST /api/workspaces/join`
  - Bergabung ke workspace dengan kode. Body: `{ "code": "A9B2X1" }`.
- `POST /api/workspaces/regenerate-code`
  - (Owner only) Ganti join code baru.
- `DELETE /api/workspaces/{id}/members/{userId}`
  - (Owner only) Keluarkan member dari workspace.

### Scoping Trips & Analytics
Setiap request ke:
- `GET /api/trips`
- `POST /api/trips`
- `GET /api/dashboard`
- `GET /api/analytics`
- `POST /api/trips/parse-document`

Akan membaca workspace aktif via helper `workspaceFromContext(r)`.
Helper mengambil ID workspace dari header `X-Workspace-ID`. Jika tidak ada/invalid, default ke workspace pertama milik user.
Validasi: User wajib terdaftar di `workspace_members` untuk workspace tersebut.

---

## 5. Frontend UX Flow (Notion-style)

1. **Navbar Workspace Selector**:
   - Di sebelah kiri avatar user / logo, terdapat dropdown Workspace Switcher (ikon building/briefcase + Nama Workspace Aktif + Chevron).
   - Dropdown menu:
     - Daftar workspace yang diikuti user (dengan tanda centang pada yang aktif).
     - Tombol `+ Buat Workspace Baru`.
     - Tombol `🔗 Gabung Workspace (Input Kode)`.
     - Tombol `⚙️ Pengaturan Workspace` (lihat Join Code / kelola member jika owner).
2. **Persistence Workspace Aktif**:
   - Disimpan di `localStorage.getItem('active_workspace_id')`.
   - Diinject otomatis pada header fetch `X-Workspace-ID: <id>`.
   - Mengubah workspace di dropdown langsung merefresh data trip dan dashboard.
3. **Penyederhanaan Halaman Trip**:
   - Hapus tab/modal collaborator di `TripDetail.tsx`.
   - Informasi pencatat pengeluaran tetap tampil di daftar transaksi (misal: "Dicatat oleh: Budi").

---

## 6. Migration & Rollout Strategy
1. Eksekusi migration SQL `009_create_workspaces.sql`.
2. Update backend models & endpoints, tes unit & integrasi untuk flow multi-workspace.
3. Update frontend API client (`web/src/api.ts`) dan navbar switcher.
4. Verifikasi E2E: User A undang User B via code -> User B switch ke Workspace A -> User B buat trip & catat pengeluaran -> User A melihat trip tersebut di dashboard-nya.

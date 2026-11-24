# Design Specification: Trip Collaborators, SBM Uang Harian Master, & UX Polish

**Date:** 2026-11-24  
**Author:** AI Principal Architect  
**Status:** Under Review  

---

## 1. Intent & Context
Aplikasi Perjadin telah memiliki alur status eksplisit dan database model yang solid. Tahap selanjutnya adalah meningkatkan utilitas operasional:
1. Menghilangkan masalah ergonomi mobile (tombol catat pengeluaran terlalu kecil dan tertutup dock bawah).
2. Memperkaya metrik analitik finansial perjalanan dinas.
3. Mengotomasi estimasi pagu berdasarkan Standar Biaya Masukan (SBM PMK RI) uang harian per provinsi/kota dengan antarmuka Creatable Select.
4. Mendukung kolaborasi tim (Shared Workspace via **Trip Collaborators**): satu perjalanan dinas dapat diakses dan dicatat bersama oleh beberapa pengguna terdaftar.

---

## 2. Goals & Non-Goals

### Goals
1. **Shortcut Pengeluaran & Ergonomi Mobile**:
   - Menambahkan Floating Action Button (FAB) atau Sticky Action Bar "Catat Pengeluaran" yang mencolok di `TripDetail`, dengan posisi `bottom: 5.5rem` (di atas bottom dock) dan z-index aman agar tidak pernah tertutup navbar/dock.
   - Menambah quick action catat pengeluaran di `Dashboard` untuk trip yang sedang berstatus `berlangsung`.

2. **Ekspansi Analitik Keuangan (`/analytics`)**:
   - Menambahkan 4 card analitik baru:
     - **Total Hari Dinas**: Akumulasi hari dinas dari seluruh trip.
     - **Burn Rate Harian**: Rata-rata pengeluaran per hari dinas (`total_pengeluaran / total_hari`).
     - **Porsi Talangan Pribadi**: Persentase pengeluaran dengan metode 'Pribadi' terhadap total belanja dinas.
     - **Rasio Realisasi Pagu**: Persentase serapan belanja terhadap total pagu uang dinas yang cair.

3. **Master SBM Uang Harian & Creatable City Select**:
   - Tabel master `sbm_rates` menyimpan tarif SBM Peraturan Menteri Keuangan (provinsi, ibukota/kota, tarif uang harian).
   - Seeder awal 38 provinsi di Indonesia dengan tarif resmi SBM PMK (misal: DKI Jakarta Rp 530.000, Jabar Rp 430.000, Bali Rp 480.000, Papua Rp 580.000, dll).
   - Manajemen SBM di `/admin/master`: CRUD tarif per provinsi/wilayah.
   - Komponen **Creatable Searchable Select** di `TripForm` untuk kolom Kota Tujuan:
     - User bisa mencari kota/provinsi yang ada di database SBM.
     - Jika kota tidak ada di list, user bisa mengetik manual ("Creatable").
     - Ketika kota/provinsi dipilih dan tanggal mulai/selesai diisi, sistem otomatis menghitung:  
       `Estimasi Uang Harian = tarif_harian * durasi_hari`.
     - Muncul banner informatif dengan tombol 1-klik "Gunakan Estimasi Ini" untuk otomatis mengisi kolom `nominal_monita`.

4. **Trip Collaborators (Shared Workspace per Perjalanan)**:
   - Tabel `trip_members` menghubungkan `trips` dengan multiple `users`.
   - Tabel `expenses` mencatat `user_id` pembuat pengeluaran.
   - Hak Akses:
     - Pemilik trip (`trips.user_id`) dan anggota terdaftar (`trip_members`) dapat melihat detail trip dan menambahkan/mengedit pengeluaran mereka sendiri.
     - Pemilik trip atau Admin dapat menambah/menghapus anggota kolaborator di halaman `TripDetail`.
     - Pada daftar perjalanan (`/`), tampilkan perjalanan milik sendiri DAN perjalanan di mana user menjadi kolaborator (dengan badge "Kolaborasi").
     - Pada setiap baris pengeluaran di `TripDetail`, tampilkan nama/avatar pencatat pengeluaran ("oleh Maulana").

### Non-Goals
- Multi-organization enterprise tenant switching (kolaborasi berbasis trip langsung menjaga model data tetap simpel dan efisien).
- Role approval bertingkat berjenjang (semua anggota kolaborator memiliki hak catat dan verifikasi mandiri).

---

## 3. Approaches Considered

- **Pendekatan A: Workspace Hirarkis Terpisah (`workspaces` table)**:
  Membuat entitas baru `workspaces`, di mana admin memasukkan user ke workspace tertentu dan semua trip dibuat di bawah workspace.  
  *Evaluasi*: Terlalu kaku untuk pola kerja dinas nyata di mana tim dinas sering berganti-ganti per penugasan/surat tugas. Menambah tabel perantara dan mempersulit user biasa yang hanya ingin catat trip pribadi.

- **Pendekatan B: Trip Collaborator Langsung (Pilihan User - Terpilih)**:
  Trip itu sendiri berfungsi sebagai workspace bersama. Pembuat trip atau admin tinggal menambahkan rekan dinas (`collaborators`) ke trip tersebut.  
  *Evaluasi*: Sangat fleksibel, zero-friction, cocok untuk pembagian tugas SPPD, dan tidak mengubah alur dasar bagi user yang jalan dinas solo.

---

## 4. Database Schema Specifications

### 4.1 Migration `004_collab_and_sbm.sql`

```sql
-- 1. Master SBM Rates
CREATE TABLE IF NOT EXISTS sbm_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provinsi TEXT NOT NULL,
    ibukota TEXT NOT NULL DEFAULT '',
    uang_harian BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sbm_provinsi ON sbm_rates (LOWER(provinsi));

-- 2. Trip Collaborators / Members
CREATE TABLE IF NOT EXISTS trip_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'member',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_trip_member UNIQUE(trip_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_trip_members_user ON trip_members (user_id);
CREATE INDEX IF NOT EXISTS idx_trip_members_trip ON trip_members (trip_id);

-- 3. Track expense recorder
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;
```

---

## 5. API Endpoints

### 5.1 SBM & Master Data
- `GET /api/sbm`: Mendapatkan seluruh list tarif SBM provinsi.
- `POST /api/sbm` (Admin only): Menambah tarif SBM baru.
- `PUT /api/sbm/{id}` (Admin only): Mengubah tarif SBM.
- `DELETE /api/sbm/{id}` (Admin only): Menghapus tarif SBM.

### 5.2 Trip Collaborators & Users
- `GET /api/users`: Endpoint publik terotentikasi untuk mencari user (id, name, email, avatar_url) saat mengundang rekan.
- `GET /api/trips/{id}/members`: List kolaborator trip (id, user_id, nama, email, avatar_url, role).
- `POST /api/trips/{id}/members`: Tambah kolaborator ke trip (`user_id` atau `email`). Hanya Owner & Admin.
- `DELETE /api/trips/{id}/members/{userId}`: Hapus kolaborator dari trip. Hanya Owner & Admin.

### 5.3 Authorization Matrix & Data Rules
1. **Trip Metadata & Status**: Hanya Owner dan Admin yang dapat mengedit trip (`PUT /api/trips/{id}`) atau menghapus trip (`DELETE`). Anggota kolaborator hanya memiliki hak read-only terhadap metadata trip.
2. **Pengeluaran (Expenses)**:
   - Anggota kolaborator dapat menambah pengeluaran dan mengedit/menghapus pengeluaran milik mereka sendiri (`e.user_id = auth_user`).
   - Owner dan Admin dapat mengedit/menghapus pengeluaran siapapun di dalam trip tersebut untuk keperluan perapihan SPJ/klaim.
3. **Analitik Finansial (`/api/analytics`)**:
   - `total_expenses_rp`: Menghitung total pengeluaran yang dicatat oleh user yang sedang login (`e.user_id = $1` atau legacy row `t.user_id = $1 AND e.user_id IS NULL`). Menjamin tidak ada distorsi dobel-hitung.
   - `total_days`: Akumulasi hari dinas dari trip yang diikuti user (baik sebagai owner maupun kolaborator).
   - `Rasio Realisasi Pagu`: Dihitung dari kohort trip berstatus `lunas` (`SUM(expenses) / SUM(uang_dinas)` pada trip lunas), mencegah skew dari trip yang masih berlangsung.

### 5.3 Modified Existing Endpoints
- `GET /api/trips`:
  ```sql
  WHERE t.user_id = $1 OR EXISTS (
      SELECT 1 FROM trip_members tm WHERE tm.trip_id = t.id AND tm.user_id = $1
  )
  ```
- `GET /api/trips/{id}`:
  Memeriksa apakah caller adalah owner, member, atau admin. Mengembalikan field `is_owner` boolean dan `collaborators_count`.
- `GET /api/analytics`:
  Mengembalikan agregat metrik baru: `total_days`, `daily_burn_rate`, `personal_share_pct`, `budget_realization_pct`.

---

## 6. Frontend & UI Design

### 6.1 TripDetail Action Bar & Floating Button
- Tombol "Tambah Pengeluaran" diperbesar menjadi Full-Width Floating Docklet atau Primary Elevated FAB (`height: 52px`, `padding: 0 1.25rem`, icon 20px, text tebal).
- Posisi: `position: fixed; bottom: 5.5rem;` (aman dari bottom nav 0.75rem + height 54px).
- Menampilkan section "Rekan Perjalanan / Kolaborator" di bawah detail hero: avatar stack, tombol "+ Undang Rekan" (membuka modal pilih user terdaftar).

### 6.2 Creatable City Select & Estimasi SBM
- Input tujuan di `TripForm` diganti dengan **Searchable Creatable Combobox**:
  - Menampilkan dropdown autocomplete dari 38 provinsi/ibukota SBM.
  - Opsi: user tetap bisa ketik manual jika tujuan di luar negeri atau kustom.
- Kotak kalkulasi reaktif:
  - `Durasi: N hari`
  - `Tarif SBM [Provinsi]: Rp X / hari`
  - `Total Estimasi: Rp (N * X)`
  - Tombol aksi: `[Terapkan ke Estimasi Monita]`

### 6.3 Analytics Page Enhancements
- 4 Card Tambahan:
  - Grid 2x2 rapi di atas breakdown kategori.
  - Doppel-card dengan typography monospaced angka jelas.

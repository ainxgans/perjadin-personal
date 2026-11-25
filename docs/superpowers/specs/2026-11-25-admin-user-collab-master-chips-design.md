# Design Specification: Admin User Management, Pre-Registration / Invite, Sole Admin Guard & SBM Chips Input

- **Date:** 2026-11-25
- **Author:** Lazy Senior Developer & Antigravity
- **Status:** Draft (Awaiting Approval)
- **Target Repo:** `perjadin-personal`

---

## 1. Intent & The Why
- **Problem Statement:**
  1. Input daftar kota di Master SBM saat ini berupa string panjang dipisah koma dalam `<input>`, rentan salah ketik, tidak ada verifikasi duplikat, dan tampilan di tabel memanjang tidak rapi.
  2. Halaman Kelola Pengguna (`/admin/users`) tidak memiliki indikator siapa akun yang sedang login `(Anda)`, dan tombol demosi "Jadikan User" aktif meski user tersebut adalah satu-satunya admin tersisa.
  3. Sistem kolaborasi perjalanan (`/trips/:id` -> "+ Undang Rekan") hanya bisa menemukan user yang sudah pernah login Google. Tidak ada cara bagi Admin untuk mendaftarkan atau mengundang rekan kerja baru ke sistem sebelum mereka login.
  4. Manajemen master data terasa monoton dan kaku tanpa pencarian cepat untuk kategori & metode pembayaran.

- **Objective:**
  1. Tingkatkan UX input kota di SBM dengan komponen **Chips / Tag Input** interaktif (badge chips, `Enter`/koma untuk tambah, tombol hapus `×`, cegah duplikat) dan chip preview yang rapi di tabel.
  2. Berikan perlindungan **Sole Admin Guard** di UI dan tandai akun `(Anda)`.
  3. Tambahkan fitur **Tambah / Pra-registrasi Pengguna Baru** oleh Admin dengan Email, Nama, dan Role, sehingga user langsung terdaftar di database dan bisa langsung dijadikan kolaborator perjalanan dinas. Saat user login pertama kali dengan Google OAuth, akun otomatis tertaut.

---

## 2. Goals, Non-Goals, Anti-Goals

### Goals
- **Chips / Tag Input:** Input daftar kota di Admin Master SBM menggunakan chips interaktif dengan validasi duplikasi dan navigasi mudah.
- **Sole Admin Guard:** Tombol "Jadikan User" otomatis ter-disable dan menampilkan badge peringatan jika target adalah admin tunggal di sistem.
- **Identifikasi Akun:** Menampilkan label badge `(Anda)` pada user yang sedang login di direktori pengguna.
- **Filter Role:** Filter cepat user berdasarkan role (`Semua`, `Admin`, `User`).
- **Pra-registrasi / Invite Pengguna:** Admin dapat membuat user baru lewat modal di `/admin/users`. Saat user login Google pertama kali dengan email tersebut, Google ID ditautkan ke record user yang sudah ada.
- **Master Data Filter:** Input pencarian cepat di tab Kategori & Metode Pembayaran.

### Non-Goals
- Tidak mengirimkan email invitation fisik via SMTP (sistem berbasis OAuth Google internal organisasi, cukup pra-registrasi email agar dikenali sistem).
- Tidak merombak skema hak akses selain `admin` dan `user`.

### Anti-Goals
- Tidak mengizinkan penghapusan atau demosi satu-satunya admin aktif yang tersisa.
- Tidak membuat form chips menjadi lambat atau bergantung pada library pihak ketiga yang membengkakkan bundle frontend. Gunakan SolidJS native component murni.

---

## 3. Approaches Considered

1. **Pendekatan A (Hanya Frontend Polish):**
   - Perbaiki tampilan chips kota dan disable tombol admin di frontend.
   - *Kelemahan:* Masalah utama pengguna baru belum bisa diundang ke trip sebelum login tetap tidak terselesaikan.

2. **Pendekatan B (Pilihan Terpilih - Full Scope):**
   - Buat komponen `ChipsInput.tsx` native di SolidJS untuk Master SBM.
   - Tambahkan modal dan endpoint `POST /api/admin/users` untuk pra-registrasi akun oleh Admin.
   - Migrasi DB: kolom `google_id` di `users` dibuat nullable (`ALTER TABLE users ALTER COLUMN google_id DROP NOT NULL`).
   - Handler Google OAuth disesuaikan: jika user dengan email tersebut sudah ada, update `google_id` dan avatar, jangan gagal karena duplikasi email.
   - Guard sole admin & badge `(Anda)` di `/admin/users`.
   - *Alasan:* Menyelesaikan semua feedback teknis sekaligus tanpa menambah beban dependensi eksternal.

---

## 4. Detailed Design

### 4.1 Database Migration (`006_users_pre_register.sql`)
```sql
-- Allow google_id to be NULL for pre-registered users before their first OAuth login
ALTER TABLE users ALTER COLUMN google_id DROP NOT NULL;
```

### 4.2 Backend Changes

#### 1. Handler `internal/handler/admin_user.go`
- Tambahkan handler `CreateAdminUser(db *sql.DB)`:
  - Route: `POST /api/admin/users`
  - Input JSON: `{ "email": string, "name": string, "role": "admin"|"user" }`
  - Validasi: email valid, email unik (belum ada di DB), nama tidak kosong.
  - Query:
    ```sql
    INSERT INTO users (email, name, role)
    VALUES ($1, $2, $3)
    RETURNING id, email, name, role, created_at;
    ```
  - Response `201 Created` dengan payload data user baru.

#### 2. Handler `internal/auth/google.go`
- Update logika upsert saat login OAuth Google:
  ```go
  // 1. Cek apakah user sudah ada berdasarkan email atau google_id
  // 2. Jika ada berdasarkan email tapi google_id kosong: UPDATE users SET google_id = $1, avatar_url = $2, name = COALESCE(NULLIF(name, ''), $3) WHERE email = $4
  // 3. Jika belum ada: INSERT baru
  ```

#### 3. Update Handler `internal/handler/admin_user.go` (Listing)
- Endpoint `GET /api/admin/users` tetap menyertakan `id, google_id, email, name, avatar_url, role, created_at, trip_count`.
- Pastikan sorting default `role = 'admin' DESC, created_at DESC`.

### 4.3 Frontend Changes

#### 1. Komponen `ChipsInput.tsx` (`web/src/components/ChipsInput.tsx`)
- Props: `values: () => string[]`, `onChange: (values: string[]) => void`, `placeholder?: string`.
- Interaksi:
  - Render list chip dengan tombol `×`.
  - Input field di samping chip.
  - Menekan `Enter` atau `,` (koma) atau klik tombol `+ Tambah` memasukkan teks ke list (otomatis di-trim, cegah duplikat, cegah string kosong).
  - Menekan `Backspace` saat input kosong akan menghapus chip terakhir.

#### 2. Halaman `AdminMaster.tsx`
- Ganti input teks kota pada modal tambah/edit SBM dengan `ChipsInput`.
- Di list tabel SBM:
  - Render kota sebagai badges/pills kecil.
  - Jika kota > 3: tampilkan 3 kota pertama + tag `+X lainnya` (bisa di-klik untuk ekspansi).

#### 3. Halaman `AdminUsers.tsx`
- Tampilkan statistik ringkas di atas: Total Pengguna, Admin, User Biasa.
- Filter chips: `Semua`, `Admin`, `User`.
- Tombol "+ Undang / Tambah Pengguna" yang membuka modal:
  - Input: Email (wajib), Nama Lengkap (wajib), Role (`User` / `Admin`).
- Tombol "Jadikan User":
  - Diberikan guard: jika `u.role === 'admin'` dan `totalAdmins <= 1`, tombol di-disable dengan tooltip / label `Admin Terakhir`.
- Pada baris user yang sedang login (`u.id === currentUser.id`):
  - Tampilkan label chip `(Anda)`.
  - Jika user adalah admin tunggal, tombol aksi tidak dapat mendemosi diri sendiri.

#### 4. API Client (`web/src/api.ts`)
- Tambahkan fungsi:
  ```ts
  export const createAdminUser = (data: { email: string; name: string; role: 'admin' | 'user' }) =>
    apiFetch<AdminUser>('/admin/users', { method: 'POST', body: JSON.stringify(data) });
  ```

---

## 5. Verification Plan
1. **Migration Test:**
   - Jalankan unit test migrasi DB `internal/db/migrations_test.go` untuk memvalidasi sintaks SQL migrasi 006.
2. **Backend Unit Tests:**
   - Test `CreateAdminUser`: sukses tambah user baru, tolak email duplikat, tolak invalid email.
   - Test `Google OAuth Upsert`: tautkan user yang di-pra-registrasi saat login pertama kali.
   - Test `UpdateUserRole`: tolak demosi admin jika total admin <= 1.
3. **Playwright E2E UI Tests:**
   - Buka `/admin/master` -> Tab Tarif SBM -> Buka Tambah/Edit SBM -> Ketik nama kota, tekan enter, pastikan chip terbentuk dan bisa dihapus.
   - Buka `/admin/users` -> Pastikan tombol sole admin ter-disable jika hanya ada 1 admin dan ada label `(Anda)`.
   - Buka Modal Tambah User -> Masukkan email rekan -> Simpan -> Muncul di daftar.
   - Buka salah satu Trip -> Tambah Rekan -> Cari email rekan baru -> Langsung muncul dan berhasil diundang.

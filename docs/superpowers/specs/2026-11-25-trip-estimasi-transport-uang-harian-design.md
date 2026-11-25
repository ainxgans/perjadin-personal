# Design Specification: Estimasi Transport, Pergantian Istilah SBM ke Uang Harian & Kalkulator Monita

- **Date:** 2026-11-25
- **Author:** Lazy Senior Developer & Antigravity
- **Status:** Draft (Awaiting Approval)
- **Target Repo:** `perjadin-personal`

---

## 1. Intent & The Why
- **Problem Statement:**
  1. Istilah "SBM" (Standar Biaya Masukan) membingungkan karena dianggap sebagai estimasi total biaya perjalanan dinas, padahal SBM menurut dokumen SPM/Monita hanyalah komponen **Uang Harian & Rapat**.
  2. Total pagu Monita (Rekap Riil Yang di-SPM-kan) mencakup komponen lain seperti **Uang Transportasi Riil (Taksi/Tiket)** dan **Hotel**. Saat ini tombol kalkulator langsung menimpa kolom `nominal_monita` hanya dengan uang harian saja, sehingga nominal pagu menjadi tidak akurat jika ada biaya transport.
  3. Pengguna tidak memiliki tempat untuk mencatat estimasi biaya transportasi perjalanan secara terpisah di data trip.

- **Objective:**
  1. Mengganti semua istilah/label **"SBM"** menjadi **"Uang Harian"** di seluruh antarmuka (Form Trip, Autocomplete Wilayah, dan Admin Master Data).
  2. Menambahkan kolom `estimasi_transport BIGINT` di tabel `trips` untuk mencatat pagu/estimasi biaya transportasi (taksi riil PP, tiket, sewa kendaraan, dll).
  3. Memperbarui `TripForm.tsx` dengan **Kalkulator Pagu Monita**:
     - Menampilkan Uang Harian otomatis: `hari × tarif wilayah`.
     - Input field `Estimasi Transport (Taksi / Tiket)` opsional.
     - Tombol / kalkulasi otomatis mengisi `Nominal Monita (Total Pagu)` = `Uang Harian + Estimasi Transport`.
  4. Menampilkan rincian komponen pagu (Uang Harian + Transport) di halaman `TripDetail.tsx`.

---

## 2. Goals, Non-Goals, Anti-Goals

### Goals
- **Penggantian Istilah:** Ganti semua label "SBM" / "Tarif SBM" menjadi "Uang Harian" / "Tarif Uang Harian" agar selaras dengan terminologi SPM Monita.
- **Penyimpanan Database:** Menambahkan kolom `estimasi_transport BIGINT` pada tabel `trips` dan mendukungnya di endpoint `POST /api/trips`, `PUT /api/trips/{id}`, serta `GET /api/trips/{id}`.
- **Kalkulator Form Trip:** Form trip menghitung subtotal Uang Harian dan memungkinkan pengisian Estimasi Transport, dengan tombol satu klik atau sinkronisasi ke `Nominal Monita`.
- **Rincian Detail Trip:** Halaman `TripDetail.tsx` menampilkan breakdown estimasi pagu (Uang Harian + Transport).

### Non-Goals
- Tidak membuat tabel master transport per wilayah (karena biaya transport/taksi/tiket bergantung rute riil dan variatif).
- Tidak membuat master hotel per wilayah (hotel diisi saat pemesanan/pengeluaran riil).

### Anti-Goals
- Tidak merusak backward compatibility API trip: kolom `estimasi_transport` bersifat opsional (nullable/0).
- Tidak mengubah nama tabel database `sbm_rates` di level DB untuk menjaga stabilitas query dan migrasi yang sudah ada, hanya istilah di UI/API layer yang diperjelas.

---

## 3. Approaches Considered

1. **Pendekatan A (Hanya Frontend Calculator):**
   - Hanya hitung di UI form dan gabungkan langsung ke `nominal_monita`.
   - *Kelemahan:* Pengguna tidak bisa melihat kembali berapa porsi transport dan uang harian yang dialokasikan saat melihat detail trip.

2. **Pendekatan B (Pilihan Terpilih - Simpan di DB & Breakdown di Detail):**
   - Tambah kolom `estimasi_transport` di `trips`.
   - Form Trip membagi input estimasi: Uang Harian (auto dari tarif wilayah) + Estimasi Transport -> Otomatis isi Nominal Monita.
   - Halaman Detail menampilkan kartu rincian pagu Monita.
   - Ganti seluruh teks SBM -> Uang Harian.

---

## 4. Detailed Design

### 4.1 Database Migration (`007_add_estimasi_transport.sql`)
```sql
ALTER TABLE trips ADD COLUMN IF NOT EXISTS estimasi_transport BIGINT;
```

### 4.2 Backend Changes

#### 1. Model `internal/model/models.go`
```go
type Trip struct {
    // ...
    EstimasiTransport *int64 `json:"estimasi_transport,omitempty"`
    // ...
}
```

#### 2. Handler `internal/handler/trip.go`
- Update query `tripSelectCols` untuk menyertakan `t.estimasi_transport`.
- Update `CreateTrip`: bind `estimasi_transport` dari request JSON dan masukkan ke query INSERT.
- Update `UpdateTrip`: bind `estimasi_transport` dan masukkan ke query UPDATE.

### 4.3 Frontend Changes

#### 1. Autocomplete & Dropdown (`web/src/components/CreatableSelect.tsx`)
- Ubah teks badge dropdown dari `"Standar Biaya: Rp ... / hari"` menjadi `"Uang Harian: Rp ... / hari"`.

#### 2. Form Trip (`web/src/pages/TripForm.tsx`)
- Ubah box "Estimasi SBM" menjadi **Kalkulator Pagu Monita**:
  - `Uang Harian`: `{hari} hari × Rp {tarif} = Rp {subtotal_uang_harian}`
  - Input field: `Estimasi Transport (Taksi / Tiket)`
  - Total Estimasi Monita: `{subtotal_uang_harian} + {estimasi_transport}`
  - Tombol **"Gunakan Total sebagai Pagu Monita"** yang mengisi input `Nominal Monita`.
- Kirim `estimasi_transport` ke API saat create/update trip.

#### 3. Detail Trip (`web/src/pages/TripDetail.tsx`)
- Di bagian ringkasan keuangan trip, jika `estimasi_transport` terisi:
  - Tampilkan rincian: Pagu Monita = Uang Harian + Transport.

#### 4. Master Data (`web/src/pages/admin/AdminMaster.tsx`)
- Tab `Tarif SBM` -> `Uang Harian`.
- Judul `Standar Biaya Masukan (Uang Harian)` -> `Tarif Uang Harian Wilayah`.
- Modal `Tambah/Edit SBM` -> `Tambah/Edit Tarif Uang Harian`.

---

## 5. Verification Plan
1. **Migration Test:** Pastikan `007_add_estimasi_transport.sql` lulus test sintaks di `internal/db/migrations_test.go`.
2. **Backend Unit Tests:** Test create & update trip dengan `estimasi_transport` di `internal/handler/trip_test.go`.
3. **Frontend Build:** `npm run build` lulus tanpa error TypeScript.
4. **Playwright E2E:**
   - Buat trip baru dengan tujuan Bandung, masukkan estimasi transport Rp 540.000.
   - Klik kalkulator -> pastikan Nominal Monita terisi (Uang Harian + Rp 540.000).
   - Buka halaman detail trip -> pastikan estimasi transport tampil.
   - Buka `/admin/master` -> pastikan label sudah berubah menjadi "Uang Harian".

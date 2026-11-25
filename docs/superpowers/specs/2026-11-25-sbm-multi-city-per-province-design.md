# Design Spec: Multi-City per Province in SBM Master & Trip Autocomplete

## Context & Problem
Saat ini tabel `sbm_rates` hanya memiliki satu kolom teks `ibukota`. Akibatnya, Jawa Barat hanya menyimpan 1 kota ("Bandung"). Ketika pengguna membuat perjalanan ke "Bogor" atau "Bekasi", autocomplete tidak memunculkan pilihan kota tersebut dan estimasi otomatis SBM gagal mendeteksi tarif Jawa Barat (Rp 430.000/hari), padahal aturan PMK menetapkan tarif uang harian berlaku sama untuk seluruh kabupaten/kota dalam satu provinsi.

## Goal
Memungkinkan 1 provinsi di master SBM memiliki beberapa kota/kabupaten (`kota TEXT[]`), sehingga pengguna dapat memilih atau mengetik kota manapun (misal Bogor, Bekasi, Bandung untuk Jawa Barat) dan sistem secara otomatis mengaitkannya ke tarif SBM provinsi tersebut.

---

## 1. Database & Migrations
Buat file migrasi `internal/db/migrations/005_sbm_multi_city.sql`:
1. Tambah kolom `kota TEXT[] NOT NULL DEFAULT '{}'` pada tabel `sbm_rates`.
2. Migrasi data awal:
   ```sql
   UPDATE sbm_rates SET kota = ARRAY[ibukota] WHERE ibukota <> '' AND kota = '{}';
   ```
3. Update daftar kota populer untuk provinsi yang sering dikunjungi:
   - **Jawa Barat:** `ARRAY['Bandung', 'Bogor', 'Bekasi', 'Depok', 'Cirebon', 'Sukabumi', 'Tasikmalaya', 'Karawang', 'Cimahi']`
   - **DKI Jakarta:** `ARRAY['Jakarta', 'Jakarta Pusat', 'Jakarta Selatan', 'Jakarta Barat', 'Jakarta Timur', 'Jakarta Utara', 'Kepulauan Seribu']`
   - **Banten:** `ARRAY['Serang', 'Tangerang', 'Tangerang Selatan', 'Cilegon', 'Pandeglang', 'Lebak']`
   - **Jawa Tengah:** `ARRAY['Semarang', 'Surakarta (Solo)', 'Magelang', 'Purwokerto', 'Salatiga', 'Tegal', 'Pekalongan', 'Kudus']`
   - **DI Yogyakarta:** `ARRAY['Yogyakarta', 'Sleman', 'Bantul', 'Kulon Progo', 'Gunungkidul']`
   - **Jawa Timur:** `ARRAY['Surabaya', 'Malang', 'Banyuwangi', 'Madiun', 'Kediri', 'Batu', 'Jember', 'Sidoarjo']`
   - **Bali:** `ARRAY['Denpasar', 'Badung', 'Gianyar', 'Ubud', 'Buleleng', 'Tabanan']`
   - **Sumatera Utara:** `ARRAY['Medan', 'Binjai', 'Pematangsiantar', 'Deli Serdang', 'Toba']`
   - **Sumatera Barat:** `ARRAY['Padang', 'Bukittinggi', 'Padang Panjang', 'Payakumbuh']`
   - **Riau & Kepri:** `ARRAY['Pekanbaru', 'Dumai']` / `ARRAY['Batam', 'Tanjung Pinang', 'Bintan']`
   - **Sulawesi Selatan:** `ARRAY['Makassar', 'Gowa', 'Maros', 'Parepare', 'Palopo']`
   - Provinsi lainnya tetap memiliki ibukota asalnya di dalam array `kota`.

---

## 2. Backend Go API (`internal/handler/sbm.go`)
1. Struct `SBMRate`:
   ```go
   type SBMRate struct {
       ID          string   `json:"id"`
       Provinsi    string   `json:"provinsi"`
       Ibukota     string   `json:"ibukota"` // dipertahankan untuk backward-compatibility (kota[0])
       Kota        []string `json:"kota"`
       UangHarian  int64    `json:"uang_harian"`
       CreatedAt   string   `json:"created_at"`
       UpdatedAt   string   `json:"updated_at"`
   }
   ```
2. Menggunakan `pq.Array(&r.Kota)` untuk query `SELECT`, `INSERT`, dan `UPDATE`.
3. Handler `ListSBMRates` (`GET /api/sbm`):
   - Jika ada parameter `?q=search`, pencarian mencari kecocokan pada `provinsi ILIKE %q%` ATAU elemen array `EXISTS (SELECT 1 FROM unnest(kota) k WHERE k ILIKE %q%)`.
4. Handler `CreateSBMRate` & `UpdateSBMRate`:
   - Menerima `kota: []string`.
   - Mengisi otomatis `ibukota = kota[0]` jika `ibukota` tidak dikirim secara eksplisit.

---

## 3. Frontend Implementation

### A. Interface `SBMRate` (`web/src/api.ts`)
```ts
export interface SBMRate {
  id: string;
  provinsi: string;
  ibukota: string;
  kota?: string[];
  uang_harian: number;
  created_at: string;
  updated_at: string;
}
```

### B. Autocomplete Tujuan (`web/src/components/CreatableSelect.tsx`)
1. Generate item opsi cerdas:
   - Setiap kota dalam `rate.kota` diekspansi menjadi opsi selectable: `"<Kota>, <Provinsi>"`.
   - Nama provinsi juga tetap menjadi opsi: `"<Provinsi> (Semua Wilayah)"`.
2. Filter:
   - Mengetik "bogor" akan langsung mencocokkan item `"Bogor, Jawa Barat"`.
   - Mengetik "bekasi" akan langsung mencocokkan item `"Bekasi, Jawa Barat"`.
3. Seleksi:
   - Saat memilih `"Bogor, Jawa Barat"`, input terisi `"Bogor, Jawa Barat"` dan mengaitkan objek `rate` Jawa Barat (uang harian Rp 430.000).

### C. Matching & Estimasi SBM di Form (`web/src/pages/TripForm.tsx`)
Fungsi `matchedRate()`:
- Mengecek kecocokan jika teks tujuan mengandung nama provinsi atau salah satu nama kota di `r.kota` (case-insensitive).
- Sehingga input custom seperti "Kunjungan Lapangan Bogor" langsung otomatis mendeteksi tarif SBM Jawa Barat.

### D. Manajemen Master SBM di Admin (`web/src/pages/admin/AdminMaster.tsx`)
1. Form Tambah/Ubah Tarif SBM:
   - Ganti/perluas input "Ibukota" menjadi "Daftar Kota / Kabupaten".
   - Mendukung input teks koma (contoh: `Bandung, Bogor, Bekasi, Depok`) atau penambahan tag/chip.
   - Kolom tabel daftar SBM menampilkan ringkasan kota (misal: "Bandung, Bogor, Bekasi (+3 lainnya)").

---

## 4. Verification & Testing
1. **Unit Test Go**:
   - `internal/handler/sbm_test.go`: uji create/update/list tarif SBM dengan array `kota`.
2. **Database Migration Test**:
   - `internal/db/migrations_test.go`: verifikasi sintaks SQL migrasi 005.
3. **E2E Playwright**:
   - Buka `/trips/new`, ketik "Bogor" di kolom Kota Tujuan.
   - Verifikasi dropdown menampilkan "Bogor, Jawa Barat" dengan badge tarif Rp 430.000.
   - Klik pilih "Bogor, Jawa Barat", isi rentang tanggal, verifikasi estimasi otomatis SBM terhitung tepat.

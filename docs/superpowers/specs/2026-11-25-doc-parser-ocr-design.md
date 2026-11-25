# Design Spec: Naskah Dinas (Surat Tugas & Undangan) Parser & Penyimpanan Dokumen

## 1. Overview
Fitur import data otomatis dari dokumen naskah dinas (Surat Tugas & Surat Undangan PDF) untuk mengisi form perjalanan dinas (`/trips/new`), sekaligus menyimpan file PDF undangan di server agar dapat diunduh/dilihat kembali pada detail perjalanan (`/trips/:id`).

Parser mengekstrak:
1. **Tanggal Mulai & Selesai** (format Indonesia, baik tanggal tunggal maupun rentang tanggal).
2. **Tempat / Lokasi / Kota Tujuan** (dengan auto-matching ke daftar SBM Kota/Provinsi).
3. **Agenda / Nama Perjalanan** (dari `Hal:` pada Undangan atau rincian kegiatan pada Surat Tugas).
4. **Nomor Surat** (disimpan ke catatan/referensi).

Dokumen PDF disimpan di server dengan arsitektur storage yang modular (local disk volume sekarang, siap upgrade ke RustFS / Object Storage nanti).

## 2. Arsitektur & Komponen

### A. Database Migration (`008_add_trip_dokumen.sql`)
Menambahkan kolom ke tabel `trips`:
- `dokumen_url TEXT`: path / identifier file dokumen yang disimpan di server (contoh: `uploads/trips/abc123_undangan.pdf`).
- `dokumen_nama TEXT`: nama asli file PDF saat diupload (contoh: `Undangan Monitoring.pdf`).

### B. Penyimpanan File (Storage Abstraction)
- **Local Storage Driver (Sekarang):**
  - File disimpan di direktori `uploads/trips/`.
  - Penamaan file unik (UUID/timestamp + slug nama file) untuk mencegah tabrakan nama file.
  - Endpoint download/preview: `GET /api/trips/{id}/dokumen` (terproteksi auth & verifikasi kepemilikan/kolaborasi trip).
  - Di `docker-compose.yml`, ditambahkan volume mount:
    ```yaml
    volumes:
      - ./uploads:/app/uploads
    ```
- **RustFS Roadmap (Upgrade Path):**
  - Implementasi interface Go `Storage` (`Save`, `Open`, `Delete`).
  - Saat RustFS / S3 storage siap, cukup ganti driver tanpa mengubah handler atau schema database (`// ponytail: local disk storage; ganti ke rustfs/s3 driver saat service storage siap`).

### C. Backend Parser & Upload Endpoint (`internal/parser/document.go` & `internal/handler/parser.go`)
- **Endpoint:** `POST /api/trips/parse-document`
  - Menerima `multipart/form-data` dengan field `file` (PDF) atau fallback JSON `text`.
  - Melakukan:
    1. Simpan file PDF sementara / ke storage `uploads/trips/`.
    2. Ekstraksi teks menggunakan `pdftotext -layout`.
    3. Parsing aturan naskah dinas Indonesia (deteksi tanggal, kota, agenda, nomor surat).
    4. Mengembalikan hasil parsing beserta `file_url` dan `file_name`.
- **Response Format:**
  ```json
  {
    "doc_type": "surat_tugas",
    "nomor_surat": "629/ST/DBBM/2026",
    "nama": "Koordinasi Implementasi Surat Rekomendasi...",
    "tujuan": "Cimahi, Jawa Barat",
    "lokasi_raw": "Cimahi",
    "tanggal_mulai": "2026-04-08",
    "tanggal_selesai": "2026-04-10",
    "catatan": "Nomor Surat Tugas: 629/ST/DBBM/2026",
    "dokumen_url": "uploads/trips/xyz_692.ST.DBBM.2026.pdf",
    "dokumen_nama": "692.ST.DBBM.2026 Cimahi 8-10 April 26.pdf"
  }
  ```

### D. Frontend (`web/src/pages/TripForm.tsx` & `TripDetail.tsx`)
- **TripForm (`/trips/new` & edit):**
  - Dropzone / tombol upload dokumen naskah dinas (PDF).
  - Setelah parse berhasil, auto-fill `Nama`, `Tujuan` (memicu kalkulator Uang Harian), `Tanggal Mulai`, `Tanggal Selesai`, `Catatan`, serta menyertakan `dokumen_url` & `dokumen_nama` pada payload simpan trip.
  - Tampilkan badge dokumen terlampir dengan opsi ganti atau hapus.
- **TripDetail (`/trips/:id`):**
  - Tampilkan kartu / badge lampiran naskah dinas:
    `📄 Undangan / Surat Tugas: <nama_file> [Buka / Unduh PDF]`
  - Tombol membuka file PDF via `GET /api/trips/{id}/dokumen`.

### E. Dockerfile & Dependensi
- Tambah `poppler-utils` di Stage 3 Alpine (`RUN apk add --no-cache ca-certificates poppler-utils`).
- Buat direktori `/app/uploads` di image runtime.


## 3. Rencana Pengujian
1. Unit test parser Go (`internal/parser/document_test.go`) menguji teks Surat Tugas dan Surat Undangan dengan variasi format tanggal.
2. HTTP test endpoint `POST /api/trips/parse-document` dengan payload PDF multipart.
3. Playwright browser test untuk flow upload PDF di `/trips/new` hingga form terisi dan disimpan.

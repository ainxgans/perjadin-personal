# Naskah Dinas Parser & Document Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement automated parsing of official Indonesian government travel documents (Surat Tugas & Surat Undangan PDFs) to autofill trip forms, and persist uploaded PDFs to server storage with a clean driver abstraction ready for future RustFS integration.

**Architecture:** A lightweight pure-Go parser engine analyzes extracted layout text from `pdftotext` to detect document types, dates (single or range), locations (matched against SBM rates), agendas, and letter numbers. A storage abstraction (`Storage` interface with `LocalStorage` driver) saves documents under `uploads/trips/`, exposed via an authenticated download route. Frontend SolidJS integrates a PDF dropzone on `TripForm` and a document viewer chip on `TripDetail`.

**Tech Stack:** Go 1.22+, PostgreSQL, poppler-utils (`pdftotext`), SolidJS, Vite, TypeScript.

**Spec:** `docs/superpowers/specs/2026-11-25-doc-parser-ocr-design.md`

## Global Constraints

- Indonesian date parser must support standard month names (`Januari` - `Desember`) and date formats (`D MMMM YYYY`, `D - D MMMM YYYY`, `D s.d D MMMM YYYY`, `D MMMM YYYY - D MMMM YYYY`).
- Document storage must use an interface abstraction (`Storage`) to allow zero-schema changes when switching to RustFS or S3.
- Database migration must be backwards compatible; `dokumen_url` and `dokumen_nama` are nullable `TEXT`.
- All routes serving documents or parsing files must enforce authentication via existing JWT middleware.
- Docker runtime must include `poppler-utils` and map the `./uploads` volume.

## Review Focus

- Corrupted or non-PDF file upload returns HTTP 400 with a clean user-facing error message instead of 500.
- Single day invitations set both `tanggal_mulai` and `tanggal_selesai` to the same date.
- Unknown destinations fallback cleanly to raw extracted string without crashing SBM lookup.
- Unauthorized users or users without access to a trip cannot download another user's document via `GET /api/trips/{id}/dokumen`.
- Editing an existing trip preserves or replaces `dokumen_url` / `dokumen_nama` correctly without deleting file or database record unexpectedly.

---

### Task 1: Database Migration 008_add_trip_dokumen.sql

**Files:**
- Create: `internal/db/migrations/008_add_trip_dokumen.sql`
- Modify: `internal/db/migrations_test.go`

**Interfaces:**
- Produces: `trips.dokumen_url TEXT`, `trips.dokumen_nama TEXT`

- [ ] **Step 1: Write migration SQL file**

```sql
ALTER TABLE trips ADD COLUMN IF NOT EXISTS dokumen_url TEXT;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS dokumen_nama TEXT;
```

- [ ] **Step 2: Update migrations test in `internal/db/migrations_test.go`**

Verify `008_add_trip_dokumen.sql` syntax and existence in migration runner tests.

- [ ] **Step 3: Run migration tests against test DB**

Run: `TEST_DATABASE_URL="postgres:///perjadin_test?host=/run/postgresql&port=5433&sslmode=disable" go test ./internal/db/... -v`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add internal/db/migrations/008_add_trip_dokumen.sql internal/db/migrations_test.go
git commit -m "feat(db): add dokumen_url and dokumen_nama columns to trips table"
```

---

### Task 2: Storage Service Abstraction & LocalStorage Driver

**Files:**
- Create: `internal/storage/storage.go`
- Create: `internal/storage/storage_test.go`

**Interfaces:**
- Produces:
  ```go
  type Storage interface {
      Save(ctx context.Context, subfolder string, filename string, r io.Reader) (storedPath string, err error)
      Open(ctx context.Context, storedPath string) (io.ReadCloser, error)
  }
  func NewLocalStorage(baseDir string) *LocalStorage
  ```

- [ ] **Step 1: Write failing unit test in `internal/storage/storage_test.go`**

Test saving a file with `LocalStorage`, reading it back, and verifying content and path safety (prevent directory traversal).

- [ ] **Step 2: Run test to verify it fails**

Run: `go test ./internal/storage/... -v`
Expected: FAIL (package/types not found)

- [ ] **Step 3: Implement `Storage` interface and `LocalStorage` in `internal/storage/storage.go`**

Save files with unique timestamp/hash prefix in `baseDir/subfolder/`, return relative storedPath, sanitize filenames, and add ponytail comment: `// ponytail: local disk storage; swap to rustfs/s3 driver when ready`.

- [ ] **Step 4: Run test to verify it passes**

Run: `go test ./internal/storage/... -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add internal/storage/
git commit -m "feat(storage): create storage abstraction with LocalStorage driver"
```

---

### Task 3: Document Parser Engine (Surat Tugas & Undangan)

**Files:**
- Create: `internal/parser/document.go`
- Create: `internal/parser/document_test.go`

**Interfaces:**
- Consumes: Raw text from PDF or direct string
- Produces:
  ```go
  type ParseResult struct {
      DocType        string `json:"doc_type"`
      NomorSurat     string `json:"nomor_surat"`
      Nama           string `json:"nama"`
      Tujuan         string `json:"tujuan"`
      LokasiRaw      string `json:"lokasi_raw"`
      TanggalMulai   string `json:"tanggal_mulai"`
      TanggalSelesai string `json:"tanggal_selesai"`
      Catatan        string `json:"catatan"`
      DokumenURL     string `json:"dokumen_url,omitempty"`
      DokumenNama    string `json:"dokumen_nama,omitempty"`
  }
  func ParseNaskahDinas(text string, knownLocations []string) ParseResult
  func ExtractTextFromPDF(pdfPath string) (string, error)
  ```

- [ ] **Step 1: Write unit tests with real Surat Tugas & Undangan fixtures in `internal/parser/document_test.go`**

Test:
- `TestParseSuratTugas`: Verifies date range (`8-10 April 2026`), location (`Cimahi` -> matched to `Cimahi, Jawa Barat`), agenda, and letter number (`629/ST/DBBM/2026`).
- `TestParseSuratUndangan`: Verifies single date (`27 Februari 2026`), location (`Aula Gedung BPH Migas`), hal/agenda, and letter number.
- `TestParseDateFormats`: Table-driven tests for various Indonesian date string patterns.

- [ ] **Step 2: Run test to verify it fails**

Run: `go test ./internal/parser/... -v`
Expected: FAIL

- [ ] **Step 3: Implement parser logic in `internal/parser/document.go`**

Use regex rules for Indonesian date strings, `Nomor:`, `Tempat:`, `Hal:`, and task points. Implement `ExtractTextFromPDF` calling `pdftotext -layout`.

- [ ] **Step 4: Run test to verify it passes**

Run: `go test ./internal/parser/... -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add internal/parser/
git commit -m "feat(parser): implement Indonesian naskah dinas text extraction and parsing"
```

---

### Task 4: Backend Handlers & Trip CRUD Integration

**Files:**
- Modify: `internal/model/models.go` (add `DokumenURL`, `DokumenNama` to `Trip`)
- Modify: `internal/handler/trip.go` (include columns in `tripSelectCols`, `tripInsertCols`, `CreateTrip`, `UpdateTrip`)
- Create: `internal/handler/parser.go` (`ParseDocumentHandler` and `ServeTripDokumenHandler`)
- Modify: `cmd/server/main.go` (register routes and initialize storage)
- Modify: `internal/handler/trip_test.go`

**Interfaces:**
- `POST /api/trips/parse-document`: accepts multipart form with `file` (or JSON `text`), saves document, parses text, returns `ParseResult`.
- `GET /api/trips/{id}/dokumen`: streams the saved PDF document with proper `Content-Type: application/pdf` and `Content-Disposition: inline`.

- [ ] **Step 1: Write tests in `internal/handler/trip_test.go`**

Test:
- `TestParseDocument_PDF`: Upload mock PDF, assert returned parsed fields & `dokumen_url`.
- `TestTrip_WithDokumen`: Create and retrieve trip with `dokumen_url` and `dokumen_nama`.
- `TestServeTripDokumen`: Verify authenticated access allows streaming document, unauthenticated/forbidden fails.

- [ ] **Step 2: Update model and trip queries**

Add `DokumenURL *string` and `DokumenNama *string` to `model.Trip`, update SQL statements and scans in `internal/handler/trip.go`.

- [ ] **Step 3: Implement `ParseDocumentHandler` and `ServeTripDokumenHandler` in `internal/handler/parser.go`**

Integrate storage saving, `ExtractTextFromPDF`, and `ParseNaskahDinas`. Pass list of known SBM cities for auto-match.

- [ ] **Step 4: Register routes in `cmd/server/main.go`**

- `r.HandleFunc("POST /api/trips/parse-document", ...)`
- `r.HandleFunc("GET /api/trips/{id}/dokumen", ...)`

- [ ] **Step 5: Run tests and verify**

Run: `TEST_DATABASE_URL="postgres:///perjadin_test?host=/run/postgresql&port=5433&sslmode=disable" go test ./... -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add internal/model/ internal/handler/ cmd/server/
git commit -m "feat(api): add parse-document and serve-dokumen endpoints with Trip CRUD support"
```

---

### Task 5: Frontend Integration (TripForm & TripDetail)

**Files:**
- Modify: `web/src/api.ts` (add `dokumen_url`, `dokumen_nama` to `Trip`, add `parseDocument` API)
- Modify: `web/src/pages/TripForm.tsx` (add upload dropzone, parse loading state, auto-fill signals, document badge)
- Modify: `web/src/pages/TripDetail.tsx` (add document preview / download action card)

- [ ] **Step 1: Update `web/src/api.ts`**

Add `dokumen_url?: string | null; dokumen_nama?: string | null;` to `Trip`.
Add `parseDocument(file: File): Promise<ParseDocumentResult>`.

- [ ] **Step 2: Update `web/src/pages/TripForm.tsx`**

- Add dropzone/button: `"Import dari Surat Tugas / Undangan (PDF)"`.
- On file select: call `api.parseDocument(file)`.
- On success: set `nama`, `tujuan`, `mulai`, `selesai`, `catatan`, and keep `dokumenUrl` & `dokumenNama` in state.
- Show badge of attached document with option to replace or remove.

- [ ] **Step 3: Update `web/src/pages/TripDetail.tsx`**

- If `trip.dokumen_url` is present, display attachment chip/button: `"📄 Surat Tugas / Undangan: {dokumen_nama}"` linking to `/api/trips/{id}/dokumen`.

- [ ] **Step 4: Build frontend and verify no type or bundle errors**

Run: `cd web && npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add web/src/
git commit -m "feat(web): add PDF import in TripForm and document viewer in TripDetail"
```

---

### Task 6: Docker Deployment Configuration & End-to-End Verification

**Files:**
- Modify: `Dockerfile` (install `poppler-utils`, create `/app/uploads`)
- Modify: `docker-compose.yml` (mount `./uploads:/app/uploads`)

- [ ] **Step 1: Update `Dockerfile` and `docker-compose.yml`**

Ensure `poppler-utils` is installed in Stage 3 runtime and volume `./uploads:/app/uploads` is mapped.

- [ ] **Step 2: Full Go test suite execution**

Run: `TEST_DATABASE_URL="postgres:///perjadin_test?host=/run/postgresql&port=5433&sslmode=disable" go test ./... -count=1`
Expected: ALL PASS.

- [ ] **Step 3: Run Playwright E2E verification**

Start local dev server and test:
1. Navigate to `/trips/new`.
2. Upload test PDF (`692.ST.DBBM.2026 Cimahi 8-10 April 26.pdf`).
3. Verify form auto-populates `Nama`, `Tujuan` (`Cimahi, Jawa Barat`), `Tanggal Mulai`, `Tanggal Selesai`, and kalkulator SBM activates.
4. Save trip and verify on `/trips/:id` that the document link appears and opens the PDF.

- [ ] **Step 4: Commit and push**

```bash
git add Dockerfile docker-compose.yml
git commit -m "feat(docker): configure poppler-utils and uploads volume"
git push origin main
```

package handler

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/lib/pq"
	"github.com/maulana/perjadin-personal/internal/auth"
	"github.com/maulana/perjadin-personal/internal/parser"
	"github.com/maulana/perjadin-personal/internal/storage"
)

func getKnownLocations(db *sql.DB) []string {
	rows, err := db.Query("SELECT provinsi, ibukota, kota FROM sbm_rates")
	if err != nil {
		return nil
	}
	defer rows.Close()

	var locs []string
	for rows.Next() {
		var prov, ibukota string
		var kota pq.StringArray
		if err := rows.Scan(&prov, &ibukota, &kota); err == nil {
			locs = append(locs, prov)
			if ibukota != "" && ibukota != prov {
				locs = append(locs, fmt.Sprintf("%s, %s", ibukota, prov))
			}
			for _, k := range kota {
				if k != "" && k != ibukota && k != prov {
					locs = append(locs, fmt.Sprintf("%s, %s", k, prov))
				}
			}
		}
	}
	return locs
}

func ParseDocumentHandler(db *sql.DB, st storage.Storage) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		contentType := r.Header.Get("Content-Type")

		knownLocs := getKnownLocations(db)

		// Case 1: JSON with text
		if strings.HasPrefix(contentType, "application/json") {
			var body struct {
				Text string `json:"text"`
			}
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil || strings.TrimSpace(body.Text) == "" {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "field text required"})
				return
			}
			res := parser.ParseNaskahDinas(body.Text, knownLocs)
			writeJSON(w, http.StatusOK, map[string]interface{}{"data": res})
			return
		}

		// Case 2: Multipart form file upload (PDF)
		if strings.HasPrefix(contentType, "multipart/form-data") {
			if err := r.ParseMultipartForm(20 << 20); err != nil { // 20 MB max
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "gagal membaca file upload"})
				return
			}
			file, header, err := r.FormFile("file")
			if err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "file upload tidak ditemukan"})
				return
			}
			defer file.Close()

			if !strings.HasSuffix(strings.ToLower(header.Filename), ".pdf") {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "hanya file PDF yang didukung"})
				return
			}

			// Save to storage
			storedPath, err := st.Save(r.Context(), "trips", header.Filename, file)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": fmt.Sprintf("gagal menyimpan file: %v", err)})
				return
			}

			// Open stored file to extract text
			rc, err := st.Open(r.Context(), storedPath)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": fmt.Sprintf("gagal membuka file tersimpan: %v", err)})
				return
			}
			defer rc.Close()

			// Create a temporary file for pdftotext
			tmpFile, err := os.CreateTemp("", "doc_parse_*.pdf")
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "gagal memproses file"})
				return
			}
			defer os.Remove(tmpFile.Name())
			defer tmpFile.Close()

			if _, err := io.Copy(tmpFile, rc); err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "gagal memproses file"})
				return
			}
			_ = tmpFile.Close()

			extractedText, err := parser.ExtractTextFromPDF(tmpFile.Name())
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": fmt.Sprintf("gagal mengekstrak teks PDF: %v", err)})
				return
			}

			res := parser.ParseNaskahDinas(extractedText, knownLocs)
			res.DokumenURL = storedPath
			res.DokumenNama = header.Filename

			writeJSON(w, http.StatusOK, map[string]interface{}{"data": res})
			return
		}

		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "content-type must be multipart/form-data or application/json"})
	}
}

func ServeTripDokumenHandler(db *sql.DB, st storage.Storage) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := auth.UserIDFromContext(r.Context())
		role := auth.RoleFromContext(r.Context())
		tripID := r.PathValue("id")

		var dokumenURL, dokumenNama *string
		var tripOwnerID string

		err := db.QueryRow(`
			SELECT t.dokumen_url, t.dokumen_nama, t.user_id
			FROM trips t
			WHERE t.id = $1 AND (
				t.user_id = $2 OR EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = t.workspace_id AND wm.user_id = $2) OR $3 = 'admin'
			)
		`, tripID, userID, role).Scan(&dokumenURL, &dokumenNama, &tripOwnerID)

		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "trip atau dokumen tidak ditemukan"})
			return
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		if dokumenURL == nil || *dokumenURL == "" {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "trip ini tidak memiliki lampiran dokumen"})
			return
		}

		rc, err := st.Open(r.Context(), *dokumenURL)
		if err != nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "file dokumen tidak ditemukan pada penyimpanan"})
			return
		}
		defer rc.Close()

		filename := "dokumen.pdf"
		if dokumenNama != nil && *dokumenNama != "" {
			filename = filepath.Base(*dokumenNama)
		}

		w.Header().Set("Content-Type", "application/pdf")
		w.Header().Set("Content-Disposition", fmt.Sprintf("inline; filename=%q", filename))
		_, _ = io.Copy(w, rc)
	}
}

package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"time"

	"github.com/maulana/perjadin-personal/internal/auth"
	"github.com/maulana/perjadin-personal/internal/model"
)

type tripResponse struct {
	ID                 string    `json:"id"`
	WorkspaceID        string    `json:"workspace_id"`
	Nama               string    `json:"nama"`
	Tujuan             string    `json:"tujuan"`
	TanggalMulai       string    `json:"tanggal_mulai"`
	TanggalSelesai     string    `json:"tanggal_selesai"`
	Status             string    `json:"status"`
	UangDinas          *int64    `json:"uang_dinas"`
	NominalMonita      *int64    `json:"nominal_monita"`
	EstimasiTransport  *int64    `json:"estimasi_transport,omitempty"`
	DokumenURL         *string   `json:"dokumen_url,omitempty"`
	DokumenNama        *string   `json:"dokumen_nama,omitempty"`
	TanggalDibayar     *string   `json:"tanggal_dibayar"`
	Catatan            string    `json:"catatan"`
	LinkMonita         string    `json:"link_monita"`
	SettlementNote     string    `json:"settlement_note"`
	TotalPengeluaran   int64     `json:"total_pengeluaran"`
	PengeluaranPribadi int64     `json:"pengeluaran_pribadi"`
	TalanganKoperasi   int64     `json:"talangan_koperasi"`
	TalanganCount      int       `json:"talangan_count"`
	Saldo              int64     `json:"saldo"`
	IsOwner            bool      `json:"is_owner"`
	OwnerName          string    `json:"owner_name"`
	CollaboratorsCount int       `json:"collaborators_count"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
}

func tripToResponse(t model.Trip, totalExpense, pengeluaranPribadi, talanganKoperasi int64, isOwner bool, ownerName string, collabsCount int) tripResponse {
	var dibayarStr *string
	if t.TanggalDibayar != nil {
		s := t.TanggalDibayar.Format("2006-01-02")
		dibayarStr = &s
	}
	var uangDinas int64
	if t.UangDinas != nil {
		uangDinas = *t.UangDinas
	}
	return tripResponse{
		ID:                 t.ID,
		WorkspaceID:        t.WorkspaceID,
		Nama:               t.Nama,
		Tujuan:             t.Tujuan,
		TanggalMulai:       t.TanggalMulai.Format("2006-01-02"),
		TanggalSelesai:     t.TanggalSelesai.Format("2006-01-02"),
		Status:             t.Status,
		UangDinas:          t.UangDinas,
		NominalMonita:      t.NominalMonita,
		EstimasiTransport:  t.EstimasiTransport,
		DokumenURL:         t.DokumenURL,
		DokumenNama:        t.DokumenNama,
		TanggalDibayar:     dibayarStr,
		Catatan:            t.Catatan,
		LinkMonita:         t.LinkMonita,
		SettlementNote:     t.SettlementNote,
		TotalPengeluaran:   totalExpense,
		PengeluaranPribadi: pengeluaranPribadi,
		TalanganKoperasi:   talanganKoperasi,
		// Uang dinas yang masuk rekening sudah bersih (sudah dipotong biaya koperasi),
		// sehingga saldo sisa hanya dikurangi pengeluaran pribadi/non-koperasi.
		Saldo:              uangDinas - pengeluaranPribadi,
		IsOwner:            isOwner,
		OwnerName:          ownerName,
		CollaboratorsCount: collabsCount,
		CreatedAt:          t.CreatedAt,
		UpdatedAt:          t.UpdatedAt,
	}
}

const tripSelectCols = `t.id, t.workspace_id, t.nama, t.tujuan, t.tanggal_mulai, t.tanggal_selesai,
	COALESCE(t.status, 'berlangsung'), t.uang_dinas, t.nominal_monita, t.tanggal_dibayar,
	COALESCE(t.catatan, ''), COALESCE(t.link_monita, ''), COALESCE(t.settlement_note, ''),
	t.estimasi_transport, t.dokumen_url, t.dokumen_nama, t.created_at, t.updated_at`

const tripInsertCols = `id, workspace_id, nama, tujuan, tanggal_mulai, tanggal_selesai,
	COALESCE(status, 'berlangsung'), uang_dinas, nominal_monita, tanggal_dibayar,
	COALESCE(catatan, ''), COALESCE(link_monita, ''), COALESCE(settlement_note, ''),
	estimasi_transport, dokumen_url, dokumen_nama, created_at, updated_at`

func canAccessTrip(db *sql.DB, tripID, userID, role string) (canAccess bool, isOwner bool, err error) {
	if db == nil {
		return false, false, sql.ErrConnDone
	}
	var tripOwnerID, wsID string
	err = db.QueryRow("SELECT user_id, workspace_id FROM trips WHERE id = $1", tripID).Scan(&tripOwnerID, &wsID)
	if err == sql.ErrNoRows {
		return false, false, nil
	}
	if err != nil {
		return false, false, err
	}

	if role == "admin" || tripOwnerID == userID {
		return true, true, nil
	}

	var isMember bool
	err = db.QueryRow("SELECT EXISTS(SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2)", wsID, userID).Scan(&isMember)
	if err != nil {
		return false, false, err
	}

	var wsRole string
	_ = db.QueryRow("SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2", wsID, userID).Scan(&wsRole)
	isWsOwner := (wsRole == "owner")

	return isMember, isWsOwner, nil
}

func ListTrips(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := auth.UserIDFromContext(r.Context())

		wsID, err := ResolveWorkspaceID(r, db, userID)
		if err != nil {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": err.Error()})
			return
		}

		rows, err := db.Query(`
			SELECT `+tripSelectCols+`,
				COALESCE(SUM(e.jumlah), 0) as total_expense,
				COALESCE(SUM(CASE WHEN LOWER(COALESCE(pm.nama, '')) NOT LIKE '%koperasi%' THEN e.jumlah ELSE 0 END), 0) as pengeluaran_pribadi,
				COALESCE(SUM(CASE WHEN LOWER(COALESCE(pm.nama, '')) LIKE '%koperasi%' THEN e.jumlah ELSE 0 END), 0) as talangan_koperasi,
				COALESCE(SUM(CASE WHEN LOWER(COALESCE(pm.nama, '')) LIKE '%talangan%' THEN 1 ELSE 0 END), 0) as talangan_count,
				(t.user_id = $2) as is_owner,
				u.name as owner_name,
				0 as collabs_count
			FROM trips t
			JOIN users u ON t.user_id = u.id
			LEFT JOIN expenses e ON e.trip_id = t.id
			LEFT JOIN payment_methods pm ON e.payment_method_id = pm.id
			WHERE t.workspace_id = $1
			GROUP BY t.id, u.name
			ORDER BY t.tanggal_mulai DESC
		`, wsID, userID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		defer rows.Close()

		var trips []tripResponse
		for rows.Next() {
			var t model.Trip
			var totalExpense, pengeluaranPribadi, talanganKoperasi int64
			var talanganCount int
			var isOwner bool
			var ownerName string
			var collabsCount int

			if err := rows.Scan(
				&t.ID, &t.WorkspaceID, &t.Nama, &t.Tujuan, &t.TanggalMulai, &t.TanggalSelesai,
				&t.Status, &t.UangDinas, &t.NominalMonita, &t.TanggalDibayar,
				&t.Catatan, &t.LinkMonita, &t.SettlementNote,
				&t.EstimasiTransport, &t.DokumenURL, &t.DokumenNama, &t.CreatedAt, &t.UpdatedAt,
				&totalExpense, &pengeluaranPribadi, &talanganKoperasi, &talanganCount, &isOwner, &ownerName, &collabsCount,
			); err != nil {
				continue
			}
			resp := tripToResponse(t, totalExpense, pengeluaranPribadi, talanganKoperasi, isOwner, ownerName, collabsCount)
			resp.TalanganCount = talanganCount
			trips = append(trips, resp)
		}
		if trips == nil {
			trips = []tripResponse{}
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"data": trips})
	}
}

func CreateTrip(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := auth.UserIDFromContext(r.Context())

		wsID, err := ResolveWorkspaceID(r, db, userID)
		if err != nil {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": err.Error()})
			return
		}

		var input struct {
			Nama              string  `json:"nama"`
			Tujuan            string  `json:"tujuan"`
			TanggalMulai      string  `json:"tanggal_mulai"`
			TanggalSelesai    string  `json:"tanggal_selesai"`
			UangDinas         *int64  `json:"uang_dinas"`
			NominalMonita     *int64  `json:"nominal_monita"`
			EstimasiTransport *int64  `json:"estimasi_transport"`
			DokumenURL        *string `json:"dokumen_url"`
			DokumenNama       *string `json:"dokumen_nama"`
			TanggalDibayar    *string `json:"tanggal_dibayar"`
			Catatan           string  `json:"catatan"`
			LinkMonita        string  `json:"link_monita"`
		}
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
			return
		}
		if input.Nama == "" || input.Tujuan == "" || input.TanggalMulai == "" || input.TanggalSelesai == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "nama, tujuan, tanggal_mulai, tanggal_selesai required"})
			return
		}

		mulai, err1 := time.Parse("2006-01-02", input.TanggalMulai)
		selesai, err2 := time.Parse("2006-01-02", input.TanggalSelesai)
		if err1 != nil || err2 != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid date format, use YYYY-MM-DD"})
			return
		}
		if selesai.Before(mulai) {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "tanggal_selesai must be >= tanggal_mulai"})
			return
		}

		var dibayar *time.Time
		if input.TanggalDibayar != nil {
			t, err := time.Parse("2006-01-02", *input.TanggalDibayar)
			if err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid tanggal_dibayar format"})
				return
			}
			dibayar = &t
		}

		var trip model.Trip
		err = db.QueryRow(`
			INSERT INTO trips (workspace_id, user_id, nama, tujuan, tanggal_mulai, tanggal_selesai, status, uang_dinas, nominal_monita, tanggal_dibayar, catatan, link_monita, estimasi_transport, dokumen_url, dokumen_nama)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
			RETURNING `+tripInsertCols+`
		`, wsID, userID, input.Nama, input.Tujuan, mulai, selesai, model.StatusBerlangsung,
			input.UangDinas, input.NominalMonita, dibayar, input.Catatan, input.LinkMonita, input.EstimasiTransport, input.DokumenURL, input.DokumenNama).
			Scan(&trip.ID, &trip.WorkspaceID, &trip.Nama, &trip.Tujuan, &trip.TanggalMulai, &trip.TanggalSelesai,
				&trip.Status, &trip.UangDinas, &trip.NominalMonita, &trip.TanggalDibayar,
				&trip.Catatan, &trip.LinkMonita, &trip.SettlementNote,
				&trip.EstimasiTransport, &trip.DokumenURL, &trip.DokumenNama, &trip.CreatedAt, &trip.UpdatedAt)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		var ownerName string
		db.QueryRow("SELECT name FROM users WHERE id = $1", userID).Scan(&ownerName)
		writeJSON(w, http.StatusCreated, map[string]interface{}{"data": tripToResponse(trip, 0, 0, 0, true, ownerName, 0)})
	}
}

func GetTrip(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := auth.UserIDFromContext(r.Context())
		role := auth.RoleFromContext(r.Context())
		id := r.PathValue("id")

		canAccess, isOwner, err := canAccessTrip(db, id, userID, role)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if !canAccess {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
			return
		}

		var trip model.Trip
		var totalExpense, pengeluaranPribadi, talanganKoperasi int64
		var tripOwnerID string
		var ownerName string

		err = db.QueryRow(`
			SELECT `+tripSelectCols+`,
				COALESCE(SUM(e.jumlah), 0),
				COALESCE(SUM(CASE WHEN LOWER(COALESCE(pm.nama, '')) NOT LIKE '%koperasi%' THEN e.jumlah ELSE 0 END), 0),
				COALESCE(SUM(CASE WHEN LOWER(COALESCE(pm.nama, '')) LIKE '%koperasi%' THEN e.jumlah ELSE 0 END), 0),
				t.user_id,
				u.name as owner_name
			FROM trips t
			JOIN users u ON t.user_id = u.id
			LEFT JOIN expenses e ON e.trip_id = t.id
			LEFT JOIN payment_methods pm ON e.payment_method_id = pm.id
			WHERE t.id = $1
			GROUP BY t.id, u.name
		`, id).Scan(
			&trip.ID, &trip.WorkspaceID, &trip.Nama, &trip.Tujuan, &trip.TanggalMulai, &trip.TanggalSelesai,
			&trip.Status, &trip.UangDinas, &trip.NominalMonita, &trip.TanggalDibayar,
			&trip.Catatan, &trip.LinkMonita, &trip.SettlementNote,
			&trip.EstimasiTransport, &trip.DokumenURL, &trip.DokumenNama, &trip.CreatedAt, &trip.UpdatedAt,
			&totalExpense, &pengeluaranPribadi, &talanganKoperasi,
			&tripOwnerID, &ownerName)

		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		writeJSON(w, http.StatusOK, map[string]interface{}{"data": tripToResponse(trip, totalExpense, pengeluaranPribadi, talanganKoperasi, isOwner, ownerName, 0)})
	}
}

func UpdateTrip(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := auth.UserIDFromContext(r.Context())
		role := auth.RoleFromContext(r.Context())
		id := r.PathValue("id")

		canAccess, isOwner, err := canAccessTrip(db, id, userID, role)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if !canAccess {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
			return
		}

		var input struct {
			Nama              *string `json:"nama"`
			Tujuan            *string `json:"tujuan"`
			TanggalMulai      *string `json:"tanggal_mulai"`
			TanggalSelesai    *string `json:"tanggal_selesai"`
			Status            *string `json:"status"`
			UangDinas         *int64  `json:"uang_dinas"`
			NominalMonita     *int64  `json:"nominal_monita"`
			EstimasiTransport *int64  `json:"estimasi_transport"`
			TanggalDibayar    *string `json:"tanggal_dibayar"`
			Catatan           *string `json:"catatan"`
			LinkMonita        *string `json:"link_monita"`
			SettlementNote    *string `json:"settlement_note"`
			DokumenURL        *string `json:"dokumen_url"`
			DokumenNama       *string `json:"dokumen_nama"`
		}
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
			return
		}

		var trip model.Trip
		var tripOwnerID string
		err = db.QueryRow(`SELECT `+tripSelectCols+`, t.user_id
			FROM trips t WHERE t.id = $1`, id).
			Scan(&trip.ID, &trip.WorkspaceID, &trip.Nama, &trip.Tujuan, &trip.TanggalMulai, &trip.TanggalSelesai,
				&trip.Status, &trip.UangDinas, &trip.NominalMonita, &trip.TanggalDibayar,
				&trip.Catatan, &trip.LinkMonita, &trip.SettlementNote,
				&trip.EstimasiTransport, &trip.DokumenURL, &trip.DokumenNama, &trip.CreatedAt, &trip.UpdatedAt, &tripOwnerID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		if input.Nama != nil {
			trip.Nama = *input.Nama
		}
		if input.Tujuan != nil {
			trip.Tujuan = *input.Tujuan
		}
		if input.TanggalMulai != nil {
			t, err := time.Parse("2006-01-02", *input.TanggalMulai)
			if err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid tanggal_mulai"})
				return
			}
			trip.TanggalMulai = t
		}
		if input.TanggalSelesai != nil {
			t, err := time.Parse("2006-01-02", *input.TanggalSelesai)
			if err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid tanggal_selesai"})
				return
			}
			trip.TanggalSelesai = t
		}
		if trip.TanggalSelesai.Before(trip.TanggalMulai) {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "tanggal_selesai must be >= tanggal_mulai"})
			return
		}
		if input.Status != nil {
			if !model.ValidStatuses[*input.Status] {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid status, use: berlangsung, selesai, diajukan, lunas"})
				return
			}
			trip.Status = *input.Status
		}
		if input.UangDinas != nil {
			trip.UangDinas = input.UangDinas
		}
		if input.NominalMonita != nil {
			trip.NominalMonita = input.NominalMonita
		}
		if input.EstimasiTransport != nil {
			trip.EstimasiTransport = input.EstimasiTransport
		}
		if input.TanggalDibayar != nil {
			t, err := time.Parse("2006-01-02", *input.TanggalDibayar)
			if err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid tanggal_dibayar"})
				return
			}
			trip.TanggalDibayar = &t
		}
		if input.Catatan != nil {
			trip.Catatan = *input.Catatan
		}
		if input.LinkMonita != nil {
			trip.LinkMonita = *input.LinkMonita
		}
		if input.SettlementNote != nil {
			trip.SettlementNote = *input.SettlementNote
		}
		if input.DokumenURL != nil {
			trip.DokumenURL = input.DokumenURL
		}
		if input.DokumenNama != nil {
			trip.DokumenNama = input.DokumenNama
		}

		_, err = db.Exec(`
			UPDATE trips SET nama=$1, tujuan=$2, tanggal_mulai=$3, tanggal_selesai=$4,
				status=$5, uang_dinas=$6, nominal_monita=$7, tanggal_dibayar=$8,
				catatan=$9, link_monita=$10, settlement_note=$11, estimasi_transport=$12,
				dokumen_url=$13, dokumen_nama=$14, updated_at=now()
			WHERE id=$15
		`, trip.Nama, trip.Tujuan, trip.TanggalMulai, trip.TanggalSelesai,
			trip.Status, trip.UangDinas, trip.NominalMonita, trip.TanggalDibayar,
			trip.Catatan, trip.LinkMonita, trip.SettlementNote, trip.EstimasiTransport,
			trip.DokumenURL, trip.DokumenNama, id)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		// Re-fetch with totals
		var totalExpense, pengeluaranPribadi, talanganKoperasi int64
		var ownerName string
		db.QueryRow(`
			SELECT COALESCE(SUM(e.jumlah), 0),
				COALESCE(SUM(CASE WHEN LOWER(COALESCE(pm.nama, '')) NOT LIKE '%koperasi%' THEN e.jumlah ELSE 0 END), 0),
				COALESCE(SUM(CASE WHEN LOWER(COALESCE(pm.nama, '')) LIKE '%koperasi%' THEN e.jumlah ELSE 0 END), 0)
			FROM expenses e
			LEFT JOIN payment_methods pm ON e.payment_method_id = pm.id
			WHERE e.trip_id = $1
		`, id).Scan(&totalExpense, &pengeluaranPribadi, &talanganKoperasi)
		db.QueryRow("SELECT updated_at FROM trips WHERE id = $1", id).Scan(&trip.UpdatedAt)
		db.QueryRow("SELECT name FROM users WHERE id = $1", tripOwnerID).Scan(&ownerName)

		writeJSON(w, http.StatusOK, map[string]interface{}{"data": tripToResponse(trip, totalExpense, pengeluaranPribadi, talanganKoperasi, isOwner, ownerName, 0)})
	}
}

func DeleteTrip(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := auth.UserIDFromContext(r.Context())
		role := auth.RoleFromContext(r.Context())
		id := r.PathValue("id")

		canAccess, isOwner, err := canAccessTrip(db, id, userID, role)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if !canAccess || (!isOwner && role != "admin") {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found or unauthorized"})
			return
		}

		result, err := db.Exec("DELETE FROM trips WHERE id = $1", id)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		rows, _ := result.RowsAffected()
		if rows == 0 {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

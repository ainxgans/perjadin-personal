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
	Nama               string    `json:"nama"`
	Tujuan             string    `json:"tujuan"`
	TanggalMulai       string    `json:"tanggal_mulai"`
	TanggalSelesai     string    `json:"tanggal_selesai"`
	Status             string    `json:"status"`
	UangDinas          *int64    `json:"uang_dinas"`
	NominalMonita      *int64    `json:"nominal_monita"`
	TanggalDibayar     *string   `json:"tanggal_dibayar"`
	Catatan            string    `json:"catatan"`
	LinkMonita         string    `json:"link_monita"`
	SettlementNote     string    `json:"settlement_note"`
	TotalPengeluaran   int64     `json:"total_pengeluaran"`
	Saldo              int64     `json:"saldo"`
	IsOwner            bool      `json:"is_owner"`
	OwnerName          string    `json:"owner_name"`
	CollaboratorsCount int       `json:"collaborators_count"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
}

func tripToResponse(t model.Trip, totalExpense int64, isOwner bool, ownerName string, collabsCount int) tripResponse {
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
		Nama:               t.Nama,
		Tujuan:             t.Tujuan,
		TanggalMulai:       t.TanggalMulai.Format("2006-01-02"),
		TanggalSelesai:     t.TanggalSelesai.Format("2006-01-02"),
		Status:             t.Status,
		UangDinas:          t.UangDinas,
		NominalMonita:      t.NominalMonita,
		TanggalDibayar:     dibayarStr,
		Catatan:            t.Catatan,
		LinkMonita:         t.LinkMonita,
		SettlementNote:     t.SettlementNote,
		TotalPengeluaran:   totalExpense,
		Saldo:              uangDinas - totalExpense,
		IsOwner:            isOwner,
		OwnerName:          ownerName,
		CollaboratorsCount: collabsCount,
		CreatedAt:          t.CreatedAt,
		UpdatedAt:          t.UpdatedAt,
	}
}

const tripSelectCols = `t.id, t.nama, t.tujuan, t.tanggal_mulai, t.tanggal_selesai,
	COALESCE(t.status, 'berlangsung'), t.uang_dinas, t.nominal_monita, t.tanggal_dibayar,
	COALESCE(t.catatan, ''), COALESCE(t.link_monita, ''), COALESCE(t.settlement_note, ''),
	t.created_at, t.updated_at`

const tripInsertCols = `id, nama, tujuan, tanggal_mulai, tanggal_selesai,
	COALESCE(status, 'berlangsung'), uang_dinas, nominal_monita, tanggal_dibayar,
	COALESCE(catatan, ''), COALESCE(link_monita, ''), COALESCE(settlement_note, ''),
	created_at, updated_at`

func ListTrips(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := auth.UserIDFromContext(r.Context())
		rows, err := db.Query(`
			SELECT `+tripSelectCols+`,
				COALESCE(SUM(e.jumlah), 0) as total_expense,
				(t.user_id = $1) as is_owner,
				u.name as owner_name,
				(SELECT COUNT(*) FROM trip_members tm WHERE tm.trip_id = t.id) as collabs_count
			FROM trips t
			JOIN users u ON t.user_id = u.id
			LEFT JOIN expenses e ON e.trip_id = t.id
			WHERE t.user_id = $1 OR EXISTS (
				SELECT 1 FROM trip_members tm WHERE tm.trip_id = t.id AND tm.user_id = $1
			)
			GROUP BY t.id, u.name
			ORDER BY t.tanggal_mulai DESC
		`, userID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		defer rows.Close()

		var trips []tripResponse
		for rows.Next() {
			var t model.Trip
			var totalExpense int64
			var isOwner bool
			var ownerName string
			var collabsCount int

			if err := rows.Scan(
				&t.ID, &t.Nama, &t.Tujuan, &t.TanggalMulai, &t.TanggalSelesai,
				&t.Status, &t.UangDinas, &t.NominalMonita, &t.TanggalDibayar,
				&t.Catatan, &t.LinkMonita, &t.SettlementNote,
				&t.CreatedAt, &t.UpdatedAt,
				&totalExpense, &isOwner, &ownerName, &collabsCount,
			); err != nil {
				continue
			}
			trips = append(trips, tripToResponse(t, totalExpense, isOwner, ownerName, collabsCount))
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
		var input struct {
			Nama           string  `json:"nama"`
			Tujuan         string  `json:"tujuan"`
			TanggalMulai   string  `json:"tanggal_mulai"`
			TanggalSelesai string  `json:"tanggal_selesai"`
			UangDinas      *int64  `json:"uang_dinas"`
			NominalMonita  *int64  `json:"nominal_monita"`
			TanggalDibayar *string `json:"tanggal_dibayar"`
			Catatan        string  `json:"catatan"`
			LinkMonita     string  `json:"link_monita"`
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
		err := db.QueryRow(`
			INSERT INTO trips (user_id, nama, tujuan, tanggal_mulai, tanggal_selesai, status, uang_dinas, nominal_monita, tanggal_dibayar, catatan, link_monita)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
			RETURNING `+tripInsertCols+`
		`, userID, input.Nama, input.Tujuan, mulai, selesai, model.StatusBerlangsung,
			input.UangDinas, input.NominalMonita, dibayar, input.Catatan, input.LinkMonita).
			Scan(&trip.ID, &trip.Nama, &trip.Tujuan, &trip.TanggalMulai, &trip.TanggalSelesai,
				&trip.Status, &trip.UangDinas, &trip.NominalMonita, &trip.TanggalDibayar,
				&trip.Catatan, &trip.LinkMonita, &trip.SettlementNote,
				&trip.CreatedAt, &trip.UpdatedAt)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		var ownerName string
		db.QueryRow("SELECT name FROM users WHERE id = $1", userID).Scan(&ownerName)
		writeJSON(w, http.StatusCreated, map[string]interface{}{"data": tripToResponse(trip, 0, true, ownerName, 0)})
	}
}

func GetTrip(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := auth.UserIDFromContext(r.Context())
		role := auth.RoleFromContext(r.Context())
		id := r.PathValue("id")

		var trip model.Trip
		var totalExpense int64
		var tripOwnerID string
		var ownerName string
		var collabsCount int

		err := db.QueryRow(`
			SELECT `+tripSelectCols+`,
				COALESCE(SUM(e.jumlah), 0),
				t.user_id,
				u.name as owner_name,
				(SELECT COUNT(*) FROM trip_members tm WHERE tm.trip_id = t.id) as collabs_count
			FROM trips t
			JOIN users u ON t.user_id = u.id
			LEFT JOIN expenses e ON e.trip_id = t.id
			WHERE t.id = $1 AND (
				t.user_id = $2 OR EXISTS (SELECT 1 FROM trip_members tm WHERE tm.trip_id = t.id AND tm.user_id = $2) OR $3 = 'admin'
			)
			GROUP BY t.id, u.name
		`, id, userID, role).Scan(
			&trip.ID, &trip.Nama, &trip.Tujuan, &trip.TanggalMulai, &trip.TanggalSelesai,
			&trip.Status, &trip.UangDinas, &trip.NominalMonita, &trip.TanggalDibayar,
			&trip.Catatan, &trip.LinkMonita, &trip.SettlementNote,
			&trip.CreatedAt, &trip.UpdatedAt, &totalExpense,
			&tripOwnerID, &ownerName, &collabsCount)

		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
			return
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		isOwner := (tripOwnerID == userID) || (role == "admin")
		writeJSON(w, http.StatusOK, map[string]interface{}{"data": tripToResponse(trip, totalExpense, isOwner, ownerName, collabsCount)})
	}
}

func UpdateTrip(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := auth.UserIDFromContext(r.Context())
		role := auth.RoleFromContext(r.Context())
		id := r.PathValue("id")

		var input struct {
			Nama           *string `json:"nama"`
			Tujuan         *string `json:"tujuan"`
			TanggalMulai   *string `json:"tanggal_mulai"`
			TanggalSelesai *string `json:"tanggal_selesai"`
			Status         *string `json:"status"`
			UangDinas      *int64  `json:"uang_dinas"`
			NominalMonita  *int64  `json:"nominal_monita"`
			TanggalDibayar *string `json:"tanggal_dibayar"`
			Catatan        *string `json:"catatan"`
			LinkMonita     *string `json:"link_monita"`
			SettlementNote *string `json:"settlement_note"`
		}
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
			return
		}

		// Only owner or admin can update trip metadata
		var trip model.Trip
		var tripOwnerID string
		err := db.QueryRow(`SELECT `+tripSelectCols+`, t.user_id
			FROM trips t WHERE t.id = $1`, id).
			Scan(&trip.ID, &trip.Nama, &trip.Tujuan, &trip.TanggalMulai, &trip.TanggalSelesai,
				&trip.Status, &trip.UangDinas, &trip.NominalMonita, &trip.TanggalDibayar,
				&trip.Catatan, &trip.LinkMonita, &trip.SettlementNote,
				&trip.CreatedAt, &trip.UpdatedAt, &tripOwnerID)
		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
			return
		}

		if tripOwnerID != userID && role != "admin" {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "hanya pemilik trip atau admin yang dapat mengubah detail trip"})
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

		_, err = db.Exec(`
			UPDATE trips SET nama=$1, tujuan=$2, tanggal_mulai=$3, tanggal_selesai=$4,
				status=$5, uang_dinas=$6, nominal_monita=$7, tanggal_dibayar=$8,
				catatan=$9, link_monita=$10, settlement_note=$11, updated_at=now()
			WHERE id=$12
		`, trip.Nama, trip.Tujuan, trip.TanggalMulai, trip.TanggalSelesai,
			trip.Status, trip.UangDinas, trip.NominalMonita, trip.TanggalDibayar,
			trip.Catatan, trip.LinkMonita, trip.SettlementNote, id)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		// Re-fetch with totals
		var totalExpense int64
		var ownerName string
		var collabsCount int
		db.QueryRow("SELECT COALESCE(SUM(jumlah), 0) FROM expenses WHERE trip_id = $1", id).Scan(&totalExpense)
		db.QueryRow("SELECT updated_at FROM trips WHERE id = $1", id).Scan(&trip.UpdatedAt)
		db.QueryRow("SELECT name FROM users WHERE id = $1", tripOwnerID).Scan(&ownerName)
		db.QueryRow("SELECT COUNT(*) FROM trip_members WHERE trip_id = $1", id).Scan(&collabsCount)

		writeJSON(w, http.StatusOK, map[string]interface{}{"data": tripToResponse(trip, totalExpense, true, ownerName, collabsCount)})
	}
}

func DeleteTrip(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := auth.UserIDFromContext(r.Context())
		role := auth.RoleFromContext(r.Context())
		id := r.PathValue("id")

		var result sql.Result
		var err error
		if role == "admin" {
			result, err = db.Exec("DELETE FROM trips WHERE id = $1", id)
		} else {
			result, err = db.Exec("DELETE FROM trips WHERE id = $1 AND user_id = $2", id, userID)
		}

		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		rows, _ := result.RowsAffected()
		if rows == 0 {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found or unauthorized"})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

package handler

import (
	"database/sql"
	"net/http"

	"github.com/maulana/perjadin-personal/internal/auth"
)

type CategorySpending struct {
	CategoryID   string `json:"category_id"`
	CategoryNama string `json:"category_nama"`
	Total        int64  `json:"total"`
	Percentage   int    `json:"percentage"`
}

type PaymentMethodSpending struct {
	PaymentMethodID   string `json:"payment_method_id"`
	PaymentMethodNama string `json:"payment_method_nama"`
	Total             int64  `json:"total"`
	Percentage        int    `json:"percentage"`
}

type AnalyticsData struct {
	TotalExpensesRp    int64                   `json:"total_expenses_rp"`
	TotalUangDinasRp   int64                   `json:"total_uang_dinas_rp"`
	AverageExpenseTrip int64                   `json:"average_expense_trip"`
	Categories         []CategorySpending      `json:"categories"`
	PaymentMethods     []PaymentMethodSpending `json:"payment_methods"`
}

func GetAnalytics(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := auth.UserIDFromContext(r.Context())

		data := AnalyticsData{
			Categories:     []CategorySpending{},
			PaymentMethods: []PaymentMethodSpending{},
		}

		// Total expenses & trips count
		var tripCount int
		_ = db.QueryRow(`
			SELECT COALESCE(SUM(e.jumlah), 0), COUNT(DISTINCT t.id)
			FROM trips t
			LEFT JOIN expenses e ON e.trip_id = t.id
			WHERE t.user_id = $1
		`, userID).Scan(&data.TotalExpensesRp, &tripCount)

		if tripCount > 0 {
			data.AverageExpenseTrip = data.TotalExpensesRp / int64(tripCount)
		}

		// Total uang dinas
		_ = db.QueryRow(`
			SELECT COALESCE(SUM(uang_dinas), 0)
			FROM trips
			WHERE user_id = $1 AND uang_dinas IS NOT NULL
		`, userID).Scan(&data.TotalUangDinasRp)

		// Category breakdown
		catRows, err := db.Query(`
			SELECT c.id, c.nama, COALESCE(SUM(e.jumlah), 0) as total
			FROM categories c
			JOIN expenses e ON e.category_id = c.id
			JOIN trips t ON e.trip_id = t.id
			WHERE t.user_id = $1
			GROUP BY c.id, c.nama
			ORDER BY total DESC
		`, userID)
		if err == nil {
			defer catRows.Close()
			for catRows.Next() {
				var cs CategorySpending
				if err := catRows.Scan(&cs.CategoryID, &cs.CategoryNama, &cs.Total); err == nil {
					if data.TotalExpensesRp > 0 {
						cs.Percentage = int((cs.Total * 100) / data.TotalExpensesRp)
					}
					data.Categories = append(data.Categories, cs)
				}
			}
		}

		// Payment method breakdown
		pmRows, err := db.Query(`
			SELECT p.id, p.nama, COALESCE(SUM(e.jumlah), 0) as total
			FROM payment_methods p
			JOIN expenses e ON e.payment_method_id = p.id
			JOIN trips t ON e.trip_id = t.id
			WHERE t.user_id = $1
			GROUP BY p.id, p.nama
			ORDER BY total DESC
		`, userID)
		if err == nil {
			defer pmRows.Close()
			for pmRows.Next() {
				var pms PaymentMethodSpending
				if err := pmRows.Scan(&pms.PaymentMethodID, &pms.PaymentMethodNama, &pms.Total); err == nil {
					if data.TotalExpensesRp > 0 {
						pms.Percentage = int((pms.Total * 100) / data.TotalExpensesRp)
					}
					data.PaymentMethods = append(data.PaymentMethods, pms)
				}
			}
		}

		writeJSON(w, http.StatusOK, map[string]interface{}{"data": data})
	}
}

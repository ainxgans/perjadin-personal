package handler

import (
	"database/sql"
	"net/http"
	"strconv"

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
	TotalExpensesRp      int64                   `json:"total_expenses_rp"`
	TotalUangDinasRp     int64                   `json:"total_uang_dinas_rp"`
	AverageExpenseTrip   int64                   `json:"average_expense_trip"`
	TotalDays            int                     `json:"total_days"`
	TotalTrips           int                     `json:"total_trips"`
	DailyBurnRate        int64                   `json:"daily_burn_rate"`
	PersonalSharePct     int                     `json:"personal_share_pct"`
	BudgetRealizationPct int                     `json:"budget_realization_pct"`
	Categories           []CategorySpending      `json:"categories"`
	PaymentMethods       []PaymentMethodSpending `json:"payment_methods"`
	AvailableYears       []int                   `json:"available_years"`
}

func GetAnalytics(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := auth.UserIDFromContext(r.Context())

		year, _ := strconv.Atoi(r.URL.Query().Get("year"))
		if year < 1900 || year > 2100 {
			year = 0
		}

		data := AnalyticsData{
			Categories:     []CategorySpending{},
			PaymentMethods: []PaymentMethodSpending{},
			AvailableYears: []int{},
		}

		// 0. Available years
		yRows, err := db.Query(`
			SELECT DISTINCT EXTRACT(YEAR FROM t.tanggal_mulai)::int AS y
			FROM trips t
			WHERE (t.user_id = $1 OR EXISTS (SELECT 1 FROM trip_members tm WHERE tm.trip_id = t.id AND tm.user_id = $1))
			ORDER BY y DESC
		`, userID)
		if err == nil {
			defer yRows.Close()
			for yRows.Next() {
				var y int
				if err := yRows.Scan(&y); err == nil {
					data.AvailableYears = append(data.AvailableYears, y)
				}
			}
		}

		// 1. Total expenses recorded by the user (or legacy rows of own trips)
		_ = db.QueryRow(`
			SELECT COALESCE(SUM(e.jumlah), 0)
			FROM expenses e
			JOIN trips t ON e.trip_id = t.id
			WHERE (e.user_id = $1 OR (e.user_id IS NULL AND t.user_id = $1))
				AND (t.user_id = $1 OR EXISTS (SELECT 1 FROM trip_members tm WHERE tm.trip_id = t.id AND tm.user_id = $1))
				AND ($2 = 0 OR EXTRACT(YEAR FROM t.tanggal_mulai) = $2)
		`, userID, year).Scan(&data.TotalExpensesRp)

		// 2. Count of distinct trips user participated in
		var tripCount int
		_ = db.QueryRow(`
			SELECT COUNT(DISTINCT t.id)
			FROM trips t
			WHERE (t.user_id = $1 OR EXISTS (SELECT 1 FROM trip_members tm WHERE tm.trip_id = t.id AND tm.user_id = $1))
				AND ($2 = 0 OR EXTRACT(YEAR FROM t.tanggal_mulai) = $2)
		`, userID, year).Scan(&tripCount)

		data.TotalTrips = tripCount
		if tripCount > 0 {
			data.AverageExpenseTrip = data.TotalExpensesRp / int64(tripCount)
		}

		// 3. Total travel days participated
		_ = db.QueryRow(`
			SELECT COALESCE(SUM(GREATEST(1, (t.tanggal_selesai - t.tanggal_mulai) + 1)), 0)
			FROM trips t
			WHERE (t.user_id = $1 OR EXISTS (SELECT 1 FROM trip_members tm WHERE tm.trip_id = t.id AND tm.user_id = $1))
				AND ($2 = 0 OR EXTRACT(YEAR FROM t.tanggal_mulai) = $2)
		`, userID, year).Scan(&data.TotalDays)

		if data.TotalDays > 0 {
			data.DailyBurnRate = data.TotalExpensesRp / int64(data.TotalDays)
		}

		// 4. Personal share percentage
		var personalExpense int64
		_ = db.QueryRow(`
			SELECT COALESCE(SUM(e.jumlah), 0)
			FROM expenses e
			JOIN trips t ON e.trip_id = t.id
			JOIN payment_methods pm ON e.payment_method_id = pm.id
			WHERE pm.nama ILIKE '%Pribadi%'
				AND (e.user_id = $1 OR (e.user_id IS NULL AND t.user_id = $1))
				AND (t.user_id = $1 OR EXISTS (SELECT 1 FROM trip_members tm WHERE tm.trip_id = t.id AND tm.user_id = $1))
				AND ($2 = 0 OR EXTRACT(YEAR FROM t.tanggal_mulai) = $2)
		`, userID, year).Scan(&personalExpense)

		if data.TotalExpensesRp > 0 {
			data.PersonalSharePct = int((personalExpense * 100) / data.TotalExpensesRp)
		}

		// 5. Total uang dinas of user's own trips
		_ = db.QueryRow(`
			SELECT COALESCE(SUM(uang_dinas), 0)
			FROM trips
			WHERE user_id = $1 AND uang_dinas IS NOT NULL
				AND ($2 = 0 OR EXTRACT(YEAR FROM tanggal_mulai) = $2)
		`, userID, year).Scan(&data.TotalUangDinasRp)

		// 6. Budget realization on lunas cohort
		var lunasUangDinas, lunasExpenses int64
		_ = db.QueryRow(`
			SELECT COALESCE(SUM(uang_dinas), 0)
			FROM trips
			WHERE user_id = $1 AND status = 'lunas' AND uang_dinas IS NOT NULL
				AND ($2 = 0 OR EXTRACT(YEAR FROM tanggal_mulai) = $2)
		`, userID, year).Scan(&lunasUangDinas)

		_ = db.QueryRow(`
			SELECT COALESCE(SUM(e.jumlah), 0)
			FROM expenses e
			JOIN trips t ON e.trip_id = t.id
			WHERE t.user_id = $1 AND t.status = 'lunas'
				AND ($2 = 0 OR EXTRACT(YEAR FROM t.tanggal_mulai) = $2)
		`, userID, year).Scan(&lunasExpenses)

		if lunasUangDinas > 0 {
			data.BudgetRealizationPct = int((lunasExpenses * 100) / lunasUangDinas)
		}

		// 7. Category breakdown
		catRows, err := db.Query(`
			SELECT c.id, c.nama, COALESCE(SUM(e.jumlah), 0) as total
			FROM categories c
			JOIN expenses e ON e.category_id = c.id
			JOIN trips t ON e.trip_id = t.id
			WHERE (e.user_id = $1 OR (e.user_id IS NULL AND t.user_id = $1))
				AND (t.user_id = $1 OR EXISTS (SELECT 1 FROM trip_members tm WHERE tm.trip_id = t.id AND tm.user_id = $1))
				AND ($2 = 0 OR EXTRACT(YEAR FROM t.tanggal_mulai) = $2)
			GROUP BY c.id, c.nama
			ORDER BY total DESC
		`, userID, year)
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

		// 8. Payment method breakdown
		pmRows, err := db.Query(`
			SELECT p.id, p.nama, COALESCE(SUM(e.jumlah), 0) as total
			FROM payment_methods p
			JOIN expenses e ON e.payment_method_id = p.id
			JOIN trips t ON e.trip_id = t.id
			WHERE (e.user_id = $1 OR (e.user_id IS NULL AND t.user_id = $1))
				AND (t.user_id = $1 OR EXISTS (SELECT 1 FROM trip_members tm WHERE tm.trip_id = t.id AND tm.user_id = $1))
				AND ($2 = 0 OR EXTRACT(YEAR FROM t.tanggal_mulai) = $2)
			GROUP BY p.id, p.nama
			ORDER BY total DESC
		`, userID, year)
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

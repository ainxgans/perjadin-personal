package main

import (
	"database/sql"
	"encoding/csv"
	"flag"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	_ "github.com/lib/pq"
	"github.com/maulana/perjadin-personal/internal/db"
)

type mdInfo struct {
	MonitaURL string
	Notes     string
}

func main() {
	dirFlag := flag.String("dir", "Dinas", "Directory containing Notion export CSV and MD files")
	userFlag := flag.String("user", "", "Target user email (default: first existing user, or creates admin)")
	dbURLFlag := flag.String("db", "", "Database connection URL (defaults to DATABASE_URL env or localhost)")
	flag.Parse()

	dbURL := *dbURLFlag
	if dbURL == "" {
		dbURL = os.Getenv("DATABASE_URL")
	}
	if dbURL == "" {
		dbURL = "postgres://postgres:postgres@localhost:5432/perjadin?sslmode=disable"
	}

	conn, err := db.Connect(dbURL)
	if err != nil {
		log.Fatalf("Gagal koneksi database: %v", err)
	}
	defer conn.Close()

	// Apply pending migrations automatically
	migrationsDir := "internal/db/migrations"
	if _, err := os.Stat(migrationsDir); os.IsNotExist(err) {
		migrationsDir = "../../internal/db/migrations"
	}
	if err := db.Migrate(conn, migrationsDir); err != nil {
		log.Fatalf("Gagal migrasi database: %v", err)
	}

	// 1. Resolve Target User
	userID, userEmail, err := resolveUser(conn, *userFlag)
	if err != nil {
		log.Fatalf("Gagal menentukan user: %v", err)
	}
	fmt.Printf("[SEEDER] Target Pengguna: %s (%s)\n", userEmail, userID)

	// 2. Resolve Master Data IDs
	catTransportID := getOrCreateCategory(conn, "Transportasi")
	catLainnyaID := getOrCreateCategory(conn, "Lainnya")
	pmPribadiID := getOrCreatePaymentMethod(conn, "Pribadi")

	// 3. Scan Markdown Files for Notes & Monita URL
	mdMap := scanMarkdownFiles(*dirFlag)
	fmt.Printf("[SEEDER] Berhasil memuat %d file catatan markdown\n", len(mdMap))

	// 4. Find & Parse Notion CSV
	csvPath := findCSVFile(*dirFlag)
	if csvPath == "" {
		log.Fatalf("Tidak ditemukan file CSV di folder %s", *dirFlag)
	}
	fmt.Printf("[SEEDER] Membaca data dari: %s\n", csvPath)

	csvFile, err := os.Open(csvPath)
	if err != nil {
		log.Fatalf("Gagal membuka CSV: %v", err)
	}
	defer csvFile.Close()

	reader := csv.NewReader(csvFile)
	headers, err := reader.Read()
	if err != nil {
		log.Fatalf("Gagal membaca header CSV: %v", err)
	}

	// Clean UTF-8 BOM if present
	if len(headers) > 0 {
		headers[0] = strings.TrimPrefix(headers[0], "\ufeff")
	}

	colIdx := make(map[string]int)
	for i, h := range headers {
		colIdx[strings.TrimSpace(h)] = i
	}

	getCol := func(row []string, name string) string {
		idx, ok := colIdx[name]
		if !ok || idx >= len(row) {
			return ""
		}
		return strings.TrimSpace(row[idx])
	}

	tripsInserted := 0
	tripsUpdated := 0
	expensesInserted := 0

	rowNum := 0
	for {
		row, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			log.Printf("Peringatan: baris %d lewati karena error: %v", rowNum+1, err)
			continue
		}
		rowNum++

		nama := getCol(row, "Nomor Surat/Judul")
		if nama == "" {
			continue
		}
		tujuan := getCol(row, "Lokasi")
		if tujuan == "" {
			tujuan = "Luar Kota"
		}

		tglMulaiStr := getCol(row, "Tanggal mulai")
		tglSelesaiStr := getCol(row, "Tanggal berakhir")
		tglMasukStr := getCol(row, "Tanggal Uang Masuk")

		mulai, err := parseDate(tglMulaiStr)
		if err != nil {
			log.Printf("[%s] Skip: tanggal mulai tidak valid (%s)", nama, tglMulaiStr)
			continue
		}
		selesai, err := parseDate(tglSelesaiStr)
		if err != nil {
			selesai = mulai
		}
		if selesai.Before(mulai) {
			selesai = mulai
		}

		var tglDibayar *time.Time
		if tglMasukStr != "" {
			d, err := parseDate(tglMasukStr)
			if err == nil {
				tglDibayar = &d
			}
		}

		nomMonita := parseRupiah(getCol(row, "Nominal Monita"))
		nomMasuk := parseRupiah(getCol(row, "Nominal masuk"))
		pengeluaranLain := parseRupiah(getCol(row, "Pengeluaran Lain"))

		linkMonita := getCol(row, "Monita")
		var catatan string

		// Check markdown metadata
		if md, found := mdMap[strings.ToLower(strings.TrimSpace(nama))]; found {
			if linkMonita == "" && md.MonitaURL != "" {
				linkMonita = md.MonitaURL
			}
			if md.Notes != "" {
				catatan = md.Notes
			}
		}

		// Upsert Trip
		var tripID string
		var isNew bool

		err = conn.QueryRow(`
			SELECT id FROM trips 
			WHERE user_id = $1 AND nama = $2 AND tanggal_mulai = $3
		`, userID, nama, mulai).Scan(&tripID)

		if err == sql.ErrNoRows {
			// Insert new trip
			err = conn.QueryRow(`
				INSERT INTO trips (user_id, nama, tujuan, tanggal_mulai, tanggal_selesai, uang_dinas, nominal_monita, tanggal_dibayar, catatan, link_monita)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
				RETURNING id
			`, userID, nama, tujuan, mulai, selesai, nomMasuk, nomMonita, tglDibayar, catatan, linkMonita).Scan(&tripID)
			if err != nil {
				log.Printf("[%s] Gagal insert trip: %v", nama, err)
				continue
			}
			tripsInserted++
			isNew = true
		} else if err == nil {
			// Update existing trip with refreshed data
			_, err = conn.Exec(`
				UPDATE trips SET
					tujuan = $1,
					tanggal_selesai = $2,
					uang_dinas = $3,
					nominal_monita = $4,
					tanggal_dibayar = $5,
					catatan = $6,
					link_monita = $7,
					updated_at = now()
				WHERE id = $8
			`, tujuan, selesai, nomMasuk, nomMonita, tglDibayar, catatan, linkMonita, tripID)
			if err != nil {
				log.Printf("[%s] Gagal update trip: %v", nama, err)
			}
			tripsUpdated++
		} else {
			log.Printf("[%s] Error query trip: %v", nama, err)
			continue
		}

		// Insert Expense from "Pengeluaran Lain" if present
		if pengeluaranLain != nil && *pengeluaranLain > 0 {
			var existsExp bool
			_ = conn.QueryRow(`
				SELECT EXISTS(SELECT 1 FROM expenses WHERE trip_id = $1 AND jumlah = $2)
			`, tripID, *pengeluaranLain).Scan(&existsExp)

			if !existsExp {
				expDesc := "Pengeluaran Lain"
				catID := catLainnyaID

				lowerNotes := strings.ToLower(catatan)
				if strings.Contains(lowerNotes, "whoosh") {
					expDesc = "Whoosh Kereta Cepat"
					catID = catTransportID
				} else if strings.Contains(lowerNotes, "gocar") || strings.Contains(lowerNotes, "taksi") {
					expDesc = "Transport / Taksi"
					catID = catTransportID
				} else if *pengeluaranLain == 35000 || *pengeluaranLain == 60000 {
					expDesc = "Tol / Bahan Bakar / Transport"
					catID = catTransportID
				}

				_, err = conn.Exec(`
					INSERT INTO expenses (trip_id, category_id, payment_method_id, deskripsi, jumlah, tanggal)
					VALUES ($1, $2, $3, $4, $5, $6)
				`, tripID, catID, pmPribadiID, expDesc, *pengeluaranLain, mulai)
				if err != nil {
					log.Printf("[%s] Gagal insert expense: %v", nama, err)
				} else {
					expensesInserted++
				}
			}
		}

		statusLabel := "URUS BERKAS"
		if tglDibayar != nil && nomMasuk != nil {
			statusLabel = "SELESAI"
		}
		action := "BARU"
		if !isNew {
			action = "UPDATE"
		}
		fmt.Printf("  ✓ [%s] %s (%s s/d %s) | Status: %s\n", action, nama, mulai.Format("02/01/2006"), selesai.Format("02/01/2006"), statusLabel)
	}

	fmt.Println("\n==================================================")
	fmt.Printf("[SEEDER BERES] %d trip baru, %d trip diperbarui, %d pengeluaran ditambahkan.\n",
		tripsInserted, tripsUpdated, expensesInserted)
	fmt.Println("==================================================")
}

func parseDate(s string) (time.Time, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return time.Time{}, fmt.Errorf("empty date")
	}
	// Try DD/MM/YYYY
	if t, err := time.Parse("02/01/2006", s); err == nil {
		return t, nil
	}
	// Try YYYY-MM-DD
	if t, err := time.Parse("2006-01-02", s); err == nil {
		return t, nil
	}
	return time.Time{}, fmt.Errorf("invalid format: %s", s)
}

func parseRupiah(s string) *int64 {
	var digits []byte
	for _, r := range s {
		if r >= '0' && r <= '9' {
			digits = append(digits, byte(r))
		}
	}
	if len(digits) == 0 {
		return nil
	}
	val, err := strconv.ParseInt(string(digits), 10, 64)
	if err != nil {
		return nil
	}
	return &val
}

func scanMarkdownFiles(dir string) map[string]mdInfo {
	res := make(map[string]mdInfo)
	files, err := filepath.Glob(filepath.Join(dir, "*.md"))
	if err != nil {
		return res
	}

	urlRegex := regexp.MustCompile(`Monita:\s*(https?://[^\s]+)`)

	for _, f := range files {
		base := filepath.Base(f)
		parts := strings.Split(base, " ")
		if len(parts) < 2 {
			continue
		}
		// Last part is 32-hex id + ".md"
		title := strings.Join(parts[:len(parts)-1], " ")
		title = strings.TrimSpace(title)

		content, err := os.ReadFile(f)
		if err != nil {
			continue
		}

		text := string(content)
		var monitaURL string
		if match := urlRegex.FindStringSubmatch(text); len(match) > 1 {
			monitaURL = strings.TrimSpace(match[1])
		}

		lines := strings.Split(text, "\n")
		var bodyLines []string
		for _, line := range lines {
			line = strings.TrimSpace(line)
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			isMeta := false
			for _, prefix := range []string{"Apakah", "Berkas", "Bersih", "Hotel", "Lokasi", "Monita", "Nominal", "Pengeluaran", "Tanggal"} {
				if strings.HasPrefix(line, prefix) {
					isMeta = true
					break
				}
			}
			if !isMeta {
				bodyLines = append(bodyLines, line)
			}
		}

		res[strings.ToLower(title)] = mdInfo{
			MonitaURL: monitaURL,
			Notes:     strings.Join(bodyLines, "\n"),
		}
	}
	return res
}

func findCSVFile(dir string) string {
	candidates := []string{
		filepath.Join(dir, "Dinas 408832b58fe9801f917ce00f69c689de_all.csv"),
		filepath.Join(dir, "Dinas 408832b58fe9801f917ce00f69c689de.csv"),
	}
	for _, c := range candidates {
		if _, err := os.Stat(c); err == nil {
			return c
		}
	}
	matches, _ := filepath.Glob(filepath.Join(dir, "*.csv"))
	if len(matches) > 0 {
		return matches[0]
	}
	return ""
}

func resolveUser(conn *sql.DB, targetEmail string) (id, email string, err error) {
	if targetEmail != "" {
		err = conn.QueryRow("SELECT id, email FROM users WHERE email = $1", targetEmail).Scan(&id, &email)
		if err == nil {
			return id, email, nil
		}
	}

	// Try finding first existing user
	err = conn.QueryRow("SELECT id, email FROM users ORDER BY created_at ASC LIMIT 1").Scan(&id, &email)
	if err == nil {
		return id, email, nil
	}

	// Create placeholder initial admin user if table empty
	defaultEmail := "admin@perjadin.internal"
	if targetEmail != "" {
		defaultEmail = targetEmail
	}
	err = conn.QueryRow(`
		INSERT INTO users (google_id, email, name, role)
		VALUES ($1, $2, 'Admin Perjadin', 'admin')
		ON CONFLICT (google_id) DO UPDATE SET email = EXCLUDED.email
		RETURNING id, email
	`, "seed-admin-01", defaultEmail).Scan(&id, &email)
	return id, email, err
}

func getOrCreateCategory(conn *sql.DB, name string) string {
	var id string
	err := conn.QueryRow("SELECT id FROM categories WHERE nama = $1", name).Scan(&id)
	if err == nil {
		return id
	}
	_ = conn.QueryRow("INSERT INTO categories (nama) VALUES ($1) ON CONFLICT (nama) DO UPDATE SET nama = EXCLUDED.nama RETURNING id", name).Scan(&id)
	return id
}

func getOrCreatePaymentMethod(conn *sql.DB, name string) string {
	var id string
	err := conn.QueryRow("SELECT id FROM payment_methods WHERE nama = $1", name).Scan(&id)
	if err == nil {
		return id
	}
	_ = conn.QueryRow("INSERT INTO payment_methods (nama) VALUES ($1) ON CONFLICT (nama) DO UPDATE SET nama = EXCLUDED.nama RETURNING id", name).Scan(&id)
	return id
}

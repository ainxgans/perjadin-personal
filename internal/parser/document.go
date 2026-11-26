package parser

import (
	"bytes"
	"fmt"
	"os/exec"
	"regexp"
	"strings"
	"time"
)

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

var indonesianMonths = map[string]time.Month{
	"januari":   time.January,
	"februari":  time.February,
	"maret":     time.March,
	"april":     time.April,
	"mei":       time.May,
	"juni":      time.June,
	"juli":      time.July,
	"agustus":   time.August,
	"september": time.September,
	"oktober":   time.October,
	"november":  time.November,
	"desember":  time.December,
}

func parseDateIndo(dayStr, monthStr, yearStr string) (time.Time, error) {
	m, ok := indonesianMonths[strings.ToLower(strings.TrimSpace(monthStr))]
	if !ok {
		return time.Time{}, fmt.Errorf("unknown month: %s", monthStr)
	}
	var d, y int
	if _, err := fmt.Sscanf(dayStr, "%d", &d); err != nil {
		return time.Time{}, err
	}
	if _, err := fmt.Sscanf(yearStr, "%d", &y); err != nil {
		return time.Time{}, err
	}
	return time.Date(y, m, d, 0, 0, 0, 0, time.UTC), nil
}

// ExtractTextFromPDF extracts plain layout text from a PDF file using pdftotext.
func ExtractTextFromPDF(pdfPath string) (string, error) {
	cmd := exec.Command("pdftotext", "-layout", pdfPath, "-")
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("pdftotext error: %v (stderr: %s)", err, stderr.String())
	}
	return stdout.String(), nil
}

// ParseNaskahDinas parses text of Indonesian official letters (Surat Tugas / Undangan).
func ParseNaskahDinas(text string, knownLocations []string) ParseResult {
	res := ParseResult{}
	lines := strings.Split(text, "\n")
	lower := strings.ToLower(text)

	// 1. Detect Document Type
	if strings.Contains(lower, "surat tugas") || strings.Contains(lower, "menugaskan pegawai") {
		res.DocType = "surat_tugas"
	} else if strings.Contains(lower, "undangan") || strings.Contains(lower, "mengundang") {
		res.DocType = "surat_undangan"
	} else {
		res.DocType = "general"
	}

	// 2. Nomor Surat
	reNomor := regexp.MustCompile(`(?i)Nomor\s*:\s*([^\n\r]+)`)
	if m := reNomor.FindStringSubmatch(text); len(m) > 1 {
		// Clean out trailing date/watermarks if present on same line
		fields := strings.Fields(m[1])
		if len(fields) > 0 {
			res.NomorSurat = strings.TrimSpace(fields[0])
		}
	}

	// 3. Tanggal (Hari, tanggal / Hari/tanggal / Tanggal)
	// Pattern A: Full range across months: D M YYYY - D M YYYY
	reDateRangeFull := regexp.MustCompile(`(?i)(?:Hari[,/]\s*tanggal|Tanggal)\s*:\s*(?:[A-Za-z’'\s–-]+[/]\s*)?(?:[A-Za-z’'\s]+[,/]\s*)?(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\s*[-–—s\.d\s]+\s*(?:[A-Za-z’'\s]+[,/]\s*)?(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})`)
	// Pattern A2: "Hari s.d. Hari /DD s.d. DD Bulan YYYY" — day names with s.d. then slash then numeric range
	reDateRangeSlashSep := regexp.MustCompile(`(?i)(?:Hari[,/]\s*tanggal|Tanggal)\s*:.*?/\s*(\d{1,2})\s*(?:[-–—]|\bs\.?d\.?)\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})`)
	// Pattern B: Range within same month: D - D M YYYY or D s.d D M YYYY or D-D M YYYY
	reDateRangeSameMonth := regexp.MustCompile(`(?i)(?:Hari[,/]\s*tanggal|Tanggal)\s*:\s*(?:[A-Za-z’'\s–-]+[/]\s*)?(?:[A-Za-z’'\s]+[,/]\s*)?(\d{1,2})\s*(?:[-–—]|\bs\.?d\.?\b)\s*(?:[A-Za-z’'\s]+[,/]\s*)?(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})`)
	// Pattern C: Single date: D M YYYY
	reSingleDate := regexp.MustCompile(`(?i)(?:Hari[,/]\s*tanggal|Tanggal)\s*:\s*(?:[A-Za-z’'\s–-]+[/]\s*)?(?:[A-Za-z’'\s]+[,/]\s*)?(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})`)

	if m := reDateRangeFull.FindStringSubmatch(text); len(m) > 6 {
		t1, err1 := parseDateIndo(m[1], m[2], m[3])
		t2, err2 := parseDateIndo(m[4], m[5], m[6])
		if err1 == nil {
			res.TanggalMulai = t1.Format("2006-01-02")
		}
		if err2 == nil {
			res.TanggalSelesai = t2.Format("2006-01-02")
		}
	} else if m := reDateRangeSlashSep.FindStringSubmatch(text); len(m) > 4 {
		t1, err1 := parseDateIndo(m[1], m[3], m[4])
		t2, err2 := parseDateIndo(m[2], m[3], m[4])
		if err1 == nil {
			res.TanggalMulai = t1.Format("2006-01-02")
		}
		if err2 == nil {
			res.TanggalSelesai = t2.Format("2006-01-02")
		}
	} else if m := reDateRangeSameMonth.FindStringSubmatch(text); len(m) > 4 {
		t1, err1 := parseDateIndo(m[1], m[3], m[4])
		t2, err2 := parseDateIndo(m[2], m[3], m[4])
		if err1 == nil {
			res.TanggalMulai = t1.Format("2006-01-02")
		}
		if err2 == nil {
			res.TanggalSelesai = t2.Format("2006-01-02")
		}
	} else if m := reSingleDate.FindStringSubmatch(text); len(m) > 3 {
		t1, err1 := parseDateIndo(m[1], m[2], m[3])
		if err1 == nil {
			res.TanggalMulai = t1.Format("2006-01-02")
			res.TanggalSelesai = t1.Format("2006-01-02")
		}
	}

	// 4. Tempat / Lokasi
	reTempat := regexp.MustCompile(`(?i)Tempat\s*:\s*([^\n\r]+(?:\n\s{15,}[^\n\r]+)*)`)
	if m := reTempat.FindStringSubmatch(text); len(m) > 1 {
		res.LokasiRaw = strings.Join(strings.Fields(m[1]), " ")
	}

	// Match lokasi to knownLocations using specificity scoring so city+province
	// beats province-only, and matching province disambiguates same-named kecamatan/kota
	// (e.g. "Depok, Kabupaten Sleman, Yogyakarta" vs "Depok, Jawa Barat").
	if res.LokasiRaw != "" {
		res.Tujuan = res.LokasiRaw
		rawLower := strings.ToLower(res.LokasiRaw)
		bestScore := 0
		bestLoc := ""

		for _, loc := range knownLocations {
			locLower := strings.ToLower(loc)
			parts := strings.Split(locLower, ",")
			primaryCity := strings.TrimSpace(parts[0])
			if primaryCity == "" {
				continue
			}

			score := 0
			if strings.Contains(rawLower, primaryCity) {
				score += 10
				if len(parts) > 1 {
					score += 5
					provPart := strings.TrimSpace(parts[1])
					provClean := strings.TrimSpace(strings.TrimPrefix(strings.TrimPrefix(provPart, "d.i. "), "dki "))
					if (provPart != "" && strings.Contains(rawLower, provPart)) ||
						(provClean != "" && strings.Contains(rawLower, provClean)) {
						score += 20
					}
				}
				if strings.Contains(rawLower, "kota "+primaryCity) || strings.Contains(rawLower, "kabupaten "+primaryCity) || strings.Contains(rawLower, "kab. "+primaryCity) {
					score += 10
				}
			} else if strings.Contains(locLower, rawLower) {
				score += 8
			}

			if score > bestScore {
				bestScore = score
				bestLoc = loc
			}
		}

		if bestLoc != "" {
			res.Tujuan = bestLoc
		}
	}

	// 5. Agenda / Nama Kegiatan
	if res.DocType == "surat_undangan" {
		// First check for explicit Agenda / Acara section
		reAgenda := regexp.MustCompile(`(?i)(?:Agenda|Acara)\s*:\s*([^\n\r]+(?:\n\s{10,}[^\n\r]+)*)`)
		if m := reAgenda.FindStringSubmatch(text); len(m) > 1 && len(strings.TrimSpace(m[1])) > 5 {
			cleaned := strings.Join(strings.Fields(m[1]), " ")
			res.Nama = strings.TrimSpace(cleaned)
		} else {
			// Fallback to Hal : ...
			reHal := regexp.MustCompile(`(?i)Hal\s*:\s*([^\n\r]+(?:\n\s{10,}[^\n\r]+)*)`)
			if m := reHal.FindStringSubmatch(text); len(m) > 1 {
				cleaned := strings.Join(strings.Fields(m[1]), " ")
				cleaned = strings.TrimPrefix(cleaned, "Undangan ")
				cleaned = strings.TrimPrefix(cleaned, "undangan ")
				res.Nama = strings.TrimSpace(cleaned)
			}
		}
	} else {
		// Surat Tugas: look for task lines below "Tempat :"
		for i, line := range lines {
			if strings.Contains(strings.ToLower(line), "tempat") && strings.Contains(line, ":") {
				for j := i + 1; j < len(lines) && j < i+12; j++ {
					trimmed := strings.TrimSpace(lines[j])
					if strings.HasPrefix(trimmed, "A. ") || strings.HasPrefix(trimmed, "1. ") {
						res.Nama = strings.TrimSpace(trimmed[3:])
						// If next lines continue the sentence, append
						for k := j + 1; k < len(lines) && k < j+3; k++ {
							nextTrimmed := strings.TrimSpace(lines[k])
							if nextTrimmed != "" && !strings.Contains(nextTrimmed, "dengan uraian") && !strings.HasPrefix(nextTrimmed, "B. ") && !strings.HasPrefix(nextTrimmed, "2. ") {
								res.Nama += " " + nextTrimmed
							} else {
								break
							}
						}
						break
					} else if len(trimmed) > 15 && !strings.Contains(trimmed, "dengan uraian") && !strings.Contains(trimmed, "Demikian") {
						res.Nama = trimmed
						break
					}
				}
				break
			}
		}
	}

	// 6. Catatan
	if res.NomorSurat != "" {
		if res.DocType == "surat_tugas" {
			res.Catatan = fmt.Sprintf("Surat Tugas No: %s", res.NomorSurat)
		} else if res.DocType == "surat_undangan" {
			res.Catatan = fmt.Sprintf("Undangan No: %s", res.NomorSurat)
		} else {
			res.Catatan = fmt.Sprintf("Nomor Surat: %s", res.NomorSurat)
		}
	}

	return res
}

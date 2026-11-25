package parser_test

import (
	"path/filepath"
	"testing"

	"github.com/maulana/perjadin-personal/internal/parser"
)

const sampleSuratTugas = `
                                                                                                        629/ST/DBBM/2026 (1 dari 1)




                                                    SURAT TUGAS
                                              Nomor : 629/ST/DBBM/2026

          Dengan ini kami menugaskan pegawai untuk melaksanakan perjalanan dinas
      atas kegiatan yang diselenggarakan pada:

      Hari, tanggal                  : Rabu, 8 April 2026 - Jumat, 10 April 2026
      Tempat                         : Cimahi

       A. Koordinasi Implementasi Surat Rekomendasi Pembelian Jenis BBM Tertentu dan Jenis
          BBM Khusus Penugasan dengan Aplikasi XSTAR 100% Tahap IV di Kota Cimahi

      dengan uraian pelaksana perjalanan dinas terlampir.

         Demikian surat tugas ini dibuat untuk dapat dipergunakan sebagaimana
      mestinya.
`

const sampleSuratUndangan = `
          Nomor             : 73.Und/KS.01/BPH/2026                          24 Februari 2026
          Sifat             : Segera
          Lampiran          : -
          Hal               : Undangan Koordinasi Persiapan Monitoring Ramadhan Idul Fitri 2026
                              dan Buka Puasa Bersama

Yang Terhormat,
1. Seluruh Pegawai

Sehubungan dengan akan dilaksanakannya kegiatan, bersama ini kami mengundang Saudara/i pada:

      Hari/tanggal      : Jum’at / 27 Februari 2026
      Waktu             : Pukul 16.00 WIB s.d Selesai
      Tempat            : Aula Gedung BPH Migas Lantai Ground
                          Jalan Kapten P. Tendean No. 28, Jakarta Selatan

Demikian kami sampaikan.
`

func TestParseSuratTugas(t *testing.T) {
	knownLocations := []string{
		"Cimahi, Jawa Barat",
		"Bandung, Jawa Barat",
		"Jakarta Selatan, DKI Jakarta",
	}

	res := parser.ParseNaskahDinas(sampleSuratTugas, knownLocations)

	if res.DocType != "surat_tugas" {
		t.Errorf("expected doc_type surat_tugas, got %s", res.DocType)
	}
	if res.NomorSurat != "629/ST/DBBM/2026" {
		t.Errorf("expected nomor_surat 629/ST/DBBM/2026, got %s", res.NomorSurat)
	}
	if res.TanggalMulai != "2026-04-08" {
		t.Errorf("expected tanggal_mulai 2026-04-08, got %s", res.TanggalMulai)
	}
	if res.TanggalSelesai != "2026-04-10" {
		t.Errorf("expected tanggal_selesai 2026-04-10, got %s", res.TanggalSelesai)
	}
	if res.LokasiRaw != "Cimahi" {
		t.Errorf("expected lokasi_raw Cimahi, got %s", res.LokasiRaw)
	}
	if res.Tujuan != "Cimahi, Jawa Barat" {
		t.Errorf("expected tujuan auto-matched Cimahi, Jawa Barat, got %s", res.Tujuan)
	}
	if res.Nama == "" || len(res.Nama) < 10 {
		t.Errorf("expected meaningful agenda/nama, got %s", res.Nama)
	}
}

func TestParseSuratUndangan(t *testing.T) {
	knownLocations := []string{
		"DKI Jakarta",
		"Kota Bandung, Jawa Barat",
	}

	res := parser.ParseNaskahDinas(sampleSuratUndangan, knownLocations)

	if res.DocType != "surat_undangan" {
		t.Errorf("expected doc_type surat_undangan, got %s", res.DocType)
	}
	if res.NomorSurat != "73.Und/KS.01/BPH/2026" {
		t.Errorf("expected nomor_surat 73.Und/KS.01/BPH/2026, got %s", res.NomorSurat)
	}
	if res.TanggalMulai != "2026-02-27" {
		t.Errorf("expected tanggal_mulai 2026-02-27, got %s", res.TanggalMulai)
	}
	if res.TanggalSelesai != "2026-02-27" {
		t.Errorf("expected tanggal_selesai 2026-02-27, got %s", res.TanggalSelesai)
	}
	if res.Nama == "" || res.Nama != "Koordinasi Persiapan Monitoring Ramadhan Idul Fitri 2026 dan Buka Puasa Bersama" {
		t.Errorf("expected cleaned agenda, got %s", res.Nama)
	}
	if res.LokasiRaw != "Aula Gedung BPH Migas Lantai Ground Jalan Kapten P. Tendean No. 28, Jakarta Selatan" {
		t.Errorf("expected full address in lokasi_raw, got %s", res.LokasiRaw)
	}
}

func TestParseDateFormats(t *testing.T) {
	tests := []struct {
		input       string
		wantMulai   string
		wantSelesai string
	}{
		{
			input:       "Hari, tanggal : 12 Mei 2026",
			wantMulai:   "2026-05-12",
			wantSelesai: "2026-05-12",
		},
		{
			input:       "Tanggal : 15 - 18 Agustus 2026",
			wantMulai:   "2026-08-15",
			wantSelesai: "2026-08-18",
		},
		{
			input:       "Hari/tanggal : Senin, 28 September 2026 s.d Kamis, 1 Oktober 2026",
			wantMulai:   "2026-09-28",
			wantSelesai: "2026-10-01",
		},
		{
			input:       "Tanggal : 5 s.d 7 November 2026",
			wantMulai:   "2026-11-05",
			wantSelesai: "2026-11-07",
		},
		{
			input:       "hari/tanggal : Selasa s.d. Jumat /17 s.d. 20 November 2026",
			wantMulai:   "2026-11-17",
			wantSelesai: "2026-11-20",
		},
	}

	for _, tt := range tests {
		res := parser.ParseNaskahDinas(tt.input, nil)
		if res.TanggalMulai != tt.wantMulai || res.TanggalSelesai != tt.wantSelesai {
			t.Errorf("for %q got %s..%s, want %s..%s", tt.input, res.TanggalMulai, res.TanggalSelesai, tt.wantMulai, tt.wantSelesai)
		}
	}
}

func TestParseRealUndanganFolder(t *testing.T) {
	files, err := filepath.Glob("../../undangan/*.pdf")
	if err != nil || len(files) == 0 {
		t.Skip("no files in undangan folder")
	}

	knownLocations := []string{
		"Bandung, Jawa Barat",
		"Kota Bandung, Jawa Barat",
		"Cimahi, Jawa Barat",
		"DKI Jakarta",
		"Jakarta Selatan, DKI Jakarta",
	}

	for _, f := range files {
		txt, err := parser.ExtractTextFromPDF(f)
		if err != nil {
			t.Errorf("extract %s err: %v", filepath.Base(f), err)
			continue
		}
		res := parser.ParseNaskahDinas(txt, knownLocations)
		t.Logf("[%s] -> Type: %s | No: %s | Tanggal: %s..%s | Tempat: %s (Matched: %s) | Agenda: %s",
			filepath.Base(f), res.DocType, res.NomorSurat, res.TanggalMulai, res.TanggalSelesai, res.LokasiRaw, res.Tujuan, res.Nama)
	}
}


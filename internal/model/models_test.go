package model

import (
	"testing"
	"time"
)

func TestTripStatus_Berlangsung(t *testing.T) {
	now := time.Date(2026, 11, 24, 12, 0, 0, 0, time.UTC)
	trip := Trip{
		TanggalMulai:   time.Date(2026, 11, 20, 0, 0, 0, 0, time.UTC),
		TanggalSelesai: time.Date(2026, 11, 28, 0, 0, 0, 0, time.UTC),
	}
	if got := trip.StatusAt(now); got != "berlangsung" {
		t.Errorf("expected berlangsung, got %s", got)
	}
}

func TestTripStatus_Berlangsung_StartDay(t *testing.T) {
	now := time.Date(2026, 11, 20, 8, 0, 0, 0, time.UTC)
	trip := Trip{
		TanggalMulai:   time.Date(2026, 11, 20, 0, 0, 0, 0, time.UTC),
		TanggalSelesai: time.Date(2026, 11, 28, 0, 0, 0, 0, time.UTC),
	}
	if got := trip.StatusAt(now); got != "berlangsung" {
		t.Errorf("expected berlangsung on start day, got %s", got)
	}
}

func TestTripStatus_Berlangsung_EndDay(t *testing.T) {
	now := time.Date(2026, 11, 28, 18, 0, 0, 0, time.UTC)
	trip := Trip{
		TanggalMulai:   time.Date(2026, 11, 20, 0, 0, 0, 0, time.UTC),
		TanggalSelesai: time.Date(2026, 11, 28, 0, 0, 0, 0, time.UTC),
	}
	if got := trip.StatusAt(now); got != "berlangsung" {
		t.Errorf("expected berlangsung on end day, got %s", got)
	}
}

func TestTripStatus_UrusBerkas(t *testing.T) {
	now := time.Date(2026, 12, 1, 12, 0, 0, 0, time.UTC)
	trip := Trip{
		TanggalMulai:   time.Date(2026, 11, 20, 0, 0, 0, 0, time.UTC),
		TanggalSelesai: time.Date(2026, 11, 28, 0, 0, 0, 0, time.UTC),
	}
	if got := trip.StatusAt(now); got != "urus_berkas" {
		t.Errorf("expected urus_berkas, got %s", got)
	}
}

func TestTripStatus_Selesai(t *testing.T) {
	now := time.Date(2026, 12, 15, 12, 0, 0, 0, time.UTC)
	uangDinas := int64(5000000)
	dibayar := time.Date(2026, 12, 10, 0, 0, 0, 0, time.UTC)
	trip := Trip{
		TanggalMulai:   time.Date(2026, 11, 20, 0, 0, 0, 0, time.UTC),
		TanggalSelesai: time.Date(2026, 11, 28, 0, 0, 0, 0, time.UTC),
		UangDinas:      &uangDinas,
		TanggalDibayar: &dibayar,
	}
	if got := trip.StatusAt(now); got != "selesai" {
		t.Errorf("expected selesai, got %s", got)
	}
}

func TestTripStatus_UrusBerkas_PartialPayment(t *testing.T) {
	now := time.Date(2026, 12, 1, 12, 0, 0, 0, time.UTC)
	uangDinas := int64(5000000)
	trip := Trip{
		TanggalMulai:   time.Date(2026, 11, 20, 0, 0, 0, 0, time.UTC),
		TanggalSelesai: time.Date(2026, 11, 28, 0, 0, 0, 0, time.UTC),
		UangDinas:      &uangDinas,
		// TanggalDibayar nil
	}
	if got := trip.StatusAt(now); got != "urus_berkas" {
		t.Errorf("expected urus_berkas with partial payment, got %s", got)
	}
}

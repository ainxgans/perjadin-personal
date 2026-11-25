package storage_test

import (
	"bytes"
	"context"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/maulana/perjadin-personal/internal/storage"
)

func TestLocalStorage_SaveAndOpen(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "storage_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	s := storage.NewLocalStorage(tempDir)
	ctx := context.Background()

	content := []byte("%PDF-1.4 mock pdf content")
	storedPath, err := s.Save(ctx, "trips", "undangan.pdf", bytes.NewReader(content))
	if err != nil {
		t.Fatalf("Save failed: %v", err)
	}

	if !strings.HasPrefix(storedPath, "trips/") || !strings.HasSuffix(storedPath, ".pdf") {
		t.Errorf("unexpected storedPath format: %s", storedPath)
	}

	// Verify file exists on disk
	fullPath := filepath.Join(tempDir, storedPath)
	if _, err := os.Stat(fullPath); os.IsNotExist(err) {
		t.Fatalf("file does not exist on disk at %s", fullPath)
	}

	// Read file back via Open
	rc, err := s.Open(ctx, storedPath)
	if err != nil {
		t.Fatalf("Open failed: %v", err)
	}
	defer rc.Close()

	readContent, err := io.ReadAll(rc)
	if err != nil {
		t.Fatalf("read failed: %v", err)
	}
	if !bytes.Equal(readContent, content) {
		t.Errorf("content mismatch: got %q, want %q", string(readContent), string(content))
	}
}

func TestLocalStorage_DirectoryTraversalProtection(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "storage_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	s := storage.NewLocalStorage(tempDir)
	ctx := context.Background()

	// Try directory traversal in Open
	_, err = s.Open(ctx, "../../../etc/passwd")
	if err == nil {
		t.Errorf("expected error for directory traversal, got nil")
	}

	// Try directory traversal in filename
	storedPath, err := s.Save(ctx, "trips", "../../evil.pdf", strings.NewReader("bad"))
	if err != nil {
		t.Fatalf("Save failed: %v", err)
	}
	if strings.Contains(storedPath, "..") {
		t.Errorf("storedPath should not contain relative dots: %s", storedPath)
	}
}

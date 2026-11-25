package storage

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// Storage abstracts file persistence.
// ponytail: local disk storage; swap to rustfs/s3 driver when ready.
type Storage interface {
	Save(ctx context.Context, subfolder string, filename string, r io.Reader) (storedPath string, err error)
	Open(ctx context.Context, storedPath string) (io.ReadCloser, error)
}

type LocalStorage struct {
	baseDir string
}

func NewLocalStorage(baseDir string) *LocalStorage {
	return &LocalStorage{baseDir: baseDir}
}

func (l *LocalStorage) Save(ctx context.Context, subfolder string, filename string, r io.Reader) (string, error) {
	// Sanitize subfolder and filename
	cleanSub := filepath.Clean(filepath.Base(subfolder))
	cleanName := filepath.Base(filename)
	cleanName = strings.ReplaceAll(cleanName, " ", "_")

	// Generate 6-byte random salt
	var randBytes [6]byte
	_, _ = rand.Read(randBytes[:])
	randHex := hex.EncodeToString(randBytes[:])

	uniqueName := fmt.Sprintf("%d_%s_%s", time.Now().Unix(), randHex, cleanName)

	targetDir := filepath.Join(l.baseDir, cleanSub)
	if err := os.MkdirAll(targetDir, 0755); err != nil {
		return "", fmt.Errorf("mkdir %s: %w", targetDir, err)
	}

	targetPath := filepath.Join(targetDir, uniqueName)
	dst, err := os.Create(targetPath)
	if err != nil {
		return "", fmt.Errorf("create file: %w", err)
	}
	defer dst.Close()

	if _, err := io.Copy(dst, r); err != nil {
		return "", fmt.Errorf("write file: %w", err)
	}

	// Stored path relative to baseDir (e.g. "trips/1700000_abc_file.pdf")
	return filepath.Join(cleanSub, uniqueName), nil
}

func (l *LocalStorage) Open(ctx context.Context, storedPath string) (io.ReadCloser, error) {
	cleanPath := filepath.Clean(storedPath)
	if strings.HasPrefix(cleanPath, "..") || filepath.IsAbs(cleanPath) {
		return nil, fmt.Errorf("invalid path: directory traversal attempt")
	}

	fullPath := filepath.Join(l.baseDir, cleanPath)
	// Safety check: ensure resolved path is within baseDir
	rel, err := filepath.Rel(l.baseDir, fullPath)
	if err != nil || strings.HasPrefix(rel, "..") {
		return nil, fmt.Errorf("invalid path: access outside base dir")
	}

	f, err := os.Open(fullPath)
	if err != nil {
		return nil, err
	}
	return f, nil
}

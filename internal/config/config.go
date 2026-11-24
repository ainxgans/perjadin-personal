package config

import (
	"fmt"
	"os"
)

type Config struct {
	DatabaseURL       string
	GoogleClientID    string
	GoogleClientSecret string
	GoogleRedirectURL string
	JWTSecret         string
	Port              string
}

func Load() Config {
	cfg := Config{
		DatabaseURL:       mustEnv("DATABASE_URL"),
		GoogleClientID:    mustEnv("GOOGLE_CLIENT_ID"),
		GoogleClientSecret: mustEnv("GOOGLE_CLIENT_SECRET"),
		GoogleRedirectURL: mustEnv("GOOGLE_REDIRECT_URL"),
		JWTSecret:         mustEnv("JWT_SECRET"),
		Port:              getEnv("PORT", "8080"),
	}
	return cfg
}

func mustEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		panic(fmt.Sprintf("required env var %s is not set", key))
	}
	return v
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

package environment

import (
	"os"
	"path/filepath"
	"strings"
)

type Environment struct {
	Host       string
	Port       string
	DBDSN      string
	DistDir    string
	ContentDir string
}

func Load(rootDir string) Environment {
	return Environment{
		Host:       getEnv("HOST", "127.0.0.1"),
		Port:       getEnv("PORT", "8787"),
		DBDSN:      getEnv("DB_DSN", ""),
		DistDir:    getEnv("DIST_DIR", filepath.Join(rootDir, "dist")),
		ContentDir: getEnv("CONTENT_DIR", filepath.Join(rootDir, "content", "posts")),
	}
}

func getEnv(key string, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}

	return value
}

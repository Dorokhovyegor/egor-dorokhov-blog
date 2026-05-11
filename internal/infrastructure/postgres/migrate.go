package postgres

import (
	"context"
	"fmt"
	"io/fs"
	"sort"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

func Migrate(ctx context.Context, pool *pgxpool.Pool, migrationFS fs.FS) error {
	entries, err := fs.ReadDir(migrationFS, ".")
	if err != nil {
		return fmt.Errorf("read migrations: %w", err)
	}

	var names []string
	for _, entry := range entries {
		name := entry.Name()
		if entry.IsDir() || !strings.HasSuffix(name, ".up.sql") {
			continue
		}
		names = append(names, name)
	}
	sort.Strings(names)

	tx, err := pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin migration transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `
create table if not exists schema_migrations (
  version bigint primary key,
  name text not null unique,
  applied_at timestamptz not null default now()
)
`); err != nil {
		return fmt.Errorf("ensure schema_migrations table: %w", err)
	}

	if _, err := tx.Exec(ctx, `select pg_advisory_xact_lock(4815162342)`); err != nil {
		return fmt.Errorf("acquire migration lock: %w", err)
	}

	for _, name := range names {
		version, err := migrationVersion(name)
		if err != nil {
			return err
		}

		var applied bool
		if err := tx.QueryRow(ctx, `select exists (select 1 from schema_migrations where version = $1)`, version).Scan(&applied); err != nil {
			return fmt.Errorf("check migration %s: %w", name, err)
		}
		if applied {
			continue
		}

		sql, err := fs.ReadFile(migrationFS, name)
		if err != nil {
			return fmt.Errorf("read migration %s: %w", name, err)
		}
		for _, statement := range splitSQLStatements(string(sql)) {
			if _, err := tx.Exec(ctx, statement); err != nil {
				return fmt.Errorf("apply migration %s: %w", name, err)
			}
		}

		if _, err := tx.Exec(ctx, `insert into schema_migrations (version, name) values ($1, $2)`, version, name); err != nil {
			return fmt.Errorf("record migration %s: %w", name, err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit migrations: %w", err)
	}

	return nil
}

func migrationVersion(name string) (int64, error) {
	prefix, _, ok := strings.Cut(name, "_")
	if !ok {
		return 0, fmt.Errorf("parse migration version from %s", name)
	}

	version, err := strconv.ParseInt(prefix, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("parse migration version from %s: %w", name, err)
	}

	return version, nil
}

func splitSQLStatements(sql string) []string {
	parts := strings.Split(sql, ";")
	statements := make([]string, 0, len(parts))
	for _, part := range parts {
		statement := strings.TrimSpace(part)
		if statement == "" {
			continue
		}
		statements = append(statements, statement)
	}

	return statements
}

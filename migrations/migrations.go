package migrations

import "embed"

// Files contains SQL migrations applied by the infrastructure bootstrap.
//
//go:embed *.sql
var Files embed.FS

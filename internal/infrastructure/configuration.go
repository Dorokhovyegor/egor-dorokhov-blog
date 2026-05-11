package infrastructure

import (
	"context"
	"fmt"
	"net"
	"os"

	"egor-dorokhov-blog/internal/domain/engagement"
	"egor-dorokhov-blog/internal/infrastructure/content"
	"egor-dorokhov-blog/internal/infrastructure/environment"
	httpserver "egor-dorokhov-blog/internal/infrastructure/handlers/http"
	"egor-dorokhov-blog/internal/infrastructure/postgres"
	"egor-dorokhov-blog/migrations"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Configuration struct {
	Environment  environment.Environment
	PostgresPool *pgxpool.Pool
	HTTPServer   *httpserver.Server
	Articles     *content.MarkdownRepository
	Engagement   engagement.Repository
}

func NewConfiguration(ctx context.Context) (*Configuration, error) {
	rootDir, err := os.Getwd()
	if err != nil {
		return nil, fmt.Errorf("get working directory: %w", err)
	}

	env := environment.Load(rootDir)

	engagementRepository, pool, err := configureEngagement(ctx, env)
	if err != nil {
		return nil, err
	}

	return &Configuration{
		Environment:  env,
		PostgresPool: pool,
		HTTPServer:   httpserver.New(net.JoinHostPort(env.Host, env.Port)),
		Articles:     content.NewMarkdownRepository(env.ContentDir),
		Engagement:   engagementRepository,
	}, nil
}

func configureEngagement(
	ctx context.Context,
	env environment.Environment,
) (engagement.Repository, *pgxpool.Pool, error) {
	if env.DBDSN == "" {
		return nil, nil, fmt.Errorf("DB_DSN must not be empty")
	}

	pool, err := postgres.NewPool(ctx, env.DBDSN)
	if err != nil {
		return nil, nil, fmt.Errorf("connect to postgres: %w", err)
	}

	if err := postgres.Migrate(ctx, pool, migrations.Files); err != nil {
		pool.Close()
		return nil, nil, fmt.Errorf("migrate postgres: %w", err)
	}

	return postgres.NewEngagementRepository(pool), pool, nil
}

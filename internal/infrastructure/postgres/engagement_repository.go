package postgres

import (
	"context"
	"fmt"
	"time"

	"egor-dorokhov-blog/internal/domain/engagement"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

type EngagementRepository struct {
	pool    *pgxpool.Pool
	timeout time.Duration
}

func NewEngagementRepository(pool *pgxpool.Pool) *EngagementRepository {
	return &EngagementRepository{
		pool:    pool,
		timeout: 5 * time.Second,
	}
}

func (r *EngagementRepository) SiteStats() (engagement.SiteStats, error) {
	ctx, cancel := context.WithTimeout(context.Background(), r.timeout)
	defer cancel()

	return r.siteStats(ctx, r.pool)
}

func (r *EngagementRepository) TrackSiteVisit(visitorID string, pagePath string) (engagement.SiteStats, error) {
	ctx, cancel := context.WithTimeout(context.Background(), r.timeout)
	defer cancel()

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return engagement.SiteStats{}, fmt.Errorf("begin transaction: %w", err)
	}
	defer rollback(ctx, tx)

	if err := touchVisitor(ctx, tx, visitorID); err != nil {
		return engagement.SiteStats{}, err
	}

	if _, err := tx.Exec(
		ctx,
		`insert into blog_site_visits(visitor_id, page_path) values ($1, $2)`,
		visitorID,
		cleanPath(pagePath),
	); err != nil {
		return engagement.SiteStats{}, fmt.Errorf("insert site visit: %w", err)
	}

	stats, err := r.siteStats(ctx, tx)
	if err != nil {
		return engagement.SiteStats{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return engagement.SiteStats{}, fmt.Errorf("commit transaction: %w", err)
	}

	return stats, nil
}

func (r *EngagementRepository) ArticleStats(slugs []string, visitorID string) ([]engagement.ArticleStats, error) {
	ctx, cancel := context.WithTimeout(context.Background(), r.timeout)
	defer cancel()

	rows, err := r.pool.Query(
		ctx,
		`
select
  requested.slug,
  coalesce(stats.reads, 0) as reads,
  coalesce(stats.likes, 0) as likes,
  exists (
    select 1
    from blog_article_likes likes
    where likes.article_slug = requested.slug
      and likes.visitor_id = $2
  ) as liked
from unnest($1::text[]) as requested(slug)
left join blog_article_stats stats on stats.article_slug = requested.slug
`,
		slugs,
		visitorID,
	)
	if err != nil {
		return nil, fmt.Errorf("query article stats: %w", err)
	}
	defer rows.Close()

	stats := make([]engagement.ArticleStats, 0, len(slugs))
	for rows.Next() {
		var item engagement.ArticleStats
		if err := rows.Scan(&item.Slug, &item.Reads, &item.Likes, &item.Liked); err != nil {
			return nil, fmt.Errorf("scan article stats: %w", err)
		}
		stats = append(stats, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate article stats: %w", err)
	}

	return stats, nil
}

func (r *EngagementRepository) TrackArticleRead(
	visitorID string,
	slug string,
	pagePath string,
) (engagement.ArticleStats, error) {
	ctx, cancel := context.WithTimeout(context.Background(), r.timeout)
	defer cancel()

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return engagement.ArticleStats{}, fmt.Errorf("begin transaction: %w", err)
	}
	defer rollback(ctx, tx)

	if err := touchVisitor(ctx, tx, visitorID); err != nil {
		return engagement.ArticleStats{}, err
	}

	if _, err := tx.Exec(
		ctx,
		`insert into blog_article_reads(article_slug, visitor_id, page_path) values ($1, $2, $3)`,
		slug,
		visitorID,
		cleanPath(pagePath),
	); err != nil {
		return engagement.ArticleStats{}, fmt.Errorf("insert article read: %w", err)
	}

	if _, err := tx.Exec(
		ctx,
		`
insert into blog_article_stats(article_slug, reads, likes)
values ($1, 1, 0)
on conflict (article_slug)
do update set
  reads = blog_article_stats.reads + 1,
  updated_at = now()
`,
		slug,
	); err != nil {
		return engagement.ArticleStats{}, fmt.Errorf("upsert article read stats: %w", err)
	}

	stats, err := r.articleStats(ctx, tx, slug, visitorID)
	if err != nil {
		return engagement.ArticleStats{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return engagement.ArticleStats{}, fmt.Errorf("commit transaction: %w", err)
	}

	return stats, nil
}

func (r *EngagementRepository) ToggleArticleLike(visitorID string, slug string) (engagement.ArticleStats, error) {
	ctx, cancel := context.WithTimeout(context.Background(), r.timeout)
	defer cancel()

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return engagement.ArticleStats{}, fmt.Errorf("begin transaction: %w", err)
	}
	defer rollback(ctx, tx)

	if err := touchVisitor(ctx, tx, visitorID); err != nil {
		return engagement.ArticleStats{}, err
	}

	if _, err := tx.Exec(
		ctx,
		`
insert into blog_article_stats(article_slug, reads, likes)
values ($1, 0, 0)
on conflict (article_slug) do nothing
`,
		slug,
	); err != nil {
		return engagement.ArticleStats{}, fmt.Errorf("ensure article stats: %w", err)
	}

	deleteTag, err := tx.Exec(
		ctx,
		`delete from blog_article_likes where article_slug = $1 and visitor_id = $2`,
		slug,
		visitorID,
	)
	if err != nil {
		return engagement.ArticleStats{}, fmt.Errorf("delete article like: %w", err)
	}

	if deleteTag.RowsAffected() == 0 {
		if _, err := tx.Exec(
			ctx,
			`
insert into blog_article_likes(article_slug, visitor_id)
values ($1, $2)
on conflict (article_slug, visitor_id) do nothing
`,
			slug,
			visitorID,
		); err != nil {
			return engagement.ArticleStats{}, fmt.Errorf("insert article like: %w", err)
		}
	}

	if _, err := tx.Exec(
		ctx,
		`
update blog_article_stats
set
  likes = (
    select count(*)
    from blog_article_likes
    where article_slug = $1
  ),
  updated_at = now()
where article_slug = $1
`,
		slug,
	); err != nil {
		return engagement.ArticleStats{}, fmt.Errorf("refresh article like stats: %w", err)
	}

	stats, err := r.articleStats(ctx, tx, slug, visitorID)
	if err != nil {
		return engagement.ArticleStats{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return engagement.ArticleStats{}, fmt.Errorf("commit transaction: %w", err)
	}

	return stats, nil
}

type queryer interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

type execer interface {
	Exec(ctx context.Context, sql string, arguments ...any) (pgconn.CommandTag, error)
}

type tx interface {
	queryer
	execer
	Commit(ctx context.Context) error
	Rollback(ctx context.Context) error
}

func (r *EngagementRepository) siteStats(ctx context.Context, db queryer) (engagement.SiteStats, error) {
	var visitorsTotal int64
	var stats engagement.SiteStats

	if err := db.QueryRow(
		ctx,
		`
select
  (select count(*) from blog_visitors) as visitors_total,
  (select count(*) from blog_site_visits) as visits_total,
  (select coalesce(sum(reads), 0) from blog_article_stats) as article_reads_total
`,
	).Scan(&visitorsTotal, &stats.VisitsTotal, &stats.ArticleReadsTotal); err != nil {
		return engagement.SiteStats{}, fmt.Errorf("query site stats: %w", err)
	}

	stats.VisitorsTotal = int(visitorsTotal)
	return stats, nil
}

func (r *EngagementRepository) articleStats(
	ctx context.Context,
	db queryer,
	slug string,
	visitorID string,
) (engagement.ArticleStats, error) {
	var stats engagement.ArticleStats

	if err := db.QueryRow(
		ctx,
		`
select
  $1::text as slug,
  coalesce(article_stats.reads, 0) as reads,
  coalesce(article_stats.likes, 0) as likes,
  exists (
    select 1
    from blog_article_likes likes
    where likes.article_slug = $1
      and likes.visitor_id = $2
  ) as liked
from (select $1::text as slug) requested
left join blog_article_stats article_stats on article_stats.article_slug = requested.slug
`,
		slug,
		visitorID,
	).Scan(&stats.Slug, &stats.Reads, &stats.Likes, &stats.Liked); err != nil {
		return engagement.ArticleStats{}, fmt.Errorf("query article stats: %w", err)
	}

	return stats, nil
}

func touchVisitor(ctx context.Context, db execer, visitorID string) error {
	if _, err := db.Exec(
		ctx,
		`
insert into blog_visitors(visitor_id)
values ($1)
on conflict (visitor_id)
do update set last_seen_at = now()
`,
		visitorID,
	); err != nil {
		return fmt.Errorf("touch visitor: %w", err)
	}

	return nil
}

func rollback(ctx context.Context, tx tx) {
	_ = tx.Rollback(ctx)
}

func cleanPath(value string) string {
	if len(value) > 500 {
		return value[:500]
	}

	return value
}

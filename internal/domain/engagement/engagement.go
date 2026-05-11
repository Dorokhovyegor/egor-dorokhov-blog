package engagement

type SiteStats struct {
	VisitorsTotal     int   `json:"visitorsTotal"`
	VisitsTotal       int64 `json:"visitsTotal"`
	ArticleReadsTotal int64 `json:"articleReadsTotal"`
}

type ArticleStats struct {
	Slug  string `json:"slug"`
	Reads int64  `json:"reads"`
	Likes int64  `json:"likes"`
	Liked bool   `json:"liked"`
}

type Repository interface {
	SiteStats() (SiteStats, error)
	TrackSiteVisit(visitorID string, path string) (SiteStats, error)
	ArticleStats(slugs []string, visitorID string) ([]ArticleStats, error)
	TrackArticleRead(visitorID string, slug string, path string) (ArticleStats, error)
	ToggleArticleLike(visitorID string, slug string) (ArticleStats, error)
}

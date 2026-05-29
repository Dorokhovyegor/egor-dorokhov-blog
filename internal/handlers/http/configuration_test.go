package httphandlers

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"egor-dorokhov-blog/internal/domain/article"
)

type fakeArticleRepository struct {
	item article.Article
}

func (r fakeArticleRepository) List() ([]article.Article, error) {
	return []article.Article{r.item}, nil
}

func (r fakeArticleRepository) GetBySlug(slug string) (article.Article, bool, error) {
	return r.item, r.item.Slug == article.NormalizeSlug(slug), nil
}

func (r fakeArticleRepository) Tags() ([]article.TagStat, error) {
	return nil, nil
}

func TestMetadataForArticleRequest(t *testing.T) {
	configuration := &Configuration{
		articles: fakeArticleRepository{
			item: article.Article{
				Slug:    "vibe-coding-trash",
				Title:   "Вайбкодинг",
				Excerpt: "Про качество кода, нейронки и вайбкодерское легаси.",
				Tags:    []string{"ии", "vibe_coding", "разработка"},
			},
		},
	}

	request := httptest.NewRequest(http.MethodGet, "https://eidorokhov.ru/blog/vibe-coding-trash", nil)
	metadata := configuration.metadataForRequest(request)

	if metadata.Title != "Вайбкодинг | Первая комната" {
		t.Fatalf("unexpected title: %q", metadata.Title)
	}
	if metadata.Description != "Про качество кода, нейронки и вайбкодерское легаси." {
		t.Fatalf("unexpected description: %q", metadata.Description)
	}
	if metadata.CanonicalURL != "https://eidorokhov.ru/blog/vibe-coding-trash" {
		t.Fatalf("unexpected canonical url: %q", metadata.CanonicalURL)
	}
	if metadata.Type != "article" {
		t.Fatalf("unexpected page type: %q", metadata.Type)
	}
	if !strings.Contains(metadata.Keywords, "vibe_coding") || !strings.Contains(metadata.Keywords, "Android") {
		t.Fatalf("unexpected keywords: %q", metadata.Keywords)
	}
}

func TestRenderIndexHTMLReplacesMetadata(t *testing.T) {
	document := `<html><head><title>Old</title><meta name="description" content="old" /><meta name="keywords" content="old" /><link rel="canonical" href="https://example.com/" /><meta property="og:type" content="website" /><meta property="og:title" content="old" /><meta property="og:description" content="old" /><meta property="og:url" content="https://example.com/" /><meta property="og:image" content="old" /><meta name="twitter:title" content="old" /><meta name="twitter:description" content="old" /><meta name="twitter:image" content="old" /></head></html>`

	rendered := renderIndexHTML(document, pageMetadata{
		Title:        "Новый заголовок",
		Description:  "Новое описание",
		Keywords:     "android, собеседования",
		CanonicalURL: "https://eidorokhov.ru/blog/test",
		Type:         "article",
	})

	for _, expected := range []string{
		"<title>Новый заголовок</title>",
		`<meta name="description" content="Новое описание" />`,
		`<meta name="keywords" content="android, собеседования" />`,
		`<link rel="canonical" href="https://eidorokhov.ru/blog/test" />`,
		`<meta property="og:type" content="article" />`,
		`<meta property="og:title" content="Новый заголовок" />`,
	} {
		if !strings.Contains(rendered, expected) {
			t.Fatalf("rendered html does not contain %q: %s", expected, rendered)
		}
	}
}

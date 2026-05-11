package content

import (
	"os"
	"path/filepath"
	"sort"
	"strings"

	"egor-dorokhov-blog/internal/domain/article"
)

type MarkdownRepository struct {
	contentDir string
}

func NewMarkdownRepository(contentDir string) *MarkdownRepository {
	return &MarkdownRepository{contentDir: contentDir}
}

func (r *MarkdownRepository) List() ([]article.Article, error) {
	items, err := r.loadArticles()
	if err != nil {
		return nil, err
	}

	return items, nil
}

func (r *MarkdownRepository) GetBySlug(slug string) (article.Article, bool, error) {
	normalizedSlug := article.NormalizeSlug(slug)
	items, err := r.loadArticles()
	if err != nil {
		return article.Article{}, false, err
	}

	for _, item := range items {
		if item.Slug == normalizedSlug {
			return item, true, nil
		}
	}

	return article.Article{}, false, nil
}

func (r *MarkdownRepository) Tags() ([]article.TagStat, error) {
	items, err := r.loadArticles()
	if err != nil {
		return nil, err
	}

	counts := map[string]int{}
	for _, item := range items {
		for _, tag := range item.Tags {
			counts[tag]++
		}
	}

	tags := make([]article.TagStat, 0, len(counts))
	for name, count := range counts {
		tags = append(tags, article.TagStat{Name: name, Count: count})
	}

	sort.Slice(tags, func(left int, right int) bool {
		if tags[left].Count != tags[right].Count {
			return tags[left].Count > tags[right].Count
		}

		return strings.ToLower(tags[left].Name) < strings.ToLower(tags[right].Name)
	})

	return tags, nil
}

func (r *MarkdownRepository) loadArticles() ([]article.Article, error) {
	files, err := filepath.Glob(filepath.Join(r.contentDir, "*.md"))
	if err != nil {
		return nil, err
	}

	items := make([]article.Article, 0, len(files))
	seenSlugs := map[string]bool{}

	for _, file := range files {
		raw, err := os.ReadFile(file)
		if err != nil {
			return nil, err
		}

		item := parseArticle(file, string(raw))
		if !item.Published || seenSlugs[item.Slug] {
			continue
		}

		seenSlugs[item.Slug] = true
		items = append(items, item)
	}

	sort.Slice(items, func(left int, right int) bool {
		return items[left].Date > items[right].Date
	})

	return items, nil
}

func parseArticle(filePath string, raw string) article.Article {
	frontmatter, content := parseFrontmatter(raw)
	fileSlug := strings.TrimSuffix(filepath.Base(filePath), filepath.Ext(filePath))
	slug := article.NormalizeSlug(firstNonEmpty(frontmatter["slug"], fileSlug))

	return article.Article{
		Slug:      slug,
		Title:     firstNonEmpty(frontmatter["title"], slug),
		Excerpt:   strings.TrimSpace(frontmatter["excerpt"]),
		Date:      firstNonEmpty(frontmatter["date"], "1970-01-01"),
		Tags:      parseTags(frontmatter["tags"]),
		Published: strings.ToLower(strings.TrimSpace(frontmatter["published"])) != "false",
		Content:   strings.TrimSpace(content),
	}
}

func parseFrontmatter(raw string) (map[string]string, string) {
	frontmatter := map[string]string{}
	normalizedRaw := strings.ReplaceAll(raw, "\r\n", "\n")

	if !strings.HasPrefix(normalizedRaw, "---\n") {
		return frontmatter, normalizedRaw
	}

	rest := strings.TrimPrefix(normalizedRaw, "---\n")
	endIndex := strings.Index(rest, "\n---")
	if endIndex < 0 {
		return frontmatter, normalizedRaw
	}

	frontmatterText := rest[:endIndex]
	content := strings.TrimPrefix(rest[endIndex:], "\n---")
	content = strings.TrimPrefix(content, "\n")

	var currentKey string
	for _, line := range strings.Split(frontmatterText, "\n") {
		trimmedLine := strings.TrimSpace(line)
		if trimmedLine == "" {
			continue
		}

		if strings.HasPrefix(trimmedLine, "- ") && currentKey == "tags" {
			value := trimQuotes(strings.TrimSpace(strings.TrimPrefix(trimmedLine, "- ")))
			if value != "" {
				if frontmatter["tags"] != "" {
					frontmatter["tags"] += ","
				}
				frontmatter["tags"] += value
			}
			continue
		}

		key, value, ok := strings.Cut(trimmedLine, ":")
		if !ok {
			continue
		}

		key = strings.TrimSpace(key)
		value = strings.TrimSpace(value)
		currentKey = ""

		switch key {
		case "slug", "title", "excerpt", "date", "published":
			frontmatter[key] = trimQuotes(value)
		case "tags":
			currentKey = "tags"
			frontmatter[key] = trimQuotes(value)
		}
	}

	return frontmatter, content
}

func parseTags(value string) []string {
	value = strings.TrimSpace(value)
	value = strings.TrimPrefix(value, "[")
	value = strings.TrimSuffix(value, "]")

	if value == "" {
		return []string{}
	}

	rawTags := strings.Split(value, ",")
	tags := make([]string, 0, len(rawTags))
	for _, rawTag := range rawTags {
		tag := trimQuotes(rawTag)
		if tag != "" {
			tags = append(tags, tag)
		}
	}

	return tags
}

func trimQuotes(value string) string {
	return strings.Trim(strings.TrimSpace(value), `"'`)
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value != "" {
			return value
		}
	}

	return ""
}

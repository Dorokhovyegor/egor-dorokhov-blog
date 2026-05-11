package article

import (
	"strings"
	"unicode"
)

type Article struct {
	Slug      string   `json:"slug"`
	Title     string   `json:"title"`
	Excerpt   string   `json:"excerpt"`
	Date      string   `json:"date"`
	Tags      []string `json:"tags"`
	Published bool     `json:"published"`
	Content   string   `json:"content"`
}

type TagStat struct {
	Name  string `json:"name"`
	Count int    `json:"count"`
}

type Repository interface {
	List() ([]Article, error)
	GetBySlug(slug string) (Article, bool, error)
	Tags() ([]TagStat, error)
}

func NormalizeSlug(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))

	var builder strings.Builder
	previousWasHyphen := false

	for _, char := range value {
		switch {
		case unicode.IsSpace(char) || char == '-':
			if !previousWasHyphen && builder.Len() > 0 {
				builder.WriteRune('-')
				previousWasHyphen = true
			}
		case unicode.IsLetter(char) || unicode.IsDigit(char) || char == '_':
			builder.WriteRune(char)
			previousWasHyphen = false
		}
	}

	return strings.Trim(builder.String(), "-")
}

func HasTag(item Article, tag string) bool {
	normalizedTag := strings.ToLower(strings.TrimSpace(tag))

	for _, articleTag := range item.Tags {
		if strings.ToLower(strings.TrimSpace(articleTag)) == normalizedTag {
			return true
		}
	}

	return false
}

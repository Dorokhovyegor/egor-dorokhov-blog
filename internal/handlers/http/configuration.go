package httphandlers

import (
	"encoding/json"
	"html"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"strings"

	"egor-dorokhov-blog/internal/domain/article"
	"egor-dorokhov-blog/internal/domain/engagement"
)

type Configuration struct {
	articles   article.Repository
	engagement engagement.Repository
	distDir    string
}

type pageMetadata struct {
	Title        string
	Description  string
	Keywords     string
	CanonicalURL string
	Type         string
}

var (
	visitorIDPattern = regexp.MustCompile(`^[0-9a-fA-F-]{20,80}$`)
	slugPattern      = regexp.MustCompile(`^[\pL\pN_-]{1,160}$`)
	titleTagPattern  = regexp.MustCompile(`(?is)<title>.*?</title>`)
)

const (
	siteName               = "Первая комната"
	siteOrigin             = "https://eidorokhov.ru"
	defaultPageTitle       = siteName + " | IT-блог о разработке и карьере"
	defaultPageDescription = "Блог о разработке, Android, Kotlin, собеседованиях, IT-карьере, ИИ, удаленке и инженерной практике."
	defaultPageKeywords    = "разработка, Android, Kotlin, coroutines, собеседования, IT-карьера, зарплата, удаленка, выгорание, ИИ, нейронки, vibe coding"
	defaultImageURL        = siteOrigin + "/uploads/first-room-avatar.jpg"
)

func NewConfiguration(
	articles article.Repository,
	engagement engagement.Repository,
	distDir string,
) *Configuration {
	return &Configuration{
		articles:   articles,
		engagement: engagement,
		distDir:    distDir,
	}
}

func (c *Configuration) Register(mux *http.ServeMux) {
	mux.HandleFunc("/api/", c.handleAPI)
	mux.HandleFunc("/", c.handleStatic)
}

func (c *Configuration) handleAPI(response http.ResponseWriter, request *http.Request) {
	if request.Method == http.MethodOptions {
		response.WriteHeader(http.StatusNoContent)
		return
	}

	if isWriteMethod(request.Method) && isCrossOriginRequest(request) {
		writeError(response, http.StatusForbidden, "cross-origin writes are not allowed")
		return
	}

	setAPIHeaders(response)

	switch {
	case request.Method == http.MethodGet && request.URL.Path == "/api/health":
		writeJSON(response, http.StatusOK, map[string]bool{"ok": true})
	case request.Method == http.MethodGet && request.URL.Path == "/api/articles":
		c.handleArticles(response, request)
	case request.Method == http.MethodGet && request.URL.Path == "/api/tags":
		c.handleTags(response)
	case request.Method == http.MethodGet && strings.HasPrefix(request.URL.Path, "/api/articles/"):
		c.handleArticle(response, request)
	case request.Method == http.MethodGet && request.URL.Path == "/api/engagement/site":
		c.handleSiteStats(response)
	case request.Method == http.MethodPost && request.URL.Path == "/api/engagement/site-visit":
		c.handleSiteVisit(response, request)
	case request.Method == http.MethodPost && request.URL.Path == "/api/engagement/articles/stats":
		c.handleArticleStats(response, request)
	case request.Method == http.MethodPost && request.URL.Path == "/api/engagement/articles/read":
		c.handleArticleRead(response, request)
	case request.Method == http.MethodPost && request.URL.Path == "/api/engagement/articles/like":
		c.handleArticleLike(response, request)
	default:
		writeError(response, http.StatusNotFound, "api route not found")
	}
}

func (c *Configuration) handleArticles(response http.ResponseWriter, request *http.Request) {
	items, err := c.articles.List()
	if err != nil {
		writeError(response, http.StatusInternalServerError, "could not load articles")
		return
	}

	tag := strings.TrimSpace(request.URL.Query().Get("tag"))
	if tag != "" {
		filtered := make([]article.Article, 0, len(items))
		for _, item := range items {
			if article.HasTag(item, tag) {
				filtered = append(filtered, item)
			}
		}
		items = filtered
	}

	writeJSON(response, http.StatusOK, items)
}

func (c *Configuration) handleArticle(response http.ResponseWriter, request *http.Request) {
	rawSlug := strings.TrimPrefix(request.URL.Path, "/api/articles/")
	slug, err := url.PathUnescape(rawSlug)
	if err != nil || !isValidSlug(slug) {
		writeError(response, http.StatusBadRequest, "invalid article slug")
		return
	}

	item, found, err := c.articles.GetBySlug(slug)
	if err != nil {
		writeError(response, http.StatusInternalServerError, "could not load article")
		return
	}
	if !found {
		writeError(response, http.StatusNotFound, "article not found")
		return
	}

	writeJSON(response, http.StatusOK, item)
}

func (c *Configuration) handleTags(response http.ResponseWriter) {
	tags, err := c.articles.Tags()
	if err != nil {
		writeError(response, http.StatusInternalServerError, "could not load tags")
		return
	}

	writeJSON(response, http.StatusOK, tags)
}

func (c *Configuration) handleSiteStats(response http.ResponseWriter) {
	stats, err := c.engagement.SiteStats()
	if err != nil {
		writeError(response, http.StatusInternalServerError, "could not load site stats")
		return
	}

	writeJSON(response, http.StatusOK, stats)
}

func (c *Configuration) handleSiteVisit(response http.ResponseWriter, request *http.Request) {
	var body struct {
		VisitorID string `json:"visitorId"`
		Path      string `json:"path"`
	}

	if !readRequestJSON(response, request, &body) {
		return
	}
	if !isValidVisitorID(body.VisitorID) {
		writeError(response, http.StatusBadRequest, "visitorId is required")
		return
	}

	stats, err := c.engagement.TrackSiteVisit(body.VisitorID, body.Path)
	if err != nil {
		writeError(response, http.StatusInternalServerError, "could not save visit")
		return
	}

	writeJSON(response, http.StatusOK, stats)
}

func (c *Configuration) handleArticleStats(response http.ResponseWriter, request *http.Request) {
	var body struct {
		Slugs     []string `json:"slugs"`
		VisitorID string   `json:"visitorId"`
	}

	if !readRequestJSON(response, request, &body) {
		return
	}

	slugs := make([]string, 0, len(body.Slugs))
	for _, slug := range body.Slugs {
		if isValidSlug(slug) {
			slugs = append(slugs, slug)
		}
	}

	stats, err := c.engagement.ArticleStats(slugs, body.VisitorID)
	if err != nil {
		writeError(response, http.StatusInternalServerError, "could not load article stats")
		return
	}

	writeJSON(response, http.StatusOK, stats)
}

func (c *Configuration) handleArticleRead(response http.ResponseWriter, request *http.Request) {
	var body struct {
		VisitorID string `json:"visitorId"`
		Slug      string `json:"slug"`
		Path      string `json:"path"`
	}

	if !readRequestJSON(response, request, &body) {
		return
	}
	if !isValidVisitorID(body.VisitorID) || !isValidSlug(body.Slug) {
		writeError(response, http.StatusBadRequest, "visitorId and slug are required")
		return
	}
	if !c.articleExists(response, body.Slug) {
		return
	}

	stats, err := c.engagement.TrackArticleRead(body.VisitorID, body.Slug, body.Path)
	if err != nil {
		writeError(response, http.StatusInternalServerError, "could not save article read")
		return
	}

	writeJSON(response, http.StatusOK, stats)
}

func (c *Configuration) handleArticleLike(response http.ResponseWriter, request *http.Request) {
	var body struct {
		VisitorID string `json:"visitorId"`
		Slug      string `json:"slug"`
	}

	if !readRequestJSON(response, request, &body) {
		return
	}
	if !isValidVisitorID(body.VisitorID) || !isValidSlug(body.Slug) {
		writeError(response, http.StatusBadRequest, "visitorId and slug are required")
		return
	}
	if !c.articleExists(response, body.Slug) {
		return
	}

	stats, err := c.engagement.ToggleArticleLike(body.VisitorID, body.Slug)
	if err != nil {
		writeError(response, http.StatusInternalServerError, "could not save article like")
		return
	}

	writeJSON(response, http.StatusOK, stats)
}

func setAPIHeaders(response http.ResponseWriter) {
	response.Header().Set("Content-Type", "application/json; charset=utf-8")
	response.Header().Set("Cache-Control", "no-store")
}

func readRequestJSON(response http.ResponseWriter, request *http.Request, target any) bool {
	defer request.Body.Close()

	decoder := json.NewDecoder(http.MaxBytesReader(response, request.Body, 64*1024))
	decoder.DisallowUnknownFields()

	if err := decoder.Decode(target); err != nil {
		writeError(response, http.StatusBadRequest, "invalid json body")
		return false
	}

	return true
}

func writeJSON(response http.ResponseWriter, statusCode int, payload any) {
	response.WriteHeader(statusCode)
	if err := json.NewEncoder(response).Encode(payload); err != nil {
		http.Error(response, "could not write json response", http.StatusInternalServerError)
	}
}

func writeError(response http.ResponseWriter, statusCode int, message string) {
	writeJSON(response, statusCode, map[string]string{"error": message})
}

func (c *Configuration) handleStatic(response http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet && request.Method != http.MethodHead {
		http.Error(response, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	cleanURLPath := path.Clean("/" + request.URL.Path)
	if cleanURLPath == "/" {
		cleanURLPath = "/index.html"
	}

	requestedFile := filepath.Join(c.distDir, filepath.FromSlash(strings.TrimPrefix(cleanURLPath, "/")))
	if !isInsideDir(c.distDir, requestedFile) {
		http.Error(response, "bad request", http.StatusBadRequest)
		return
	}

	if fileInfo, err := os.Stat(requestedFile); err == nil && !fileInfo.IsDir() {
		http.ServeFile(response, request, requestedFile)
		return
	}

	indexFile := filepath.Join(c.distDir, "index.html")
	if _, err := os.Stat(indexFile); err != nil {
		http.Error(response, "run npm run build before starting the server", http.StatusNotFound)
		return
	}

	c.serveIndex(response, request, indexFile)
}

func (c *Configuration) serveIndex(response http.ResponseWriter, request *http.Request, indexFile string) {
	rawHTML, err := os.ReadFile(indexFile)
	if err != nil {
		http.Error(response, "could not read index.html", http.StatusInternalServerError)
		return
	}

	response.Header().Set("Content-Type", "text/html; charset=utf-8")
	if request.Method == http.MethodHead {
		return
	}

	if _, err := response.Write([]byte(renderIndexHTML(string(rawHTML), c.metadataForRequest(request)))); err != nil {
		http.Error(response, "could not write index.html", http.StatusInternalServerError)
	}
}

func (c *Configuration) metadataForRequest(request *http.Request) pageMetadata {
	cleanURLPath := path.Clean("/" + request.URL.Path)
	if cleanURLPath == "/index.html" {
		cleanURLPath = "/"
	}

	metadata := pageMetadata{
		Title:        defaultPageTitle,
		Description:  defaultPageDescription,
		Keywords:     defaultPageKeywords,
		CanonicalURL: siteOrigin + canonicalPath(request, cleanURLPath),
		Type:         "website",
	}

	if cleanURLPath == "/" || cleanURLPath == "/blog" {
		metadata.CanonicalURL = siteOrigin + "/"
		return metadata
	}

	if strings.HasPrefix(cleanURLPath, "/blog/tag/") {
		tag := strings.TrimSpace(strings.TrimPrefix(cleanURLPath, "/blog/tag/"))
		if decodedTag, err := url.PathUnescape(tag); err == nil && decodedTag != "" {
			metadata.Title = "#" + decodedTag + " | " + siteName
			metadata.Description = "Статьи блога «" + siteName + "» по теме «" + decodedTag + "»."
			metadata.Keywords = decodedTag + ", " + defaultPageKeywords
		}
		return metadata
	}

	if strings.HasPrefix(cleanURLPath, "/blog/") {
		rawSlug := strings.TrimPrefix(cleanURLPath, "/blog/")
		if strings.Contains(rawSlug, "/") {
			return metadata
		}

		slug, err := url.PathUnescape(rawSlug)
		if err != nil || !isValidSlug(slug) {
			return metadata
		}

		item, found, err := c.articles.GetBySlug(slug)
		if err != nil || !found {
			return metadata
		}

		metadata.Title = item.Title + " | " + siteName
		metadata.Description = firstNonEmpty(item.Excerpt, defaultPageDescription)
		metadata.Keywords = articleKeywords(item.Tags)
		metadata.Type = "article"
	}

	return metadata
}

func canonicalPath(request *http.Request, cleanURLPath string) string {
	if cleanURLPath == "/" {
		return "/"
	}

	escapedPath := request.URL.EscapedPath()
	if escapedPath == "" || escapedPath == "/" || escapedPath == "/index.html" {
		return cleanURLPath
	}

	return path.Clean("/" + escapedPath)
}

func renderIndexHTML(document string, metadata pageMetadata) string {
	document = titleTagPattern.ReplaceAllLiteralString(
		document,
		"<title>"+html.EscapeString(metadata.Title)+"</title>",
	)
	document = replaceMetaName(document, "description", metadata.Description)
	document = replaceMetaName(document, "keywords", metadata.Keywords)
	document = replaceMetaProperty(document, "og:type", metadata.Type)
	document = replaceMetaProperty(document, "og:title", metadata.Title)
	document = replaceMetaProperty(document, "og:description", metadata.Description)
	document = replaceMetaProperty(document, "og:url", metadata.CanonicalURL)
	document = replaceMetaProperty(document, "og:image", defaultImageURL)
	document = replaceMetaName(document, "twitter:title", metadata.Title)
	document = replaceMetaName(document, "twitter:description", metadata.Description)
	document = replaceMetaName(document, "twitter:image", defaultImageURL)
	document = replaceCanonicalURL(document, metadata.CanonicalURL)

	return document
}

func replaceMetaName(document string, name string, content string) string {
	pattern := regexp.MustCompile(`<meta\s+name="` + regexp.QuoteMeta(name) + `"\s+content="[^"]*"\s*/?>`)
	replacement := `<meta name="` + html.EscapeString(name) + `" content="` + html.EscapeString(content) + `" />`

	return pattern.ReplaceAllLiteralString(document, replacement)
}

func replaceMetaProperty(document string, property string, content string) string {
	pattern := regexp.MustCompile(`<meta\s+property="` + regexp.QuoteMeta(property) + `"\s+content="[^"]*"\s*/?>`)
	replacement := `<meta property="` + html.EscapeString(property) + `" content="` + html.EscapeString(content) + `" />`

	return pattern.ReplaceAllLiteralString(document, replacement)
}

func replaceCanonicalURL(document string, canonicalURL string) string {
	pattern := regexp.MustCompile(`<link\s+rel="canonical"\s+href="[^"]*"\s*/?>`)
	replacement := `<link rel="canonical" href="` + html.EscapeString(canonicalURL) + `" />`

	return pattern.ReplaceAllLiteralString(document, replacement)
}

func isInsideDir(parent string, child string) bool {
	parentAbs, err := filepath.Abs(parent)
	if err != nil {
		return false
	}

	childAbs, err := filepath.Abs(child)
	if err != nil {
		return false
	}

	relativePath, err := filepath.Rel(parentAbs, childAbs)
	if err != nil {
		return false
	}

	return relativePath == "." || !strings.HasPrefix(relativePath, "..")
}

func isValidVisitorID(value string) bool {
	return visitorIDPattern.MatchString(value)
}

func isValidSlug(value string) bool {
	return slugPattern.MatchString(value)
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

func articleKeywords(tags []string) string {
	tagKeywords := strings.TrimSpace(strings.Join(tags, ", "))
	if tagKeywords == "" {
		return defaultPageKeywords
	}

	return tagKeywords + ", " + defaultPageKeywords
}

func (c *Configuration) articleExists(response http.ResponseWriter, slug string) bool {
	_, found, err := c.articles.GetBySlug(slug)
	if err != nil {
		writeError(response, http.StatusInternalServerError, "could not validate article")
		return false
	}
	if !found {
		writeError(response, http.StatusNotFound, "article not found")
		return false
	}

	return true
}

func isWriteMethod(method string) bool {
	return method != http.MethodGet && method != http.MethodHead && method != http.MethodOptions
}

func isCrossOriginRequest(request *http.Request) bool {
	origin := request.Header.Get("Origin")
	if origin == "" {
		return false
	}

	originURL, err := url.Parse(origin)
	if err != nil {
		return true
	}

	return !strings.EqualFold(originURL.Host, request.Host)
}

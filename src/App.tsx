import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArticleList } from "./components/ArticleList";
import { ArticleView } from "./components/ArticleView";
import { BlogSidebar } from "./components/BlogSidebar";
import { Article, TagItem, filterArticlesByTag, findArticleBySlug, getArticles, getTags } from "./lib/articles";
import {
  ArticleStats,
  getArticleStats,
  trackArticleRead,
  trackSiteVisit,
  toggleArticleLike
} from "./lib/engagement";

const safeDecode = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const SITE_NAME = "Первая комната";
const SITE_ORIGIN = "https://eidorokhov.ru";
const DEFAULT_PAGE_TITLE = `${SITE_NAME} | IT-блог о разработке и карьере`;
const DEFAULT_PAGE_DESCRIPTION =
  "Блог о разработке, Android, Kotlin, собеседованиях, IT-карьере, ИИ, удаленке и инженерной практике.";
const DEFAULT_PAGE_KEYWORDS =
  "разработка, Android, Kotlin, coroutines, собеседования, IT-карьера, зарплата, удаленка, выгорание, ИИ, нейронки, vibe coding";
const DEFAULT_IMAGE_URL = `${SITE_ORIGIN}/uploads/first-room-avatar.jpg`;

const savedScrollPositions = new Map<string, number>();

const getScrollKey = (pathname: string) => {
  const normalizedPath = pathname.replace(/\/+$/g, "") || "/";

  if (normalizedPath === "/" || normalizedPath === "/blog") {
    return "/blog";
  }

  return normalizedPath;
};

const usePathname = () => {
  const [path, setPath] = useState(() => window.location.pathname || "/");
  const pathRef = useRef(path);

  useEffect(() => {
    const onPopState = () => {
      savedScrollPositions.set(getScrollKey(pathRef.current), window.scrollY);

      const nextPath = window.location.pathname || "/";
      pathRef.current = nextPath;
      setPath(nextPath);
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  return path;
};

const navigate = (to: string) => {
  if (to === window.location.pathname) {
    return;
  }

  savedScrollPositions.set(getScrollKey(window.location.pathname || "/"), window.scrollY);
  window.history.pushState({}, "", to);
  window.dispatchEvent(new PopStateEvent("popstate"));
};

const setMetaContent = (selector: string, content: string) => {
  const element = document.head.querySelector<HTMLMetaElement>(selector);

  if (element) {
    element.content = content;
  }
};

const setCanonicalUrl = (url: string) => {
  const element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');

  if (element) {
    element.href = url;
  }
};

const setPageMetadata = ({
  title,
  description,
  keywords,
  canonicalUrl,
  type = "website"
}: {
  title: string;
  description: string;
  keywords: string;
  canonicalUrl: string;
  type?: "article" | "website";
}) => {
  document.title = title;
  setCanonicalUrl(canonicalUrl);
  setMetaContent('meta[name="description"]', description);
  setMetaContent('meta[name="keywords"]', keywords);
  setMetaContent('meta[property="og:type"]', type);
  setMetaContent('meta[property="og:title"]', title);
  setMetaContent('meta[property="og:description"]', description);
  setMetaContent('meta[property="og:url"]', canonicalUrl);
  setMetaContent('meta[property="og:image"]', DEFAULT_IMAGE_URL);
  setMetaContent('meta[name="twitter:title"]', title);
  setMetaContent('meta[name="twitter:description"]', description);
  setMetaContent('meta[name="twitter:image"]', DEFAULT_IMAGE_URL);
};

const App = () => {
  const pathname = usePathname();
  const [articles, setArticles] = useState<Article[]>([]);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [isContentLoading, setIsContentLoading] = useState(true);
  const [contentError, setContentError] = useState<string | null>(null);
  const articleSlugs = useMemo(() => articles.map((item) => item.slug), [articles]);
  const [articleStats, setArticleStats] = useState<Record<string, ArticleStats>>({});
  const [pendingLikeSlugs, setPendingLikeSlugs] = useState<Set<string>>(() => new Set());

  const segments = pathname
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .filter(Boolean);

  const isRoot = segments.length === 0;
  const isBlogList = segments[0] === "blog" && segments.length === 1;
  const isTagPage = segments[0] === "blog" && segments[1] === "tag" && Boolean(segments[2]);
  const isArticlePage = segments[0] === "blog" && segments.length === 2 && segments[1] !== "tag";

  const activeTag = isTagPage ? safeDecode(segments[2]) : undefined;
  const listItems = useMemo(
    () => (activeTag ? filterArticlesByTag(articles, activeTag) : articles),
    [activeTag, articles]
  );
  const article = isArticlePage ? findArticleBySlug(articles, safeDecode(segments[1])) : undefined;
  const articleSlug = article?.slug;
  const articleIndex = article ? articles.findIndex((item) => item.slug === article.slug) : -1;
  const previousArticle = articleIndex > 0 ? articles[articleIndex - 1] : undefined;
  const nextArticle = articleIndex >= 0 && articleIndex < articles.length - 1 ? articles[articleIndex + 1] : undefined;

  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
  }, []);

  useLayoutEffect(() => {
    if (isContentLoading) {
      return;
    }

    const currentScrollKey = getScrollKey(pathname);
    const nextScrollY = savedScrollPositions.get(currentScrollKey) ?? 0;

    window.requestAnimationFrame(() => {
      window.scrollTo({ left: 0, top: nextScrollY, behavior: "auto" });
    });
  }, [isContentLoading, pathname]);

  useEffect(() => {
    let isMounted = true;

    const loadContent = async () => {
      setIsContentLoading(true);
      setContentError(null);

      try {
        const [nextArticles, nextTags] = await Promise.all([getArticles(), getTags()]);

        if (!isMounted) {
          return;
        }

        setArticles(nextArticles);
        setTags(nextTags);
      } catch {
        if (!isMounted) {
          return;
        }

        setContentError("Попробуй обновить страницу чуть позже.");
      } finally {
        if (isMounted) {
          setIsContentLoading(false);
        }
      }
    };

    void loadContent();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadEngagement = async () => {
      const [, stats] = await Promise.all([
        trackSiteVisit(window.location.pathname),
        getArticleStats(articleSlugs)
      ]);

      if (!isMounted) {
        return;
      }

      setArticleStats(
        stats.reduce<Record<string, ArticleStats>>((acc, item) => {
          acc[item.slug] = item;
          return acc;
        }, {})
      );
    };

    void loadEngagement();

    return () => {
      isMounted = false;
    };
  }, [articleSlugs]);

  useEffect(() => {
    if (!articleSlug) {
      return;
    }

    let isMounted = true;
    const readTimer = window.setTimeout(() => {
      const registerRead = async () => {
        const stats = await trackArticleRead(articleSlug, window.location.pathname);

        if (!isMounted) {
          return;
        }

        setArticleStats((current) => ({
          ...current,
          [stats.slug]: stats
        }));
      };

      void registerRead();
    }, 900);

    return () => {
      isMounted = false;
      window.clearTimeout(readTimer);
    };
  }, [articleSlug]);

  useEffect(() => {
    const canonicalUrl = `${SITE_ORIGIN}${window.location.pathname}`;

    if (article) {
      setPageMetadata({
        title: `${article.title} | ${SITE_NAME}`,
        description: article.excerpt || DEFAULT_PAGE_DESCRIPTION,
        keywords: [article.tags.join(", "), DEFAULT_PAGE_KEYWORDS].filter(Boolean).join(", "),
        canonicalUrl,
        type: "article"
      });
      return;
    }

    if (activeTag) {
      setPageMetadata({
        title: `#${activeTag} | ${SITE_NAME}`,
        description: `Статьи блога «${SITE_NAME}» по теме «${activeTag}».`,
        keywords: `${activeTag}, ${DEFAULT_PAGE_KEYWORDS}`,
        canonicalUrl
      });
      return;
    }

    setPageMetadata({
      title: DEFAULT_PAGE_TITLE,
      description: DEFAULT_PAGE_DESCRIPTION,
      keywords: DEFAULT_PAGE_KEYWORDS,
      canonicalUrl: `${SITE_ORIGIN}/`
    });
  }, [activeTag, article]);

  const handleToggleLike = (slug: string) => {
    if (pendingLikeSlugs.has(slug)) {
      return;
    }

    setPendingLikeSlugs((current) => new Set(current).add(slug));

    void toggleArticleLike(slug)
      .then((stats) => {
        setArticleStats((current) => ({
          ...current,
          [stats.slug]: stats
        }));
      })
      .finally(() => {
        setPendingLikeSlugs((current) => {
          const next = new Set(current);
          next.delete(slug);
          return next;
        });
      });
  };

  const renderContent = () => {
    if (isContentLoading) {
      return (
        <section className="rounded-3xl border border-line/70 bg-white p-10 text-ink/60 shadow-soft">
          Загружаю статьи...
        </section>
      );
    }

    if (contentError) {
      return (
        <section className="rounded-3xl border border-line/70 bg-white p-10 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/50">Не получилось</p>
          <h2 className="mt-3 text-2xl font-semibold text-ink">Статьи не загрузились</h2>
          <p className="mt-3 text-sm text-ink/65">{contentError}</p>
        </section>
      );
    }

    if (isRoot || isBlogList || isTagPage) {
      return (
        <ArticleList
          items={listItems}
          activeTag={activeTag}
          onOpenArticle={(slug) => navigate(`/blog/${encodeURIComponent(slug)}`)}
          statsBySlug={articleStats}
        />
      );
    }

    if (isArticlePage && article) {
      return (
        <ArticleView
          article={article}
          onBack={() => navigate("/blog")}
          onTagClick={(tag) => navigate(`/blog/tag/${encodeURIComponent(tag)}`)}
          previousArticle={previousArticle}
          nextArticle={nextArticle}
          onOpenArticle={(slug) => navigate(`/blog/${encodeURIComponent(slug)}`)}
          stats={articleStats[article.slug]}
          isLikePending={pendingLikeSlugs.has(article.slug)}
          onToggleLike={handleToggleLike}
        />
      );
    }

    return (
      <section className="rounded-3xl border border-line bg-white p-10 shadow-soft">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/50">Не найдено</p>
        <h2 className="mt-3 text-3xl font-semibold text-ink">Страница не найдена</h2>
        <p className="mt-3 text-sm text-ink/65">В блоге нет такого пути. Вернись к списку статей.</p>
        <button
          type="button"
          onClick={() => navigate("/blog")}
          className="mt-6 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:brightness-95"
        >
          Открыть блог
        </button>
      </section>
    );
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-fog px-5 py-8 sm:px-8 sm:py-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-120px] top-[-140px] h-[360px] w-[360px] rounded-full bg-accent/15 blur-3xl" />
        <div className="absolute bottom-[-180px] right-[-120px] h-[420px] w-[420px] rounded-full bg-cyan-200/40 blur-3xl" />
      </div>

      <div className="relative mx-auto grid w-full max-w-7xl gap-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
        <div className="lg:sticky lg:top-8">
          <BlogSidebar
            tags={tags}
            activeTag={activeTag}
            onSelectTag={(tag) =>
              navigate(tag ? `/blog/tag/${encodeURIComponent(tag)}` : "/blog")
            }
          />
        </div>

        <div>{renderContent()}</div>
      </div>
    </main>
  );
};

export default App;

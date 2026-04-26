import { useEffect, useMemo, useState } from "react";
import { ArticleList } from "./components/ArticleList";
import { ArticleView } from "./components/ArticleView";
import { BlogSidebar } from "./components/BlogSidebar";
import { filterArticlesByTag, getArticleBySlug, getArticles, getTags } from "./lib/articles";

const safeDecode = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const usePathname = () => {
  const [path, setPath] = useState(() => window.location.pathname || "/");

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname || "/");
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  return path;
};

const navigate = (to: string) => {
  if (to === window.location.pathname) {
    return;
  }

  window.history.pushState({}, "", to);
  window.dispatchEvent(new PopStateEvent("popstate"));
};

const App = () => {
  const pathname = usePathname();
  const articles = useMemo(() => getArticles(), []);
  const tags = useMemo(() => getTags(), []);

  const segments = pathname
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .filter(Boolean);

  const isRoot = segments.length === 0;
  const isBlogList = segments[0] === "blog" && segments.length === 1;
  const isTagPage = segments[0] === "blog" && segments[1] === "tag" && Boolean(segments[2]);
  const isArticlePage = segments[0] === "blog" && segments.length === 2 && segments[1] !== "tag";

  const activeTag = isTagPage ? safeDecode(segments[2]) : undefined;
  const listItems = activeTag ? filterArticlesByTag(activeTag) : articles;
  const article = isArticlePage ? getArticleBySlug(safeDecode(segments[1])) : undefined;
  const articleIndex = article ? articles.findIndex((item) => item.slug === article.slug) : -1;
  const previousArticle = articleIndex > 0 ? articles[articleIndex - 1] : undefined;
  const nextArticle = articleIndex >= 0 && articleIndex < articles.length - 1 ? articles[articleIndex + 1] : undefined;

  useEffect(() => {
    if (article) {
      document.title = `${article.title} | Личный блог`;
      return;
    }

    if (activeTag) {
      document.title = `#${activeTag} | Личный блог`;
      return;
    }

    document.title = "Личный блог";
  }, [activeTag, article]);

  const renderContent = () => {
    if (isRoot || isBlogList || isTagPage) {
      return (
        <ArticleList
          items={listItems}
          activeTag={activeTag}
          onOpenArticle={(slug) => navigate(`/blog/${encodeURIComponent(slug)}`)}
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
        />
      );
    }

    return (
      <section className="rounded-3xl border border-line bg-white p-10 shadow-soft">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/50">404</p>
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

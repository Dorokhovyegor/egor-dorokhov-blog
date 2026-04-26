import { Article } from "../lib/articles";

type ArticleListProps = {
  items: Article[];
  activeTag?: string;
  onOpenArticle: (slug: string) => void;
};

const prettyDate = (value: string) =>
  new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(new Date(value));

export const ArticleList = ({ items, onOpenArticle }: ArticleListProps) => {
  return (
    <section className="space-y-5">
      {items.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-line bg-white p-10 text-center text-ink/60">
          По этому тегу пока нет статей.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((article) => (
            <article
              key={article.slug}
              className="group relative flex min-h-[320px] cursor-pointer flex-col justify-between overflow-hidden rounded-3xl bg-white p-5 shadow-soft transition duration-300 hover:-translate-y-0.5"
              onClick={() => onOpenArticle(article.slug)}
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(124,58,237,0.14),transparent_42%),radial-gradient(circle_at_88%_92%,rgba(6,182,212,0.16),transparent_48%)]" />

              <div className="relative z-10">
                <p className="text-xs uppercase tracking-[0.14em] text-ink/45">{prettyDate(article.date)}</p>
                <h3 className="mt-2 text-2xl font-semibold leading-tight text-ink transition group-hover:text-accent">
                  {article.title}
                </h3>
                {article.excerpt && <p className="mt-3 line-clamp-4 text-sm leading-relaxed text-ink/70">{article.excerpt}</p>}
              </div>

              <div className="relative z-10 mt-4 flex flex-wrap gap-2">
                {article.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-accentSoft px-3 py-1 text-xs font-medium text-accent">
                    #{tag}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};

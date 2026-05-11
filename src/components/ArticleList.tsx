import { Article } from "../lib/articles";
import { ArticleStats } from "../lib/engagement";

type ArticleListProps = {
  items: Article[];
  activeTag?: string;
  onOpenArticle: (slug: string) => void;
  statsBySlug: Record<string, ArticleStats>;
};

const prettyDate = (value: string) =>
  new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(new Date(value));

const formatCount = (value: number | undefined) => new Intl.NumberFormat("ru-RU").format(value ?? 0);

const EyeIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
    <path
      d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    />
    <circle cx="12" cy="12" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
  </svg>
);

const HeartIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
    <path
      d="M20.3 5.7a5 5 0 0 0-7.1 0L12 6.9l-1.2-1.2a5 5 0 0 0-7.1 7.1L12 21l8.3-8.2a5 5 0 0 0 0-7.1Z"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    />
  </svg>
);

export const ArticleList = ({ items, onOpenArticle, statsBySlug }: ArticleListProps) => {
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

              <div className="relative z-10 mt-5 space-y-4">
                <div className="flex flex-wrap gap-2">
                  {article.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-accentSoft px-3 py-1 text-xs font-medium text-accent">
                      #{tag}
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-3 text-xs font-semibold text-ink/55">
                  <span className="inline-flex items-center gap-1.5">
                    <EyeIcon />
                    {formatCount(statsBySlug[article.slug]?.reads)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <HeartIcon />
                    {formatCount(statsBySlug[article.slug]?.likes)}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};

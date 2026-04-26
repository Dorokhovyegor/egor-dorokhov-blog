import { ReactNode, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Article } from "../lib/articles";

type ArticleViewProps = {
  article: Article;
  onBack: () => void;
  onTagClick: (tag: string) => void;
  previousArticle?: Article;
  nextArticle?: Article;
  onOpenArticle: (slug: string) => void;
};

const prettyDate = (value: string) =>
  new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(new Date(value));

const copyToClipboard = async (value: string) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textArea = document.createElement("textarea");
  textArea.value = value;
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand("copy");
  document.body.removeChild(textArea);
};

const MarkdownCode = ({
  inline,
  className,
  children
}: {
  inline?: boolean;
  className?: string;
  children?: ReactNode;
}) => {
  const [copied, setCopied] = useState(false);
  const rawCode = String(children ?? "").replace(/\n$/, "");
  const languageMatch = /language-([\w-]+)/.exec(className || "");
  const language = languageMatch?.[1] || "text";

  if (inline) {
    return <code className={className}>{children}</code>;
  }

  const copyCode = async () => {
    try {
      await copyToClipboard(rawCode);

      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={copyCode}
        className="absolute right-3 top-3 z-10 rounded-md border border-white/20 bg-white/10 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-white/20"
      >
        {copied ? "Скопировано" : "Копировать"}
      </button>

      <SyntaxHighlighter
        language={language}
        style={oneDark}
        showLineNumbers
        wrapLongLines
        customStyle={{
          margin: 0,
          borderRadius: "0.95rem",
          border: "1px solid #1e293b",
          paddingTop: "1rem",
          paddingRight: "1rem",
          paddingBottom: "1rem",
          paddingLeft: "0.55rem",
          boxShadow: "0 14px 34px rgba(15, 23, 42, 0.24)"
        }}
        lineNumberStyle={{
          minWidth: "2.6em",
          paddingRight: "1em",
          color: "rgba(148, 163, 184, 0.8)"
        }}
        codeTagProps={{
          style: {
            fontFamily: "JetBrains Mono, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace",
            fontSize: "0.9rem",
            lineHeight: "1.7"
          }
        }}
      >
        {rawCode}
      </SyntaxHighlighter>
    </div>
  );
};

const MarkdownImage = ({
  src,
  alt,
  title
}: {
  src?: string;
  alt?: string;
  title?: string;
}) => {
  if (!src) {
    return null;
  }

  const normalizedSrc = src
    .replace(/^\/dist\/uploads\//, "/uploads/")
    .replace(/^dist\/uploads\//, "/uploads/");

  return (
    <span className="blog-image-wrap">
      <img src={normalizedSrc} alt={alt || "Изображение"} loading="lazy" />
      {title && <span className="blog-image-caption">{title}</span>}
    </span>
  );
};

export const ArticleView = ({
  article,
  onBack,
  onTagClick,
  previousArticle,
  nextArticle,
  onOpenArticle
}: ArticleViewProps) => {
  return (
    <article className="rounded-3xl border border-line/70 bg-white p-6 shadow-soft sm:p-10">
      <button
        type="button"
        onClick={onBack}
        className="rounded-full border border-line px-4 py-2 text-sm text-ink/70 transition hover:border-accent hover:text-accent"
      >
        Назад к списку
      </button>

      <p className="mt-7 text-xs uppercase tracking-[0.14em] text-ink/50">{prettyDate(article.date)}</p>
      <h1 className="mt-3 text-3xl font-semibold text-ink sm:text-4xl">{article.title}</h1>

      <div className="mt-4 flex flex-wrap gap-2">
        {article.tags.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => onTagClick(tag)}
            className="rounded-full bg-accentSoft px-3 py-1 text-xs font-semibold text-accent transition hover:brightness-95"
          >
            #{tag}
          </button>
        ))}
      </div>

      <div className="blog-content mt-8">
        <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={{ code: MarkdownCode, img: MarkdownImage }}>
          {article.content}
        </ReactMarkdown>
      </div>

      {(previousArticle || nextArticle) && (
        <div className="mt-10 border-t border-line/80 pt-6">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/50">Навигация по статьям</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {previousArticle ? (
              <button
                type="button"
                onClick={() => onOpenArticle(previousArticle.slug)}
                className="rounded-2xl border border-line bg-fog px-4 py-4 text-left transition hover:border-accent"
              >
                <p className="text-xs uppercase tracking-[0.12em] text-ink/50">Предыдущая</p>
                <p className="mt-1 text-sm font-semibold text-ink">{previousArticle.title}</p>
              </button>
            ) : (
              <div />
            )}

            {nextArticle && (
              <button
                type="button"
                onClick={() => onOpenArticle(nextArticle.slug)}
                className="rounded-2xl border border-line bg-fog px-4 py-4 text-left transition hover:border-accent"
              >
                <p className="text-xs uppercase tracking-[0.12em] text-ink/50">Следующая</p>
                <p className="mt-1 text-sm font-semibold text-ink">{nextArticle.title}</p>
              </button>
            )}
          </div>
        </div>
      )}
    </article>
  );
};

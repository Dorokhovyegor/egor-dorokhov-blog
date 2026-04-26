export type Article = {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  tags: string[];
  published: boolean;
  content: string;
};

type Frontmatter = {
  slug?: string;
  title?: string;
  excerpt?: string;
  date?: string;
  tags?: string[];
  published?: boolean;
};

const postFiles = import.meta.glob("/content/posts/*.md", {
  eager: true,
  import: "default",
  query: "?raw"
}) as Record<string, string>;

const normalizeSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9а-яё\-_]/gi, "")
    .replace(/-+/g, "-");

const filenameToSlug = (path: string) => {
  const match = path.match(/\/([^/]+)\.md$/);
  return match ? normalizeSlug(match[1]) : "article";
};

const trimQuotes = (value: string) => value.trim().replace(/^['"]|['"]$/g, "");

const parseFrontmatter = (raw: string): { data: Frontmatter; content: string } => {
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);

  if (!match) {
    return { data: {}, content: raw };
  }

  const frontmatterText = match[1];
  const content = match[2] ?? "";
  const lines = frontmatterText.split(/\r?\n/);

  const data: Frontmatter = {};
  let currentKey: keyof Frontmatter | null = null;

  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }

    const listMatch = line.match(/^\s*-\s*(.+)$/);
    if (listMatch && currentKey === "tags") {
      const value = trimQuotes(listMatch[1]);
      data.tags = [...(data.tags ?? []), value];
      continue;
    }

    const keyValueMatch = line.match(/^\s*([a-zA-Z_][\w-]*)\s*:\s*(.*)$/);
    if (!keyValueMatch) {
      continue;
    }

    const key = keyValueMatch[1];
    const rawValue = keyValueMatch[2]?.trim() ?? "";
    currentKey = null;

    if (key === "title") {
      data.title = trimQuotes(rawValue);
      continue;
    }

    if (key === "slug") {
      data.slug = trimQuotes(rawValue);
      continue;
    }

    if (key === "excerpt") {
      data.excerpt = trimQuotes(rawValue);
      continue;
    }

    if (key === "date") {
      data.date = trimQuotes(rawValue);
      continue;
    }

    if (key === "published") {
      data.published = rawValue.toLowerCase() !== "false";
      continue;
    }

    if (key === "tags") {
      currentKey = "tags";

      if (!rawValue) {
        data.tags = data.tags ?? [];
        continue;
      }

      const inlineListMatch = rawValue.match(/^\[(.*)\]$/);
      if (inlineListMatch) {
        data.tags = inlineListMatch[1]
          .split(",")
          .map((item) => trimQuotes(item))
          .filter(Boolean);
      } else {
        data.tags = [trimQuotes(rawValue)].filter(Boolean);
      }
    }
  }

  return { data, content };
};

const parsePost = (path: string, raw: string): Article => {
  const parsed = parseFrontmatter(raw);
  const data = parsed.data ?? {};

  const slug = normalizeSlug(data.slug ?? filenameToSlug(path));
  const title = data.title?.trim() || slug;
  const excerpt = data.excerpt?.trim() || "";
  const date = data.date || "1970-01-01";
  const tags = Array.isArray(data.tags) ? data.tags.map((tag) => tag.trim()).filter(Boolean) : [];
  const published = data.published !== false;

  return {
    slug,
    title,
    excerpt,
    date,
    tags,
    published,
    content: (parsed.content || "").trim()
  };
};

const dedupeBySlug = (articles: Article[]) => {
  const seen = new Set<string>();
  return articles.filter((article) => {
    if (seen.has(article.slug)) {
      return false;
    }
    seen.add(article.slug);
    return true;
  });
};

const allArticles = dedupeBySlug(
  Object.entries(postFiles)
    .map(([path, raw]) => {
      try {
        return parsePost(path, raw);
      } catch {
        return null;
      }
    })
    .filter((article): article is Article => Boolean(article && article.published))
    .sort((a, b) => +new Date(b.date) - +new Date(a.date))
);

export const getArticles = () => allArticles;

export const getArticleBySlug = (slug: string) =>
  allArticles.find((article) => article.slug === normalizeSlug(slug));

export const getTags = () => {
  const counts = new Map<string, number>();

  for (const article of allArticles) {
    for (const tag of article.tags) {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ru"));
};

export const filterArticlesByTag = (tag: string) => {
  const normalized = tag.trim().toLowerCase();
  return allArticles.filter((article) => article.tags.some((item) => item.toLowerCase() === normalized));
};

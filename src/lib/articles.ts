import { callApi } from "./api";

export type Article = {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  tags: string[];
  published: boolean;
  content: string;
};

export type TagItem = {
  name: string;
  count: number;
};

const normalizeSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9а-яё\-_]/gi, "")
    .replace(/-+/g, "-");

export const getArticles = () => callApi<Article[]>("/articles");

export const getTags = () => callApi<TagItem[]>("/tags");

export const getArticleBySlug = async (slug: string) => {
  try {
    return await callApi<Article>(`/articles/${encodeURIComponent(normalizeSlug(slug))}`);
  } catch {
    return undefined;
  }
};

export const findArticleBySlug = (articles: Article[], slug: string) =>
  articles.find((article) => article.slug === normalizeSlug(slug));

export const filterArticlesByTag = (articles: Article[], tag: string) => {
  const normalized = tag.trim().toLowerCase();
  return articles.filter((article) => article.tags.some((item) => item.toLowerCase() === normalized));
};

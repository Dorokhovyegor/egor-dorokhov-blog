import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const siteOrigin = "https://eidorokhov.ru";
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const postsDir = path.join(rootDir, "content", "posts");
const publicDir = path.join(rootDir, "public");
const sitemapPath = path.join(publicDir, "sitemap.xml");

const pages = [
  {
    loc: `${siteOrigin}/`,
    changefreq: "weekly",
    priority: "1.0",
  },
  {
    loc: `${siteOrigin}/blog`,
    changefreq: "weekly",
    priority: "0.9",
  },
];

if (existsSync(postsDir)) {
  const posts = readdirSync(postsDir)
    .filter((file) => file.endsWith(".md"))
    .map((file) => parsePostFile(path.join(postsDir, file)))
    .filter((post) => post && post.published !== "false" && post.slug)
    .sort((left, right) => right.date.localeCompare(left.date));

  for (const post of posts) {
    pages.push({
      loc: `${siteOrigin}/blog/${encodeURIComponent(post.slug)}`,
      lastmod: post.date,
      changefreq: "monthly",
      priority: "0.8",
    });
  }
}

writeFileSync(sitemapPath, renderSitemap(pages), "utf8");
console.log(`Generated ${path.relative(rootDir, sitemapPath)} with ${pages.length} URL(s).`);

function parsePostFile(filePath) {
  const source = readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  if (!source.startsWith("---\n")) {
    return null;
  }

  const endIndex = source.indexOf("\n---", 4);
  if (endIndex === -1) {
    return null;
  }

  return parseFrontmatter(source.slice(4, endIndex));
}

function parseFrontmatter(frontmatter) {
  const data = {};

  for (const line of frontmatter.split(/\r?\n/)) {
    const field = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!field) {
      continue;
    }

    const [, key, rawValue] = field;
    data[key] = cleanValue(rawValue);
  }

  return data;
}

function cleanValue(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function renderSitemap(items) {
  const urls = items
    .map(
      (item) => `  <url>
    <loc>${escapeXML(item.loc)}</loc>${item.lastmod ? `
    <lastmod>${escapeXML(item.lastmod)}</lastmod>` : ""}
    <changefreq>${escapeXML(item.changefreq)}</changefreq>
    <priority>${escapeXML(item.priority)}</priority>
  </url>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

function escapeXML(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

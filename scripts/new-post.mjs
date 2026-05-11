import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const postsDir = path.join(rootDir, "content", "posts");

const translit = new Map(
  Object.entries({
    а: "a",
    б: "b",
    в: "v",
    г: "g",
    д: "d",
    е: "e",
    ё: "e",
    ж: "zh",
    з: "z",
    и: "i",
    й: "y",
    к: "k",
    л: "l",
    м: "m",
    н: "n",
    о: "o",
    п: "p",
    р: "r",
    с: "s",
    т: "t",
    у: "u",
    ф: "f",
    х: "h",
    ц: "c",
    ч: "ch",
    ш: "sh",
    щ: "sch",
    ъ: "",
    ы: "y",
    ь: "",
    э: "e",
    ю: "yu",
    я: "ya",
  }),
);

function parseArgs(argv) {
  const options = {
    tags: [],
    published: false,
    force: false,
  };
  const titleParts = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === "--published") {
      options.published = true;
    } else if (arg === "--draft") {
      options.published = false;
    } else if (arg === "--force") {
      options.force = true;
    } else if (arg === "--slug") {
      options.slug = requireValue(arg, next);
      i += 1;
    } else if (arg === "--date") {
      options.date = requireValue(arg, next);
      i += 1;
    } else if (arg === "--excerpt") {
      options.excerpt = requireValue(arg, next);
      i += 1;
    } else if (arg === "--tag") {
      options.tags.push(requireValue(arg, next));
      i += 1;
    } else if (arg === "--tags") {
      options.tags.push(
        ...requireValue(arg, next)
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      );
      i += 1;
    } else if (arg.startsWith("--")) {
      fail(`Unknown option: ${arg}`);
    } else {
      titleParts.push(arg);
    }
  }

  options.title = titleParts.join(" ").trim();
  return options;
}

function requireValue(flag, value) {
  if (!value || value.startsWith("--")) {
    fail(`${flag} requires a value`);
  }

  return value;
}

function localDate() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function slugify(input) {
  return input
    .toLowerCase()
    .split("")
    .map((char) => translit.get(char) ?? char)
    .join("")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 120);
}

function quoteYaml(value) {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function renderPost({ title, slug, date, tags, excerpt, published }) {
  const tagsBlock = `tags:${
    tags.length > 0
      ? `\n${tags.map((tag) => `  - ${tag}`).join("\n")}`
      : " []"
  }`;

  return `---\ntitle: ${quoteYaml(title)}\nslug: ${quoteYaml(slug)}\ndate: ${quoteYaml(date)}\n${tagsBlock}\nexcerpt: ${quoteYaml(excerpt)}\npublished: ${published ? "true" : "false"}\n---\n\n`;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

const options = parseArgs(process.argv.slice(2));

if (!options.title) {
  fail('Usage: npm run post:new -- "Название статьи" [--tag android] [--published]');
}

const slug = options.slug ? slugify(options.slug) : slugify(options.title);
if (!slug) {
  fail("Could not generate a slug. Pass one explicitly with --slug.");
}

const date = options.date ?? localDate();
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  fail("Date must use YYYY-MM-DD format.");
}

const excerpt = options.excerpt ?? options.title;
const filePath = path.join(postsDir, `${slug}.md`);

if (existsSync(filePath) && !options.force) {
  fail(`Post already exists: ${path.relative(rootDir, filePath)}`);
}

mkdirSync(postsDir, { recursive: true });
writeFileSync(
  filePath,
  renderPost({
    title: options.title,
    slug,
    date,
    tags: options.tags,
    excerpt,
    published: options.published,
  }),
  "utf8",
);

console.log(`Created ${path.relative(rootDir, filePath)}`);

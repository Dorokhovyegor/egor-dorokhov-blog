import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const postsDir = path.join(rootDir, "content", "posts");
const errors = [];
const warnings = [];
const slugs = new Map();
let files = [];

if (!existsSync(postsDir)) {
  errors.push("Missing content/posts directory.");
  report();
}

files = readdirSync(postsDir)
  .filter((file) => file.endsWith(".md"))
  .sort((a, b) => a.localeCompare(b));

if (files.length === 0) {
  warnings.push("No markdown posts found in content/posts.");
}

for (const file of files) {
  const filePath = path.join(postsDir, file);
  const relativePath = path.relative(rootDir, filePath);
  const source = readFileSync(filePath, "utf8");
  const parsed = parsePost(source);

  if (!parsed) {
    errors.push(`${relativePath}: missing frontmatter block.`);
    continue;
  }

  const { data, body } = parsed;
  const title = data.title;
  const slug = data.slug;
  const date = data.date;
  const published = data.published;

  if (!title) {
    errors.push(`${relativePath}: title is required.`);
  }

  if (!slug) {
    errors.push(`${relativePath}: slug is required.`);
  } else {
    if (!/^[a-z0-9_-]{1,160}$/.test(slug)) {
      errors.push(`${relativePath}: slug must contain only latin lowercase letters, digits, "_" or "-".`);
    }

    const existing = slugs.get(slug);
    if (existing) {
      errors.push(`${relativePath}: duplicate slug "${slug}" already used in ${existing}.`);
    } else {
      slugs.set(slug, relativePath);
    }

    const filenameSlug = path.basename(file, ".md");
    if (filenameSlug !== slug) {
      warnings.push(`${relativePath}: filename differs from slug "${slug}".`);
    }
  }

  if (!date) {
    errors.push(`${relativePath}: date is required.`);
  } else if (!isValidDate(date)) {
    errors.push(`${relativePath}: date must use YYYY-MM-DD format.`);
  }

  if (!["true", "false"].includes(published)) {
    errors.push(`${relativePath}: published must be true or false.`);
  }

  if (body.trim().length === 0) {
    warnings.push(`${relativePath}: article body is empty.`);
  }
}

report();

function parsePost(source) {
  const normalized = source.replace(/^\uFEFF/, "");
  if (!normalized.startsWith("---\n")) {
    return null;
  }

  const endIndex = normalized.indexOf("\n---", 4);
  if (endIndex === -1) {
    return null;
  }

  const frontmatter = normalized.slice(4, endIndex);
  const body = normalized.slice(endIndex + 4);
  return {
    data: parseFrontmatter(frontmatter),
    body,
  };
}

function parseFrontmatter(frontmatter) {
  const data = {};
  const lines = frontmatter.split(/\r?\n/);
  let currentListKey = null;

  for (const line of lines) {
    const listItem = line.match(/^\s*-\s*(.*)$/);
    if (currentListKey && listItem) {
      data[currentListKey].push(cleanValue(listItem[1]));
      continue;
    }

    const field = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!field) {
      currentListKey = null;
      continue;
    }

    const [, key, rawValue] = field;
    const value = rawValue.trim();

    if (value === "") {
      data[key] = [];
      currentListKey = key;
      continue;
    }

    data[key] = cleanValue(value);
    currentListKey = null;
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

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function report() {
  for (const warning of warnings) {
    console.warn(`Warning: ${warning}`);
  }

  if (errors.length > 0) {
    for (const error of errors) {
      console.error(`Error: ${error}`);
    }
    process.exit(1);
  }

  console.log(`Content check passed: ${files.length} post(s).`);
}

import { callApi } from "./api";

export type ArticleStats = {
  slug: string;
  reads: number;
  likes: number;
  liked: boolean;
};

export type SiteStats = {
  visitorsTotal: number;
  visitsTotal: number;
  articleReadsTotal: number;
};

type LocalArticleStats = {
  reads: number;
  likes: number;
  liked: boolean;
};

type LocalEngagementStore = {
  siteVisits: number;
  articleStats: Record<string, LocalArticleStats>;
};

const VISITOR_ID_KEY = "blog:visitor-id:v1";
const LOCAL_STORE_KEY = "blog:engagement:v1";
const SITE_VISIT_SESSION_KEY = "blog:site-visit:v1";
const ARTICLE_READ_SESSION_KEY_PREFIX = "blog:article-read:v1:";

let memoVisitorId: string | undefined;
let warnedAboutApi = false;

function toCount(value: unknown) {
  const count = Number(value ?? 0);
  return Number.isFinite(count) ? Math.max(0, count) : 0;
}

function createVisitorId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);

  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join("")
  ].join("-");
}

function readLocalStorage(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocalStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable in private browser modes. Metrics still work in memory for this render.
  }
}

function readSessionFlag(key: string) {
  try {
    return window.sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeSessionFlag(key: string) {
  try {
    window.sessionStorage.setItem(key, "1");
  } catch {
    // A missing sessionStorage should not block analytics events.
  }
}

function getVisitorId() {
  if (memoVisitorId) {
    return memoVisitorId;
  }

  const existingId = readLocalStorage(VISITOR_ID_KEY);
  if (existingId) {
    memoVisitorId = existingId;
    return existingId;
  }

  memoVisitorId = createVisitorId();
  writeLocalStorage(VISITOR_ID_KEY, memoVisitorId);
  return memoVisitorId;
}

function readLocalStore(): LocalEngagementStore {
  const fallback: LocalEngagementStore = {
    siteVisits: 0,
    articleStats: {}
  };

  const rawStore = readLocalStorage(LOCAL_STORE_KEY);
  if (!rawStore) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(rawStore) as Partial<LocalEngagementStore>;
    return {
      siteVisits: toCount(parsed.siteVisits),
      articleStats: parsed.articleStats ?? {}
    };
  } catch {
    return fallback;
  }
}

function writeLocalStore(store: LocalEngagementStore) {
  writeLocalStorage(LOCAL_STORE_KEY, JSON.stringify(store));
}

function localArticleStats(slug: string, store = readLocalStore()): ArticleStats {
  const stats = store.articleStats[slug];

  return {
    slug,
    reads: toCount(stats?.reads),
    likes: toCount(stats?.likes),
    liked: Boolean(stats?.liked)
  };
}

function localSiteStats(store = readLocalStore()): SiteStats {
  const articleReadsTotal = Object.values(store.articleStats).reduce(
    (total, item) => total + toCount(item.reads),
    0
  );

  return {
    visitorsTotal: getVisitorId() ? 1 : 0,
    visitsTotal: toCount(store.siteVisits),
    articleReadsTotal
  };
}

function mapArticleStats(value: unknown): ArticleStats {
  const row = value as Partial<ArticleStats>;

  return {
    slug: typeof row.slug === "string" ? row.slug : "",
    reads: toCount(row.reads),
    likes: toCount(row.likes),
    liked: Boolean(row.liked)
  };
}

function mapSiteStats(value: unknown): SiteStats {
  const row = value as Partial<SiteStats>;

  return {
    visitorsTotal: toCount(row.visitorsTotal),
    visitsTotal: toCount(row.visitsTotal),
    articleReadsTotal: toCount(row.articleReadsTotal)
  };
}

function warnAboutApiFailure(error: unknown) {
  if (warnedAboutApi) {
    return;
  }

  warnedAboutApi = true;
  console.warn("Engagement metrics fell back to localStorage.", error);
}

async function callApiOrFallback<T>(request: () => Promise<T>, fallback: () => T | Promise<T>) {
  try {
    return await request();
  } catch (error) {
    warnAboutApiFailure(error);
    return fallback();
  }
}

export async function getSiteStats(): Promise<SiteStats> {
  return callApiOrFallback(
    async () => mapSiteStats(await callApi<unknown>("/engagement/site")),
    () => localSiteStats()
  );
}

export async function getArticleStats(slugs: string[]): Promise<ArticleStats[]> {
  if (slugs.length === 0) {
    return [];
  }

  return callApiOrFallback(
    async () => {
      const rows = await callApi<unknown[]>("/engagement/articles/stats", {
        slugs,
        visitorId: getVisitorId()
      });

      return rows.map(mapArticleStats).filter((item) => item.slug);
    },
    () => slugs.map((slug) => localArticleStats(slug))
  );
}

export async function trackSiteVisit(pagePath: string): Promise<SiteStats> {
  if (readSessionFlag(SITE_VISIT_SESSION_KEY)) {
    return getSiteStats();
  }

  writeSessionFlag(SITE_VISIT_SESSION_KEY);

  return callApiOrFallback(
    async () =>
      mapSiteStats(
        await callApi<unknown>("/engagement/site-visit", {
          visitorId: getVisitorId(),
          path: pagePath
        })
      ),
    () => {
      const store = readLocalStore();
      store.siteVisits += 1;
      writeLocalStore(store);
      return localSiteStats(store);
    }
  );
}

export async function trackArticleRead(slug: string, pagePath: string): Promise<ArticleStats> {
  const sessionKey = `${ARTICLE_READ_SESSION_KEY_PREFIX}${slug}`;

  if (readSessionFlag(sessionKey)) {
    return (await getArticleStats([slug]))[0] ?? localArticleStats(slug);
  }

  writeSessionFlag(sessionKey);

  return callApiOrFallback(
    async () =>
      mapArticleStats(
        await callApi<unknown>("/engagement/articles/read", {
          visitorId: getVisitorId(),
          slug,
          path: pagePath
        })
      ),
    () => {
      const store = readLocalStore();
      const current = localArticleStats(slug, store);
      store.articleStats[slug] = {
        reads: current.reads + 1,
        likes: current.likes,
        liked: current.liked
      };
      writeLocalStore(store);
      return localArticleStats(slug, store);
    }
  );
}

export async function toggleArticleLike(slug: string): Promise<ArticleStats> {
  return callApiOrFallback(
    async () =>
      mapArticleStats(
        await callApi<unknown>("/engagement/articles/like", {
          visitorId: getVisitorId(),
          slug
        })
      ),
    () => {
      const store = readLocalStore();
      const current = localArticleStats(slug, store);
      const liked = !current.liked;

      store.articleStats[slug] = {
        reads: current.reads,
        likes: Math.max(0, current.likes + (liked ? 1 : -1)),
        liked
      };
      writeLocalStore(store);

      return localArticleStats(slug, store);
    }
  );
}

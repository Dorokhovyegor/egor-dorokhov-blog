create table if not exists blog_visitors (
  visitor_id text primary key,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists blog_site_visits (
  id bigint generated always as identity primary key,
  visitor_id text not null references blog_visitors(visitor_id) on delete cascade,
  page_path text not null default '',
  visited_at timestamptz not null default now()
);

create index if not exists blog_site_visits_visitor_id_idx on blog_site_visits(visitor_id);
create index if not exists blog_site_visits_visited_at_idx on blog_site_visits(visited_at);

create table if not exists blog_article_stats (
  article_slug text primary key,
  reads bigint not null default 0 check (reads >= 0),
  likes bigint not null default 0 check (likes >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists blog_article_reads (
  id bigint generated always as identity primary key,
  article_slug text not null,
  visitor_id text not null references blog_visitors(visitor_id) on delete cascade,
  page_path text not null default '',
  read_at timestamptz not null default now()
);

create index if not exists blog_article_reads_article_slug_idx on blog_article_reads(article_slug);
create index if not exists blog_article_reads_visitor_id_idx on blog_article_reads(visitor_id);
create index if not exists blog_article_reads_read_at_idx on blog_article_reads(read_at);

create table if not exists blog_article_likes (
  article_slug text not null,
  visitor_id text not null references blog_visitors(visitor_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (article_slug, visitor_id)
);

create index if not exists blog_article_likes_visitor_id_idx on blog_article_likes(visitor_id);

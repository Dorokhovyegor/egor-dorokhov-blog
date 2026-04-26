type TagItem = {
  name: string;
  count: number;
};

type SidebarProps = {
  tags: TagItem[];
  activeTag?: string;
  onSelectTag: (tag?: string) => void;
};

type LinkItem = {
  label: string;
  href: string;
  kind: "telegram" | "boosty";
  description: string;
};

const links: LinkItem[] = [
  {
    label: "Мой телеграм канал",
    href: "https://t.me/nichebrodnotes",
    kind: "telegram",
    description: "Короткие заметки, наблюдения и идеи"
  },
  {
    label: "Мой бусти",
    href: "https://boosty.to/egor_di",
    kind: "boosty",
    description: "Если хочешь уровень глубже — тебе сюда"
  }
];

const LinkIcon = ({ kind }: { kind: "telegram" | "boosty" }) => {
  if (kind === "telegram") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 text-[#229ED9]">
        <path
          fill="currentColor"
          d="M21.8 4.2c-.3-.3-.8-.4-1.3-.2L3.3 10.6c-.6.2-.9.8-.8 1.4.1.6.5 1 1.1 1.1l4.4.9 1 4.5c.1.6.6 1 1.2 1.1h.1c.6 0 1-.3 1.3-.8l2.4-4 4.2 3.1c.4.3.9.4 1.4.2.5-.2.8-.6.9-1.1l2.2-11.6c.1-.5 0-1-.3-1.3Zm-11.1 10 7.4-6.5-5.8 7.9-.4 2.1-1.2-3.5Z"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <rect x="2" y="2" width="20" height="20" rx="6" fill="#F15A29" />
      <path
        fill="#fff"
        d="M8.2 7h4.8c2.4 0 3.9 1.2 3.9 3.2 0 1.3-.7 2.2-1.9 2.7 1.5.4 2.4 1.5 2.4 3 0 2.1-1.7 3.5-4.4 3.5H8.2V7Zm4.5 5.1c1.1 0 1.8-.5 1.8-1.4s-.7-1.3-1.8-1.3h-2v2.7h2Zm.3 4.9c1.3 0 2.1-.5 2.1-1.5s-.8-1.5-2.1-1.5h-2.3V17H13Z"
      />
    </svg>
  );
};

export const BlogSidebar = ({ tags, activeTag, onSelectTag }: SidebarProps) => {
  return (
    <aside className="overflow-hidden rounded-3xl">
      <div className="px-6 pb-6 pt-3">
        <div>
          <h1 className="text-2xl font-semibold leading-tight text-ink">Егор Дорохов</h1>
          <div className="mt-3 space-y-2 text-sm leading-relaxed text-ink/70">
            <p>Android-разработчик, 8+ лет опыта.</p>
            <p>Здесь разборы вопросов и задач с собеседований.</p>
            <p>Иногда пишу и на другие темы, которые мне интересны.</p>
          </div>
        </div>
      </div>

      <div className="space-y-7 p-6">
        <section>
          <div className="grid grid-cols-1 gap-4">
          {links.map((link) => (
            <div key={link.label} className="flex w-full flex-col">
              <a
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="group block w-full rounded-2xl bg-white px-5 py-3.5 shadow-sm transition hover:-translate-y-0.5"
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2.5 text-base font-semibold text-ink">
                    <LinkIcon kind={link.kind} />
                    {link.label}
                  </span>
                  {link.kind === "boosty" && (
                    <span className="rounded-full bg-[#F15A29] px-3 py-1 text-xs font-bold text-white">
                      Подписаться
                    </span>
                  )}
                </span>
              </a>
              <p className="mt-2 inline-flex items-start gap-1.5 px-1 text-xs leading-relaxed text-ink/65">
                {link.kind === "boosty" && <span aria-hidden="true">⚡</span>}
                <span>{link.description}</span>
              </p>
            </div>
          ))}
          </div>
        </section>

        <section>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onSelectTag(undefined)}
              className={`rounded-full px-3 py-1.5 text-sm transition ${
                !activeTag
                  ? "bg-accent text-white"
                  : "bg-white text-ink shadow-sm hover:text-accent"
              }`}
            >
              Все статьи
            </button>
            {tags.map((tag) => (
              <button
                key={tag.name}
                type="button"
                onClick={() => onSelectTag(tag.name)}
                className={`rounded-full px-3 py-1.5 text-sm transition ${
                  activeTag === tag.name
                    ? "bg-accent text-white"
                    : "bg-white text-ink shadow-sm hover:text-accent"
                }`}
              >
                #{tag.name} · {tag.count}
              </button>
            ))}
          </div>
        </section>
      </div>
    </aside>
  );
};

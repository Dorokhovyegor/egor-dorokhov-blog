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
  description: string;
  cta: string;
};

const links: LinkItem[] = [
  {
    label: "Телеграм канал",
    href: "https://t.me/fr_first_room",
    description: "Подписывайся на телеграм канал, там больше постов не только по данной теме",
    cta: "Подписаться"
  }
];

const LinkIcon = () => {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 text-[#229ED9]">
      <path
        fill="currentColor"
        d="M21.8 4.2c-.3-.3-.8-.4-1.3-.2L3.3 10.6c-.6.2-.9.8-.8 1.4.1.6.5 1 1.1 1.1l4.4.9 1 4.5c.1.6.6 1 1.2 1.1h.1c.6 0 1-.3 1.3-.8l2.4-4 4.2 3.1c.4.3.9.4 1.4.2.5-.2.8-.6.9-1.1l2.2-11.6c.1-.5 0-1-.3-1.3Zm-11.1 10 7.4-6.5-5.8 7.9-.4 2.1-1.2-3.5Z"
      />
    </svg>
  );
};

export const BlogSidebar = ({ tags, activeTag, onSelectTag }: SidebarProps) => {
  return (
    <aside className="overflow-hidden rounded-3xl">
      <div className="px-6 pb-6 pt-3">
        <div>
          <img
            src="/uploads/first-room-avatar.jpg"
            alt="Первая комната"
            className="mb-5 h-24 w-24 rounded-3xl object-cover shadow-sm"
          />
          <h1 className="text-2xl font-semibold leading-tight text-ink">Первая комната</h1>
          <p className="mt-3 text-sm leading-relaxed text-ink/70">
            Блог о поиске работы, карьерном росте и прохождении интервью.
          </p>
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
                  className="group block w-full rounded-2xl border border-[#229ED9]/25 bg-gradient-to-br from-[#E8F6FD] via-white to-white px-5 py-4 shadow-soft ring-1 ring-white/70 transition hover:-translate-y-0.5 hover:border-[#229ED9]/45 hover:shadow-lg"
                >
                  <span className="flex flex-col gap-3">
                    <span className="flex items-center gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm">
                        <LinkIcon />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-base font-semibold leading-tight text-ink">{link.label}</span>
                        <span className="mt-0.5 block text-xs font-medium text-ink/55">Больше заметок и наблюдений</span>
                      </span>
                    </span>
                    <span className="block w-full rounded-full bg-[#229ED9] px-4 py-2.5 text-center text-sm font-semibold leading-none text-white shadow-sm transition group-hover:bg-[#1689C0]">
                      {link.cta}
                    </span>
                  </span>
                </a>
                <p className="mt-2.5 px-1 text-xs leading-relaxed text-ink/70">
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

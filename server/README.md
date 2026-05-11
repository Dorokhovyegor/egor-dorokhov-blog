# Go blog backend

Минимальный backend для блога: отдает статьи, frontend, уникальных посетителей, визиты, прочтения статей и лайки.

## Структура

- `cmd/blog` - точка входа приложения.
- `internal/domain` - доменные типы и интерфейсы репозиториев.
- `internal/handlers/http` - HTTP-ручки и отдача frontend.
- `internal/infrastructure/content` - markdown-репозиторий статей.
- `internal/infrastructure/postgres` - подключение к Postgres, миграции и репозиторий метрик.
- `internal/infrastructure/environment` - переменные окружения.
- `internal/infrastructure/handlers/http` - обертка над `http.Server`.

## Локальный запуск

```bash
docker compose up -d postgres
export DB_DSN="postgres://blog:blog@127.0.0.1:55432/blog?sslmode=disable"
npm run build
npm run server
```

Сервер по умолчанию слушает `127.0.0.1:8787`; локально сайт можно открыть на `http://127.0.0.1:8787`. Он отдает собранный `dist` и API на `/api/*`.

## Настройки

Переменные окружения:

- `PORT` - порт, по умолчанию `8787`.
- `HOST` - host, по умолчанию `127.0.0.1`.
- `DB_DSN` - подключение к Postgres, обязательная переменная.
- `DIST_DIR` - путь до собранного фронтенда, по умолчанию `dist`.
- `CONTENT_DIR` - путь до markdown-статей, по умолчанию `content/posts`.

Backend применяет idempotent schema migration на старте.

## База данных

Метрики хранятся в Postgres:

- `blog_visitors` - анонимные посетители.
- `blog_site_visits` - заходы на сайт.
- `blog_article_reads` - события чтения статей.
- `blog_article_likes` - лайки посетителей по статьям.
- `blog_article_stats` - агрегированные счетчики чтений и лайков.

JSON-хранилища больше нет. Если `DB_DSN` не задан или Postgres недоступен, backend не стартует.

## Публикация статей

Сейчас источник статей - markdown-файлы в `content/posts`. Frontend их не импортирует: Go backend читает эти файлы и отдает JSON через `/api/articles`, `/api/articles/{slug}` и `/api/tags`.

GitHub Action собирает frontend, собирает Go-бинарник, деплоит `dist`, `content` и `blog-server` на VPS. Runtime-метрики хранятся в Postgres, поэтому деплой файлов их не трогает.

Для автоперезапуска backend после деплоя добавь repository variable или secret `SYSTEMD_SERVICE`, например `egor-blog`. Пример systemd unit лежит в `server/egor-blog.service.example`.

На VPS секреты лучше держать отдельно от unit-файла:

```bash
sudo mkdir -p /etc/egor-blog
sudo cp server/egor-blog.env.example /etc/egor-blog/egor-blog.env
sudo chown root:root /etc/egor-blog/egor-blog.env
sudo chmod 600 /etc/egor-blog/egor-blog.env
```

В `/etc/egor-blog/egor-blog.env` надо заменить пароль в `DB_DSN`.

Nginx в такой схеме должен проксировать сайт в Go-сервер:

```nginx
location / {
  proxy_pass http://127.0.0.1:8787;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}
```

Перед открытием сайта проверь, что наружу не слушают backend и база:

```bash
ss -ltnp | grep -E ':(5432|55432|8787|80|443)'
```

Хорошо: `127.0.0.1:5432` и `127.0.0.1:8787`, наружу только `0.0.0.0:80` / `0.0.0.0:443`.

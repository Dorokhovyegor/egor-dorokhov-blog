# Публикация статей и обновление бэка

Сейчас сайт работает как монолит: Go-бэкенд отдает API и статику фронта, Postgres хранит просмотры, лайки и посещения. На VPS наружу должны смотреть только `80/443`, сам Go-сервер слушает `127.0.0.1:8787`, Postgres слушает `127.0.0.1:5432`.

## Быстрый сценарий

```bash
npm run post:new -- "Название статьи" --tag карьера
npm run content:check
npm run check
git add content/posts
git commit -m "Add post: nazvanie-stati"
git push origin main
```

После `git push` GitHub Action сам соберет фронт, проверит Go-бэкенд, соберет бинарь, зальет `dist/`, `content/` и `blog-server` на VPS, затем перезапустит systemd-сервис.

## Новая статья

Команда создает черновик в `content/posts`:

```bash
npm run post:new -- "Что бы я делал в Android в 2026" --tag android --tag карьера
```

По умолчанию `published: false`. Когда статья готова, поменяй в файле:

```yaml
published: true
```

Полезные опции:

```bash
npm run post:new -- "Название" --slug custom-slug
npm run post:new -- "Название" --date 2026-05-11
npm run post:new -- "Название" --excerpt "Короткое описание"
npm run post:new -- "Название" --published
```

## Проверки

```bash
npm run content:check
```

Проверяет обязательные поля, формат даты, дубли `slug` и допустимые символы в URL. Если имя markdown-файла отличается от `slug`, это только предупреждение.

```bash
npm run check
```

Полная локальная проверка перед пушем: контент, фронт, Go-тесты и сборка Go-пакета.

## Локальная разработка

Поднять локальный Postgres:

```bash
npm run dev:db
```

Запустить Go-монолит:

```bash
npm run dev:server
```

Запустить Vite отдельно, если хочется привычный hot reload:

```bash
npm run dev
```

Vite проксирует `/api` на `http://127.0.0.1:8787`.

## Обновление бэкенда

Обычный путь такой же:

```bash
npm run check
git add .
git commit -m "Update backend"
git push origin main
```

GitHub Action пересоберет бинарь и перезапустит `egor-blog.service` на VPS. Базу данных деплой не трогает, поэтому лайки и просмотры сохраняются между релизами.

## Проверка на VPS после деплоя

```bash
sudo systemctl status egor-blog --no-pager
curl http://127.0.0.1:8787/api/health
curl http://127.0.0.1:8787/api/articles | head -c 300
```

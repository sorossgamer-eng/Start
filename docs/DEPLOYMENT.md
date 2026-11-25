# DEPLOYMENT.md — Инструкция по деплою

> Пошаговое руководство для новичка.
> Время выполнения: ~1 час при первом деплое.

---

## Что куда деплоится

| Часть | Где живёт | Адрес |
|---|---|---|
| Mini App (фронтенд) | GitHub Pages | `https://sorossgamer-eng.github.io/Start/tg-app/index.html` |
| Бэкенд (API + панель) | Beget VPS | `http://155.212.208.8/` |
| База данных | Supabase | `eijhjcgjnhvzfiqsjvlf.supabase.co` |

---

## Часть 1 — GitHub Pages (фронтенд)

GitHub Pages публикует HTML-файлы автоматически при каждом `git push`.
Ничего настраивать не нужно — просто пушишь код, через 1-2 минуты сайт обновляется.

### Как задеплоить изменения в Mini App:

```bash
# В терминале VS Code (в папке demo-project)
git add tg-app/index.html
git commit -m "Описание изменений"
git push origin main
```

Проверить результат: открыть в браузере
`https://sorossgamer-eng.github.io/Start/tg-app/index.html`

---

## Часть 2 — Beget VPS (бэкенд)

### Данные для подключения

| Параметр | Значение |
|---|---|
| IP | `155.212.208.8` |
| Логин | `root` |
| Пароль | (хранится в личном кабинете Beget → VPS → Настройки) |

### Подключение к серверу

В терминале VS Code (`Ctrl + ~`):
```bash
ssh root@155.212.208.8
```
Введи пароль (символы не отображаются — это нормально).

---

## Первый деплой на VPS (с нуля)

> Если сервер уже настроен — переходи к разделу "Обновление бэкенда".

### Шаг 1 — Установить Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
node --version  # должно показать v20.x.x
```

### Шаг 2 — Установить PM2

```bash
npm install -g pm2
```

### Шаг 3 — Установить Nginx

```bash
apt-get install -y nginx
```

### Шаг 4 — Скачать проект с GitHub

```bash
git clone https://github.com/sorossgamer-eng/Start.git /var/www/remontpro
cd /var/www/remontpro/backend
npm install
```

### Шаг 5 — Создать файл настроек (.env)

```bash
echo 'PORT=3000' > .env
echo 'DATABASE_URL=postgresql://postgres.eijhjcgjnhvzfiqsjvlf:ПАРОЛЬ@aws-1-eu-central-1.pooler.supabase.com:5432/postgres' >> .env
echo 'JWT_SECRET=RemontPro_JWT_Secret_2026_xK9mP3nQ' >> .env
echo 'ADMIN_USERNAME=alex' >> .env
echo 'ADMIN_PASSWORD=RemontPro2026!' >> .env
```

⚠️ Замени `ПАРОЛЬ` на реальный пароль базы данных из Supabase
(Dashboard → Connect → Session Pooler).

Проверь что всё записалось:
```bash
cat .env
```

### Шаг 6 — Настроить Nginx

Создай файл конфига через файловый менеджер Beget:
- Путь: `/etc/nginx/sites-available/nginx-remontpro.conf`
- Содержимое:

```nginx
server {
    listen 80;
    server_name 155.212.208.8;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Активируй конфиг:
```bash
ln -s /etc/nginx/sites-available/nginx-remontpro.conf /etc/nginx/sites-enabled/remontpro
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
```

### Шаг 7 — Запустить бэкенд

```bash
cd /var/www/remontpro/backend
pm2 start src/app.js --name remontpro
pm2 save
pm2 startup
```

### Шаг 8 — Проверить

```bash
curl http://localhost:3000/
# Должно вернуть: {"status":"ok","message":"РемонтПро API работает 🚀"}

curl http://155.212.208.8/
# То же самое — теперь доступно из интернета
```

---

## Обновление бэкенда (после изменений в коде)

Когда изменил код на локальном компьютере и запушил на GitHub — обнови сервер:

```bash
# Подключись к серверу
ssh root@155.212.208.8

# Перейди в папку проекта
cd /var/www/remontpro

# Скачай последние изменения с GitHub
git pull origin main

# Установить новые зависимости (если добавились)
cd backend && npm install

# Перезапустить сервер
pm2 restart remontpro

# Проверить что работает
pm2 status
```

---

## База данных — Supabase

### Данные подключения

| Параметр | Значение |
|---|---|
| Dashboard | `supabase.com/dashboard/project/eijhjcgjnhvzfiqsjvlf` |
| Region | Frankfurt (EU) |
| Метод | Session Pooler (IPv4) |

### Запустить SQL-скрипт заново (если нужно пересоздать таблицы)

1. Открой Supabase Dashboard → SQL Editor
2. Вставь содержимое файла `backend/db/schema.sql`
3. Нажми Run

### Обновить данные тестового подрядчика

```sql
-- Установить бот и chat_id
UPDATE contractors
SET bot_token = 'ТОКЕН_БОТА', bot_chat_id = ЧАТ_ID
WHERE slug = 'remontpro-demo';
```

---

## Панель подрядчика

Файл: `backend/panel/index.html` — открывать напрямую в браузере (двойной клик).

**Тестовые данные для входа:**
- Email: `demo@example.com`
- Пароль: `Demo2026!`

При открытии панели сервер должен быть запущен (PM2 статус `online`).

---

## Telegram бот

| Параметр | Значение |
|---|---|
| Username | `@Sprinter7_bot` |
| Token | В файле `tg-app/.env` |
| Chat ID администратора | `5232656243` |

Уведомления о заявках приходят в бот автоматически при каждой новой заявке из Mini App.

---

## Частые проблемы

### Сервер не отвечает по IP

```bash
pm2 status          # проверить что remontpro = online
pm2 logs remontpro  # посмотреть ошибки
systemctl status nginx
```

### SSH отказывает в соединении

Причина: fail2ban заблокировал IP после нескольких неверных паролей.
Решение: войти через VNC консоль в панели Beget → сбросить блокировку или изменить пароль.

### База данных недоступна

Ошибка: `getaddrinfo ENOTFOUND`
Причина: DNS не резолвит хост Supabase.
Решение: использовать Session Pooler URL (не Direct connection) — он совместим с IPv4.

### После перезагрузки сервера бэкенд не запустился

```bash
pm2 resurrect       # восстановить сохранённые процессы
pm2 save            # сохранить текущий список процессов
```

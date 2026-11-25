# BACKEND-PLAN.md — Архитектура бэкенда платформы

> Документ для разработки бэкенда под ключ.
> Платформа позволяет подрядчикам ремонта квартир разворачивать
> персональное Telegram Mini App за минуты.

---

## 1. Роли в системе

```
Платформа (Александр)
    │
    ├── добавляет вручную
    ▼
Подрядчик (мастер по ремонту)
    │  настраивает бренд, услуги, цены, фото в веб-панели
    │  вводит токен своего бота
    ▼
Клиент подрядчика
       открывает Mini App → считает стоимость → оставляет заявку
```

| Роль | Доступ | Что видит/делает |
|------|--------|-----------------|
| **Администратор** (Александр) | Закрытая веб-панель | Добавляет подрядчиков, управляет подписками |
| **Подрядчик** | Личная веб-панель | Настраивает бренд, услуги, портфолио, бота |
| **Клиент** | Только Mini App | Считает стоимость ремонта, оставляет заявку |

---

## 2. Технический стек

| Компонент | Решение | Почему |
|-----------|---------|--------|
| Язык бэкенда | **Node.js + Express** | Лучшая экосистема для Telegram Bot API, быстрый старт |
| База данных | **PostgreSQL** | Реляционная структура, подходит для мультитенантности |
| Кэш / сессии | **Redis** | Быстрые сессии для веб-панели подрядчика |
| Хранилище файлов | **Локальная папка на VPS** (→ позже S3) | Фото портфолио |
| Хостинг | **Beget VPS** (Ubuntu) | Требование заказчика |
| Процесс-менеджер | **PM2** | Авторестарт, логи |
| Reverse proxy | **Nginx** | HTTPS, роутинг доменов |
| Оплата | **ЮКасса** | Карта + QR-код, популярно в РФ |
| Email | **Nodemailer + SMTP Beget** | Уведомления подрядчику |
| Telegram боты | **node-telegram-bot-api** | Вебхуки для каждого бота подрядчика |

---

## 3. Структура базы данных

### 3.1 Таблица `contractors` — подрядчики

```sql
CREATE TABLE contractors (
  id              SERIAL PRIMARY KEY,
  slug            VARCHAR(60) UNIQUE NOT NULL,  -- уникальный URL: app.ru/c/slug
  brand_name      VARCHAR(120) NOT NULL,         -- «СтройМастер Краснодар»
  tagline         VARCHAR(200),                  -- слоган под названием
  logo_url        VARCHAR(500),                  -- путь к логотипу
  accent_color    VARCHAR(7) DEFAULT '#2AABEE',  -- HEX акцентного цвета темы
  theme_id        INTEGER REFERENCES themes(id), -- White Label тема (платно)

  -- Контакты подрядчика (не видны клиентам)
  owner_name      VARCHAR(120) NOT NULL,
  owner_email     VARCHAR(200) NOT NULL,
  owner_phone     VARCHAR(20),

  -- Telegram бот подрядчика
  bot_token       VARCHAR(200) UNIQUE,           -- токен от @BotFather
  bot_username    VARCHAR(100),                  -- @username бота
  bot_chat_id     BIGINT,                        -- куда слать заявки
  webhook_set     BOOLEAN DEFAULT FALSE,

  -- Подписка
  plan            VARCHAR(20) DEFAULT 'free',    -- 'free' | 'pro'
  plan_expires_at TIMESTAMPTZ,

  -- Системные
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  notes           TEXT                           -- заметки администратора
);
```

### 3.2 Таблица `services` — услуги подрядчика

```sql
CREATE TABLE services (
  id              SERIAL PRIMARY KEY,
  contractor_id   INTEGER REFERENCES contractors(id) ON DELETE CASCADE,
  name            VARCHAR(120) NOT NULL,          -- «Капитальный ремонт»
  icon            VARCHAR(10) DEFAULT '🔨',       -- эмодзи иконки
  price_per_sqm   INTEGER,                        -- цена за м² (NULL если flat)
  flat_price      INTEGER,                        -- фиксированная цена (NULL если за м²)
  description     VARCHAR(300),
  is_popular      BOOLEAN DEFAULT FALSE,          -- показывать плашку «Популярно»
  is_active       BOOLEAN DEFAULT TRUE,
  sort_order      INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
-- Ограничение: free план — максимум 1 активная услуга
```

**Бесплатная услуга** по умолчанию при регистрации подрядчика:
```json
{
  "name": "Выезд замерщика",
  "icon": "📐",
  "flat_price": 0,
  "description": "Бесплатный выезд для замера и составления сметы"
}
```

### 3.3 Таблица `portfolio_items` — портфолио

```sql
CREATE TABLE portfolio_items (
  id              SERIAL PRIMARY KEY,
  contractor_id   INTEGER REFERENCES contractors(id) ON DELETE CASCADE,
  title           VARCHAR(150) NOT NULL,          -- «Кухня-гостиная, Краснодар»
  repair_type     VARCHAR(80),                    -- «Капитальный»
  area_sqm        INTEGER,                        -- 68
  duration_days   INTEGER,                        -- 45
  cost_rub        INTEGER,                        -- 2400000
  description     TEXT,
  image_url       VARCHAR(500),                   -- путь к фото
  sort_order      INTEGER DEFAULT 0,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
-- Ограничение: free план — максимум 0 фото (портфолио недоступно)
-- pro план — без ограничений
```

### 3.4 Таблица `leads` — заявки клиентов

```sql
CREATE TABLE leads (
  id              SERIAL PRIMARY KEY,
  contractor_id   INTEGER REFERENCES contractors(id),
  -- Данные клиента
  client_name     VARCHAR(120) NOT NULL,
  client_phone    VARCHAR(30) NOT NULL,
  call_time       VARCHAR(50),                   -- «Утром», «Днём», «Вечером»
  -- Параметры расчёта
  repair_type     VARCHAR(80),
  area_sqm        INTEGER,
  city            VARCHAR(80),
  city_coeff      DECIMAL(4,2),
  estimated_cost  INTEGER,                       -- предварительный расчёт в ₽
  -- Telegram пользователь
  tg_user_id      BIGINT,
  tg_username     VARCHAR(100),
  tg_first_name   VARCHAR(100),
  -- Статус обработки
  status          VARCHAR(30) DEFAULT 'new',     -- 'new' | 'called' | 'in_work' | 'done' | 'rejected'
  manager_note    TEXT,
  -- Системные
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  notified_tg     BOOLEAN DEFAULT FALSE,         -- отправлено ли в Telegram
  notified_email  BOOLEAN DEFAULT FALSE          -- отправлено ли на email
);
```

### 3.5 Таблица `subscriptions` — история оплат

```sql
CREATE TABLE subscriptions (
  id              SERIAL PRIMARY KEY,
  contractor_id   INTEGER REFERENCES contractors(id),
  plan            VARCHAR(20) NOT NULL,           -- 'pro'
  amount_kopecks  INTEGER NOT NULL,               -- сумма в копейках (ЮКасса)
  period_months   INTEGER DEFAULT 1,
  payment_id      VARCHAR(200),                  -- ID платежа ЮКасса
  payment_status  VARCHAR(30) DEFAULT 'pending', -- 'pending'|'succeeded'|'canceled'
  started_at      TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.6 Таблица `themes` — White Label темы

```sql
CREATE TABLE themes (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(80) NOT NULL,           -- «Синяя», «Тёмная», «Зелёная»
  preview_url     VARCHAR(500),
  accent_color    VARCHAR(7),
  bg_color        VARCHAR(7),
  header_color    VARCHAR(7),
  is_active       BOOLEAN DEFAULT TRUE
);
```

### 3.7 Таблица `admins` — администраторы платформы

```sql
CREATE TABLE admins (
  id              SERIAL PRIMARY KEY,
  username        VARCHAR(80) UNIQUE NOT NULL,
  password_hash   VARCHAR(200) NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 4. API эндпоинты

### 4.1 Публичное API (вызывается из Mini App)

```
GET  /api/app/:slug/config
     → Конфиг подрядчика: бренд, услуги, портфолио
     → Кэшируется в Redis 5 минут

POST /api/app/:slug/lead
     Body: { client_name, client_phone, repair_type, area, city,
             city_coeff, estimated_cost, call_time, tg_user_id }
     → Сохраняет заявку в БД
     → Отправляет уведомление в Telegram бот подрядчика
     → Отправляет email подрядчику
     → Возвращает { ok: true, lead_id }
```

Пример ответа `/api/app/stroymasters/config`:
```json
{
  "brand": {
    "name": "СтройМастер",
    "tagline": "Ремонт квартир в Краснодаре",
    "logo_url": "/uploads/logos/stroymasters.png",
    "accent_color": "#FF6B35"
  },
  "services": [
    { "id": 1, "name": "Косметический", "price_per_sqm": 900, "icon": "🖌️",
      "description": "Обои, покраска, напольное покрытие", "is_popular": false },
    { "id": 2, "name": "Капитальный", "price_per_sqm": 2500, "icon": "🔨",
      "description": "Замена труб, проводки, полный цикл", "is_popular": true }
  ],
  "portfolio": [
    { "id": 1, "title": "Гостиная, Краснодар", "area_sqm": 55,
      "duration_days": 40, "cost_rub": 1800000, "image_url": "/uploads/..." }
  ],
  "cities": [
    { "name": "Краснодар", "coeff": 1.0 },
    { "name": "Сочи", "coeff": 1.2 },
    { "name": "Другой", "coeff": 0.9 }
  ]
}
```

### 4.2 API веб-панели подрядчика (требует авторизации)

**Авторизация:**
```
POST /api/contractor/auth/login   → { email, password } → JWT токен
POST /api/contractor/auth/logout
GET  /api/contractor/auth/me      → профиль + план подписки
```

**Профиль и бренд:**
```
GET  /api/contractor/profile
PUT  /api/contractor/profile
     Body: { brand_name, tagline, accent_color, theme_id }

POST /api/contractor/logo         → загрузка логотипа (multipart)
POST /api/contractor/bot-token
     Body: { token }
     → Проверяет токен через Telegram API (getMe)
     → Сохраняет bot_username
     → Устанавливает webhook
     → Устанавливает описание и команды бота
```

**Услуги:**
```
GET    /api/contractor/services
POST   /api/contractor/services
       Проверка: free план → отказ если уже есть 1 услуга
PUT    /api/contractor/services/:id
DELETE /api/contractor/services/:id
PUT    /api/contractor/services/reorder  → Body: [{ id, sort_order }]
```

**Портфолио:**
```
GET    /api/contractor/portfolio
POST   /api/contractor/portfolio          → multipart, загрузка фото
       Проверка: free план → отказ (портфолио только pro)
PUT    /api/contractor/portfolio/:id
DELETE /api/contractor/portfolio/:id
```

**Заявки:**
```
GET  /api/contractor/leads                → с фильтрами: status, date_from, date_to
GET  /api/contractor/leads/:id
PUT  /api/contractor/leads/:id/status    → Body: { status, manager_note }
```

**Подписка:**
```
GET  /api/contractor/subscription         → текущий план, дата истечения
POST /api/contractor/subscription/pay     → создаёт платёж в ЮКасса, возвращает URL
POST /api/contractor/subscription/webhook → вебхук от ЮКасса (подпись проверяется)
```

### 4.3 API администратора платформы (только Александр)

```
POST /api/admin/auth/login
GET  /api/admin/contractors              → список всех подрядчиков
POST /api/admin/contractors              → добавить подрядчика вручную
PUT  /api/admin/contractors/:id
PUT  /api/admin/contractors/:id/plan    → Body: { plan, expires_at }
DELETE /api/admin/contractors/:id       → деактивировать
GET  /api/admin/leads                   → все заявки платформы
GET  /api/admin/stats                   → кол-во подрядчиков, заявок, выручка
```

### 4.4 Telegram вебхуки

```
POST /webhook/:bot_token
     → Определяет подрядчика по bot_token
     → При /start — отправляет кнопку «Открыть приложение» (InlineKeyboardButton WebApp)
     → При /help  — отправляет контакты подрядчика
```

---

## 5. Логика уведомлений о заявке

При поступлении заявки (`POST /api/app/:slug/lead`) бэкенд:

**1. Сохраняет в БД**

**2. Отправляет в Telegram бот подрядчика:**
```
🔔 Новая заявка!

👤 Иванов Иван
📞 +7 999 123-45-67
🕐 Удобное время: Утром

🏠 Капитальный ремонт
📐 Площадь: 60 м²
🏙 Город: Москва
💰 Предварительно: 195 000 ₽

⏰ 14:32, 29 марта 2026
```

**3. Отправляет email подрядчику** (та же информация в HTML-письме)

---

## 6. Ограничения по тарифам

| Функция | Free | Pro |
|---------|------|-----|
| Услуги в калькуляторе | 1 (выезд замерщика) | Без ограничений |
| Портфолио | Недоступно | Без ограничений |
| Выбор темы (WhiteLabel) | Нет | Да |
| Уведомления в Telegram | Да | Да |
| Уведомления на email | Да | Да |
| Заявки в панели | Да | Да |

---

## 7. Схема установки бота подрядчиком

```
1. Подрядчик заходит на BotFather → /newbot → получает токен
2. Вводит токен в веб-панели → POST /api/contractor/bot-token
3. Бэкенд:
   a. GET https://api.telegram.org/bot{token}/getMe  → проверка токена
   b. SET WEBHOOK → https://ваш-сервер.ru/webhook/{token}
   c. setMyDescription → «Калькулятор ремонта от {brand_name}»
   d. setMyCommands → /start, /help
   e. Сохраняет bot_username в БД
4. Подрядчик получает готовую ссылку на Mini App:
   https://ваш-сервер.ru/app/{slug}
   и публичную ссылку на бота: https://t.me/{bot_username}
```

---

## 8. Структура проекта (Node.js)

```
backend/
├── src/
│   ├── routes/
│   │   ├── app.js         — публичное API Mini App
│   │   ├── contractor.js  — панель подрядчика
│   │   ├── admin.js       — панель администратора
│   │   └── webhook.js     — Telegram вебхуки
│   ├── services/
│   │   ├── telegram.js    — отправка сообщений, установка вебхуков
│   │   ├── email.js       — отправка писем через Nodemailer
│   │   ├── payment.js     — интеграция с ЮКасса
│   │   └── limits.js      — проверка ограничений тарифа
│   ├── middleware/
│   │   ├── auth.js        — проверка JWT (подрядчик / админ)
│   │   └── upload.js      — загрузка файлов (multer)
│   ├── db/
│   │   ├── index.js       — подключение к PostgreSQL (pg)
│   │   └── migrations/    — SQL-миграции
│   └── app.js             — точка входа Express
├── uploads/               — загруженные файлы (логотипы, фото портфолио)
├── .env                   — токены, строки подключения
├── ecosystem.config.js    — конфиг PM2
└── package.json
```

---

## 9. Переменные окружения (.env)

```env
# Сервер
PORT=3000
BASE_URL=https://ваш-домен.ru

# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=remontpro
DB_USER=remontpro_user
DB_PASS=...

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=...
JWT_EXPIRES_IN=7d

# ЮКасса
YOOKASSA_SHOP_ID=...
YOOKASSA_SECRET_KEY=...

# Email (SMTP Beget)
SMTP_HOST=mail.beget.com
SMTP_PORT=465
SMTP_USER=notify@ваш-домен.ru
SMTP_PASS=...

# Администратор
ADMIN_PASSWORD_HASH=...
```

---

## 10. Этапы разработки (приоритет)

| # | Этап | Что входит |
|---|------|-----------|
| 1 | **Ядро** | БД + миграции, публичное API (config + lead), Telegram уведомление |
| 2 | **Панель подрядчика** | Авторизация, редактирование бренда, услуги, заявки |
| 3 | **Бот** | Webhook роутер, /start с кнопкой Mini App, /help |
| 4 | **Портфолио** | Загрузка фото, отображение в Mini App |
| 5 | **Монетизация** | ЮКасса, проверка тарифа, темы WhiteLabel |
| 6 | **Панель администратора** | Управление подрядчиками, статистика |

---

*Документ актуален для разработки с нуля на Beget VPS.
Перед началом этапа 5 — уточнить цену подписки и ID магазина ЮКасса.*

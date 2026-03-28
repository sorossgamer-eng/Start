-- ============================================================
-- SCHEMA.SQL — База данных платформы РемонтПро
-- Supabase / PostgreSQL
-- Создаёт все таблицы, индексы и начальные данные
-- ============================================================

-- Порядок важен: сначала таблицы без зависимостей


-- ------------------------------------------------------------
-- 1. themes — White Label темы оформления
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS themes (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(80)  NOT NULL,           -- «Синяя», «Тёмная», «Зелёная»
  preview_url     VARCHAR(500),
  accent_color    VARCHAR(7),
  bg_color        VARCHAR(7),
  header_color    VARCHAR(7),
  is_active       BOOLEAN DEFAULT TRUE
);


-- ------------------------------------------------------------
-- 2. admins — администраторы платформы (только Александр)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admins (
  id              SERIAL PRIMARY KEY,
  username        VARCHAR(80)  UNIQUE NOT NULL,
  password_hash   VARCHAR(200) NOT NULL,
  created_at      TIMESTAMPTZ  DEFAULT NOW()
);


-- ------------------------------------------------------------
-- 3. contractors — подрядчики ремонта
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contractors (
  id              SERIAL PRIMARY KEY,
  slug            VARCHAR(60)  UNIQUE NOT NULL,    -- уникальный URL: /app/slug
  brand_name      VARCHAR(120) NOT NULL,
  tagline         VARCHAR(200),
  logo_url        VARCHAR(500),
  accent_color    VARCHAR(7)   DEFAULT '#2AABEE',  -- HEX цвет кнопок в Mini App
  theme_id        INTEGER REFERENCES themes(id),

  -- Контакты (не видны клиентам)
  owner_name      VARCHAR(120) NOT NULL,
  owner_email     VARCHAR(200) NOT NULL,
  owner_phone     VARCHAR(20),

  -- Telegram бот подрядчика
  bot_token       VARCHAR(200) UNIQUE,
  bot_username    VARCHAR(100),
  bot_chat_id     BIGINT,
  webhook_set     BOOLEAN      DEFAULT FALSE,

  -- Тариф
  plan            VARCHAR(20)  DEFAULT 'free',     -- 'free' | 'pro'
  plan_expires_at TIMESTAMPTZ,

  -- Системные
  is_active       BOOLEAN      DEFAULT TRUE,
  created_at      TIMESTAMPTZ  DEFAULT NOW(),
  notes           TEXT                             -- заметки Александра
);


-- ------------------------------------------------------------
-- 4. services — услуги подрядчика (карточки в калькуляторе)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS services (
  id              SERIAL PRIMARY KEY,
  contractor_id   INTEGER      NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  name            VARCHAR(120) NOT NULL,
  icon            VARCHAR(10)  DEFAULT '🔨',
  price_per_sqm   INTEGER,                         -- цена за м² (NULL если flat_price)
  flat_price      INTEGER,                         -- фиксированная цена (NULL если за м²)
  description     VARCHAR(300),
  is_popular      BOOLEAN      DEFAULT FALSE,
  is_active       BOOLEAN      DEFAULT TRUE,
  sort_order      INTEGER      DEFAULT 0,
  created_at      TIMESTAMPTZ  DEFAULT NOW()
);


-- ------------------------------------------------------------
-- 5. portfolio_items — портфолио выполненных объектов
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS portfolio_items (
  id              SERIAL PRIMARY KEY,
  contractor_id   INTEGER      NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  title           VARCHAR(150) NOT NULL,           -- «Кухня-гостиная, Краснодар»
  repair_type     VARCHAR(80),
  area_sqm        INTEGER,
  duration_days   INTEGER,
  cost_rub        INTEGER,
  description     TEXT,
  image_url       VARCHAR(500),
  sort_order      INTEGER      DEFAULT 0,
  is_active       BOOLEAN      DEFAULT TRUE,
  created_at      TIMESTAMPTZ  DEFAULT NOW()
);


-- ------------------------------------------------------------
-- 6. leads — заявки клиентов
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS leads (
  id              SERIAL PRIMARY KEY,
  contractor_id   INTEGER      NOT NULL REFERENCES contractors(id),

  -- Данные клиента
  client_name     VARCHAR(120) NOT NULL,
  client_phone    VARCHAR(30)  NOT NULL,
  call_time       VARCHAR(50),                     -- «Утром», «Днём», «Вечером»

  -- Параметры расчёта
  repair_type     VARCHAR(80),
  area_sqm        INTEGER,
  city            VARCHAR(80),
  city_coeff      DECIMAL(4,2),
  estimated_cost  INTEGER,                         -- в рублях

  -- Telegram пользователь
  tg_user_id      BIGINT,
  tg_username     VARCHAR(100),
  tg_first_name   VARCHAR(100),

  -- Статус
  status          VARCHAR(30)  DEFAULT 'new',      -- 'new'|'called'|'in_work'|'done'|'rejected'
  manager_note    TEXT,

  -- Системные
  created_at      TIMESTAMPTZ  DEFAULT NOW(),
  notified_tg     BOOLEAN      DEFAULT FALSE,
  notified_email  BOOLEAN      DEFAULT FALSE
);


-- ------------------------------------------------------------
-- 7. subscriptions — история платежей ЮКасса
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscriptions (
  id              SERIAL PRIMARY KEY,
  contractor_id   INTEGER      NOT NULL REFERENCES contractors(id),
  plan            VARCHAR(20)  NOT NULL,           -- 'pro'
  amount_kopecks  INTEGER      NOT NULL,           -- в копейках (100₽ = 10000)
  period_months   INTEGER      DEFAULT 1,
  payment_id      VARCHAR(200),                    -- ID платежа в ЮКасса
  payment_status  VARCHAR(30)  DEFAULT 'pending',  -- 'pending'|'succeeded'|'canceled'
  started_at      TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ  DEFAULT NOW()
);


-- ============================================================
-- ИНДЕКСЫ — ускоряют поиск по часто используемым полям
-- ============================================================

-- Быстрый поиск подрядчика по slug (используется при каждом запросе Mini App)
CREATE INDEX IF NOT EXISTS idx_contractors_slug       ON contractors(slug);
-- Быстрый поиск активных подрядчиков
CREATE INDEX IF NOT EXISTS idx_contractors_active     ON contractors(is_active);
-- Услуги подрядчика
CREATE INDEX IF NOT EXISTS idx_services_contractor    ON services(contractor_id);
-- Портфолио подрядчика
CREATE INDEX IF NOT EXISTS idx_portfolio_contractor   ON portfolio_items(contractor_id);
-- Заявки по подрядчику + дата (для фильтров в панели)
CREATE INDEX IF NOT EXISTS idx_leads_contractor       ON leads(contractor_id);
CREATE INDEX IF NOT EXISTS idx_leads_created          ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_status           ON leads(status);
-- Платежи по подрядчику
CREATE INDEX IF NOT EXISTS idx_subscriptions_contractor ON subscriptions(contractor_id);


-- ============================================================
-- НАЧАЛЬНЫЕ ДАННЫЕ
-- ============================================================

-- Базовые темы оформления
INSERT INTO themes (name, accent_color, bg_color, header_color) VALUES
  ('Синяя (по умолчанию)',  '#2AABEE', '#FFFFFF', '#2AABEE'),
  ('Тёмная',               '#BB86FC', '#121212', '#1E1E1E'),
  ('Зелёная',              '#4CAF50', '#FFFFFF', '#4CAF50'),
  ('Оранжевая',            '#FF6B35', '#FFFFFF', '#FF6B35')
ON CONFLICT DO NOTHING;


-- ============================================================
-- ПРИМЕР ДАННЫХ — тестовый подрядчик "РемонтПро"
-- (удалить перед продакшном или оставить для демо)
-- ============================================================

INSERT INTO contractors (slug, brand_name, tagline, accent_color, owner_name, owner_email, owner_phone, plan)
VALUES (
  'remontpro-demo',
  'РемонтПро',
  'Ремонт квартир под ключ в Москве',
  '#2AABEE',
  'Демо Подрядчик',
  'demo@example.com',
  '+7 (495) 000-00-00',
  'pro'
) ON CONFLICT (slug) DO NOTHING;

-- Услуги для тестового подрядчика
INSERT INTO services (contractor_id, name, icon, price_per_sqm, flat_price, description, is_popular, sort_order)
SELECT
  c.id,
  v.name, v.icon, v.price_per_sqm, v.flat_price, v.description, v.is_popular, v.sort_order
FROM contractors c
CROSS JOIN (VALUES
  ('Косметический',  '🖌️',  900,  NULL,  'Обои, покраска, напольное покрытие',           FALSE, 1),
  ('Капитальный',    '🔨',  2500, NULL,  'Замена труб, проводки, полный цикл',            TRUE,  2),
  ('Под ключ',       '🏠',  3500, NULL,  'От чернового до финишного — заезжаете готовым', FALSE, 3),
  ('Дизайнерский',   '✨',  6000, NULL,  'Авторские решения, premium-отделка',            FALSE, 4),
  ('Новостройка',    '🏗️', 2200, NULL,  'Специализация — 500+ объектов опыта',           FALSE, 5),
  ('Санузел',        '🚿', NULL,  85000, 'Полная реконструкция ванной и туалета',         FALSE, 6)
) AS v(name, icon, price_per_sqm, flat_price, description, is_popular, sort_order)
WHERE c.slug = 'remontpro-demo'
ON CONFLICT DO NOTHING;

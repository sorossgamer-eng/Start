// Публичное API — вызывается из Telegram Mini App
// Два эндпоинта: получить конфиг подрядчика + принять заявку

const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/app/:slug/config
// Возвращает настройки подрядчика: бренд, услуги, портфолио
router.get('/:slug/config', async (req, res) => {
  try {
    const { slug } = req.params;

    // Ищем подрядчика по slug
    const contractorResult = await db.query(
      `SELECT id, brand_name, tagline, logo_url, accent_color
       FROM contractors
       WHERE slug = $1 AND is_active = TRUE`,
      [slug]
    );

    if (contractorResult.rows.length === 0) {
      return res.status(404).json({ error: 'Подрядчик не найден' });
    }

    const contractor = contractorResult.rows[0];

    // Получаем активные услуги
    const servicesResult = await db.query(
      `SELECT id, name, icon, price_per_sqm, flat_price, description, is_popular
       FROM services
       WHERE contractor_id = $1 AND is_active = TRUE
       ORDER BY sort_order`,
      [contractor.id]
    );

    // Получаем портфолио
    const portfolioResult = await db.query(
      `SELECT id, title, repair_type, area_sqm, duration_days, cost_rub, image_url
       FROM portfolio_items
       WHERE contractor_id = $1 AND is_active = TRUE
       ORDER BY sort_order`,
      [contractor.id]
    );

    res.json({
      brand: {
        name:         contractor.brand_name,
        tagline:      contractor.tagline,
        logo_url:     contractor.logo_url,
        accent_color: contractor.accent_color
      },
      services:  servicesResult.rows,
      portfolio: portfolioResult.rows
    });

  } catch (err) {
    console.error('Ошибка /config:', err.message);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});


// POST /api/app/:slug/lead
// Принимает заявку от клиента Mini App
router.post('/:slug/lead', async (req, res) => {
  try {
    const { slug } = req.params;
    const {
      client_name, client_phone, call_time,
      repair_type, area_sqm, city, city_coeff, estimated_cost,
      tg_user_id, tg_username, tg_first_name
    } = req.body;

    // Валидация обязательных полей
    if (!client_name || !client_phone) {
      return res.status(400).json({ error: 'Имя и телефон обязательны' });
    }

    // Находим подрядчика
    const contractorResult = await db.query(
      'SELECT id FROM contractors WHERE slug = $1 AND is_active = TRUE',
      [slug]
    );

    if (contractorResult.rows.length === 0) {
      return res.status(404).json({ error: 'Подрядчик не найден' });
    }

    const contractor_id = contractorResult.rows[0].id;

    // Сохраняем заявку в БД
    const leadResult = await db.query(
      `INSERT INTO leads
         (contractor_id, client_name, client_phone, call_time,
          repair_type, area_sqm, city, city_coeff, estimated_cost,
          tg_user_id, tg_username, tg_first_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING id`,
      [contractor_id, client_name, client_phone, call_time,
       repair_type, area_sqm, city, city_coeff, estimated_cost,
       tg_user_id, tg_username, tg_first_name]
    );

    const lead_id = leadResult.rows[0].id;
    console.log(`✅ Новая заявка #${lead_id} для подрядчика slug=${slug}`);

    res.json({ ok: true, lead_id });

  } catch (err) {
    console.error('Ошибка /lead:', err.message);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;

// API панели подрядчика
// Все маршруты требуют авторизации (кроме /auth/login)

const express  = require('express');
const router   = express.Router();
const jwt      = require('jsonwebtoken');
const bcrypt   = require('bcrypt');
const db       = require('../db');
const auth     = require('../middleware/auth');

// ============================================================
// АВТОРИЗАЦИЯ
// ============================================================

// POST /api/contractor/auth/login
router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email и пароль обязательны' });
    }

    const result = await db.query(
      'SELECT id, slug, owner_email, owner_name, password_hash, plan, is_active FROM contractors WHERE owner_email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    const contractor = result.rows[0];

    if (!contractor.is_active) {
      return res.status(403).json({ error: 'Аккаунт деактивирован' });
    }

    const passwordMatch = await bcrypt.compare(password, contractor.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    const token = jwt.sign(
      { id: contractor.id, slug: contractor.slug, email: contractor.owner_email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      contractor: {
        id:    contractor.id,
        name:  contractor.owner_name,
        email: contractor.owner_email,
        plan:  contractor.plan
      }
    });

  } catch (err) {
    console.error('Ошибка login:', err.message);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// GET /api/contractor/auth/me
router.get('/auth/me', auth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, slug, brand_name, tagline, accent_color, owner_name, owner_email, owner_phone, bot_username, plan, plan_expires_at FROM contractors WHERE id = $1',
      [req.contractor.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});


// ============================================================
// ПРОФИЛЬ И БРЕНД
// ============================================================

// GET /api/contractor/profile
router.get('/profile', auth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, slug, brand_name, tagline, logo_url, accent_color, owner_name, owner_email, owner_phone, bot_username, webhook_set, plan, plan_expires_at FROM contractors WHERE id = $1',
      [req.contractor.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// PUT /api/contractor/profile
router.put('/profile', auth, async (req, res) => {
  try {
    const { brand_name, tagline, accent_color, owner_phone } = req.body;
    await db.query(
      'UPDATE contractors SET brand_name=$1, tagline=$2, accent_color=$3, owner_phone=$4 WHERE id=$5',
      [brand_name, tagline, accent_color, owner_phone, req.contractor.id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});


// ============================================================
// УСЛУГИ
// ============================================================

// GET /api/contractor/services
router.get('/services', auth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, name, icon, price_per_sqm, flat_price, description, is_popular, is_active, sort_order FROM services WHERE contractor_id = $1 ORDER BY sort_order',
      [req.contractor.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// POST /api/contractor/services
router.post('/services', auth, async (req, res) => {
  try {
    // Проверка лимита free-плана
    const contractor = await db.query('SELECT plan FROM contractors WHERE id=$1', [req.contractor.id]);
    if (contractor.rows[0].plan === 'free') {
      const count = await db.query('SELECT COUNT(*) FROM services WHERE contractor_id=$1 AND is_active=TRUE', [req.contractor.id]);
      if (parseInt(count.rows[0].count) >= 1) {
        return res.status(403).json({ error: 'Free план: максимум 1 услуга. Перейдите на Pro.' });
      }
    }

    const { name, icon, price_per_sqm, flat_price, description, is_popular } = req.body;
    const result = await db.query(
      'INSERT INTO services (contractor_id, name, icon, price_per_sqm, flat_price, description, is_popular) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',
      [req.contractor.id, name, icon || '🔨', price_per_sqm, flat_price, description, is_popular || false]
    );
    res.json({ ok: true, id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// PUT /api/contractor/services/:id
router.put('/services/:id', auth, async (req, res) => {
  try {
    const { name, icon, price_per_sqm, flat_price, description, is_popular, is_active } = req.body;
    await db.query(
      'UPDATE services SET name=$1, icon=$2, price_per_sqm=$3, flat_price=$4, description=$5, is_popular=$6, is_active=$7 WHERE id=$8 AND contractor_id=$9',
      [name, icon, price_per_sqm, flat_price, description, is_popular, is_active, req.params.id, req.contractor.id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// DELETE /api/contractor/services/:id
router.delete('/services/:id', auth, async (req, res) => {
  try {
    await db.query('DELETE FROM services WHERE id=$1 AND contractor_id=$2', [req.params.id, req.contractor.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});


// ============================================================
// ЗАЯВКИ
// ============================================================

// GET /api/contractor/leads
router.get('/leads', auth, async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;
    let sql = 'SELECT id, client_name, client_phone, call_time, repair_type, area_sqm, city, estimated_cost, status, manager_note, created_at FROM leads WHERE contractor_id=$1';
    const params = [req.contractor.id];

    if (status) {
      params.push(status);
      sql += ` AND status=$${params.length}`;
    }

    sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// PUT /api/contractor/leads/:id/status
router.put('/leads/:id/status', auth, async (req, res) => {
  try {
    const { status, manager_note } = req.body;
    const allowed = ['new', 'called', 'in_work', 'done', 'rejected'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: 'Недопустимый статус' });
    }
    await db.query(
      'UPDATE leads SET status=$1, manager_note=$2 WHERE id=$3 AND contractor_id=$4',
      [status, manager_note, req.params.id, req.contractor.id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;

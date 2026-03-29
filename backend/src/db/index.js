// Подключение к базе данных PostgreSQL (Supabase)
// Это как "телефонная линия" между бэкендом и базой данных

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Supabase требует SSL
});

// Проверка подключения при старте
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Ошибка подключения к БД:', err.message);
  } else {
    console.log('✅ База данных подключена:', res.rows[0].now);
  }
});

module.exports = pool;

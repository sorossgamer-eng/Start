// Скрипт для установки пароля подрядчику
// Запуск: node scripts/set-password.js <slug> <пароль>
// Пример: node scripts/set-password.js remontpro-demo MyPassword123

require('dotenv').config();
const bcrypt = require('bcrypt');
const db = require('../src/db');

const [,, slug, password] = process.argv;

if (!slug || !password) {
  console.error('Использование: node scripts/set-password.js <slug> <пароль>');
  process.exit(1);
}

async function run() {
  const hash = await bcrypt.hash(password, 10);
  const result = await db.query(
    'UPDATE contractors SET password_hash=$1 WHERE slug=$2 RETURNING id, owner_email',
    [hash, slug]
  );
  if (result.rows.length === 0) {
    console.error(`Подрядчик с slug="${slug}" не найден`);
    process.exit(1);
  }
  console.log(`✅ Пароль установлен для ${result.rows[0].owner_email}`);
  process.exit(0);
}

run().catch(e => { console.error(e.message); process.exit(1); });

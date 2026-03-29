// Точка входа Express-сервера
// Здесь собираются все маршруты и настройки

const express = require('express');
const cors    = require('cors');
require('dotenv').config();

const app = express();

// Разрешаем принимать JSON и запросы с других доменов (Telegram Mini App)
app.use(express.json());
app.use(cors());

// Подключаем маршруты
app.use('/api/app',        require('./routes/app'));
app.use('/api/contractor', require('./routes/contractor'));

// Проверочный маршрут — открой в браузере http://localhost:3000/
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'РемонтПро API работает 🚀' });
});

// Запускаем сервер
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
});

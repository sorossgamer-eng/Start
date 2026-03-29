// Middleware проверки JWT-токена
// Вешается на защищённые маршруты панели подрядчика

const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.contractor = payload; // { id, slug, email }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Токен недействителен или истёк' });
  }
}

module.exports = authMiddleware;

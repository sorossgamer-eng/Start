// Сервис отправки сообщений в Telegram
// Используется для уведомлений подрядчику о новой заявке

const fetch = require('node-fetch');

// Отправляет сообщение в чат через бота подрядчика
async function sendMessage(botToken, chatId, text) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML'
    })
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Telegram API: ${data.description}`);
  return data;
}

// Форматирует заявку в красивое сообщение для подрядчика
function formatLeadMessage(lead, brandName) {
  const date = new Date().toLocaleString('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  const cost = lead.estimated_cost
    ? `${lead.estimated_cost.toLocaleString('ru-RU')} ₽`
    : 'Выезд замерщика (бесплатно)';

  const area = lead.area_sqm ? `${lead.area_sqm} м²` : '—';

  return `🔔 <b>Новая заявка!</b>

👤 ${lead.client_name}
📞 ${lead.client_phone}
🕐 Удобное время: ${lead.call_time || 'не указано'}

🏠 ${lead.repair_type || 'Выезд замерщика'}
📐 Площадь: ${area}
🏙 Город: ${lead.city || '—'}
💰 Предварительно: ${cost}

⏰ ${date}`;
}

// Уведомляет подрядчика о новой заявке
// Если бот не настроен — тихо пропускает, не блокирует заявку
async function notifyContractor(contractor, lead) {
  if (!contractor.bot_token || !contractor.bot_chat_id) {
    console.log(`ℹ️  Бот не настроен для подрядчика id=${contractor.id}, уведомление пропущено`);
    return false;
  }

  try {
    const text = formatLeadMessage(lead, contractor.brand_name);
    await sendMessage(contractor.bot_token, contractor.bot_chat_id, text);
    console.log(`✅ Telegram-уведомление отправлено подрядчику id=${contractor.id}`);
    return true;
  } catch (err) {
    console.error(`❌ Ошибка Telegram для подрядчика id=${contractor.id}:`, err.message);
    return false;
  }
}

module.exports = { sendMessage, notifyContractor, formatLeadMessage };

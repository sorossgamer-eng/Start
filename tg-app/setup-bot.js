// Запусти: node setup-bot.js
// Настраивает бота через Telegram Bot API

const TOKEN = '8709206227:AAGHRBIKwCwK9xr0bssk5cnuRoPmnpTcCME';
const BASE  = `https://api.telegram.org/bot${TOKEN}`;

async function api(method, body) {
  const res = await fetch(`${BASE}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  console.log(`${method}:`, data.ok ? '✅ OK' : `❌ ${data.description}`);
  return data;
}

(async () => {
  // 1. Описание бота
  await api('setMyDescription', {
    description: '🏠 РемонтПро — калькулятор стоимости ремонта квартиры прямо в Telegram.\n\nВыбери тип ремонта, укажи площадь и город — получи расчёт за 30 секунд. Оставь заявку и мы перезвоним.\n\nНажми кнопку «Открыть приложение» 👇',
    language_code: 'ru'
  });

  // 2. Короткое описание
  await api('setMyShortDescription', {
    short_description: 'Расчёт стоимости ремонта квартиры за 30 секунд',
    language_code: 'ru'
  });

  // 3. Команды
  await api('setMyCommands', {
    commands: [
      { command: 'start',   description: 'Запустить калькулятор ремонта' },
      { command: 'help',    description: 'Помощь и часто задаваемые вопросы' },
      { command: 'contact', description: 'Связаться с менеджером' }
    ],
    language_code: 'ru'
  });

  // 4. Кнопка меню → открывает Mini App
  await api('setChatMenuButton', {
    menu_button: {
      type: 'web_app',
      text: '🏠 Открыть приложение',
      web_app: { url: 'https://sorossgamer-eng.github.io/Start/tg-app/index.html' }
    }
  });

  console.log('\nГотово! Бот настроен.');
})();

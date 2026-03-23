# Telegram Mini App — РемонтПро
## Документация для разработчика

---

## Файловая структура

```
tg-app/
├── index.html   — единственный файл приложения (HTML + CSS + JS)
└── CLAUDE.md    — этот файл
```

Всё приложение находится в **одном файле** `index.html` согласно правилам проекта.

---

## Экраны и навигация

```
screen-welcome    →  screen-type    →  screen-params
                                            ↓
screen-portfolio  ←  screen-success  ←  screen-result
                                            ↓
                                       screen-form
                                            ↓
                                       screen-success
```

| Экран ID           | Назначение                          |
|--------------------|--------------------------------------|
| `screen-welcome`   | Приветствие, кнопка «Рассчитать»     |
| `screen-type`      | Выбор типа ремонта (5 вариантов)     |
| `screen-params`    | Площадь + город                      |
| `screen-result`    | Итоговая сумма + разбивка            |
| `screen-form`      | Форма заявки (имя, телефон, время)   |
| `screen-success`   | Подтверждение + резюме заявки        |
| `screen-portfolio` | Сетка выполненных проектов (2 колонки)|

### Функции навигации в JS:
- `goTo(id)` — переход вперёд со слайд-анимацией
- `goBack()` — переход назад (обратный слайд)
- `onEnter(id)` — вызывается при каждом входе на экран

---

## Где менять данные

### Типы ремонта и цены
Массив `REPAIR_TYPES` в начале `<script>`:

```js
const REPAIR_TYPES = [
  { id:'cosmetic', name:'Косметический', price:900,  icon:'🖌️', color:'#E8F5E9', desc:'...' },
  // ...
];
```

Поля:
- `price` — цена за м² в рублях
- `icon` — иконка (emoji или текст)
- `color` — цвет фона иконки (HEX)
- `popular: true` — показывает плашку «Популярно»

### Коэффициенты городов
Атрибуты `data-coeff` у кнопок в `screen-params`:

```html
<button data-coeff="1.3"  data-name="Москва"> Москва </button>
<button data-coeff="1.15" data-name="Санкт-Петербург"> СПб </button>
<button data-coeff="1.0"  data-name="Другой город"> Другой </button>
```

### Портфолио проектов
Массив `PORTFOLIO`:

```js
const PORTFOLIO = [
  { id:1, name:'Гостиная, Москва', icon:'🛋️', bg:'#E3F2FD',
    type:'Капитальный', area:'68 м²', days:'52 дня', cost:'2 400 000 ₽',
    desc:'Описание проекта...' },
  // ...
];
```

### Название компании и слоган
В секции `screen-welcome` в HTML:

```html
<div class="welcome-name">РемонтПро</div>
<div class="welcome-sub">Ремонт квартир под ключ в Москве</div>
```

---

## Telegram SDK — что используется

| API                            | Где применяется                          |
|-------------------------------|------------------------------------------|
| `tg.ready()`                  | Сигнал о готовности приложения           |
| `tg.expand()`                 | Раскрытие на весь экран                  |
| `tg.setHeaderColor()`         | Цвет шапки Telegram = фон приложения     |
| `tg.BackButton.onClick()`     | Кнопка «Назад» в шапке Telegram          |
| `tg.BackButton.show/hide()`   | Показ/скрытие кнопки назад               |
| `HapticFeedback.impactOccurred()` | Тактильный отклик на тапы            |
| `HapticFeedback.notificationOccurred()` | Вибрация при успешной отправке |
| `tg.close()`                  | Закрытие приложения                      |
| `initDataUnsafe.user.first_name` | Имя пользователя для предзаполнения   |

**Цвета темы** берутся автоматически через CSS-переменные:
- `--tg-theme-bg-color` — основной фон
- `--tg-theme-secondary-bg-color` — вторичный фон (серый)
- `--tg-theme-text-color` — цвет текста
- `--tg-theme-hint-color` — подсказки и метки
- `--tg-theme-button-color` — цвет кнопок (синий)

---

## Отправка данных боту (продакшн)

Сейчас при нажатии «Отправить заявку» данные **не отправляются на сервер** — приложение статическое. В продакшне нужно раскомментировать и настроить блок в `btn-submit`:

```js
// Вариант 1 — HTTP POST на ваш сервер
fetch('https://ваш-сервер.ru/api/lead', {
  method: 'POST',
  body: JSON.stringify({
    type:     state.type?.name,
    area:     state.area,
    city:     state.cityName,
    total:    Math.round(state.total),
    name:     state.name,
    phone:    state.phone,
    callTime: state.callTime
  }),
  headers: { 'Content-Type': 'application/json' }
});

// Вариант 2 — отправить в Telegram бот (только для inline-режима)
tg.sendData(JSON.stringify({ ...state }));
```

---

## Как тестировать

### В браузере (без Telegram)
Открыть `tg-app/index.html` через Live Server в VS Code.
Работает полностью, кроме Telegram-специфичных функций (тактильность, BackButton).

### В Telegram
1. Разместить файл на GitHub Pages:
   `https://sorossgamer-eng.github.io/Start/tg-app/index.html`
2. Создать бота через `@BotFather`
3. Команда `/newapp` → указать URL выше
4. Открыть Mini App из бота

### Быстрая проверка через @BotFather
```
/mybots → выбрать бота → Bot Settings → Menu Button → Edit menu button URL
```
Вставить: `https://sorossgamer-eng.github.io/Start/tg-app/index.html`

---

## Структура CSS

| Блок                  | Что стилизует                          |
|-----------------------|----------------------------------------|
| `:root`               | CSS-переменные темы                    |
| `.screen`             | Базовый стиль всех экранов             |
| `.screen-header`      | Шапка с кнопкой назад и заголовком     |
| `.btn-main`           | Главная синяя кнопка                   |
| `.btn-ghost`          | Вторичная текстовая кнопка             |
| `.repair-card`        | Карточка типа ремонта с чекбоксом      |
| `.breakdown`          | Разбивка стоимости с прогресс-барами   |
| `.form-list`          | Список полей формы в iOS-стиле         |
| `.bottom-sheet`       | Выдвигающийся листок снизу             |
| `.anim` + `.anim-1..5`| Пошаговое появление элементов          |

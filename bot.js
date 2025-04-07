const TelegramBot = require("node-telegram-bot-api");
const sqlite3 = require("sqlite3").verbose();

// Токен вашего бота (замените на свой)
const token = "8033041005:AAHLY32ezWnDo8oEXCE0KP0nIniuTn_hfL8";

// Создаем бота
const bot = new TelegramBot(token, { polling: true });

// Подключаемся к базе данных SQLite (файл будет создан автоматически)
const db = new sqlite3.Database("./users.db");

// Создаем таблицу users, если она не существует
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    user_id INTEGER UNIQUE,
    username TEXT,
    first_name TEXT,
    last_name TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
});

// Обработчик команды /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const user = msg.from;

  // Сохраняем пользователя в базу данных
  db.run(
    `INSERT OR IGNORE INTO users (user_id, username, first_name, last_name) VALUES (?, ?, ?, ?)`,
    [user.id, user.username, user.first_name, user.last_name],
    function (err) {
      if (err) {
        return console.error(err.message);
      }
      if (this.changes > 0) {
        console.log(
          `Новый пользователь сохранен: ${user.username || user.first_name}`
        );
      } else {
        console.log(
          `Пользователь уже существует: ${user.username || user.first_name}`
        );
      }
    }
  );

  // Отправляем приветственное сообщение
  const welcomeText =
    `*Привет\\, ${user.first_name || "друг"}\\!* 👋\n\n` +
    `*Я бот для автоматического принятия заявок\\.*\n\n` +
    `[📩 Подать заявку](https://example\\.com/apply) \\- заявки принимаются автоматически\\!\n\n` +
    `Или нажми кнопку ниже\\:`;

  // Создаем inline-клавиатуру
  const keyboard = {
    inline_keyboard: [
      [
        {
          text: "📨 Подать заявку",
          url: "https://example.com/apply", // URL здесь без экранирования
        },
      ],
    ],
  };

  // Отправляем сообщение
  bot.sendMessage(chatId, welcomeText, {
    parse_mode: "MarkdownV2",
    reply_markup: keyboard,
  });
});

// Обработчик ошибок
bot.on("polling_error", (error) => {
  console.log(error);
});

console.log("Бот запущен и ожидает сообщений...");

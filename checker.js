const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const fs = require("fs");
const path = require("path");

const MESSAGE_HISTORY_FILE = path.join(__dirname, "messageHistory.json");
const MAX_HISTORY_SIZE = 20;

// Загружаем историю сообщений или создаем новую
let messageHistory = [];
try {
  if (fs.existsSync(MESSAGE_HISTORY_FILE)) {
    const data = fs.readFileSync(MESSAGE_HISTORY_FILE, "utf-8");
    messageHistory = JSON.parse(data);
    // Проверяем, что это массив строк
    if (!Array.isArray(messageHistory)) {
      messageHistory = [];
    }
  }
} catch (err) {
  console.error("Ошибка при загрузке истории сообщений:", err);
}

const API_ID = 25171031;
const API_HASH = "10f7696a65a7217fad43302ea6ba1695";
const session = new StringSession(
  "1AgAOMTQ5LjE1NC4xNjcuNDEBu78qPLXHr8yaYljJt/Jn1PwprinT4b9+tiuoEGx7bkzsIIrVwsN9gPd30kv/tPx00oBBEKjPr6Ugj54FeQvO6CITHwkTjShMGMYVqEQf9oGJJTQvktHJehCFHjCiRq3YPlABhac3ChqT0B2qxANk3P4brmR1UUs3bGEcqvSqbKTIOQCWrZApA5RyAuwiQG5HKjJY7M71aeqRgbGEpP0zvdyyDe2fTd/aazvjSrbNjDtK/nh0Zd3Xbonk1ekpxOJqTYfTTw08ZsIUOlWFCQNsVtHrtYkS9JMK5e5CGRZTJ2SBOPVk7bXzt0BoPBjRcNVYD/HYxrguGEdD0v36kLuMdhg="
);
const client = new TelegramClient(session, API_ID, API_HASH, {
  connectionRetries: 5,
});

// Конфигурация каналов
const SOURCE_CHANNELS = [
  "@hr_affiliate",
  "@affy_hr",
  "@works_cpa",
  "@testpost1233",
];
const TARGET_CHANNEL = "@arbitrage_vacancys";

// Функция для нормализации текста
function normalizeText(text) {
  return text
    .replace(/\s+/g, " ") // Заменяем множественные пробелы на один
    .trim() // Удаляем пробелы в начале и конце
    .toLowerCase(); // Приводим к нижнему регистру
}

function saveMessageToHistory(text) {
  // Нормализуем текст перед сохранением
  const normalizedText = normalizeText(text);

  // Добавляем текст в начало массива
  messageHistory.unshift(normalizedText);

  // Удаляем дубликаты (новые записи остаются, старые удаляются)
  const uniqueHistory = [];
  const seen = new Set();

  for (const item of messageHistory) {
    if (!seen.has(item)) {
      seen.add(item);
      uniqueHistory.push(item);
    }
  }

  // Обрезаем массив до максимального размера
  messageHistory = uniqueHistory.slice(0, MAX_HISTORY_SIZE);

  // Сохраняем в файл
  try {
    fs.writeFileSync(
      MESSAGE_HISTORY_FILE,
      JSON.stringify(messageHistory, null, 2)
    );
  } catch (err) {
    console.error("Ошибка при сохранении истории сообщений:", err);
  }
}

function isMessageDuplicate(text) {
  const normalizedText = normalizeText(text);
  return messageHistory.includes(normalizedText);
}

(async () => {
  await client.connect();
  console.log("✅ Бот успешно подключен к Telegram");

  client.addEventHandler(async (event) => {
    try {
      const message = event.message;
      if (!message) return;

      // Получаем username канала-источника
      const sourceChat = await client.getEntity(message.peerId);
      const sourceUsername = sourceChat.username;

      // Проверяем, что сообщение из нужного канала
      if (!sourceUsername || !SOURCE_CHANNELS.includes(`@${sourceUsername}`)) {
        return;
      }

      console.log(`📩 Новое сообщение из канала @${sourceUsername}`);

      // Получаем текст сообщения
      const messageText = message.message || "";

      // Пропускаем сообщения без текста (только медиа)
      if (!messageText.trim()) {
        console.log("⏭ Сообщение без текста, пропускаем");
        return;
      }

      // Проверяем, есть ли такое сообщение в истории
      if (isMessageDuplicate(messageText)) {
        console.log("⏭ Сообщение уже публиковалось, пропускаем");
        return;
      }

      // Пересылаем сообщение без указания автора
      await client.forwardMessages(TARGET_CHANNEL, {
        messages: [message.id],
        fromPeer: message.peerId,
        dropAuthor: true, // Скрываем автора
      });

      // Сохраняем текст сообщения в историю
      saveMessageToHistory(messageText);

      console.log("✅ Сообщение переслано (автор скрыт)!");
    } catch (err) {
      console.error("❌ Ошибка при пересылке:", err);
    }
  });

  console.log(`👂 Бот слушает каналы: ${SOURCE_CHANNELS.join(", ")}`);
  console.log(`🎯 Целевой канал: ${TARGET_CHANNEL}`);
})();

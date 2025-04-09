const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const fs = require("fs");
const path = require("path");

const MESSAGE_HISTORY_FILE = path.join(__dirname, "messageHistory.json");
const MAX_HISTORY_SIZE = 50; // Увеличил размер истории для надежности

// Загружаем историю сообщений или создаем новую
let messageHistory = [];
try {
  if (fs.existsSync(MESSAGE_HISTORY_FILE)) {
    const data = fs.readFileSync(MESSAGE_HISTORY_FILE, "utf-8");
    messageHistory = JSON.parse(data);
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

// Функция для нормализации текста (удаление лишних пробелов, приведение к нижнему регистру)
function normalizeText(text) {
  return text
    .replace(/\s+/g, " ") // Заменяем множественные пробелы на один
    .trim() // Удаляем пробелы в начале и конце
    .toLowerCase(); // Приводим к нижнему регистру
}

function getMessageKey(message) {
  // Получаем текст сообщения
  let text = message.text || "";

  // Если сообщение содержит медиа, но нет текста, создаем ключ на основе медиа
  if (!text && message.media) {
    return `media:${message.media.classType}-${
      message.media.id?.toString() || "0"
    }`;
  }

  // Нормализуем текст для сравнения
  const normalizedText = normalizeText(text);

  // Создаем хеш текста для компактного хранения
  // Используем простую хеш-функцию для демонстрации (можно заменить на более надежную)
  let hash = 0;
  for (let i = 0; i < normalizedText.length; i++) {
    const char = normalizedText.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Преобразуем в 32-битное целое число
  }

  return `text:${hash}`;
}

function saveMessageToHistory(messageKey) {
  // Добавляем новое сообщение в начало массива
  messageHistory.unshift(messageKey);

  // Обрезаем массив до максимального размера
  if (messageHistory.length > MAX_HISTORY_SIZE) {
    messageHistory = messageHistory.slice(0, MAX_HISTORY_SIZE);
  }

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

      // Получаем уникальный ключ сообщения
      const messageKey = getMessageKey(message);

      // Проверяем, есть ли такое сообщение в истории
      if (messageHistory.includes(messageKey)) {
        console.log("⏭ Сообщение уже публиковалось, пропускаем");
        return;
      }

      // Пересылаем сообщение без указания автора
      await client.forwardMessages(TARGET_CHANNEL, {
        messages: [message.id],
        fromPeer: message.peerId,
        dropAuthor: true, // Скрываем автора
      });

      // Сохраняем сообщение в историю
      saveMessageToHistory(messageKey);

      console.log("✅ Сообщение переслано (автор скрыт)!");
    } catch (err) {
      console.error("❌ Ошибка при пересылке:", err);
    }
  });

  console.log(`👂 Бот слушает каналы: ${SOURCE_CHANNELS.join(", ")}`);
  console.log(`🎯 Целевой канал: ${TARGET_CHANNEL}`);
})();

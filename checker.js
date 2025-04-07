const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");

const processedMessages = new Set();

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
  //   "@myvoicetest",
];
const TARGET_CHANNEL = "@arbitrage_vacancys";

function getMessageKey(message) {
  if (message.text) {
    return `text:${message.text.substring(0, 100)}`;
  } else if (message.media) {
    return `media:${message.media.classType}-${
      message.media.id?.toString() || "0"
    }`;
  }
  return `id:${message.id}`;
}

(async () => {
  await client.connect();
  console.log("✅ Бот успешно подключен к Telegram");

  client.addEventHandler(async (event) => {
    try {
      const message = event.message;
      if (!message) return;

      const sourceChat = await client.getEntity(message.peerId);
      const sourceUsername = sourceChat.username;

      if (!sourceUsername || !SOURCE_CHANNELS.includes(`@${sourceUsername}`)) {
        return;
      }

      const messageKey = getMessageKey(message);

      if (processedMessages.has(messageKey)) {
        console.log(`⏩ Пропускаем дубликат из @${sourceUsername}`);
        return;
      }

      processedMessages.add(messageKey);

      if (processedMessages.size > 1000) {
        const firstKey = processedMessages.values().next().value;
        processedMessages.delete(firstKey);
      }

      console.log(`📩 Новое сообщение из канала @${sourceUsername}`);
      console.log(message);

      await client.forwardMessages(TARGET_CHANNEL, {
        messages: [message.id],
        fromPeer: message.peerId,
        dropAuthor: true,
      });

      console.log("✅ Сообщение переслано (автор скрыт)!");
    } catch (err) {
      console.error("❌ Ошибка при пересылке:", err);
    }
  });

  console.log(`👂 Бот слушает каналы: ${SOURCE_CHANNELS.join(", ")}`);
  console.log(`🎯 Целевой канал: ${TARGET_CHANNEL}`);
})();

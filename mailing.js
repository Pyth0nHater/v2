const { TelegramClient, Api } = require("telegram");
const { StringSession } = require("telegram/sessions");

const sleep = (milliseconds) => {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
};

// Конфигурация
const API_ID = 25171031;
const API_HASH = "10f7696a65a7217fad43302ea6ba1695";
const session = new StringSession(
  "1AgAOMTQ5LjE1NC4xNjcuNDEBu78qPLXHr8yaYljJt/Jn1PwprinT4b9+tiuoEGx7bkzsIIrVwsN9gPd30kv/tPx00oBBEKjPr6Ugj54FeQvO6CITHwkTjShMGMYVqEQf9oGJJTQvktHJehCFHjCiRq3YPlABhac3ChqT0B2qxANk3P4brmR1UUs3bGEcqvSqbKTIOQCWrZApA5RyAuwiQG5HKjJY7M71aeqRgbGEpP0zvdyyDe2fTd/aazvjSrbNjDtK/nh0Zd3Xbonk1ekpxOJqTYfTTw08ZsIUOlWFCQNsVtHrtYkS9JMK5e5CGRZTJ2SBOPVk7bXzt0BoPBjRcNVYD/HYxrguGEdD0v36kLuMdhg="
);
const client = new TelegramClient(session, API_ID, API_HASH, {
  connectionRetries: 5,
});

// Настройки рассылки
const batchSize = 6; // Размер пачки для рассылки
const waitTime = 900; // Ожидание между пачками в секундах
const sourceChatUsername = "@premiumspamer"; // Чат, откуда брать последнее сообщение

async function getAllFolders() {
  try {
    console.log("Получаем список всех чатов...");
    const result = await client.invoke(new Api.messages.GetDialogFilters());
    console.log(result.filters[2].includePeers);
    return result.filters[2].includePeers;
  } catch (error) {
    console.error("Ошибка при получении чатов:", error);
    return [];
  }
}

async function getLastMessageFromChat(username) {
  try {
    const entity = await client.getEntity(username);
    const messages = await client.getMessages(entity, { limit: 1 });
    return messages[0];
  } catch (error) {
    console.error(`Ошибка при получении сообщения из ${username}:`, error);
    return null;
  }
}

async function forwardMessageToChats() {
  try {
    await client.connect();

    // Получаем чаты для рассылки
    const chats = await getAllFolders();
    if (!chats || chats.length === 0) {
      console.log("Нет чатов для рассылки");
      return;
    }

    // Получаем последнее сообщение из исходного чата
    const sourceChat = await client.getEntity(sourceChatUsername);
    const lastMessage = await getLastMessageFromChat(sourceChatUsername);

    if (!lastMessage) {
      console.log("Не удалось получить последнее сообщение из исходного чата");
      return;
    }

    console.log(`Начинаем рассылку сообщения из ${sourceChatUsername}...`);

    let successCount = 0;

    for (let i = 0; i < chats.length; i += batchSize) {
      const batch = chats.slice(i, i + batchSize);
      const promises = [];

      for (const chat of batch) {
        promises.push(
          (async () => {
            try {
              const targetEntity = await client.getInputEntity(chat);
              await client.forwardMessages(targetEntity, {
                messages: [lastMessage.id],
                fromPeer: sourceChat,
                dropAuthor: true,
              });
              console.log(
                `Сообщение переслано в чат ${chat.className}-${
                  chat.userId || chat.channelId || chat.chatId
                }`
              );
              successCount++;
              if (successCount % batchSize === 0) {
                console.log(
                  `Достигнуто ${successCount} успешных отправок. Ждем ${waitTime} секунд...`
                );
                await sleep(waitTime * 1000);
              }
            } catch (error) {
              console.error(`Ошибка при пересылке в ${chat}:`, error);
            }
          })()
        );
      }

      await Promise.all(promises);
    }

    console.log("Рассылка завершена!");
  } catch (error) {
    console.error("Ошибка в основном потоке:", error);
  } finally {
    await client.disconnect();
  }
}

forwardMessageToChats().catch(console.error);

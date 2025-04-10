const { TelegramClient, Api } = require("telegram");
const { StringSession } = require("telegram/sessions");
const TelegramBot = require("node-telegram-bot-api");

const sleep = (milliseconds) => {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
};

// Конфигурация Telegram Client
const API_ID = 25171031;
const API_HASH = "10f7696a65a7217fad43302ea6ba1695";
const session = new StringSession(
  "1AgAOMTQ5LjE1NC4xNjcuNDEBu78qPLXHr8yaYljJt/Jn1PwprinT4b9+tiuoEGx7bkzsIIrVwsN9gPd30kv/tPx00oBBEKjPr6Ugj54FeQvO6CITHwkTjShMGMYVqEQf9oGJJTQvktHJehCFHjCiRq3YPlABhac3ChqT0B2qxANk3P4brmR1UUs3bGEcqvSqbKTIOQCWrZApA5RyAuwiQG5HKjJY7M71aeqRgbGEpP0zvdyyDe2fTd/aazvjSrbNjDtK/nh0Zd3Xbonk1ekpxOJqTYfTTw08ZsIUOlWFCQNsVtHrtYkS9JMK5e5CGRZTJ2SBOPVk7bXzt0BoPBjRcNVYD/HYxrguGEdD0v36kLuMdhg="
);
const client = new TelegramClient(session, API_ID, API_HASH, {
  connectionRetries: 5,
});

// Конфигурация Telegram Bot
const BOT_TOKEN = "8033041005:AAHLY32ezWnDo8oEXCE0KP0nIniuTn_hfL8"; // Замените на ваш токен бота
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Настройки рассылки
const batchSize = 6;
const waitTime = 900;
const sourceChatUsername = "@premiumspamer";
const restartDelay = 5000; // Задержка перед перезапуском в миллисекундах (5 секунд)

// Состояние рассылки
let isSending = false;
let stopSending = false;
let adminChatId = null;
let autoRestartEnabled = false; // Флаг автоматического перезапуска

// Создаем клавиатуру с кнопками
const menuKeyboard = {
  reply_markup: {
    keyboard: [
      ["🚀 Старт рассылки"],
      ["🛑 Остановить рассылку"],
      ["🔄 Автоперезапуск ВКЛ", "⏹ Автоперезапуск ВЫКЛ"],
    ],
    resize_keyboard: true,
    one_time_keyboard: false,
  },
};

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

// Добавьте эту новую функцию для получения информации о чатах
async function printChatsInfo() {
  try {
    await client.connect();
    const chats = await getAllFolders();

    if (!chats || chats.length === 0) {
      console.log("Нет чатов для отображения");
      return;
    }

    console.log("Список чатов:");
    for (let i = 0; i < chats.length; i++) {
      try {
        const targetEntity = await client.getInputEntity(chats[i]);
        // console.log(`Чат ${i + 1}:`, targetEntity);

        // Если хотите получить больше информации о чате
        const fullEntity = await client.getEntity(chats[i]);
        // console.log(`Подробности чата ${i + 1}:`, fullEntity);

        // Извлекаем название чата в зависимости от типа
        let chatName = "";
        if (fullEntity.className === "Channel") {
          chatName = fullEntity.title;
        } else if (fullEntity.className === "User") {
          chatName = `${fullEntity.firstName || ""} ${
            fullEntity.lastName || ""
          }`.trim();
        } else if (fullEntity.className === "Chat") {
          chatName = fullEntity.title;
        }

        console.log(`Название чата ${i + 1}:`, chatName);
      } catch (error) {
        console.error(
          `Ошибка при получении информации о чате ${i + 1}:`,
          error
        );
      }
    }
  } catch (error) {
    console.error("Ошибка при подключении:", error);
  } finally {
    await client.disconnect();
  }
}

// Вызываем функцию для вывода информации о чатах
// printChatsInfo();

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
    if (!adminChatId) {
      console.log("Admin chat ID not set");
      return;
    }

    await client.connect();

    // Получаем чаты для рассылки
    const chats = await getAllFolders();
    if (!chats || chats.length === 0) {
      console.log("Нет чатов для рассылки");
      await bot.sendMessage(
        adminChatId,
        "Нет чатов для рассылки",
        menuKeyboard
      );
      isSending = false;
      return;
    }

    // Получаем последнее сообщение из исходного чата
    const sourceChat = await client.getEntity(sourceChatUsername);
    const lastMessage = await getLastMessageFromChat(sourceChatUsername);

    if (!lastMessage) {
      console.log("Не удалось получить последнее сообщение из исходного чата");
      await bot.sendMessage(
        adminChatId,
        "Не удалось получить последнее сообщение из исходного чата",
        menuKeyboard
      );
      isSending = false;
      return;
    }

    console.log(`Начинаем рассылку сообщения из ${sourceChatUsername}...`);
    await bot.sendMessage(
      adminChatId,
      `Начинаем рассылку сообщения из ${sourceChatUsername}...`,
      menuKeyboard
    );

    let successCount = 0;
    stopSending = false;

    for (let i = 0; i < chats.length; i += batchSize) {
      if (stopSending) {
        console.log("Рассылка остановлена администратором");
        await bot.sendMessage(
          adminChatId,
          "Рассылка остановлена администратором",
          menuKeyboard
        );
        break;
      }

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
            } catch (error) {
              console.error(`Ошибка при пересылке в ${chat}:`, error);
            }
          })()
        );
      }

      await Promise.all(promises);

      if (i + batchSize < chats.length && !stopSending) {
        console.log(
          `Отправлено ${i + batchSize} из ${
            chats.length
          }. Ждем ${waitTime} секунд...`
        );
        await bot.sendMessage(
          adminChatId,
          `Отправлено ${i + batchSize} из ${
            chats.length
          }. Ждем ${waitTime} секунд...`,
          menuKeyboard
        );
        await sleep(waitTime * 1000);
      }
    }

    if (!stopSending) {
      console.log("Рассылка завершена!");
      await bot.sendMessage(
        adminChatId,
        `Рассылка завершена! Успешно отправлено: ${successCount} сообщений`,
        menuKeyboard
      );

      // Если включен автоперезапуск, запускаем снова после задержки
      if (autoRestartEnabled && !stopSending) {
        console.log(`Автоперезапуск через ${restartDelay / 1000} секунд...`);
        await bot.sendMessage(
          adminChatId,
          `Автоперезапуск через ${restartDelay / 1000} секунд...`,
          menuKeyboard
        );
        await sleep(restartDelay);
        forwardMessageToChats();
      }
    }
    isSending = false;
  } catch (error) {
    console.error("Ошибка в основном потоке:", error);
    if (adminChatId) {
      await bot.sendMessage(
        adminChatId,
        `Произошла ошибка: ${error.message}`,
        menuKeyboard
      );
    }
    isSending = false;
  } finally {
    await client.disconnect();
  }
}

// Обработчики команд бота
bot.onText(/\/start/, (msg) => {
  adminChatId = msg.chat.id;
  bot.sendMessage(
    adminChatId,
    "Бот для рассылки сообщений. Используйте кнопки для управления:",
    menuKeyboard
  );
});

bot.on("message", (msg) => {
  const text = msg.text;
  const chatId = msg.chat.id;
  adminChatId = chatId;

  if (text === "🚀 Старт рассылки") {
    if (isSending) {
      bot.sendMessage(chatId, "Рассылка уже запущена", menuKeyboard);
    } else {
      isSending = true;
      stopSending = false;
      bot.sendMessage(chatId, "Запускаем рассылку...", menuKeyboard);
      forwardMessageToChats();
    }
  } else if (text === "🛑 Остановить рассылку") {
    if (isSending) {
      stopSending = true;
      bot.sendMessage(
        chatId,
        "Команда на остановку рассылки принята",
        menuKeyboard
      );
    } else {
      bot.sendMessage(chatId, "Рассылка не активна", menuKeyboard);
    }
  } else if (text === "🔄 Автоперезапуск ВКЛ") {
    autoRestartEnabled = true;
    bot.sendMessage(chatId, "Автоперезапуск включен", menuKeyboard);
    if (!isSending) {
      isSending = true;
      stopSending = false;
      bot.sendMessage(
        chatId,
        "Запускаем рассылку с автоперезапуском...",
        menuKeyboard
      );
      forwardMessageToChats();
    }
  } else if (text === "⏹ Автоперезапуск ВЫКЛ") {
    autoRestartEnabled = false;
    bot.sendMessage(chatId, "Автоперезапуск выключен", menuKeyboard);
  }
});

console.log("Бот запущен и ожидает команд...");

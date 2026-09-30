import { createNotConnectedModule } from "../notConnected";

export const telegramModule = createNotConnectedModule({
  id: "telegram",
  label: "Telegram",
  themeColor: "#668df3",
  needs: {
    ru: "токен вашего бота и сам бот в администраторах канала",
    en: "your bot's token, with the bot added as an admin of the channel",
  },
});

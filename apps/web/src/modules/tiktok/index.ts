import { createNotConnectedModule } from "../notConnected";

export const tiktokModule = createNotConnectedModule({
  id: "tiktok",
  label: "TikTok",
  themeColor: "#8476fd",
  needs: {
    ru: "доступ TikTok for Developers, выдаётся после проверки заявки",
    en: "TikTok for Developers access, granted after an application review",
  },
});

import { createNotConnectedModule } from "../notConnected";

export const instagramModule = createNotConnectedModule({
  id: "instagram",
  label: "Instagram",
  themeColor: "#957aff",
  needs: {
    ru: "профессиональный аккаунт Instagram и приложение в Meta for Developers",
    en: "a professional Instagram account and an app in Meta for Developers",
  },
});

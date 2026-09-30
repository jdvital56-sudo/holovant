import { createNotConnectedModule } from "../notConnected";

export const linkedinModule = createNotConnectedModule({
  id: "linkedin",
  label: "LinkedIn",
  themeColor: "#6a83f5",
  needs: {
    ru: "доступ к LinkedIn API, выдаётся по заявке",
    en: "LinkedIn API access, granted on application",
  },
});

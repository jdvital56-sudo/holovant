import { createNotConnectedModule } from "../notConnected";

export const xModule = createNotConnectedModule({
  id: "x",
  label: "X",
  themeColor: "#6e79f8",
  needs: {
    ru: "платный доступ к X API",
    en: "paid access to the X API",
  },
});

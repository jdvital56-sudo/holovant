import { createNotConnectedModule } from "../notConnected";

export const youtubeModule = createNotConnectedModule({
  id: "youtube",
  label: "YouTube",
  themeColor: "#7372fb",
  needs: {
    ru: "ключ YouTube Data API и адрес вашего канала",
    en: "a YouTube Data API key and your channel's address",
  },
});

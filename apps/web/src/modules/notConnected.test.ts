import { describe, expect, it } from "vitest";
import { instagramModule } from "./instagram";
import { linkedinModule } from "./linkedin";
import { telegramModule } from "./telegram";
import { tiktokModule } from "./tiktok";
import { xModule } from "./x";
import { youtubeModule } from "./youtube";

/**
 * The six social cards showed accounts that do not exist, with numbers and
 * advice. These rows hold them to saying what is true: not connected, and
 * what connecting takes.
 */

const SOCIAL = [instagramModule, tiktokModule, youtubeModule, xModule, linkedinModule, telegramModule];

describe("a social card with no account behind it", () => {
  it("says it is not connected, on the card and out loud", async () => {
    for (const card of SOCIAL) {
      const data = await card.dataProvider.getSnapshot();
      const shown = card.toMetrics(data).map((m) => `${m.label} ${m.value}`).join(" ");
      expect(shown, card.id).toContain("не подключён");
      expect(card.toAdvice(data, "ru").spoken, card.id).toContain("не подключён");
    }
  });

  it("shows no number at all", async () => {
    // The invented follower counts were the problem. A digit on one of these
    // cards means a figure crept back in.
    for (const card of SOCIAL) {
      const data = await card.dataProvider.getSnapshot();
      for (const metric of card.toMetrics(data)) {
        expect(metric.value, `${card.id}: ${metric.label}`).not.toMatch(/\d/);
        expect(metric.deltaPct, card.id).toBeUndefined();
      }
    }
  });

  it("names no account that does not exist", async () => {
    for (const card of SOCIAL) {
      expect(card.dataProvider.listAccounts, card.id).toBeUndefined();
      const data = await card.dataProvider.getSnapshot();
      const everything = JSON.stringify([card.toMetrics(data), card.toAdvice(data, "ru")]);
      expect(everything, card.id).not.toMatch(/@holovant|@vadym/);
    }
  });

  it("gives no advice drawn from numbers it does not have", async () => {
    for (const card of SOCIAL) {
      const data = await card.dataProvider.getSnapshot();
      const advice = card.toAdvice(data, "ru").tips.join(" ");
      expect(advice, card.id).not.toMatch(/вкладывайтесь|рост|охват/i);
    }
  });

  it("says what connecting it takes", async () => {
    for (const card of SOCIAL) {
      const data = await card.dataProvider.getSnapshot();
      const need = card.toMetrics(data).find((m) => m.label === "Нужно");
      expect(need?.value.length ?? 0, card.id).toBeGreaterThan(10);
    }
  });

  it("keeps its id and label, so the voice still opens it", () => {
    // The direction that must not break: "открой инстаграм" is matched by id.
    expect(SOCIAL.map((m) => m.id)).toEqual(["instagram", "tiktok", "youtube", "x", "linkedin", "telegram"]);
    expect(SOCIAL.map((m) => m.label)).toEqual(["Instagram", "TikTok", "YouTube", "X", "LinkedIn", "Telegram"]);
  });
});

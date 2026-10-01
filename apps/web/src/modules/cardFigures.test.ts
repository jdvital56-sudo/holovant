import { describe, expect, it } from "vitest";
import { aiModule } from "./ai";
import { sportsModule } from "./sports";

/**
 * The first row of a card is the figure on its face, in the largest type on
 * screen. Filming the product for its presentation showed three cards whose
 * figure said nothing: the AI card showed "deepseek-chat", the football card
 * "2026-2027", the weather card the city. Weather is held in liveCards.test.
 */

const aiReady = { model: "deepseek-chat", configured: true, voice: "piper" as const, searchConfigured: true };

describe("the AI card", () => {
  it("shows how much is connected, not the supplier's name", () => {
    const [figure] = aiModule.toMetrics(aiReady);
    expect(figure.value).toBe("3 из 3");
    expect(figure.value).not.toContain("deepseek");
  });

  it("still names the model in the panel, where it can be read", () => {
    expect(aiModule.toMetrics(aiReady).some((m) => m.value === "deepseek-chat")).toBe(true);
  });

  it("says nothing in Latin out loud", () => {
    // A Russian voice reads "deepseek-chat" as a mumble.
    for (const d of [aiReady, { ...aiReady, searchConfigured: false }, { ...aiReady, voice: "browser" as const }]) {
      expect(aiModule.toAdvice(d, "ru").spoken, JSON.stringify(d)).not.toMatch(/[a-z]/i);
    }
  });

  it("counts honestly when something is missing", () => {
    expect(aiModule.toMetrics({ ...aiReady, searchConfigured: false })[0].value).toBe("2 из 3");
    expect(aiModule.toMetrics({ ...aiReady, configured: false, searchConfigured: false, voice: "browser" })[0].value).toBe("0 из 3");
  });
});

describe("the football card", () => {
  const football = {
    state: "ok" as const,
    season: "2026-2027",
    partial: true,
    table: [
      { rank: 1, team: "Amed", played: 6, points: 13, goalDifference: 5, form: "ВВНВП" },
      { rank: 2, team: "Galatasaray", played: 6, points: 13, goalDifference: 4, form: null },
    ],
    next: [],
    last: null,
  };

  it("shows the leader's points, agreed with the number", () => {
    const [figure] = sportsModule.toMetrics(football);
    expect(figure.value).toBe("13 очков");
    expect(figure.label).toContain("Amed");
  });

  it("still shows the season, lower down", () => {
    expect(sportsModule.toMetrics(football).some((m) => m.value === "2026-2027")).toBe(true);
  });
});

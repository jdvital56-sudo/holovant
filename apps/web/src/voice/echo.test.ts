import { describe, expect, it } from "vitest";
import { isEchoOfSpeech } from "./echo";

/**
 * These are transcripts that actually reached the model as questions, taken
 * from the founder's screen. Each one is the assistant hearing itself.
 */
describe("telling the assistant's own voice from the user's", () => {
  it("catches its own clarifying question coming back", () => {
    const spoken =
      "Давайте уточним. Вы написали «не держит тем качество снижена Даха», я хочу понять, " +
      "о чём речь. Подскажите, что именно анализировать, и я сразу перейду к делу.";
    expect(isEchoOfSpeech("Давайте уточним Что именно нужно проанализировать", spoken)).toBe(true);
  });

  it("catches a module briefing read back to it", () => {
    const spoken =
      "Кадров 20 — сцена не держит темп, качество снижено до низкого. " +
      "Сервисы: 5 из 5 на связи. Сеть 4g, 10 мегабит в секунду.";
    expect(isEchoOfSpeech("не держит тем качество снижена до низкого", spoken)).toBe(true);
  });

  it("matches across the endings Russian adds and drops", () => {
    expect(isEchoOfSpeech("проанализировать положение", "анализировать положении")).toBe(true);
  });

  it("lets a real question through, even on the same subject", () => {
    const spoken = "Курс доллара к гривне сейчас 44 и 57 гривны за доллар.";
    // He asks again, in his own words. This must reach the model.
    expect(isEchoOfSpeech("а через месяц какой прогноз", spoken)).toBe(false);
    expect(isEchoOfSpeech("почему так выросло", spoken)).toBe(false);
  });

  it("lets a command through", () => {
    const spoken = "Сейчас в Киеве 22 градусов, ощущается как 20 градусов.";
    expect(isEchoOfSpeech("открой инстаграм", spoken)).toBe(false);
    expect(isEchoOfSpeech("включи музыку", spoken)).toBe(false);
  });

  it("says nothing is an echo when nothing has been spoken", () => {
    expect(isEchoOfSpeech("какая погода", "")).toBe(false);
  });
});

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
    // A recogniser hears "проанализировать" where "анализировать" was said.
    // Checked at sentence length, because a two-word phrase is a command and
    // is deliberately never judged.
    expect(
      isEchoOfSpeech(
        "нужно проанализировать положение компании подробно",
        "надо анализировать положении компании подробнее",
      ),
    ).toBe(true);
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

/**
 * The other direction. Twice now the guard has eaten commands instead of echo,
 * and both times it looked from outside like the system had stopped listening.
 */
describe("a short command is never mistaken for an echo", () => {
  it("lets the face be dismissed while the face is being talked about", () => {
    // "Лицо" was certainly said a moment ago — the face had just been shown.
    // Half the words of "закрой лицо" match, which used to be enough to throw
    // the command away.
    const spoken = "Я здесь. Показываю лицо. Спрашивайте что угодно про лицо.";
    expect(isEchoOfSpeech("закрой лицо", spoken)).toBe(false);
    expect(isEchoOfSpeech("скрой лицо", spoken)).toBe(false);
  });

  it("lets the chat be dismissed while the chat is on screen", () => {
    const spoken = "Отвечаю в чате. Вот что нашёл по вашему вопросу в чате.";
    expect(isEchoOfSpeech("закрой чат", spoken)).toBe(false);
    expect(isEchoOfSpeech("убери чат", spoken)).toBe(false);
  });

  it("lets other short orders through", () => {
    const spoken = "Включаю музыку Radiohead, громкость восемьдесят процентов.";
    expect(isEchoOfSpeech("выключи музыку", spoken)).toBe(false);
    expect(isEchoOfSpeech("сделай тише", spoken)).toBe(false);
    expect(isEchoOfSpeech("следующий трек", spoken)).toBe(false);
  });

  it("still catches a real echo, which arrives as a whole sentence", () => {
    const spoken =
      "Давайте уточним. Подскажите, что именно анализировать, и я сразу перейду к делу.";
    expect(isEchoOfSpeech("Давайте уточним Что именно нужно проанализировать", spoken)).toBe(true);
  });
});

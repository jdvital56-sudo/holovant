import { describe, expect, it } from "vitest";
import { isEchoOfSpeech } from "./echo";

/**
 * The rule that stops the circling.
 *
 * This guard has now been wrong in both directions, twice each. Loose, and the
 * assistant answers its own voice and talks in circles. Tight, and it eats the
 * user's follow-ups and his short commands — which from across the room looks
 * exactly like a system that has stopped listening.
 *
 * Every previous fix was checked against the case just reported and no other,
 * so tightening it to cure one complaint uncovered the opposite complaint a day
 * later. That is the loop he named, and it is a testing failure rather than a
 * judgement failure.
 *
 * So both directions are held here, in one table, and every one of these is a
 * real transcript from his screen or a real phrase he has spoken. Any change to
 * a threshold that cures one side and breaks the other fails immediately
 * instead of reaching him.
 */

/** What the assistant had said in the last minute, per scenario. */
const SPOKEN = {
  face: "Я здесь. Показываю лицо. Спрашивайте что угодно, пока лицо на экране.",
  chat: "Отвечаю в чате. Вот что я нашёл по вашему вопросу, смотрите в чате ниже.",
  music:
    "Включаю музыку Radiohead, громкость восемьдесят процентов. Трек уже играет в плеере слева.",
  clarify:
    "Давайте уточним. Подскажите, что именно анализировать, и я сразу перейду к делу.",
  system:
    "Кадров двадцать, сцена не держит темп, качество снижено до низкого. Сервисы пять из пяти на связи.",
  rate: "Курс доллара к гривне сейчас сорок четыре и пятьдесят семь гривны за доллар.",
  weather: "В Киеве сейчас двадцать два градуса, почти ясно, ветер восемь километров в час.",
};

/**
 * Said by him, and therefore must always act — never discarded as an echo,
 * however much the assistant has just been talking about the same subject.
 */
const MUST_ACT: Array<[said: string, whileSpeaking: string]> = [
  ["закрой лицо", SPOKEN.face],
  ["скрой лицо", SPOKEN.face],
  ["убери лицо", SPOKEN.face],
  ["покажи лицо", SPOKEN.face],
  ["закрой чат", SPOKEN.chat],
  ["убери чат", SPOKEN.chat],
  ["выключи музыку", SPOKEN.music],
  ["сделай тише", SPOKEN.music],
  ["сделай громче", SPOKEN.music],
  ["следующий трек", SPOKEN.music],
  ["поставь на паузу", SPOKEN.music],
  ["открой инстаграм", SPOKEN.music],
  ["открой систему", SPOKEN.system],
  // Follow-ups on the subject just discussed. These were eaten once before by
  // a guard that compared a question to the previous answer.
  ["а какой прогноз на завтра", SPOKEN.weather],
  ["почему он так вырос", SPOKEN.rate],
  ["а в долларах сколько это", SPOKEN.rate],
];

/**
 * Heard through the microphone while the assistant spoke, and therefore its
 * own voice. Acting on any of these is what made it hold a conversation with
 * itself on his screen.
 */
const MUST_IGNORE: Array<[heard: string, whileSpeaking: string]> = [
  ["Давайте уточним Что именно нужно проанализировать", SPOKEN.clarify],
  ["подскажите что именно анализировать и я сразу перейду", SPOKEN.clarify],
  ["не держит тем качество снижена до низкого", SPOKEN.system],
  ["сервисы пять из пяти на связи", SPOKEN.system],
  ["включаю музыку радиохед громкость восемьдесят процентов", SPOKEN.music],
  ["в киеве сейчас двадцать два градуса почти ясно", SPOKEN.weather],
  ["курс доллара к гривне сейчас сорок четыре", SPOKEN.rate],
];

describe("commands and questions always get through", () => {
  for (const [said, spoken] of MUST_ACT) {
    it(`acts on “${said}”`, () => {
      expect(isEchoOfSpeech(said, spoken), said).toBe(false);
    });
  }
});

describe("its own voice never gets through", () => {
  for (const [heard, spoken] of MUST_IGNORE) {
    it(`ignores “${heard.slice(0, 40)}…”`, () => {
      expect(isEchoOfSpeech(heard, spoken), heard).toBe(true);
    });
  }
});

describe("with nothing spoken, nothing is an echo", () => {
  it("lets everything through before the assistant has said a word", () => {
    for (const [said] of [...MUST_ACT, ...MUST_IGNORE]) {
      expect(isEchoOfSpeech(said, ""), said).toBe(false);
    }
  });
});

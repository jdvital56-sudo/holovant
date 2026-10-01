// Speaks into the real page, through a stand-in for the browser's recogniser.
//
// The voice hook is the most-repaired file in the project and has never been
// tested whole: only the pieces carved out of it. A microphone cannot be
// driven from here, so the recogniser is replaced by one this script controls,
// and his own reported phrases are said into the running app at the moments
// he said them. The model's answers are canned so timing is repeatable and no
// money is spent; synthesis is the real Piper voice, because its timing is
// exactly what the echo rules depend on.
//
// Run against a started server: `pnpm --filter web e2e:voice`. Needs a
// Chromium; set HOLOVANT_CHROME to its path, or Playwright's own is used.
// Run on yesterday's voice code it fails five of nine, exactly where he
// reported it: the question straight after an answer lost, no «Да, слушаю
// вас», and its own reply taken for his next question.
import { chromium } from "playwright-core";

const CHROME = process.env.HOLOVANT_CHROME || undefined;
const BASE = process.env.HOLOVANT_URL || "http://localhost:3000";
const browser = await chromium.launch({
  executablePath: CHROME,
  headless: false,
  args: ["--mute-audio", "--autoplay-policy=no-user-gesture-required"],
});
const page = await browser.newPage({ viewport: { width: 1400, height: 860 } });

// A recogniser this script can speak through, and a record of every clip played.
await page.addInitScript(() => {
  class FakeRecognition {
    constructor() {
      window.__rec = this;
      this.continuous = false;
      this.interimResults = false;
    }
    start() {
      setTimeout(() => this.onstart?.(), 10);
    }
    stop() {
      setTimeout(() => this.onend?.(), 10);
    }
    abort() {
      setTimeout(() => this.onend?.(), 10);
    }
  }
  window.webkitSpeechRecognition = FakeRecognition;
  window.SpeechRecognition = FakeRecognition;
  window.__say = (text, isFinal) => {
    const result = [{ transcript: text, confidence: 0.9 }];
    result.isFinal = isFinal;
    window.__rec?.onresult?.({ resultIndex: 0, results: [result] });
  };
  window.__audio = [];
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    const entry = { at: performance.now(), ended: null, paused: null, src: String(this.src).slice(-12), err: null };
    window.__audio.push(entry);
    this.addEventListener("ended", () => (entry.ended = performance.now()), { once: true });
    this.addEventListener("pause", () => (entry.paused = performance.now()), { once: true });
    this.addEventListener("error", () => (entry.err = "error"), { once: true });
    const p = play.call(this);
    p.catch((e) => (entry.err = String(e && e.name)));
    return p;
  };
});

// Canned answers, streamed the way the server streams them.
const asked = [];
await page.route("**/api/chat", async (route) => {
  const body = JSON.parse(route.request().postData() ?? "{}");
  const question = body.messages?.at(-1)?.content ?? "";
  asked.push({ question, at: Date.now() });
  const answer = question.includes("остановить")
    ? "Чтобы остановить музыку, скажите пауза. Чтобы продолжить, скажите продолжи. Это работает и поверх песни."
    : question.includes("проект")
    ? "У вас четыре репозитория. Holovant на ветке master, менялся вчера. Nexus OS не трогался три недели. Gods eye view давно чист."
    : "Я открываю карточки, отвечаю на вопросы и ищу в ваших заметках. Готов к работе, сэр.";
  await route.fulfill({ status: 200, contentType: "text/plain; charset=utf-8", body: answer });
});

const rows = [];
const check = (name, ok, detail = "") => {
  rows.push({ name, ok, detail });
  console.log(`${ok ? "OK  " : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};
const say = (text, isFinal = true) => page.evaluate(([t, f]) => window.__say(t, f), [text, isFinal]);
const audio = () => page.evaluate(() => window.__audio.map((a) => ({ ...a })));
const status = () => page.evaluate(() => document.body.innerText);
console.log("— запуск —");
const waitAskedSince = async (n, ms) => {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (asked.length > n) return true;
    await page.waitForTimeout(100);
  }
  return asked.length > n;
};
/** Waits until no clip is playing, then returns how long ago the last one ended. */
const waitSilence = async (ms = 30000) => {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const clips = await audio();
    if (clips.length && clips.every((c) => c.ended || c.paused)) return;
    await page.waitForTimeout(150);
  }
};

await page.goto(`${BASE}/?e2e`);
await page.waitForTimeout(5000);
await page.getByText(/VOICE/).first().click();
// Let the everyday lines finish warming before speaking.
await page.waitForTimeout(6000);

// 1. "Что ты умеешь" with nothing else going on.
let before = asked.length;
await say("что ты умеешь");
check("«что ты умеешь» доходит до модели", await waitAskedSince(before, 2000));

// 2. The tail of its own answer, right after it stops: must be ignored.
await waitSilence();
await page.waitForTimeout(300);
before = asked.length;
await say("к работе сэр");
await page.waitForTimeout(400);
const shown = await status();
await page.waitForTimeout(1100);
check("хвост своей речи «к работе сэр» не принят за вопрос", asked.length === before);
check("и на экране сказано, почему пропущено", /эхо/i.test(shown));

// 3. His short question inside the same window: must go through.
before = asked.length;
await say("какие у нас есть проекты");
check("«какие у нас есть проекты» сразу после ответа доходит", await waitAskedSince(before, 2000));

// 4. "Стоп" over the answer, from a partial result. Said only once a sentence
// has been playing for a while: said at a join between two sentences, the
// next one starts in the same millisecond and is cut 30-40 ms later, which is
// correct but made an earlier version of this check fail now and then.
const playingFor = async (ms, within = 15000) => {
  const until = Date.now() + within;
  while (Date.now() < until) {
    const now = await page.evaluate(() => performance.now());
    if ((await audio()).some((c) => !c.ended && !c.paused && now - c.at > ms)) return true;
    await page.waitForTimeout(40);
  }
  return false;
};
const answerPlaying = await playingFor(300);
const stopAt = await page.evaluate(() => performance.now());
await say("стоп", false);
await page.waitForTimeout(900);
const after = await audio();
// Everything that was sounding when the word was heard must have stopped.
const live = after.filter(
  (c) => c.at <= stopAt + 5 && !(c.ended && c.ended <= stopAt) && !(c.paused && c.paused <= stopAt),
);
const silencedIn = Math.max(0, ...live.map((c) => (c.paused ?? c.ended ?? Infinity) - stopAt));
check(
  "«стоп» обрывает речь сразу",
  answerPlaying && live.length > 0 && silencedIn <= 300,
  answerPlaying ? `оборвано за ${Math.round(silencedIn)} мс` : "ответ так и не зазвучал — проверять было нечего",
);
if (process.env.HOLOVANT_DEBUG) {
  console.log("stopAt", Math.round(stopAt));
  for (const c of after) console.log(JSON.stringify({ at: Math.round(c.at), ended: c.ended && Math.round(c.ended), paused: c.paused && Math.round(c.paused), src: c.src, err: c.err }));
}
// After it, exactly one line: «Да, слушаю вас» — and no more of the answer.
const ack = after.filter((c) => c.at > stopAt + 5);
check(
  "после «стоп» звучит «Да, слушаю вас», и больше ничего",
  ack.length === 1 && !ack[0].err,
  `начало через ${Math.round((ack[0]?.at ?? stopAt) - stopAt)} мс`,
);

// 5. The final transcript of the same "стоп" a moment later: no second answer.
await page.waitForTimeout(1500);
const clipsBeforeFinal = (await audio()).length;
await say("стоп", true);
await page.waitForTimeout(1200);
check("тот же «стоп» в окончательной расшифровке не отвечается второй раз", (await audio()).length === clipsBeforeFinal);

// 6. "Стоп" with a question in the same breath.
await waitSilence();
await page.waitForTimeout(4500); // past the repeat window
before = asked.length;
await say("стоп какие у нас есть проекты", true);
check("«стоп, какие у нас проекты» — вопрос задан", await waitAskedSince(before, 2000));

// 7. Its own reply heard a few seconds later, long — must be ignored.
await waitSilence();
await page.waitForTimeout(2600);
before = asked.length;
await say("у вас четыре репозитория holovant на ветке master менялся вчера");
await page.waitForTimeout(1500);
check("свой ответ, услышанный через 3 секунды, не принят за вопрос", asked.length === before);

// ---- Commands over music --------------------------------------------------
// With music playing the recogniser never hears silence and never finalises,
// so from here on most commands are said as partial results only — the way
// they actually arrive over a song. Results are read from the app's own
// state (?e2e), not from a label that is upper-cased and fades in 2.5 s.

const state = (key) => page.evaluate((k) => window.__holovant[k](), key);
const until = async (fn, ms = 2000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await fn()) return true;
    await page.waitForTimeout(100);
  }
  return false;
};

await waitSilence();
await page.waitForTimeout(2500);

const musicAsked = [];
page.on("request", (r) => r.url().includes("/api/music") && musicAsked.push(r.url()));
await say("включи Океан Ельзи Обійми", true);
check("«включи Океан Ельзи» находит и ставит трек", await until(async () => (await state("playing")) === "ready", 8000), String(await state("playing")));
await page.waitForTimeout(3000);

await say("пауза", false);
check("«пауза» под музыку срабатывает без окончательной расшифровки", await until(async () => (await state("paused")) === true, 2000));

await page.waitForTimeout(1500);
const volumeBefore = await state("volume");
await say("сделай громче", false);
await until(async () => (await state("volume")) !== volumeBefore, 2000);
const volumeOnce = await state("volume");
await page.waitForTimeout(300);
await say("сделай громче", true); // the final of the same words, arriving late
await page.waitForTimeout(900);
const volumeAfter = await state("volume");
check(
  "«сделай громче» срабатывает один раз, а не дважды",
  volumeOnce > volumeBefore && volumeAfter === volumeOnce,
  `${volumeBefore.toFixed(2)} → ${volumeOnce.toFixed(2)} → ${volumeAfter.toFixed(2)}`,
);

await page.waitForTimeout(1500);
await say("открой погоду", false);
check("«открой погоду» открывает карточку по промежуточному тексту", await until(async () => (await state("open")) === "weather", 2000));
await page.waitForTimeout(1500);
await say("закрой", false);
check("«закрой» закрывает её", await until(async () => (await state("open")) === null, 2000), String(await state("open")));

await page.waitForTimeout(1500);
await say("покажи лицо", false);
check("«покажи лицо» показывает лицо", await until(async () => (await state("face")) === true, 2500));
await page.waitForTimeout(1500);
await say("убери лицо", false);
check("«убери лицо» убирает его", await until(async () => (await state("face")) === false, 2500));

// The other direction: a song title is never acted on half-said.
await page.waitForTimeout(1500);
const musicBefore = musicAsked.length;
await say("включи океан", false);
await page.waitForTimeout(1600);
check("«включи океан» на полуслове музыку не запускает", musicAsked.length === musicBefore);

// The most dangerous direction: its own voice naming a command. It explains
// how to pause, the microphone hears "скажите пауза", and the music must not
// pause because of what it said itself.
await page.waitForTimeout(1500);
await say("продолжи", true);
await until(async () => (await state("paused")) === false, 2000);
await page.waitForTimeout(1500);
await say("как остановить музыку", true);
await playingFor(300);
await say("чтобы остановить музыку скажите пауза", false);
await page.waitForTimeout(1200);
check("его собственное «скажите пауза» музыку не останавливает", (await state("paused")) === false);

const passed = rows.filter((r) => r.ok).length;
console.log(JSON.stringify({ passed, total: rows.length }));
await browser.close();
process.exit(passed === rows.length ? 0 : 1);

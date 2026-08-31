# Holovant — where the project stands

Written for whoever picks this up next, including a different AI. The code is
the source of truth; this is the part the code cannot tell you.

## Running it

```
cd apps/web
pnpm dev
```

Port 3000. Configuration lives in `apps/web/.env.local`, which is git-ignored;
`README.md` lists every variable and what each one turns on. The file is absent
on a fresh clone, and every feature behind it degrades honestly rather than
failing: no key means the assistant says so out loud.

Checks before committing: `pnpm --filter web typecheck`, `... lint`,
`... test`. Lint is slow — allow two or three minutes. There are 263 tests.

## What works

- 3D orbit of 16 module cards, hologram treatment, accents running violet to
  cyan in orbit order so a module is recognisable by hue in peripheral vision
- Server-side voice through Piper, 281–358ms measured, warmed on page load
- **Thor** — the assistant's name. It is configuration; the spellings a
  recogniser produces for a name ("тор", "тхор", "thor") are a per-name list in
  `config/assistant.ts`, extendable through the environment
- Thor's face: a generated hologram clip on black. Summoned by voice, it
  assembles from a spark. While it is up the whole dashboard is hidden, the 3D
  scene stops rendering, and the voice runs through a light ring modulator
- The assistant has **tools**: web search, weather, the current time, the
  user's notes. Without them it answered questions about today from training
  data, or said it had no internet — true of the model and false of the product
- The assistant has **hands**: it opens modules, plays and pauses music, plays
  a saved collection, saves the playing track, opens a web page, changes the
  volume, shows and hides its face. Chosen by the model like any tool, but
  performed in the browser — see "Actions" below
- **Named music collections.** Created by naming one ("сохрани в подборку для
  работы"), played back by name, listed on request. Held in localStorage
- Voice commands: open a module, rotate, close, search, play, pause, resume,
  next, save, play a collection, list collections, volume, dismiss chat or
  player, wake on the name, show and hide the face, stop
- **Russian is spoken correctly**: nouns agree with their numeral, dates and
  years are ordinals, numbers after a preposition are declined, clock times are
  hours and minutes, units and abbreviations are said in full
- Second brain: a folder of Markdown, indexed in memory, re-read by mtime
- **Memory of the user** — not his notes but the assistant's own conclusions
  about him, written into his vault as Markdown he can open and correct. A
  wrong conclusion, unlike a wrong answer, is repeated in every reply from then
  on, so it lives where he can strike it out
- **A morning briefing** — the date, the weather, his calendar, notes written
  against today, and what is still unticked. Asked for, never volunteered: he
  decided the system does not speak first
- **Calendar** through the private iCal address his provider publishes:
  read-only, no sign-in, one line in `.env.local`. Repeating events are
  expanded, which is most of what a real calendar holds
- Web search (Firecrawl), weather (Open-Meteo, no key), a real system check
- Music through the YouTube Data API, cached a day; falls back to reading the
  results page when `YOUTUBE_API_KEY` is unset
- A perimeter on `/api/*`: rate limit always, plus a shared token enforced only
  when `HOLOVANT_ACCESS_TOKEN` is set
- Hand tracking: movement steers the orbit and stops with the hand, pinch
  toggles a card. Under the tracking button, at a size that can be read out
  loud, the HUD reports what it measures: readings a second, the lowest of the
  last ten, what the camera promised and the frame size it gave, what a look
  costs while searching for a hand and while following one, and which
  processor is doing the looking — switchable, since the graphics card is not
  always the faster of the two
- 263 tests; lint and types clean; CI runs all three on every push

## What is not built

Module data is mock everywhere except weather, system, the brain and music. The
provider interface takes live sources without touching the UI, but no social or
financial source is connected. There is no sign-in, no payment, and no
deployment — it runs on one machine.

Memory of the user and the morning briefing are built. The assistant speaking
first was asked for and then **withdrawn** — he does not want it. What he wants
instead is that when he asks a question, the best answer is proposed rather
than a list of options.

## The lesson that matters most

**Fix a bug in both directions, or it comes back.**

The founder named this before I did: "мы снова и снова повторяем те же самые
ошибки, по кругу идём". He was right, and the cause was never judgement — it
was checking each fix against the complaint of that day and nothing else.

The echo guard was wrong in both directions, twice each. Tightened to stop the
assistant answering its own voice, it ate the user's follow-ups and his short
commands; loosened, the first fault returned. A spring stiffened so the
carousel would stop with the hand went numerically unstable at thirty frames a
second and left for infinity. Each change was correct for the case in front of
me and wrong for the case it had just displaced.

So, for any threshold, heuristic or spring config:

- Write down what must **still** work, not only what must now work. Both go in
  one test file, as a table.
- Use real transcripts and real phrases from the person who reported it.
  Invented examples agree with whatever you already believe.
- Never report a fix as done on the strength of the reported case passing.

`echoBothWays.test.ts`, `handMotion.test.ts` and `springStability.test.ts` are
that rule made concrete. `reported.test.ts` holds every break he has reported,
written in his own words.

For anything you cannot see — a camera, a WebGL surface, a microphone — say so,
put a number on screen he can read back, and reason with arithmetic rather than
adjusting values and asking whether it feels better. Simulating the detection
rate found the gesture bug in a minute; waving at a camera would not have.

## Things that will bite you

**The microphone hears the assistant's own voice.** Everything about the voice
loop follows. Acting on what it hears while speaking makes it answer its own
answers; ignoring everything makes it deaf for the whole length of a reply. The
settled rule in `useVoiceCommands.ts`: "стоп" always acts, even on a partial
result; a *command* over a reply cuts it off and runs; a *question* over a
reply is dropped; nothing is taken as a question for 1.8s after the voice
stops; a line resembling recent speech is discarded for twelve seconds after
that. **Short phrases are never judged as echo** — "закрой лицо" is two words
and both had just been spoken.

**A promise in text is not an action.** It has failed this way twice: it wrote
"открываю сайт" and opened nothing; it wrote "я проверю новости" and never
searched. The brief forbids writing that you are opening, playing or checking
something without having called the tool in the same turn. A tool call arriving
after some text no longer ends the turn — that text is a preamble.

**A failed command must not reach the model.** Asked to stop the music in words
the matcher missed, the model reported that the music had stopped. Phrases that
mean stop are caught when something is playing, but *after* the matcher, so a
command about something else wins — "убери лицо" used to stop the music and
leave the face.

**Voice commands match word stems, not whole words.** Russian inflects, and
commands are spoken in the accusative.

**Unmounting a component kills whatever engine holds its element.** The camera
video lives in the HUD; showing the face replaced the HUD, unmounting it, and
hand tracking was dead for the session with the button still reading ON.
Rendering it in both branches is not enough — a different parent is a different
element. It sits at a fixed position ahead of the branch.

**The spring integrator is only stable while the step is under 2/√tension.**
Frame time is clamped at a thirtieth of a second, so a tension above about five
hundred used to diverge exactly when the machine was busiest — the carousel
span too fast to see and nothing stopped it. Steps are sliced at a
hundred-and-twentieth now, and `springStability.test.ts` checks every config at
every frame rate. Below thirty frames a second every animation runs in slow
motion — that is the clamp's price, deliberate, and worth knowing.

**What the assistant concludes about him lives in the vault it also searches.**
Without a marker it writes a guess about him, finds it a day later while
searching his notes, and repeats it back as something he decided — convincing
him with his own words, which he never said. The file carries the front matter
`isAgentMemory` looks for, and `briefing.test.ts` checks both directions: its
own conclusions never surface, his own notes on the same subject still do.

**"Not connected" and "nothing there" are different answers.** An unconnected
calendar said as "no meetings today" is a lie he would act on, and from inside
the code the two are the same empty list. Everything that can be missing is
carried as null and said as missing. The health check reports the feed's whole
size beside today's count for the same reason: a clear day and a parser that
read nothing look identical from outside.

**Music goes through the YouTube Data API, never the general web search**,
which returns watch links only for the most literal titles.

**A browser will not open a tab without a click.** With popups allowed for the
origin it goes straight through; without, a chip asks for one tap. This is a
rule of the browser, said plainly rather than promised away.

**Native libraries break on non-ASCII paths.** espeak inside Piper cannot open
a path containing Cyrillic. It is handed the 8.3 short name, after the model
loads.

**Do not use `instrumentation.ts` for server warm-up.** Next compiles it for
the edge runtime, where `node:child_process` fails the build.

**One dev server at a time.** Two writing to the same `.next` corrupts it, and
the symptom looks like broken code: HTTP 200, HUD drawn, no hydration. Kill by
PID from `netstat -ano | grep :3000`, delete `.next`, restart.

**A stale browser tab lies about the console.** Errors accumulate across every
hot reload. Judge a clean build from a freshly opened tab, never the one that
has been open all session.

**Replacing a file in `public/` does not reach the browser.** The face clip is
requested with a version query (`?v=6`); bump it when the file changes.

**Escapes do not survive being written through a shell.** `\b` has arrived as a
literal backspace byte and `\p{L}` as `p{L}`, twice each — patterns that look
correct and match nothing. Build regexes with `String.raw`;
`sourceHygiene.test.ts` fails on any control character in the source.

## Actions

The model chooses an action like any tool, but the interface is in the browser,
so the server does not perform it: it sends the action down the answer stream
inside an envelope delimited by control characters, and the client unpacks and
carries it out. One direction — it does not wait to be told the module opened,
which the user sees faster than a round trip could report. An envelope split
across two chunks is held back rather than acted on half-formed. Only http and
https addresses are ever opened, checked where the action is made and again
where it runs. See `server/actionTypes.ts` and `voice/actionRunner.ts`.

## Open, and owed to the founder

- **The hand rate is measured, and this machine cannot do gestures.** Seven to
  eight readings a second, where fifteen is the floor. One pass of the hand
  model costs eighty to ninety milliseconds here, which caps the rate near
  twelve before rendering takes its share. Four explanations were tested and
  all four were wrong: the camera promises and delivers thirty; the scene is
  not the thief (stripping it to minimal made detection *worse*); the graphics
  card is not secretly the processor, and forcing the processor changed nothing
  (89ms against 79ms); a quarter of the pixels changed nothing (92ms against
  79ms, against a drift of some fifteen between readings) and was reverted.
  Nothing here is worth another guess — what is left is a cheaper model or a
  faster machine. A worker would smooth the scene and leave the rate where it
  is.
- **Popup permission is per-origin.** Allowed on his machine for
  `localhost:3000`. A deployment needs it again, and so does every customer —
  it belongs in a first-run screen rather than as a surprise.
- **The repository is public**, his deliberate choice so he can work on it from
  several tools. He asked to be reminded to close it before selling. `LICENSE`
  is "all rights reserved" as a minimum in the meantime.
- **`HOLOVANT_ACCESS_TOKEN` is unset**, correct locally and wrong the moment
  there is a public address.

## The rule that matters most

Anything the interface promises, the product must do. The Music module once
told users to say "play" while no such command existed. That is worse than a
missing feature, because it spends the user's trust before they find out.

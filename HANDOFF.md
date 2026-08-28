# Holovant — where the project stands

Written for whoever picks this up next, including a different AI. The code is
the source of truth; this is the part the code cannot tell you.

## Running it

```
cd apps/web
pnpm dev
```

Port 3000. Configuration lives in `apps/web/.env.local`, which is git-ignored
and holds the DeepSeek key, the Piper voice paths, and the notes folder. It is
absent on a fresh clone, and every feature behind it degrades honestly rather
than failing: no key means the assistant says so out loud.

Checks before committing: `pnpm --filter web typecheck`, `... lint`,
`... test`. Lint is slow — allow two or three minutes.

## What works

- 3D orbit of 16 module cards, hologram treatment, accents running violet to
  cyan in orbit order so a module is recognisable by hue in peripheral vision
- Server-side voice through Piper, 281–358ms measured, warmed on page load
- Streaming conversation with DeepSeek, provider-agnostic (OpenAI-compatible)
- Vita: named assistant, name is configuration so each customer sets their own
- Vita's face: a generated hologram clip played over black. Summoned by voice,
  it assembles from a spark and loops its formed tail. While it is up the whole
  dashboard is hidden, the 3D scene stops rendering, and the voice runs through
  a light ring modulator
- Voice commands: open a module, rotate, close, search the web, play music,
  save and replay favourite tracks, volume up and down, dismiss the chat or the
  player, wake on the assistant's name, show and hide the face
- Second brain: a folder of Markdown, consulted on every question. Empty for a
  customer until they connect their own
- Web search (Firecrawl), weather (Open-Meteo, no key), a real system check
- Several accounts per social module, combined by default
- Hand tracking, pinch to freeze the scene
- 52 tests; lint and types clean

## What is not built

Module data is mock everywhere except weather, system and the brain. The
provider interface takes live sources without touching the UI, but none are
connected. There is no sign-in, no payment, and no deployment — it runs on one
machine.

Asked for and still open: acting rather than only reporting ("schedule a post
for Thursday" should happen); memory of the user; a morning briefing; the
assistant speaking first.

## Things that will bite you

**The microphone hears the assistant's own voice.** Everything about the voice
loop follows from this. Acting on what it hears while speaking makes it answer
its own answers; ignoring everything while speaking makes it deaf for the whole
length of a reply, which reads as a freeze. The settled rule, in
`useVoiceCommands.ts`: "стоп" always acts, even on a partial result; text that
mostly overlaps the line being spoken is discarded as echo; a *command* said
over a reply cuts it off and runs; a *question* said over a reply is dropped.

**A failed command must not reach the model.** Asked to stop the music by a
phrase the matcher missed, the model will say the music has stopped. It has
not. Phrases that mean stop are caught before the matcher when something is
playing, and anything that starts like a command but matches nothing is
answered "не понял команду".

**Voice commands match word stems, not whole words.** Russian inflects, and
commands are spoken in the accusative — "включи музыку", not "музыка".

**Music search goes through YouTube's results page**, not the general web
search: the latter returns watch links only for the most literal titles, so
every artist name came back as nothing found.

**A browser will not open tabs or start audible sound without a click.** A
spoken command is not a click. This is why the player is embedded.

**Native libraries break on non-ASCII paths.** espeak inside Piper cannot open
a path containing Cyrillic, which is every path under this user's home folder.
It is handed the 8.3 short name, and the path must be set on the voice object
*after* the model loads.

**Do not use `instrumentation.ts` for server warm-up.** Next compiles it for the
edge runtime too, where `node:child_process` fails the build and takes the
speech route down with it. Warm-up is a GET on `/api/speak` instead.

**One dev server at a time.** Two writing to the same `.next` corrupts it, and
the symptom looks like broken code: HTTP 200, HUD drawn, no client hydration.
Kill by PID from `netstat -ano | grep :3000`, delete `.next`, restart.

**Replacing a file in `public/` does not reach the browser.** The face clip is
requested with a version query (`/vita-face.mp4?v=5`); bump it when the file
changes or a stale clip is served from cache.

**Full 3D plus a full-screen video is too much at once.** The scene sets
`frameloop="never"` while the face is up, and the video avoids `mix-blend-mode`
and animated drop shadows — both are per-frame full-screen GPU passes.

## The rule that matters most

Anything the interface promises, the product must do. The Music module once told
users to say "play" while no such command existed. That is worse than a missing
feature, because it spends the user's trust before they find out.

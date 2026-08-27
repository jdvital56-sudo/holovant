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

## What works

- 3D orbit of 16 module cards, hologram treatment, accents running violet to
  cyan in orbit order so a module is recognisable by hue in peripheral vision
- Server-side voice through Piper, 281–358ms measured, warmed on page load
- Streaming conversation with DeepSeek, provider-agnostic (OpenAI-compatible)
- Vita: named assistant, name is configuration so each customer sets their own
- Vita's face — points assembling into a figure, driven by the measured level
  of the audio actually playing
- Second brain: a folder of Markdown, consulted on every question. Empty for a
  customer until they connect their own
- Web search (Firecrawl), weather (Open-Meteo, no key), a real system check
- Several accounts per social module, combined by default
- Hand tracking, pinch to freeze the scene
- 30 tests; lint and types clean

## What is not built

Module data is mock everywhere except weather, system and the brain. The
provider interface takes live sources without touching the UI, but none are
connected. There is no sign-in, no payment, and no deployment — it runs on one
machine.

Asked for and still open: a robotic voice; acting rather than only reporting;
memory of the user; a morning briefing; the assistant speaking first.

## Things that will bite you

**Voice commands match word stems, not whole words.** Russian inflects, and
commands are spoken in the accusative — "включи музыку", not "музыка". Whole-word
matching failed silently and sent commands to the model as questions, which
looked like random system faults.

**A browser will not open tabs or start audible sound without a click.** A
spoken command is not a click. This is why the music player is embedded rather
than opening YouTube: voice finds the track, one click starts it. There is no
way around this and attempting one wastes a day.

**Native libraries break on non-ASCII paths.** espeak inside Piper cannot open a
path containing Cyrillic, which is every path under this user's home folder.
It is handed the 8.3 short name, and the path must be set on the voice object
*after* the model loads — Piper builds its phonemizer lazily and overwrites an
earlier manual call.

**Do not use `instrumentation.ts` for server warm-up.** Next compiles it for the
edge runtime too, where `node:child_process` fails the build and takes the
speech route down with it. Warm-up is a GET on `/api/speak` instead.

**One dev server at a time.** Two writing to the same `.next` corrupts it.

## The rule that matters most

Anything the interface promises, the product must do. The Music module once told
users to say "play" while no such command existed. That is worse than a missing
feature, because it spends the user's trust before they find out.

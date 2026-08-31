# Holovant

A spatial operating system for the browser. Sixteen modules orbit as
holographic cards; you talk to it, and it answers out loud in its own voice.

Not a dashboard with a chat box bolted on. The voice is the interface: open a
module, ask a question, play a track, summon the assistant's face — all spoken,
all answered aloud.

## Running it

```bash
pnpm install
pnpm --filter web dev
```

Port 3000. Nothing below is required to start — every feature that needs a key
says so out loud instead of failing silently, and the app runs without any of
them.

### Configuration

Put these in `apps/web/.env.local`, which is git-ignored.

| Variable | What it turns on | Without it |
| --- | --- | --- |
| `HOLOVANT_LLM_API_KEY` | The assistant's answers | It says it has no key |
| `HOLOVANT_LLM_BASE_URL` | A different provider (OpenAI-compatible) | DeepSeek |
| `HOLOVANT_LLM_MODEL` | A different model | `deepseek-chat` |
| `HOLOVANT_PIPER_PYTHON` | The product's own voice — path to a venv Python with Piper | The browser's voice, which differs per machine |
| `HOLOVANT_PIPER_VOICE` | Path to the `.onnx` voice model | As above |
| `FIRECRAWL_API_KEY` | Web search | Search is off |
| `YOUTUBE_API_KEY` | Finding music the supported way, embeddable results only | Falls back to reading the results page — works, but against YouTube's terms |
| `HOLOVANT_BRAIN_PATH` | The second brain — a folder of Markdown notes | The module asks you to connect one |
| `HOLOVANT_USER_MEMORY_PATH` | Where the assistant keeps what it has concluded about you | `Holovant/О пользователе.md` inside the second brain, or `.holovant/` without one |
| `HOLOVANT_CALENDAR_ICS` | Your calendar in the morning briefing — the **private** iCal address from your calendar's own settings, read-only, no sign-in | The briefing says the calendar is not connected, which is not the same as saying the day is clear |
| `HOLOVANT_ACCESS_TOKEN` | Requires a bearer token on every `/api/*` call | The API is open — correct on one local machine, **not** on a public address |
| `NEXT_PUBLIC_HOLOVANT_ASSISTANT_NAME` | What the assistant is called | `Vita` |

### Checks

```bash
pnpm --filter web typecheck && pnpm --filter web lint && pnpm --filter web test
```

Lint takes a couple of minutes. Do not run `build` while `dev` is running —
they share `.next` and the result looks like broken code.

## Layout

- `apps/web` — the application. `src/scene` is the 3D orbit, `src/voice` the
  command engine and speech, `src/modules` the sixteen modules, `src/server`
  the model, notes and Piper worker, `src/app/api` seven routes.
- `apps/web/voice-worker/piper_worker.py` — long-lived Piper process, spoken to
  over stdin/stdout.
- `packages/module-contracts` — what a module is, and how data reaches it.
- `packages/motion-vocabulary` — shared spring and easing definitions.

## State of it

Module data is mock everywhere except weather, the system check and the second
brain. There is no sign-in, no payment and no deployment. `HANDOFF.md` is the
honest account: what works, what does not, and the failures already paid for.

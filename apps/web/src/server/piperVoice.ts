import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface, type Interface } from "node:readline";

/**
 * Server-side speech through a long-lived Piper process.
 *
 * The browser's own synthesiser was the alternative, but its voices differ by
 * operating system and browser, so no two users hear the same product. Piper
 * runs here, which makes the voice a property of the app rather than of the
 * machine it happens to be opened on.
 *
 * The model costs seconds to load and a fraction of one to run, so exactly one
 * worker is kept warm for the lifetime of the server.
 */

const WORKER_SCRIPT = "voice-worker/piper_worker.py";
/** A reply that takes longer than this has stopped being conversational. */
const SYNTH_TIMEOUT_MS = 8000;
const START_TIMEOUT_MS = 45000;

interface PendingJob {
  resolve: (outPath: string) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

class PiperWorker {
  private process: ChildProcessWithoutNullStreams | null = null;
  private reader: Interface | null = null;
  private ready: Promise<void> | null = null;
  /** Piper answers in the order it was asked, so a queue is enough to match up. */
  private queue: PendingJob[] = [];

  private failAll(error: Error) {
    const pending = this.queue;
    this.queue = [];
    pending.forEach((job) => {
      clearTimeout(job.timer);
      job.reject(error);
    });
  }

  private reset() {
    this.process = null;
    this.reader?.close();
    this.reader = null;
    this.ready = null;
  }

  private start(): Promise<void> {
    const python = process.env.HOLOVANT_PIPER_PYTHON;
    const voice = process.env.HOLOVANT_PIPER_VOICE;
    if (!python || !voice) {
      return Promise.reject(
        new Error("Piper is not configured (HOLOVANT_PIPER_PYTHON, HOLOVANT_PIPER_VOICE)."),
      );
    }

    return new Promise<void>((resolve, reject) => {
      const child = spawn(python, [WORKER_SCRIPT], {
        cwd: process.cwd(),
        env: { ...process.env, HOLOVANT_PIPER_VOICE: voice, PYTHONIOENCODING: "utf-8" },
        stdio: ["pipe", "pipe", "pipe"],
      });
      this.process = child;

      const startTimer = setTimeout(() => {
        reject(new Error("Piper worker did not become ready in time."));
        child.kill();
      }, START_TIMEOUT_MS);

      let stderr = "";
      child.stderr.on("data", (chunk: Buffer) => {
        stderr = (stderr + chunk.toString()).slice(-2000);
      });

      child.on("exit", (code) => {
        clearTimeout(startTimer);
        this.failAll(new Error(`Piper worker exited (${code}). ${stderr.trim()}`));
        this.reset();
        reject(new Error(`Piper worker exited (${code}). ${stderr.trim()}`));
      });

      const reader = createInterface({ input: child.stdout });
      this.reader = reader;

      reader.on("line", (line) => {
        let message: Record<string, unknown>;
        try {
          message = JSON.parse(line) as Record<string, unknown>;
        } catch {
          return; // Not our protocol — library chatter on stdout.
        }

        if ("ready" in message) {
          clearTimeout(startTimer);
          if (message.ready === true) resolve();
          else reject(new Error(String(message.error ?? "Piper failed to start.")));
          return;
        }

        const job = this.queue.shift();
        if (!job) return;
        clearTimeout(job.timer);
        if (message.ok === true && typeof message.out === "string") job.resolve(message.out);
        else job.reject(new Error(String(message.error ?? "Synthesis failed.")));
      });
    });
  }

  ensureReady(): Promise<void> {
    if (!this.ready) {
      this.ready = this.start().catch((error: unknown) => {
        this.reset();
        throw error;
      });
    }
    return this.ready;
  }

  async synthesize(text: string): Promise<Buffer> {
    await this.ensureReady();
    const child = this.process;
    if (!child) throw new Error("Piper worker is not running.");

    const out = join(tmpdir(), `holovant-${randomUUID()}.wav`);

    const outPath = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        // The job stays queued deliberately: its reply is still coming, and
        // dropping it here would misalign every later reply with its request.
        reject(new Error("Synthesis timed out."));
      }, SYNTH_TIMEOUT_MS);

      this.queue.push({ resolve, reject, timer });
      child.stdin.write(`${JSON.stringify({ text, out })}\n`);
    });

    try {
      const wav = await readFile(outPath);
      if (wav.length === 0) {
        // Piper writes an empty file rather than failing when the text
        // phonemises to nothing. Returning it would be silence dressed up as
        // success, and the caller could never fall back.
        throw new Error("Synthesis produced no audio.");
      }
      return wav;
    } finally {
      void unlink(outPath).catch(() => {});
    }
  }

  dispose() {
    this.failAll(new Error("Worker disposed."));
    this.process?.kill();
    this.reset();
  }
}

/**
 * Held on globalThis rather than in module scope: the dev server re-evaluates
 * modules on every edit, and a plain module-scope instance would leak a fresh
 * Python process — each holding a voice model in memory — on each reload.
 */
const globalForPiper = globalThis as typeof globalThis & {
  holovantPiper?: PiperWorker;
  holovantPiperExitHookInstalled?: boolean;
};

const worker = globalForPiper.holovantPiper ?? new PiperWorker();
globalForPiper.holovantPiper = worker;

if (!globalForPiper.holovantPiperExitHookInstalled) {
  process.once("exit", () => worker.dispose());
  globalForPiper.holovantPiperExitHookInstalled = true;
}

export function synthesizeSpeech(text: string): Promise<Buffer> {
  return worker.synthesize(text);
}

/** Loads the model ahead of the first request instead of during it. */
export function warmUpSpeech(): Promise<void> {
  return worker.ensureReady();
}

export function isPiperConfigured(): boolean {
  return Boolean(process.env.HOLOVANT_PIPER_PYTHON && process.env.HOLOVANT_PIPER_VOICE);
}

import { NextResponse } from "next/server";
import { synthesizeSpeech, isPiperConfigured, warmUpSpeech } from "@/server/piperVoice";

/**
 * Loads the voice model without synthesising anything, so the several seconds
 * it costs are spent while the user is still looking at the scene rather than
 * on the first thing they say. The client calls this once on load.
 */
export async function GET() {
  if (!isPiperConfigured()) {
    return NextResponse.json({ ready: false, reason: "not-configured" }, { status: 501 });
  }
  try {
    await warmUpSpeech();
    return NextResponse.json({ ready: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Warm-up failed.";
    return NextResponse.json({ ready: false, reason: message }, { status: 503 });
  }
}

/** Replies are short. Anything longer is not a spoken answer. */
const TEXT_LIMIT = 600;

/** Node APIs and a long-lived child process rule out the edge runtime. */
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isPiperConfigured()) {
    // A plain 501 lets the client fall back to the browser's own voice
    // instead of the page going silent.
    return NextResponse.json({ error: "Server speech is not configured." }, { status: 501 });
  }

  let text: string;
  try {
    const body = (await request.json()) as { text?: unknown };
    text = typeof body.text === "string" ? body.text.trim().slice(0, TEXT_LIMIT) : "";
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  if (!text) return NextResponse.json({ error: "Empty text." }, { status: 400 });

  try {
    const wav = await synthesizeSpeech(text);
    return new NextResponse(new Uint8Array(wav), {
      headers: {
        "Content-Type": "audio/wav",
        "Content-Length": String(wav.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Synthesis failed.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

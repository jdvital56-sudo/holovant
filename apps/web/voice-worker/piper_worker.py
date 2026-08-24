# -*- coding: utf-8 -*-
"""
Long-lived Piper synthesiser.

Loading the voice model costs seconds; synthesising a line costs a fraction of
one. So the model is loaded once here and the process is kept alive, rather
than paying the load on every reply.

Protocol, one JSON object per line in each direction:
  in   {"text": "...", "out": "C:\\path\\to.wav"}
  out  {"ok": true, "out": "..."} | {"ok": false, "error": "..."}
Readiness is announced once, after a warm-up synthesis:
  out  {"ready": true, "load_seconds": 2.31}
"""

import ctypes
import json
import os
import sys
import time
import wave


def emit(payload):
    sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def write_wav(voice, text, out):
    """
    Closing a wave file that received no frames raises "# channels not
    specified", which replaces whatever actually went wrong during synthesis.
    Closing separately keeps the real failure visible.
    """
    handle = wave.open(out, "wb")
    try:
        voice.synthesize_wav(text, handle)
    finally:
        try:
            handle.close()
        except Exception:  # noqa: BLE001 - never worth masking the real error
            pass


def short_path(path):
    """
    espeak-ng is a native library and cannot open a path containing non-ASCII
    characters. On a machine whose user folder is Cyrillic that is every path
    under the home directory, so it is handed the 8.3 short form instead.
    """
    if os.name != "nt":
        return str(path)
    buf = ctypes.create_unicode_buffer(1024)
    written = ctypes.windll.kernel32.GetShortPathNameW(str(path), buf, 1024)
    return buf.value if written else str(path)


def main():
    voice_path = os.environ.get("HOLOVANT_PIPER_VOICE")
    if not voice_path:
        emit({"ready": False, "error": "HOLOVANT_PIPER_VOICE is not set"})
        return 1
    if not os.path.exists(voice_path):
        emit({"ready": False, "error": "Voice model not found: %s" % voice_path})
        return 1

    try:
        import piper
        from piper.phonemize_espeak import ESPEAK_DATA_DIR
    except Exception as exc:  # noqa: BLE001 - reported to the caller, not swallowed
        emit({"ready": False, "error": "piper is not importable: %s" % exc})
        return 1

    started = time.time()
    try:
        voice = piper.PiperVoice.load(voice_path)
        # Piper builds its espeak phonemizer lazily from this attribute, so it
        # has to be corrected before the first synthesis rather than after.
        voice.espeak_data_dir = short_path(ESPEAK_DATA_DIR)
    except Exception as exc:  # noqa: BLE001
        emit({"ready": False, "error": "Could not load voice: %s" % exc})
        return 1

    load_seconds = time.time() - started

    # The first synthesis also initialises espeak, which costs about two
    # seconds. Spending it now means the user's first reply is not the one
    # that waits for it.
    try:
        warm = os.path.join(os.environ.get("TEMP", "."), "holovant-piper-warm.wav")
        write_wav(voice, "Готов", warm)
        try:
            os.remove(warm)
        except OSError:
            pass
    except Exception as exc:  # noqa: BLE001
        emit({"ready": False, "error": "Warm-up failed: %s" % exc})
        return 1

    emit({"ready": True, "load_seconds": round(load_seconds, 2)})

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            request = json.loads(line)
            text = (request.get("text") or "").strip()
            out = request.get("out")
            if not text or not out:
                emit({"ok": False, "error": "text and out are both required"})
                continue
            write_wav(voice, text, out)
            emit({"ok": True, "out": out})
        except Exception as exc:  # noqa: BLE001
            # One bad line must not take the worker down with it.
            emit({"ok": False, "error": str(exc)})

    return 0


if __name__ == "__main__":
    sys.exit(main())

"""
audio_duck.py — Auto-ducking: reduce music volume during speech segments

Usage:
    python audio_duck.py <speechAudioPath> <musicAudioPath> <outputPath> [duckLevel=0.15]

Output (JSON to stdout):
    {"outputPath": "...", "duckPoints": [{"start": 0.0, "end": 1.0, "level": 0.15}, ...]}
"""

import json
import sys
import os
import numpy as np

try:
    import librosa
    import soundfile as sf
except ImportError as e:
    print(json.dumps({"error": f"Missing dependency: {e}. Run: pip install librosa soundfile"}))
    sys.exit(1)


FADE_DURATION = 0.20   # 200 ms fade for smooth transitions
TOP_DB_SPEECH = 35     # silence threshold for detecting speech (lower = more sensitive)


def make_duck_envelope(music_samples, sr, duck_points, duck_level, fade_dur):
    """
    Build a gain envelope array (same length as music_samples) that
    linearly ramps between 1.0 (full) and duck_level in speech regions,
    with smooth fade_dur-second transitions.
    """
    gain = np.ones(len(music_samples), dtype=np.float32)
    fade_samples = int(fade_dur * sr)

    for dp in duck_points:
        start_s = int(dp["start"] * sr)
        end_s = int(dp["end"] * sr)
        n = len(music_samples)

        # Clamp to array bounds
        start_s = max(0, min(start_s, n))
        end_s = max(0, min(end_s, n))

        # Fade-in: 1.0 → duck_level
        fade_in_start = start_s
        fade_in_end = min(start_s + fade_samples, end_s)
        if fade_in_end > fade_in_start:
            fade_len = fade_in_end - fade_in_start
            gain[fade_in_start:fade_in_end] *= np.linspace(1.0, duck_level, fade_len)

        # Sustain: duck_level
        sustain_start = fade_in_end
        sustain_end = max(fade_in_end, end_s - fade_samples)
        if sustain_end > sustain_start:
            gain[sustain_start:sustain_end] *= duck_level

        # Fade-out: duck_level → 1.0
        fade_out_start = sustain_end
        fade_out_end = min(end_s, n)
        if fade_out_end > fade_out_start:
            fade_len = fade_out_end - fade_out_start
            gain[fade_out_start:fade_out_end] *= np.linspace(duck_level, 1.0, fade_len)

    return gain


def main():
    if len(sys.argv) < 4:
        raise SystemExit(
            "Usage: audio_duck.py speechAudioPath musicAudioPath outputPath [duckLevel=0.15]"
        )

    speech_path = sys.argv[1]
    music_path = sys.argv[2]
    output_path = sys.argv[3]
    duck_level = float(sys.argv[4]) if len(sys.argv) > 4 else 0.15

    # ── Validate inputs ──────────────────────────────────────────────────────
    for p in (speech_path, music_path):
        if not os.path.exists(p):
            print(json.dumps({"error": f"File not found: {p}"}))
            sys.exit(1)

    # ── Load speech audio ────────────────────────────────────────────────────
    speech_y, speech_sr = librosa.load(speech_path, sr=None, mono=True)
    speech_duration = len(speech_y) / speech_sr

    # Detect speech (non-silence) intervals
    speech_intervals = librosa.effects.split(speech_y, top_db=TOP_DB_SPEECH)
    duck_points = [
        {
            "start": round(float(s) / speech_sr, 3),
            "end": round(float(e) / speech_sr, 3),
            "level": duck_level,
        }
        for s, e in speech_intervals
    ]

    # ── Load music audio ─────────────────────────────────────────────────────
    # Resample music to match speech sr for mixing
    music_y, music_sr = librosa.load(music_path, sr=speech_sr, mono=True)

    # Loop or trim music to match speech duration
    required_samples = len(speech_y)
    if len(music_y) < required_samples:
        # Loop music
        repeats = int(np.ceil(required_samples / len(music_y)))
        music_y = np.tile(music_y, repeats)
    music_y = music_y[:required_samples].copy()

    # ── Build duck gain envelope ─────────────────────────────────────────────
    gain_env = make_duck_envelope(music_y, speech_sr, duck_points, duck_level, FADE_DURATION)
    ducked_music = music_y * gain_env

    # ── Mix speech + ducked music ────────────────────────────────────────────
    # Normalise each stem so peak ≤ 0.95 before mixing to avoid clipping
    def safe_normalise(arr, peak=0.95):
        max_val = np.abs(arr).max()
        return arr * (peak / max_val) if max_val > 0 else arr

    speech_norm = safe_normalise(speech_y)
    music_norm = safe_normalise(ducked_music, peak=0.80)   # music slightly quieter overall

    mixed = speech_norm + music_norm
    # Final clip guard
    max_mix = np.abs(mixed).max()
    if max_mix > 1.0:
        mixed /= max_mix

    # ── Write output ─────────────────────────────────────────────────────────
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    sf.write(output_path, mixed.astype(np.float32), speech_sr, subtype="PCM_16")

    print(json.dumps({
        "outputPath": output_path,
        "duration": round(speech_duration, 3),
        "duckPoints": duck_points,
        "duckCount": len(duck_points),
    }))


if __name__ == "__main__":
    main()

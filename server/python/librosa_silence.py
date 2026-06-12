import json
import sys

import librosa


def main():
    if len(sys.argv) < 2:
        raise SystemExit("Usage: librosa_silence.py audioPath [threshold=0.02] [minDuration=0.5]")

    audio_path = sys.argv[1]
    min_duration = float(sys.argv[3]) if len(sys.argv) > 3 else 0.5
    y, sr = librosa.load(audio_path, sr=None)
    intervals = librosa.effects.split(y, top_db=40)

    silence_ranges = []
    previous_end = 0
    for start, end in intervals:
      start_seconds = previous_end / sr
      end_seconds = start / sr
      if end_seconds - start_seconds >= min_duration:
          silence_ranges.append({"start": start_seconds, "end": end_seconds})
      previous_end = end

    duration = len(y) / sr
    if duration - (previous_end / sr) >= min_duration:
        silence_ranges.append({"start": previous_end / sr, "end": duration})

    total_silence = sum(item["end"] - item["start"] for item in silence_ranges)
    print(json.dumps({
        "silenceRanges": silence_ranges,
        "totalSilence": total_silence,
        "count": len(silence_ranges)
    }))


if __name__ == "__main__":
    main()

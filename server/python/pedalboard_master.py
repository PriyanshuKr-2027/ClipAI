import json
import sys

import pyloudnorm as pyln
from pedalboard import Compressor, Gain, HighpassFilter, Pedalboard
from pedalboard.io import AudioFile


def main():
    if len(sys.argv) < 3:
        raise SystemExit("Usage: pedalboard_master.py audioPath outputPath [targetLufs=-14]")

    audio_path = sys.argv[1]
    output_path = sys.argv[2]
    target_lufs = float(sys.argv[3]) if len(sys.argv) > 3 else -14

    with AudioFile(audio_path) as source:
        audio = source.read(source.frames)
        sample_rate = source.samplerate

    board = Pedalboard([
        HighpassFilter(cutoff_frequency_hz=80),
        Compressor(threshold_db=-18, ratio=3),
        Gain(gain_db=0)
    ])
    processed = board(audio, sample_rate)

    meter = pyln.Meter(sample_rate)
    loudness = meter.integrated_loudness(processed.T)
    gain_db = target_lufs - loudness
    mastered = Gain(gain_db=gain_db)(processed, sample_rate)
    final_loudness = meter.integrated_loudness(mastered.T)

    with AudioFile(output_path, "w", sample_rate, mastered.shape[0]) as destination:
        destination.write(mastered)

    print(json.dumps({"masteredPath": output_path, "lufs": float(final_loudness)}))


if __name__ == "__main__":
    main()

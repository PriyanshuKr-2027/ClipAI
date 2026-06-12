import json
import sys

import librosa


def main():
    if len(sys.argv) < 2:
        raise SystemExit("Usage: librosa_beat.py audioPath [--energy]")

    audio_path = sys.argv[1]
    include_energy = "--energy" in sys.argv
    y, sr = librosa.load(audio_path, sr=None)
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
    beat_times = librosa.frames_to_time(beat_frames, sr=sr).tolist()
    result = {"bpm": round(float(tempo), 1), "beats": beat_times}

    if include_energy:
        rms = librosa.feature.rms(y=y, frame_length=sr, hop_length=sr)[0]
        result["energyBySecond"] = [float(value) for value in rms]

    print(json.dumps(result))


if __name__ == "__main__":
    main()

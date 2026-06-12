import json
import sys
from pathlib import Path

import noisereduce as nr
import soundfile as sf


def main():
    if len(sys.argv) < 2:
        raise SystemExit("Usage: noisereduce_pass.py audioPath")

    audio_path = Path(sys.argv[1])
    y, sr = sf.read(str(audio_path))
    reduced = nr.reduce_noise(y=y, sr=sr)

    if audio_path.suffix.lower() == ".wav":
        output_path = audio_path.with_name(f"{audio_path.stem}_clean.wav")
    else:
        output_path = audio_path.with_name(f"{audio_path.name}_clean.wav")

    sf.write(str(output_path), reduced, sr)
    print(json.dumps({"cleanAudioPath": str(output_path)}))


if __name__ == "__main__":
    main()

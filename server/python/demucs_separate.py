import json
import sys
import uuid
from pathlib import Path

import demucs.api
import torchaudio


def main():
    if len(sys.argv) < 3:
        raise SystemExit("Usage: demucs_separate.py audioPath outputDir")

    audio_path = sys.argv[1]
    output_dir = Path(sys.argv[2])
    output_dir.mkdir(parents=True, exist_ok=True)

    separator = demucs.api.Separator(model="htdemucs")
    separator.load_model()
    origin, separated = separator.separate_audio_file(audio_path)

    vocals = separated["vocals"]
    vocals_path = output_dir / f"{uuid.uuid4()}_vocals.wav"
    torchaudio.save(str(vocals_path), vocals.cpu(), origin.samplerate)

    print(json.dumps({"vocalsPath": str(vocals_path)}))


if __name__ == "__main__":
    main()

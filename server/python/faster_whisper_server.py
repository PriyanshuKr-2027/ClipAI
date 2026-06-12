import json
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')

from faster_whisper import WhisperModel


def arg_value(name, default):
    if name in sys.argv:
        return sys.argv[sys.argv.index(name) + 1]
    return default


def main():
    if len(sys.argv) < 2:
        raise SystemExit("Usage: faster_whisper_server.py audioPath [--language auto] [--beam_size 5] [--model large-v3]")

    audio_path = sys.argv[1]
    language = arg_value("--language", "auto")
    beam_size = int(arg_value("--beam_size", "5"))
    model_size = arg_value("--model", "large-v3")
    initial_prompt = arg_value("--initial_prompt", None)
    model_path = Path(__file__).parent / "models" / model_size

    print(f"Loading Whisper model from {model_path}", file=sys.stderr)
    model = WhisperModel(str(model_path), device="cpu", compute_type="int8")

    transcribe_kwargs = {"beam_size": beam_size, "word_timestamps": True}
    if language != "auto":
        transcribe_kwargs["language"] = language
    if initial_prompt:
        transcribe_kwargs["initial_prompt"] = initial_prompt

    print(f"Transcribing {audio_path}", file=sys.stderr)
    segments, info = model.transcribe(audio_path, **transcribe_kwargs)

    words = []
    text_parts = []
    for segment in segments:
        text_parts.append(segment.text)
        if segment.words:
            for word in segment.words:
                words.append({
                    "word": word.word,
                    "start": word.start,
                    "end": word.end
                })

    print(json.dumps({
        "words": words,
        "text": "".join(text_parts).strip(),
        "language": info.language,
        "duration": info.duration
    }))


if __name__ == "__main__":
    main()

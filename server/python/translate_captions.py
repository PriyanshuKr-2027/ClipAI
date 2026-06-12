import json
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')

from deep_translator import GoogleTranslator


def sentence_chunks(words):
    chunk = []
    for word in words:
        chunk.append(word)
        token = word.get("word", "").strip()
        if word.get("sentenceBreak") or token.endswith((".", "!", "?")):
            yield chunk
            chunk = []
    if chunk:
        yield chunk


def main():
    if len(sys.argv) < 3:
        raise SystemExit("Usage: translate_captions.py words_json_path targetLang")

    words = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    target_lang = sys.argv[2]
    source_lang = sys.argv[3] if len(sys.argv) > 3 else "auto"
    translator = GoogleTranslator(source=source_lang, target=target_lang)
    translated_words = []

    for chunk in sentence_chunks(words):
        text = " ".join(item.get("word", "").strip() for item in chunk).strip()
        translated = translator.translate(text) if text else ""
        for item in chunk:
            translated_words.append({
                "word": item.get("word", ""),
                "start": item.get("start"),
                "end": item.get("end"),
                "translated": translated
            })

    print(json.dumps({"translatedWords": translated_words}, ensure_ascii=False))


if __name__ == "__main__":
    main()

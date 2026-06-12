import json
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')


def mark_basic_sentence_breaks(words):
    for word in words:
        token = word.get("word", "").strip()
        if token.endswith((".", "!", "?")):
            word["sentenceBreak"] = True
    return words


def main():
    if len(sys.argv) < 3:
        raise SystemExit("Usage: spacy_breaks.py words_json_path language")

    words_path = Path(sys.argv[1])
    language = sys.argv[2].lower()
    words = json.loads(words_path.read_text(encoding="utf-8"))

    if not words:
        print(json.dumps({"words": []}))
        return

    if language not in ("en", "eng", "english"):
        print(json.dumps({"words": mark_basic_sentence_breaks(words)}))
        return

    import spacy

    nlp = spacy.load("en_core_web_sm")
    text = " ".join(word.get("word", "").strip() for word in words)
    doc = nlp(text)
    sentence_ends = {sent.end for sent in doc.sents}

    token_index = 0
    for word in words:
        token_count = len(nlp.make_doc(word.get("word", "").strip()))
        token_index += max(token_count, 1)
        if token_index in sentence_ends:
            word["sentenceBreak"] = True

    print(json.dumps({"words": words}))


if __name__ == "__main__":
    main()

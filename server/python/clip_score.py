import json
import sys

import clip
import cv2
import torch
from PIL import Image


def frame_at(cap, fps, timestamp):
    cap.set(cv2.CAP_PROP_POS_FRAMES, int(timestamp * fps))
    ok, frame = cap.read()
    if not ok:
        return None
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    return Image.fromarray(rgb)


def main():
    if len(sys.argv) < 3:
        raise SystemExit("Usage: clip_score.py videoPath timestamps_json")

    video_path = sys.argv[1]
    timestamps = json.loads(sys.argv[2])
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model, preprocess = clip.load("ViT-B/32", device=device)
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30

    with torch.no_grad():
        text_tokens = clip.tokenize(["boring static video"]).to(device)
        boring_embedding = model.encode_text(text_tokens)
        boring_embedding = boring_embedding / boring_embedding.norm(dim=-1, keepdim=True)
        scores = []

        for timestamp in timestamps:
            image = frame_at(cap, fps, float(timestamp))
            if image is None:
                continue
            image_input = preprocess(image).unsqueeze(0).to(device)
            image_embedding = model.encode_image(image_input)
            image_embedding = image_embedding / image_embedding.norm(dim=-1, keepdim=True)
            similarity = (image_embedding @ boring_embedding.T).item()
            scores.append({"time": float(timestamp), "score": float(1 - similarity)})

    cap.release()
    print(json.dumps({"scores": scores}))


if __name__ == "__main__":
    main()

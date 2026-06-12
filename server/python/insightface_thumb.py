import json
import sys
import uuid
from pathlib import Path

import cv2
import insightface


def sharpness(frame):
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    return cv2.Laplacian(gray, cv2.CV_64F).var()


def main():
    if len(sys.argv) < 4:
        raise SystemExit("Usage: insightface_thumb.py videoPath startTime endTime [outputDir]")

    video_path = sys.argv[1]
    start_time = float(sys.argv[2])
    end_time = float(sys.argv[3])
    output_dir = Path(sys.argv[4]) if len(sys.argv) > 4 else Path(video_path).parent
    output_dir.mkdir(parents=True, exist_ok=True)

    app = insightface.app.FaceAnalysis()
    app.prepare(ctx_id=0, det_size=(640, 640))

    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    timestamps = [
        start_time + (end_time - start_time) * i / 7
        for i in range(8)
    ]
    best = None

    for timestamp in timestamps:
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(timestamp * fps))
        ok, frame = cap.read()
        if not ok:
            continue
        faces = app.get(frame)
        frame_sharpness = sharpness(frame)
        for face in faces:
            x1, y1, x2, y2 = face.bbox
            face_area = max((x2 - x1) * (y2 - y1), 0)
            confidence = float(getattr(face, "det_score", 0))
            score = float(face_area * confidence + frame_sharpness)
            if best is None or score > best["score"]:
                best = {"score": score, "timestamp": timestamp, "frame": frame, "confidence": confidence}

    cap.release()

    if best is None:
        raise SystemExit("No usable face frame found")

    thumb_path = output_dir / f"{uuid.uuid4()}.jpg"
    cv2.imwrite(str(thumb_path), best["frame"])
    print(json.dumps({
        "thumbPath": str(thumb_path),
        "timestamp": best["timestamp"],
        "faceScore": best["score"]
    }))


if __name__ == "__main__":
    main()

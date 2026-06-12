import json
import sys

import cv2
from ultralytics import YOLO


def main():
    if len(sys.argv) < 2:
        raise SystemExit("Usage: yolo_detect.py videoPath [sampleRate=1.0]")

    video_path = sys.argv[1]
    sample_rate = float(sys.argv[2]) if len(sys.argv) > 2 else 1.0
    model = YOLO("yolov8n.pt")
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    frame_interval = max(int(fps / sample_rate), 1)
    detections = []
    frame_index = 0

    while cap.isOpened():
        ok, frame = cap.read()
        if not ok:
            break

        if frame_index % frame_interval == 0:
            time_seconds = frame_index / fps
            result = model(frame, verbose=False)[0]
            objects = []
            for box in result.boxes:
                cls = int(box.cls[0])
                objects.append({
                    "label": model.names[cls],
                    "confidence": float(box.conf[0])
                })
            detections.append({"time": time_seconds, "objects": objects})

        frame_index += 1

    cap.release()
    print(json.dumps({"detections": detections}))


if __name__ == "__main__":
    main()

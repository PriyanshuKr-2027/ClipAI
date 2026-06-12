import json
import sys
import os

# Remove script directory from path to avoid circular import with the scenedetect third-party package
script_dir = os.path.dirname(os.path.abspath(__file__))
if script_dir in sys.path:
    sys.path.remove(script_dir)
if "" in sys.path:
    sys.path.remove("")

from scenedetect import ContentDetector, detect


def main():
    if len(sys.argv) < 2:
        raise SystemExit("Usage: scenedetect.py videoPath [threshold=27]")

    video_path = sys.argv[1]
    threshold = float(sys.argv[2]) if len(sys.argv) > 2 else 27
    scene_list = detect(video_path, ContentDetector(threshold=threshold))
    scenes = [
        {"start": scene[0].get_seconds(), "end": scene[1].get_seconds()}
        for scene in scene_list
    ]

    print(json.dumps({"scenes": scenes, "sceneCount": len(scenes)}))


if __name__ == "__main__":
    main()

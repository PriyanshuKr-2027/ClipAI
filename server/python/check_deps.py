import importlib.util
import json


PACKAGES = {
    "faster_whisper": "faster_whisper",
    "demucs": "demucs",
    "noisereduce": "noisereduce",
    "soundfile": "soundfile",
    "librosa": "librosa",
    "spacy": "spacy",
    "deep_translator": "deep_translator",
    "scenedetect": "scenedetect",
    "ultralytics": "ultralytics",
    "clip": "clip",
    "insightface": "insightface",
    "onnxruntime": "onnxruntime",
    "cv2": "cv2",
    "pedalboard": "pedalboard",
    "pyloudnorm": "pyloudnorm",
    "numpy": "numpy",
    "torch": "torch",
    "torchvision": "torchvision",
    "PIL": "PIL",
}


def is_available(module_name):
    return importlib.util.find_spec(module_name) is not None


available = {
    package: is_available(module_name)
    for package, module_name in PACKAGES.items()
}
all_ready = all(available.values())

print(json.dumps({"available": available, "allReady": all_ready}))

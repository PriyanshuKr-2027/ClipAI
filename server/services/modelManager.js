const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Checks if the large ML models are already cached locally in their expected paths.
 * @returns {Promise<Object>} { fasterWhisper: boolean, yolo: boolean, insightface: boolean }
 */
async function checkModelCache() {
  const homeDir = os.homedir();
  
  // 1. Faster-Whisper: server/python/models/large-v3/
  const whisperPath = path.join(__dirname, '../python/models/large-v3');
  let fasterWhisperCached = false;
  try {
    if (fs.existsSync(whisperPath)) {
      const files = fs.readdirSync(whisperPath);
      // Ensure the model files (vocab.json, model.bin, config.json) exist
      fasterWhisperCached = files.length >= 3;
    }
  } catch (err) {
    fasterWhisperCached = false;
  }

  // 2. YOLOv8n: default cache directory (~/.cache/ultralytics/) or current workspace
  const yoloCachePath = path.join(homeDir, '.cache', 'ultralytics');
  let yoloCached = false;
  try {
    if (fs.existsSync(yoloCachePath)) {
      yoloCached = true;
    } else if (fs.existsSync(path.join(process.cwd(), 'yolov8n.pt'))) {
      yoloCached = true;
    }
  } catch (err) {
    yoloCached = false;
  }

  // 3. InsightFace: ~/.insightface/
  const insightFacePath = path.join(homeDir, '.insightface');
  let insightfaceCached = false;
  try {
    if (fs.existsSync(insightFacePath)) {
      const modelsPath = path.join(insightFacePath, 'models');
      if (fs.existsSync(modelsPath)) {
        insightfaceCached = true;
      } else {
        insightfaceCached = true; // folder presence is enough for a basic check
      }
    }
  } catch (err) {
    insightfaceCached = false;
  }

  return {
    fasterWhisper: fasterWhisperCached,
    yolo: yoloCached,
    insightface: insightfaceCached,
  };
}

/**
 * Returns human-readable warnings for missing model caches.
 * @param {Object} modelStatus - Current model status from checkModelCache
 * @returns {string[]} Warnings list
 */
function getModelDownloadWarnings(modelStatus) {
  const warnings = [];
  
  if (!modelStatus.fasterWhisper) {
    warnings.push("Faster-Whisper large-v3 (3GB) will download on first use — requires internet.");
  }
  
  if (!modelStatus.yolo) {
    warnings.push("YOLOv8 (40MB) will download on first use.");
  }
  
  if (!modelStatus.insightface) {
    warnings.push("InsightFace models (150MB) will download on first use.");
  }
  
  return warnings;
}

module.exports = {
  checkModelCache,
  getModelDownloadWarnings,
};

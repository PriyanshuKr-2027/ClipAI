const express = require('express');
const router = express.Router();
const fs = require('fs');
const { runPythonScript } = require('../services/pythonBridge');

const broadcastWs = (msg) => {
  if (global.wss) {
    global.wss.clients.forEach((client) => {
      if (client.readyState === 1) { // ws.OPEN
        client.send(JSON.stringify(msg));
      }
    });
  }
};

// POST /api/scene/detect
router.post('/detect', async (req, res) => {
  try {
    const { videoPath, threshold } = req.body;
    if (!videoPath) {
      return res.status(400).json({ error: 'Missing videoPath' });
    }
    if (!fs.existsSync(videoPath)) {
      return res.status(400).json({ error: `Video file not found: ${videoPath}` });
    }

    // Broadcast starting stage
    broadcastWs({ type: 'progress', jobId: 'scene', percent: 0, stage: 'scene_detect' });

    const thresholdVal = threshold !== undefined ? threshold : 27;

    const result = await runPythonScript('scenedetect.py', [videoPath, String(thresholdVal)], 180000);

    // Broadcast completion stage
    broadcastWs({ type: 'done', jobId: 'scene', stage: 'scene_detect' });

    res.json({
      scenes: result.scenes || [],
      sceneCount: result.sceneCount || 0
    });
  } catch (err) {
    console.error('Error in scene detection:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/scene/clip-score
router.post('/clip-score', async (req, res) => {
  try {
    const { videoPath, timestamps } = req.body;
    if (!videoPath || !timestamps) {
      return res.status(400).json({ error: 'videoPath and timestamps are required' });
    }
    if (!fs.existsSync(videoPath)) {
      return res.status(400).json({ error: `Video file not found: ${videoPath}` });
    }

    const hasClip = global.availableFeatures && global.availableFeatures.clip;
    if (!hasClip) {
      return res.status(400).json({ error: 'CLIP model is not available or not installed' });
    }

    const timestampsStr = JSON.stringify(timestamps);
    const result = await runPythonScript('clip_score.py', [videoPath, timestampsStr], 180000);

    res.json({
      scores: result.scores || []
    });
  } catch (err) {
    console.error('Error in /clip-score:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

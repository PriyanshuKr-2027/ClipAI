const express = require('express');
const fs = require('fs');
const path = require('path');
const { runPythonScript } = require('../services/pythonBridge');
const sharpService = require('../services/sharpService');
const ffmpegService = require('../services/ffmpeg');
const { v4: uuid } = require('uuid');

const router = express.Router();
const tempDir = path.join(__dirname, '..', '..', 'temp');

function tempUrlFor(filePath) {
  return `http://localhost:3001/temp/${path.basename(filePath)}`;
}

// POST /api/thumb/generate
router.post('/generate', async (req, res) => {
  try {
    const { videoPath, timestamp } = req.body;
    if (!videoPath) {
      return res.status(400).json({ error: 'videoPath is required' });
    }
    if (!fs.existsSync(videoPath)) {
      return res.status(400).json({ error: `Video file not found: ${videoPath}` });
    }

    const ts = timestamp !== undefined ? parseFloat(timestamp) : 1.0;
    const rawFrameFilename = `${uuid()}_raw_frame.jpg`;
    const rawFramePath = path.join(tempDir, rawFrameFilename);

    // Extract frame at timestamp using FFmpeg
    await ffmpegService.thumbnail(videoPath, ts, rawFramePath);

    const optimizedFilename = `${uuid()}_optimized_thumb.jpg`;
    const optimizedPath = path.join(tempDir, optimizedFilename);

    // Optimize with sharp
    await sharpService.optimizeThumbnail(rawFramePath, optimizedPath);

    // Clean up raw frame
    try {
      if (fs.existsSync(rawFramePath)) {
        fs.unlinkSync(rawFramePath);
      }
    } catch (err) {
      console.error('Failed to delete temporary raw frame:', err);
    }

    res.json({
      thumbPath: optimizedPath,
      thumbUrl: tempUrlFor(optimizedPath)
    });
  } catch (err) {
    console.error('Error in /generate:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/thumb/best-frame
router.post('/best-frame', async (req, res) => {
  try {
    const { videoPath, startTime, endTime } = req.body;
    if (!videoPath) {
      return res.status(400).json({ error: 'videoPath is required' });
    }
    if (!fs.existsSync(videoPath)) {
      return res.status(400).json({ error: `Video file not found: ${videoPath}` });
    }
    if (startTime === undefined || endTime === undefined) {
      return res.status(400).json({ error: 'startTime and endTime are required' });
    }

    const bestFrame = await sharpService.extractBestFrame(
      videoPath,
      parseFloat(startTime),
      parseFloat(endTime),
      tempDir
    );

    res.json({
      thumbPath: bestFrame.thumbPath,
      thumbUrl: tempUrlFor(bestFrame.thumbPath),
      timestamp: bestFrame.timestamp,
      sharpnessScore: bestFrame.sharpnessScore
    });
  } catch (err) {
    console.error('Error in /best-frame:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/thumb/insightface
router.post('/insightface', async (req, res) => {
  try {
    const { videoPath, startTime, endTime } = req.body;
    if (!videoPath) {
      return res.status(400).json({ error: 'videoPath is required' });
    }
    if (!fs.existsSync(videoPath)) {
      return res.status(400).json({ error: `Video file not found: ${videoPath}` });
    }
    if (startTime === undefined || endTime === undefined) {
      return res.status(400).json({ error: 'startTime and endTime are required' });
    }

    const hasInsightFace = global.availableFeatures && global.availableFeatures.insightface;

    if (hasInsightFace) {
      try {
        const result = await runPythonScript(
          'insightface_thumb.py',
          [videoPath, String(startTime), String(endTime), tempDir],
          300000
        );

        const unoptimizedPath = result.thumbPath;
        const optimizedFilename = `${uuid()}_insightface_optimized.jpg`;
        const optimizedPath = path.join(tempDir, optimizedFilename);

        // Optimize result with sharp
        await sharpService.optimizeThumbnail(unoptimizedPath, optimizedPath);

        // Clean up unoptimized image
        try {
          if (fs.existsSync(unoptimizedPath)) {
            fs.unlinkSync(unoptimizedPath);
          }
        } catch (cleanupErr) {
          console.error('Failed to cleanup unoptimized InsightFace image:', cleanupErr);
        }

        return res.json({
          thumbPath: optimizedPath,
          thumbUrl: tempUrlFor(optimizedPath),
          timestamp: result.timestamp,
          faceScore: result.faceScore
        });
      } catch (pythonErr) {
        console.warn('InsightFace Python script execution failed, falling back to best-frame:', pythonErr);
      }
    }

    // Fall back to best-frame
    console.log('InsightFace not available or failed. Using best-frame fallback.');
    const bestFrame = await sharpService.extractBestFrame(
      videoPath,
      parseFloat(startTime),
      parseFloat(endTime),
      tempDir
    );

    const optimizedFilename = `${uuid()}_fallback_optimized.jpg`;
    const optimizedPath = path.join(tempDir, optimizedFilename);

    // Optimize best-frame result with sharp
    await sharpService.optimizeThumbnail(bestFrame.thumbPath, optimizedPath);

    // Clean up original best frame
    try {
      if (fs.existsSync(bestFrame.thumbPath)) {
        fs.unlinkSync(bestFrame.thumbPath);
      }
    } catch (cleanupErr) {
      console.error('Failed to cleanup unoptimized best frame:', cleanupErr);
    }

    res.json({
      thumbPath: optimizedPath,
      thumbUrl: tempUrlFor(optimizedPath),
      timestamp: bestFrame.timestamp,
      faceScore: null,
      sharpnessScore: bestFrame.sharpnessScore
    });

  } catch (err) {
    console.error('Error in /insightface:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

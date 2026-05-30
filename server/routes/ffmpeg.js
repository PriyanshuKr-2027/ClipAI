const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const ffmpegService = require('../services/ffmpeg');

const tempDir = path.join(__dirname, '..', '..', 'temp');

// Helper to get output paths
function getTempPaths(extension) {
  const id = uuidv4();
  const filename = `${id}.${extension}`;
  const filepath = path.join(tempDir, filename);
  return { id, filename, filepath };
}

// POST /api/ffmpeg/info
router.post('/info', async (req, res) => {
  try {
    const { videoPath } = req.body;
    if (!videoPath) return res.status(400).json({ error: 'videoPath is required' });
    
    const info = await ffmpegService.getVideoInfo(videoPath);
    res.json(info);
  } catch (err) {
    console.error('Info route error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ffmpeg/extract-audio
router.post('/extract-audio', async (req, res) => {
  try {
    const { videoPath } = req.body;
    if (!videoPath) return res.status(400).json({ error: 'videoPath is required' });
    
    const { filename, filepath } = getTempPaths('mp3');
    await ffmpegService.extractAudio(videoPath, filepath);
    
    res.json({
      audioPath: filepath,
      audioFilename: filename
    });
  } catch (err) {
    console.error('Extract audio error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ffmpeg/cut-clip
router.post('/cut-clip', async (req, res) => {
  try {
    const { videoPath, start, end, outputName } = req.body;
    if (!videoPath || start === undefined || end === undefined) {
      return res.status(400).json({ error: 'videoPath, start, and end are required' });
    }
    
    const suffix = outputName ? `_${outputName.replace(/[^a-z0-9]/gi, '_')}` : '';
    const id = uuidv4();
    const filename = `${id}${suffix}.mp4`;
    const filepath = path.join(tempDir, filename);
    
    await ffmpegService.cutClip(videoPath, parseFloat(start), parseFloat(end), filepath);
    
    res.json({
      clipPath: filepath,
      clipFilename: filename
    });
  } catch (err) {
    console.error('Cut clip error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ffmpeg/thumbnail
router.post('/thumbnail', async (req, res) => {
  try {
    const { videoPath, timestamp } = req.body;
    if (!videoPath) return res.status(400).json({ error: 'videoPath is required' });
    
    const ts = timestamp !== undefined ? parseFloat(timestamp) : 1.0;
    const { filename, filepath } = getTempPaths('jpg');
    
    await ffmpegService.thumbnail(videoPath, ts, filepath);
    
    res.json({
      thumbPath: filepath,
      thumbFilename: filename
    });
  } catch (err) {
    console.error('Thumbnail error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ffmpeg/trim
router.post('/trim', async (req, res) => {
  try {
    const { videoPath, inPoint, outPoint } = req.body;
    if (!videoPath || inPoint === undefined || outPoint === undefined) {
      return res.status(400).json({ error: 'videoPath, inPoint, and outPoint are required' });
    }
    
    const { filename, filepath } = getTempPaths('mp4');
    await ffmpegService.trim(videoPath, parseFloat(inPoint), parseFloat(outPoint), filepath);
    
    res.json({
      outputPath: filepath,
      outputFilename: filename
    });
  } catch (err) {
    console.error('Trim error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ffmpeg/speed
router.post('/speed', async (req, res) => {
  try {
    const { videoPath, speed } = req.body;
    if (!videoPath || speed === undefined) {
      return res.status(400).json({ error: 'videoPath and speed are required' });
    }
    
    const speedVal = parseFloat(speed);
    if (speedVal < 0.25 || speedVal > 4.0) {
      return res.status(400).json({ error: 'Speed must be between 0.25 and 4.0' });
    }
    
    const { filename, filepath } = getTempPaths('mp4');
    await ffmpegService.speed(videoPath, speedVal, filepath);
    
    res.json({
      outputPath: filepath,
      outputFilename: filename
    });
  } catch (err) {
    console.error('Speed error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ffmpeg/crop
router.post('/crop', async (req, res) => {
  try {
    const { videoPath, x, y, w, h } = req.body;
    if (!videoPath || x === undefined || y === undefined || w === undefined || h === undefined) {
      return res.status(400).json({ error: 'videoPath, x, y, w, and h are required' });
    }
    
    const { filename, filepath } = getTempPaths('mp4');
    await ffmpegService.crop(videoPath, parseInt(x), parseInt(y), parseInt(w), parseInt(h), filepath);
    
    res.json({
      outputPath: filepath,
      outputFilename: filename
    });
  } catch (err) {
    console.error('Crop error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ffmpeg/burn-captions
router.post('/burn-captions', async (req, res) => {
  try {
    const { videoPath, assContent, crf, resolution } = req.body;
    if (!videoPath || !assContent) {
      return res.status(400).json({ error: 'videoPath and assContent are required' });
    }
    
    const jobId = uuidv4();
    const assFilename = `${jobId}.ass`;
    const assPath = path.join(tempDir, assFilename);
    const outputFilename = `${jobId}.mp4`;
    const outputPath = path.join(tempDir, outputFilename);
    
    // Write ASS subtitles to file
    fs.writeFileSync(assPath, assContent, 'utf8');
    
    // Return the jobId immediately
    res.status(202).json({ jobId });
    
    // Process in background
    ffmpegService.burnCaptions(
      videoPath,
      assPath,
      outputPath,
      crf !== undefined ? parseInt(crf) : 23,
      resolution || 'original',
      (percent) => {
        if (global.broadcastProgress) {
          global.broadcastProgress(jobId, percent);
        }
      }
    ).then(() => {
      // Cleanup ASS file
      try {
        fs.unlinkSync(assPath);
      } catch (cleanupErr) {
        console.error('Failed to cleanup ASS file:', cleanupErr);
      }
      
      // Broadcast completion
      if (global.broadcastDone) {
        global.broadcastDone(jobId, outputFilename);
      }
    }).catch((err) => {
      console.error(`Error processing burn-captions job ${jobId}:`, err);
      try {
        if (fs.existsSync(assPath)) fs.unlinkSync(assPath);
      } catch (_) {}
      
      if (global.broadcastProgress) {
        global.broadcastProgress(jobId, -1);
      }
    });
    
  } catch (err) {
    console.error('Burn captions error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ffmpeg/reencode
router.post('/reencode', async (req, res) => {
  try {
    const { videoPath, crf, resolution } = req.body;
    if (!videoPath) {
      return res.status(400).json({ error: 'videoPath is required' });
    }
    
    const jobId = uuidv4();
    const outputFilename = `${jobId}.mp4`;
    const outputPath = path.join(tempDir, outputFilename);
    
    res.status(202).json({ jobId });
    
    ffmpegService.reencode(
      videoPath,
      outputPath,
      crf !== undefined ? parseInt(crf) : 23,
      resolution || 'original',
      (percent) => {
        if (global.broadcastProgress) {
          global.broadcastProgress(jobId, percent);
        }
      }
    ).then(() => {
      if (global.broadcastDone) {
        global.broadcastDone(jobId, outputFilename);
      }
    }).catch((err) => {
      console.error(`Error processing reencode job ${jobId}:`, err);
      if (global.broadcastProgress) {
        global.broadcastProgress(jobId, -1);
      }
    });
    
  } catch (err) {
    console.error('Reencode error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

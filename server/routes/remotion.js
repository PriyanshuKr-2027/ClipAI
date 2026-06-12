const express = require('express');
const router = express.Router();
const { v4: uuid } = require('uuid');
const path = require('path');
const { renderCaptionVideo } = require('../services/remotionRenderer');

// In-memory job status map
const jobs = new Map();

// POST /api/remotion/render
router.post('/render', (req, res) => {
  try {
    const { words, style, duration, videoWidth, videoHeight } = req.body;
    
    if (!words || !style || !duration) {
      return res.status(400).json({ error: 'Missing required parameters: words, style, duration' });
    }

    const jobId = uuid();
    const tempDir = path.join(__dirname, '..', '..', 'temp');

    // Initialize job status
    jobs.set(jobId, {
      id: jobId,
      status: 'rendering',
      percent: 0,
      outputFilename: null,
      error: null,
      createdAt: new Date(),
    });

    // Start rendering in the background (fire-and-forget, do not await)
    renderCaptionVideo({
      words,
      style,
      duration,
      width: videoWidth || 1080,
      height: videoHeight || 1920,
      outputDir: tempDir,
      jobId,
      wss: global.wss,
      onProgress: (percent) => {
        const job = jobs.get(jobId);
        if (job) {
          job.percent = percent;
        }
      }
    }).then(({ outputPath }) => {
      const outputFilename = path.basename(outputPath);
      const job = jobs.get(jobId);
      if (job) {
        job.status = 'completed';
        job.percent = 100;
        job.outputFilename = outputFilename;
      }
      
      // Broadcast completed message
      global.wss?.clients?.forEach((client) => {
        if (client.readyState === 1) { // WebSocket.OPEN is 1
          client.send(JSON.stringify({
            type: 'done',
            jobId,
            stage: 'remotion_render',
            outputFilename
          }));
        }
      });
    }).catch((err) => {
      console.error(`Remotion render job ${jobId} failed:`, err);
      const job = jobs.get(jobId);
      if (job) {
        job.status = 'failed';
        job.error = err.message;
      }

      // Broadcast error message
      global.wss?.clients?.forEach((client) => {
        if (client.readyState === 1) { // WebSocket.OPEN is 1
          client.send(JSON.stringify({
            type: 'error',
            jobId,
            stage: 'remotion_render',
            message: err.message
          }));
        }
      });
    });

    // Return the jobId immediately
    res.json({ jobId });
  } catch (err) {
    console.error('Error starting Remotion render:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/remotion/styles
router.get('/styles', (req, res) => {
  res.json({
    styles: ['NeonPop', 'HinglishFire', 'BoldDevanagari', 'CleanMinimal', 'ReelBold']
  });
});

// GET /api/remotion/status/:jobId
router.get('/status/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  res.json(job);
});

module.exports = router;

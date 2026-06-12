const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { v4: uuid } = require('uuid');
const importer = require('../services/importer');
const { getVideoInfo } = require('../services/ffmpeg');

const tempDir = path.join(__dirname, '..', '..', 'temp');

function validateUrl(url) {
  if (!url) {
    throw new Error('URL is required');
  }
  if (!/^https?:\/\//i.test(url)) {
    throw new Error('URL must start with http:// or https://');
  }
}

function videoUrlFor(filePath) {
  return `http://localhost:3001/temp/${path.basename(filePath)}`;
}

const broadcastDownload = (jobId, percent, speed = null, eta = null) => {
  if (global.wss) {
    global.wss.clients.forEach((client) => {
      if (client.readyState === 1) { // ws.OPEN
        client.send(JSON.stringify({
          type: 'download',
          jobId,
          percent,
          speed,
          eta,
          stage: 'downloading'
        }));
      }
    });
  }
};

// POST /api/import/ytdlp
router.post('/ytdlp', async (req, res) => {
  try {
    const { url } = req.body;
    validateUrl(url);

    const jobId = uuid();
    broadcastDownload(jobId, 0);

    const result = await importer.importFromYtDlp(url, tempDir, (progressData) => {
      const pct = typeof progressData === 'object' ? progressData.percent : progressData;
      const spd = typeof progressData === 'object' ? progressData.speed : null;
      const eta = typeof progressData === 'object' ? progressData.eta : null;
      broadcastDownload(jobId, pct, spd, eta);
    });

    const info = await getVideoInfo(result.filePath);
    broadcastDownload(jobId, 100);

    res.json({
      filePath: result.filePath,
      videoUrl: videoUrlFor(result.filePath),
      duration: info.duration,
      width: info.width,
      height: info.height,
      jobId
    });
  } catch (err) {
    console.error('YtDlp import error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/import/instagram
router.post('/instagram', async (req, res) => {
  try {
    const { url } = req.body;
    validateUrl(url);

    const jobId = uuid();
    broadcastDownload(jobId, 0);

    const result = await importer.importFromInstagram(url, tempDir, (progress) => {
      broadcastDownload(jobId, progress);
    });

    const info = await getVideoInfo(result.filePath);
    broadcastDownload(jobId, 100);

    res.json({
      filePath: result.filePath,
      videoUrl: videoUrlFor(result.filePath),
      duration: info.duration,
      width: info.width,
      height: info.height,
      jobId
    });
  } catch (err) {
    console.error('Instagram import error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/import/playwright
router.post('/playwright', async (req, res) => {
  try {
    const { url } = req.body;
    validateUrl(url);

    const jobId = uuid();
    broadcastDownload(jobId, 0);

    const result = await importer.importFromPlaywright(url, tempDir, (progress) => {
      broadcastDownload(jobId, progress);
    });

    const info = await getVideoInfo(result.filePath);
    broadcastDownload(jobId, 100);

    res.json({
      filePath: result.filePath,
      videoUrl: videoUrlFor(result.filePath),
      duration: info.duration,
      width: info.width,
      height: info.height,
      jobId
    });
  } catch (err) {
    console.error('Playwright import error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

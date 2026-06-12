const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { v4: uuid } = require('uuid');
const { runPythonScript } = require('../services/pythonBridge');

// POST /api/audio/beats
router.post('/beats', async (req, res) => {
  try {
    const { audioPath } = req.body;
    if (!audioPath) {
      return res.status(400).json({ error: 'Missing audioPath' });
    }
    if (!fs.existsSync(audioPath)) {
      return res.status(400).json({ error: `Audio file not found: ${audioPath}` });
    }

    const result = await runPythonScript('librosa_beat.py', [audioPath], 60000);
    res.json({
      bpm: result.bpm,
      beats: result.beats || [],
      beatCount: (result.beats || []).length
    });
  } catch (err) {
    console.error('Error in /beats:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/audio/beats-with-energy
router.post('/beats-with-energy', async (req, res) => {
  try {
    const { audioPath } = req.body;
    if (!audioPath) {
      return res.status(400).json({ error: 'Missing audioPath' });
    }
    if (!fs.existsSync(audioPath)) {
      return res.status(400).json({ error: `Audio file not found: ${audioPath}` });
    }

    const result = await runPythonScript('librosa_beat.py', [audioPath, '--energy'], 60000);
    res.json({
      bpm: result.bpm,
      beats: result.beats || [],
      energyBySecond: result.energyBySecond || []
    });
  } catch (err) {
    console.error('Error in /beats-with-energy:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/audio/silence
router.post('/silence', async (req, res) => {
  try {
    const { audioPath, threshold, minDuration } = req.body;
    if (!audioPath) {
      return res.status(400).json({ error: 'Missing audioPath' });
    }
    if (!fs.existsSync(audioPath)) {
      return res.status(400).json({ error: `Audio file not found: ${audioPath}` });
    }

    const tVal = threshold !== undefined ? threshold : 0.02;
    const durVal = minDuration !== undefined ? minDuration : 0.5;

    const result = await runPythonScript('librosa_silence.py', [audioPath, String(tVal), String(durVal)], 60000);
    res.json({
      silenceRanges: result.silenceRanges || [],
      totalSilence: result.totalSilence || 0,
      count: (result.silenceRanges || []).length
    });
  } catch (err) {
    console.error('Error in /silence:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/audio/pedalboard-master
router.post('/pedalboard-master', async (req, res) => {
  try {
    const { audioPath, targetLufs } = req.body;
    if (!audioPath) {
      return res.status(400).json({ error: 'Missing audioPath' });
    }
    if (!fs.existsSync(audioPath)) {
      return res.status(400).json({ error: `Audio file not found: ${audioPath}` });
    }

    const tempDir = path.join(__dirname, '..', '..', 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const masteredFilename = `${uuid()}_mastered.wav`;
    const outputPath = path.join(tempDir, masteredFilename);
    const targetLufsVal = targetLufs !== undefined ? targetLufs : -14;

    const result = await runPythonScript('pedalboard_master.py', [audioPath, outputPath, String(targetLufsVal)], 60000);
    
    res.json({
      masteredPath: outputPath,
      masteredUrl: `/temp/${masteredFilename}`,
      lufs: result.lufs
    });
  } catch (err) {
    console.error('Error in /pedalboard-master:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

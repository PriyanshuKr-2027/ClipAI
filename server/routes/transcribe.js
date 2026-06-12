const express = require('express');
const fs = require('fs');
const path = require('path');
const transcribeService = require('../services/transcribeService');
const { runPythonScript } = require('../services/pythonBridge');

const router = express.Router();
const tempDir = path.join(__dirname, '..', '..', 'temp');

function validateTempFile(filePath) {
  if (!filePath) {
    throw new Error('file path is required');
  }

  const resolvedPath = path.resolve(filePath);
  const resolvedTempDir = path.resolve(tempDir);

  if (!resolvedPath.startsWith(`${resolvedTempDir}${path.sep}`)) {
    throw new Error('file must be inside temp directory');
  }

  if (!fs.existsSync(resolvedPath)) {
    throw new Error('file does not exist');
  }

  return resolvedPath;
}

function tempUrlFor(filePath) {
  const filename = path.basename(filePath);
  return `http://localhost:3001/temp/${filename}`;
}

function broadcastTranscribe(stage, percent) {
  const payload = { type: 'transcribe', stage, percent };
  if (global.wss) {
    global.wss.clients.forEach((client) => {
      if (client.readyState === 1) {
        client.send(JSON.stringify(payload));
      }
    });
    return;
  }

  if (global.broadcastProgress) {
    global.broadcastProgress(null, percent);
  }
}

// POST /api/transcribe/whisper
router.post('/whisper', async (req, res) => {
  try {
    const { audioPath, language = 'auto' } = req.body;
    validateTempFile(audioPath);

    broadcastTranscribe('whisper', 50);
    const result = await transcribeService.transcribeAudio(audioPath, language, (percent) => {
      broadcastTranscribe('whisper', percent);
    });
    broadcastTranscribe('whisper', 100);

    res.json({
      words: result.words || [],
      text: result.text || '',
      language: result.language || 'en',
      duration: result.duration || 0,
      backend: result.backend
    });
  } catch (err) {
    console.error('Whisper transcription error:', err);
    res.status(400).json({ error: err.message });
  }
});

// POST /api/transcribe/demucs
router.post('/demucs', async (req, res) => {
  try {
    const { audioPath } = req.body;
    validateTempFile(audioPath);

    broadcastTranscribe('demucs', 10);
    const result = await runPythonScript('demucs_separate.py', [audioPath, tempDir], 600000);
    broadcastTranscribe('demucs', 100);

    res.json({
      vocalsPath: result.vocalsPath,
      vocalsUrl: tempUrlFor(result.vocalsPath)
    });
  } catch (err) {
    console.error('Demucs separation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/transcribe/denoise
router.post('/denoise', async (req, res) => {
  try {
    const { audioPath } = req.body;
    validateTempFile(audioPath);

    const result = await runPythonScript('noisereduce_pass.py', [audioPath], 300000);

    res.json({
      cleanAudioPath: result.cleanAudioPath,
      cleanAudioUrl: tempUrlFor(result.cleanAudioPath)
    });
  } catch (err) {
    console.error('Denoise error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/transcribe/spacy-breaks
router.post('/spacy-breaks', async (req, res) => {
  try {
    const { wordsJsonPath, language = 'en' } = req.body;
    validateTempFile(wordsJsonPath);

    const result = await runPythonScript('spacy_breaks.py', [wordsJsonPath, language], 120000);

    res.json({
      words: result.words || []
    });
  } catch (err) {
    console.error('SpaCy sentence break error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/transcribe/translate
router.post('/translate', async (req, res) => {
  try {
    const { wordsJsonPath, targetLang, sourceLang = 'auto' } = req.body;
    if (!targetLang) {
      return res.status(400).json({ error: 'targetLang is required' });
    }
    validateTempFile(wordsJsonPath);

    const result = await runPythonScript('translate_captions.py', [wordsJsonPath, targetLang, sourceLang], 120000);

    res.json({
      translatedWords: result.translatedWords || []
    });
  } catch (err) {
    console.error('Caption translation error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

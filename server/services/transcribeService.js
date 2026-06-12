const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('ffprobe-static').path;
const { runPythonScript } = require('./pythonBridge.js');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const GROQ_API_KEY = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY;
const MAX_GROQ_SIZE_BYTES = 25 * 1024 * 1024;
const TARGET_CHUNK_SIZE_BYTES = 24 * 1024 * 1024;
const tempDir = path.join(__dirname, '..', '..', 'temp');

if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

async function transcribeAudio(audioPath, language = 'auto', onProgress = null) {
  const stats = fs.statSync(audioPath);

  if (stats.size > MAX_GROQ_SIZE_BYTES) {
    return await transcribeChunked(audioPath, language, onProgress);
  }

  try {
    const result = await transcribeWithGroq(audioPath, language);
    return { ...result, backend: 'groq' };
  } catch (err) {
    if (isRecoverableGroqError(err)) {
      console.warn(`[transcribe] Groq failed (${err.message}), falling back to Faster-Whisper...`);
      const result = await transcribeWithFasterWhisper(audioPath, language, onProgress);
      return { ...result, backend: 'faster-whisper' };
    }
    throw err;
  }
}

async function transcribeWithGroq(audioPath, language) {
  const form = new FormData();
  form.append('file', fs.createReadStream(audioPath));
  form.append('model', 'whisper-large-v3-turbo');
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'word');
  if (language !== 'auto') form.append('language', language);

  if (language === 'hi' || language === 'auto') {
    const promptText = "Always transcribe in Hindi (Devanagari script), never Urdu script. देवनागरी में लिखें, उर्दू में नहीं।";
    form.append('prompt', promptText);
  }

  const response = await axios.post(GROQ_API_URL, form, {
    headers: { ...form.getHeaders(), Authorization: `Bearer ${GROQ_API_KEY}` },
    timeout: 120000,
    maxContentLength: Infinity,
    maxBodyLength: Infinity
  });

  const data = response.data;
  return {
    words: data.words || [],
    text: data.text || '',
    language: data.language || 'en',
    duration: data.duration || 0
  };
}

async function transcribeWithFasterWhisper(audioPath, language, onProgress) {
  const args = [audioPath];
  if (language !== 'auto') args.push('--language', language);

  if (language === 'hi' || language === 'auto') {
    const promptText = "Always transcribe in Hindi (Devanagari script), never Urdu script. देवनागरी में लिखें, उर्दू में नहीं।";
    args.push('--initial_prompt', promptText);
  }

  if (onProgress) onProgress(0);
  const result = await runPythonScript('faster_whisper_server.py', args, 600000);
  if (onProgress) onProgress(100);
  return result;
}

async function transcribeChunked(audioPath, language, onProgress) {
  const chunks = [];

  try {
    const duration = await getAudioDuration(audioPath);
    const stats = fs.statSync(audioPath);
    const bytesPerSecond = stats.size / Math.max(duration, 1);
    const chunkDuration = Math.max(10, Math.floor(TARGET_CHUNK_SIZE_BYTES / Math.max(bytesPerSecond, 1)));

    for (let start = 0; start < duration; start += chunkDuration) {
      const currentDuration = Math.min(chunkDuration, duration - start);
      const chunkPath = path.join(tempDir, `${path.basename(audioPath, path.extname(audioPath))}_${Date.now()}_${chunks.length}.wav`);
      await extractChunk(audioPath, chunkPath, start, currentDuration);
      chunks.push({ path: chunkPath, start, duration: currentDuration });
    }

    const stitchedWords = [];
    const textParts = [];
    let detectedLanguage = language === 'auto' ? 'en' : language;
    let usedFallback = false;

    for (let index = 0; index < chunks.length; index += 1) {
      const chunk = chunks[index];
      if (onProgress) onProgress(Math.round((index / chunks.length) * 100));

      const result = await transcribeSingleChunk(chunk.path, language, onProgress);
      if (result.backend === 'faster-whisper') usedFallback = true;
      detectedLanguage = result.language || detectedLanguage;
      if (result.text) textParts.push(result.text);

      const adjustedWords = (result.words || []).map((word) => ({
        ...word,
        start: word.start + chunk.start,
        end: word.end + chunk.start
      }));
      stitchedWords.push(...adjustedWords);
    }

    if (onProgress) onProgress(100);

    return {
      words: stitchedWords,
      text: textParts.join(' ').trim(),
      language: detectedLanguage,
      duration,
      backend: usedFallback ? 'hybrid' : 'groq'
    };
  } finally {
    for (const chunk of chunks) {
      try {
        if (fs.existsSync(chunk.path)) fs.unlinkSync(chunk.path);
      } catch (err) {
        console.warn(`[transcribe] Failed to cleanup chunk ${chunk.path}: ${err.message}`);
      }
    }
  }
}

async function transcribeSingleChunk(audioPath, language, onProgress) {
  try {
    const result = await transcribeWithGroq(audioPath, language);
    return { ...result, backend: 'groq' };
  } catch (err) {
    if (isRecoverableGroqError(err)) {
      console.warn(`[transcribe] Groq chunk failed (${err.message}), falling back to Faster-Whisper...`);
      const result = await transcribeWithFasterWhisper(audioPath, language, onProgress);
      return { ...result, backend: 'faster-whisper' };
    }
    throw err;
  }
}

function isRecoverableGroqError(err) {
  const isRateLimit = err?.response?.status === 429;
  const isServerError = err?.response?.status >= 500;
  const isNetworkError = err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND';
  return isRateLimit || isServerError || isNetworkError;
}

function getAudioDuration(audioPath) {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffprobePath, [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      audioPath
    ]);
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`ffprobe failed: ${stderr.slice(-500)}`));
      }

      const duration = parseFloat(stdout.trim());
      if (!Number.isFinite(duration) || duration <= 0) {
        return reject(new Error(`Invalid audio duration from ffprobe: ${stdout.trim()}`));
      }

      resolve(duration);
    });
  });
}

function extractChunk(audioPath, outputPath, start, duration) {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, [
      '-y',
      '-ss', String(start),
      '-t', String(duration),
      '-i', audioPath,
      '-c', 'copy',
      outputPath
    ]);
    let stderr = '';

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`ffmpeg chunk failed: ${stderr.slice(-500)}`));
      }
      resolve(outputPath);
    });
  });
}

module.exports = {
  transcribeAudio
};

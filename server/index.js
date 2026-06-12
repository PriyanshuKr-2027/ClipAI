const express = require('express');
const cors = require('cors');
const http = require('http');
const ws = require('ws');
const path = require('path');
const fs = require('fs');
const { runPythonScript } = require('./services/pythonBridge');
const modelManager = require('./services/modelManager');
const { initQueues, getJobStatus } = require('./services/bullQueue');
const { parsePromptToActions, describeActions } = require('./services/aiPromptParser');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const wss = new ws.Server({ server });
global.wss = wss;

const PORT = process.env.PORT || 3001;

// Ensure temp directory exists in project ROOT
const tempDir = path.join(__dirname, '..', 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

global.availableFeatures = {
  fasterWhisper: false,
  demucs: false,
  librosa: false,
  scenedetect: false,
  yolo: false,
  clip: false,
  insightface: false,
  pedalboard: false
};

async function checkPythonFeatures() {
  try {
    const deps = await runPythonScript('check_deps.py', [], 30000);
    const available = deps.available || {};

    global.availableFeatures = {
      fasterWhisper: Boolean(available.faster_whisper),
      demucs: Boolean(available.demucs),
      librosa: Boolean(available.librosa),
      scenedetect: Boolean(available.scenedetect),
      yolo: Boolean(available.ultralytics),
      clip: Boolean(available.clip),
      insightface: Boolean(available.insightface),
      pedalboard: Boolean(available.pedalboard && available.pyloudnorm)
    };

    console.log('Python feature availability:', global.availableFeatures);
  } catch (err) {
    console.warn('Python dependency check failed:', err.message);
  }
}

// Middleware
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static temp files
app.use('/temp', express.static(tempDir));

// WebSocket setup
wss.on('connection', (wsConn) => {
  console.log('New WebSocket client connected');
  wsConn.send(JSON.stringify({ type: 'connected', message: 'Connected to ClipAI backend' }));
  
  wsConn.on('close', () => {
    console.log('WebSocket client disconnected');
  });
});

// Broadcast helper for jobs (useful for other router files)
global.broadcastProgress = (jobId, percent) => {
  wss.clients.forEach((client) => {
    if (client.readyState === ws.OPEN) {
      client.send(JSON.stringify({ type: 'progress', jobId, percent }));
    }
  });
};

global.broadcastDone = (jobId, outputFilename) => {
  wss.clients.forEach((client) => {
    if (client.readyState === ws.OPEN) {
      client.send(JSON.stringify({ type: 'done', jobId, outputFilename }));
    }
  });
};

// Routers
const ffmpegRouter = require('./routes/ffmpeg');
app.use('/api/ffmpeg', ffmpegRouter);

const filesRouter = require('./routes/files');
app.use('/api/files', filesRouter);

const transitionsRouter = require('./routes/transitions');
app.use('/api/transitions', transitionsRouter);

const transcribeRoutes = require('./routes/transcribe');
app.use('/api/transcribe', transcribeRoutes);

const importRoutes = require('./routes/import');
app.use('/api/import', importRoutes);

const audioRoutes = require('./routes/audio');
app.use('/api/audio', audioRoutes);

const sceneRoutes = require('./routes/scene');
app.use('/api/scene', sceneRoutes);

const thumbnailRoutes = require('./routes/thumbnail');
app.use('/api/thumb', thumbnailRoutes);

const remotionRoutes = require('./routes/remotion');
app.use('/api/remotion', remotionRoutes);

// Healthcheck
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'ClipAI Backend Server running' });
});

app.get('/api/status', async (req, res) => {
  try {
    const models = await modelManager.checkModelCache();
    const warnings = modelManager.getModelDownloadWarnings(models);
    res.json({
      features: global.availableFeatures,
      models,
      warnings,
      groqConfigured: !!(process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY)
    });
  } catch (err) {
    console.error('Error fetching system status:', err);
    res.status(500).json({ error: err.message });
  }
});

// AI Prompt Parser — convert natural language to structured edit actions
app.post('/api/prompt/parse', async (req, res) => {
  try {
    const { promptText, currentState = {} } = req.body;
    if (!promptText || typeof promptText !== 'string' || !promptText.trim()) {
      return res.status(400).json({ error: 'promptText is required' });
    }
    const actions = await parsePromptToActions(promptText.trim(), currentState);
    const description = describeActions(actions);
    res.json({ actions, description });
  } catch (err) {
    console.error('[prompt/parse] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Job status endpoint — works for both Bull/Redis and in-memory queues
app.get('/api/jobs/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const status = await getJobStatus(jobId);
    if (!status) {
      return res.status(404).json({ error: `Job ${jobId} not found` });
    }
    res.json(status);
  } catch (err) {
    console.error('Error fetching job status:', err);
    res.status(500).json({ error: err.message });
  }
});

server.listen(PORT, () => {
  checkPythonFeatures();
  initQueues().catch((err) => console.error('[Bull] Queue init error:', err));
  console.log(`Server is running on port ${PORT}`);
  console.log(`Serving static files from ${tempDir}`);
});


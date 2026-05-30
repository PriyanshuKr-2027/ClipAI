const express = require('express');
const cors = require('cors');
const http = require('http');
const ws = require('ws');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const wss = new ws.Server({ server });

const PORT = process.env.PORT || 3001;

// Ensure temp directory exists in project ROOT
const tempDir = path.join(__dirname, '..', 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
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

// Healthcheck
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'ClipAI Backend Server running' });
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Serving static files from ${tempDir}`);
});

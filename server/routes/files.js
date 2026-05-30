const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const ffmpegService = require('../services/ffmpeg');
const { spawn } = require('child_process');

const tempDir = path.join(__dirname, '..', '..', 'temp');

// Ensure temp directory exists
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, tempDir);
  },
  filename: function (req, file, cb) {
    const id = uuidv4();
    // Sanitize originalname to prevent path traversal or special character issues
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    cb(null, `${id}_${safeName}`);
  }
});

// Configure multer upload limits and filters
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 4 * 1024 * 1024 * 1024 // 4GB limit
  },
  fileFilter: function (req, file, cb) {
    const allowedMimeTypes = [
      'video/mp4',
      'video/quicktime',
      'video/x-msvideo',
      'video/x-matroska'
    ];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Only MP4, MOV, AVI, and MKV are allowed.`));
    }
  }
});

// POST /api/files/upload
router.post('/upload', (req, res, next) => {
  upload.single('video')(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: `Multer Error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file uploaded.' });
    }

    const { path: filePath, filename, originalname, size } = req.file;

    // Get video info using FFprobe via our service
    const info = await ffmpegService.getVideoInfo(filePath);

    res.json({
      filePath,
      filename,
      originalName: originalname,
      size,
      duration: info.duration,
      width: info.width,
      height: info.height,
      fps: info.fps
    });
  } catch (err) {
    console.error('Upload error:', err);
    // Cleanup the uploaded file if FFprobe fails
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupErr) {
        console.error('Error cleaning up file after failure:', cleanupErr);
      }
    }
    res.status(500).json({ error: err.message });
  }
});

// GET /api/files/list
router.get('/list', (req, res) => {
  try {
    const filesList = [];
    const files = fs.readdirSync(tempDir);
    
    for (const file of files) {
      const filePath = path.join(tempDir, file);
      const stat = fs.statSync(filePath);
      
      // Only include actual files, not directories
      if (stat.isFile()) {
        filesList.push({
          name: file,
          size: stat.size,
          created: stat.mtime // Last modified time
        });
      }
    }
    
    // Sort by created descending (newest first)
    filesList.sort((a, b) => b.created - a.created);
    
    res.json({ files: filesList });
  } catch (err) {
    console.error('List files error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/files/cleanup
router.delete('/cleanup', (req, res) => {
  try {
    const files = fs.readdirSync(tempDir);
    const now = Date.now();
    const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
    let deletedCount = 0;
    
    for (const file of files) {
      const filePath = path.join(tempDir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isFile()) {
        const fileAge = now - stat.mtimeMs;
        if (fileAge > TWELVE_HOURS_MS) {
          try {
            fs.unlinkSync(filePath);
            deletedCount++;
          } catch (delErr) {
            console.error(`Failed to delete ${file}:`, delErr);
          }
        }
      }
    }
    
    res.json({ deleted: deletedCount });
  } catch (err) {
    console.error('Cleanup error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Helper to spawn yt-dlp safely without shell injection issues
function runYtDlp(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('yt-dlp', args);
    let stdout = '';
    let stderr = '';
    
    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(stderr.trim() || `yt-dlp exited with code ${code}`));
      }
      resolve(stdout.trim());
    });
  });
}

// POST /api/files/download-youtube
router.post('/download-youtube', async (req, res) => {
  const { url, streamOnly, jobId } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });

  try {
    // 1. Get the video title first (fast)
    const title = await runYtDlp(['--get-title', url]).catch(() => 'YouTube Video');
    const safeTitle = title.replace(/[^a-zA-Z0-9.\-_ ]/g, '_');

    if (streamOnly) {
      // Stream Mode: get direct pre-muxed mp4 stream URL
      const streamUrl = await runYtDlp(['-g', '-f', 'best[ext=mp4]/best', url]);
      
      // Probe metadata
      const info = await ffmpegService.getVideoInfo(streamUrl);
      
      return res.json({
        filePath: streamUrl,
        videoUrl: streamUrl,
        filename: `${safeTitle}.mp4`,
        size: 0,
        duration: info.duration,
        width: info.width,
        height: info.height,
        fps: info.fps,
        streamOnly: true
      });
    } else {
      // Download Mode: download video locally
      const uniqueId = uuidv4();
      const outputFilename = `youtube_${uniqueId}.mp4`;
      const outputPath = path.join(tempDir, outputFilename);

      // Spawn yt-dlp to download
      const ytDlp = spawn('yt-dlp', [
        '-f', 'bestvideo[height<=720]+bestaudio/best[height<=720]/best',
        '--merge-output-format', 'mp4',
        '-o', outputPath,
        url
      ]);

      ytDlp.stdout.on('data', (data) => {
        const text = data.toString();
        const match = text.match(/\[download\]\s+(\d+(?:\.\d+)?)%/);
        if (match && jobId) {
          const percent = Math.round(parseFloat(match[1]));
          global.broadcastProgress(jobId, percent);
        }
      });

      // Handle errors
      let stderr = '';
      ytDlp.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ytDlp.on('close', async (code) => {
        if (code !== 0) {
          console.error('yt-dlp download failed:', stderr);
          return res.status(500).json({ error: `yt-dlp download failed: ${stderr.trim()}` });
        }

        try {
          if (!fs.existsSync(outputPath)) {
            return res.status(500).json({ error: 'Downloaded file not found.' });
          }

          // Probe downloaded file
          const info = await ffmpegService.getVideoInfo(outputPath);
          const stat = fs.statSync(outputPath);

          res.json({
            filePath: outputPath,
            videoUrl: `http://localhost:3001/temp/${outputFilename}`,
            filename: `${safeTitle}.mp4`,
            size: stat.size,
            duration: info.duration,
            width: info.width,
            height: info.height,
            fps: info.fps,
            streamOnly: false
          });
        } catch (err) {
          console.error('Error probing downloaded file:', err);
          res.status(500).json({ error: err.message });
        }
      });
    }
  } catch (err) {
    console.error('YouTube import error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

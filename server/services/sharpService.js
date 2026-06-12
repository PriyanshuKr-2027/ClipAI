const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { v4: uuid } = require('uuid');
const ffmpegService = require('./ffmpeg');

// Disable sharp cache to prevent file locking on Windows
sharp.cache(false);

async function optimizeThumbnail(inputPath, outputPath, width = 270) {
  const buffer = fs.readFileSync(inputPath);
  const metadata = await sharp(buffer).metadata();
  await sharp(buffer)
    .resize(width, null, { withoutEnlargement: true })
    .jpeg({ quality: 85, progressive: true })
    .sharpen({ sigma: 0.5 })
    .toFile(outputPath);
  const out = await sharp(outputPath).metadata();
  return { outputPath, width: out.width, height: out.height };
}

async function computeSharpness(imagePath) {
  // Estimate sharpness via variance of pixel values
  // Sharp-based approach: get raw pixel buffer, compute variance
  const buffer = fs.readFileSync(imagePath);
  const { data, info } = await sharp(buffer).grayscale().raw().toBuffer({ resolveWithObject: true });
  const arr = new Float32Array(data);
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length;
  return variance;
}

async function extractBestFrame(videoPath, startTime, endTime, tempDir) {
  // Extract 8 frames evenly between startTime and endTime using FFmpeg
  // For each frame, compute sharpness via computeSharpness()
  // Return the path + timestamp of the sharpest frame
  const numFrames = 8;
  const timestamps = [];
  for (let i = 0; i < numFrames; i++) {
    const t = startTime + ((endTime - startTime) * i) / (numFrames - 1);
    timestamps.push(t);
  }

  let bestFrame = null;

  for (let i = 0; i < timestamps.length; i++) {
    const timestamp = timestamps[i];
    const frameFilename = `${uuid()}_best_frame_candidate_${i}.jpg`;
    const framePath = path.join(tempDir, frameFilename);

    try {
      await ffmpegService.thumbnail(videoPath, timestamp, framePath);
      const score = await computeSharpness(framePath);

      if (!bestFrame || score > bestFrame.sharpnessScore) {
        if (bestFrame) {
          try {
            fs.unlinkSync(bestFrame.thumbPath);
          } catch (e) {
            console.error('Failed to delete temp frame file:', e);
          }
        }
        bestFrame = {
          thumbPath: framePath,
          timestamp,
          sharpnessScore: score
        };
      } else {
        try {
          fs.unlinkSync(framePath);
        } catch (e) {
          console.error('Failed to delete temp frame file:', e);
        }
      }
    } catch (err) {
      console.error(`Error processing frame at timestamp ${timestamp}:`, err);
      try {
        if (fs.existsSync(framePath)) {
          fs.unlinkSync(framePath);
        }
      } catch (_) {}
    }
  }

  if (!bestFrame) {
    throw new Error('Failed to extract any valid frames');
  }

  return bestFrame;
}

module.exports = {
  optimizeThumbnail,
  computeSharpness,
  extractBestFrame
};

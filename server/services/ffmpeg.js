const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('ffprobe-static').path;

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

/**
 * Formats a file path specifically for the FFmpeg 'ass' filter on Windows.
 * E.g., "C:\path\to\sub.ass" -> "'C\:/path/to/sub.ass'"
 */
function formatAssPath(absolutePath) {
  // Convert backslashes to forward slashes
  let formatted = absolutePath.replace(/\\/g, '/');
  // Escape the drive letter colon
  formatted = formatted.replace(':', '\\:');
  // Escape single quotes for ffmpeg filtergraph syntax
  formatted = formatted.replace(/'/g, "'\\''");
  // Wrap in single quotes to handle spaces and special characters in paths
  return `'${formatted}'`;
}

/**
 * Builds atempo filter chain to support speed values outside of [0.5, 2.0].
 * atempo filter only supports speed values from 0.5 to 2.0.
 */
function getAtempoFilter(speedVal) {
  let tempSpeed = speedVal;
  const filters = [];
  while (tempSpeed > 2.0) {
    filters.push('atempo=2.0');
    tempSpeed /= 2.0;
  }
  while (tempSpeed < 0.5) {
    filters.push('atempo=0.5');
    tempSpeed /= 0.5;
  }
  if (tempSpeed !== 1.0) {
    filters.push(`atempo=${tempSpeed.toFixed(4)}`);
  }
  return filters.join(',');
}

/**
 * Get metadata information for a video file.
 */
function getVideoInfo(videoPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) return reject(err);
      
      const format = metadata.format || {};
      const videoStream = (metadata.streams || []).find(s => s.codec_type === 'video') || {};
      
      // Calculate FPS
      let fps = 30;
      if (videoStream.r_frame_rate) {
        const parts = videoStream.r_frame_rate.split('/');
        if (parts.length === 2 && +parts[1] !== 0) {
          fps = Math.round(+parts[0] / +parts[1]);
        }
      }
      
      resolve({
        duration: parseFloat(format.duration || 0),
        width: parseInt(videoStream.width || 0, 10),
        height: parseInt(videoStream.height || 0, 10),
        fps,
        size: parseInt(format.size || 0, 10),
        codec: videoStream.codec_name
      });
    });
  });
}

/**
 * Extract 16kHz mono PCM WAV audio track from a video file.
 */
function extractAudio(videoPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .noVideo()
      .audioCodec('pcm_s16le')
      .audioFrequency(16000)
      .audioChannels(1)
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', (err) => reject(err))
      .run();
  });
}

/**
 * Overlay a transparent caption video on top of a base video and keep base audio.
 */
function composite(baseVideoPath, captionVideoPath, outputPath, onProgress) {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(baseVideoPath)
      .input(captionVideoPath)
      .complexFilter('[0:v][1:v]overlay=0:0[v]')
      .outputOptions('-map [v]')
      .outputOptions('-map 0:a?')
      .outputOptions('-c:v libx264')
      .outputOptions('-c:a copy')
      .outputOptions('-preset superfast')
      .output(outputPath)
      .on('start', (commandLine) => {
        console.log('Spawned FFmpeg composite: ' + commandLine);
      })
      .on('progress', (progress) => {
        if (onProgress && progress.percent) {
          onProgress(Math.round(progress.percent));
        }
      })
      .on('end', () => resolve(outputPath))
      .on('error', (err) => {
        console.error('FFmpeg composite Error:', err.message);
        reject(err);
      })
      .run();
  });
}

/**
 * Cut video clip using stream copy (fast, no re-encoding).
 */
function cutClip(videoPath, start, end, outputPath) {
  return new Promise((resolve, reject) => {
    const duration = end - start;
    ffmpeg(videoPath)
      .setStartTime(start)
      .setDuration(duration)
      .outputOptions('-c copy')
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', (err) => reject(err))
      .run();
  });
}

/**
 * Capture a thumbnail frame at a specific timestamp.
 */
function thumbnail(videoPath, timestamp, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .seekInput(timestamp)
      .frames(1)
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', (err) => reject(err))
      .run();
  });
}

/**
 * Trim video (re-encoded for seek accuracy).
 */
function trim(videoPath, inPoint, outPoint, outputPath) {
  return new Promise((resolve, reject) => {
    const duration = outPoint - inPoint;
    ffmpeg(videoPath)
      .setStartTime(inPoint)
      .setDuration(duration)
      .videoCodec('libx264')
      .audioCodec('aac')
      .outputOptions('-preset superfast')
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', (err) => reject(err))
      .run();
  });
}

/**
 * Adjust video and audio playback speed.
 */
function speed(videoPath, speedVal, outputPath) {
  return new Promise((resolve, reject) => {
    const videoFilter = `setpts=${(1 / speedVal).toFixed(4)}*PTS`;
    const audioFilter = getAtempoFilter(speedVal);
    
    let ff = ffmpeg(videoPath)
      .videoCodec('libx264')
      .audioCodec('aac')
      .videoFilter(videoFilter)
      .outputOptions('-preset superfast');
      
    if (audioFilter) {
      ff = ff.audioFilter(audioFilter);
    }
    
    ff.output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', (err) => reject(err))
      .run();
  });
}

/**
 * Crop video to a specific bounding box.
 */
function crop(videoPath, x, y, w, h, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .videoCodec('libx264')
      .audioCodec('aac')
      .videoFilter(`crop=${w}:${h}:${x}:${y}`)
      .outputOptions('-preset superfast')
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', (err) => reject(err))
      .run();
  });
}

/**
 * Burn ASS captions into the video file.
 */
function burnCaptions(videoPath, assPath, outputPath, crf = 23, resolution = 'original', onProgress) {
  return new Promise((resolve, reject) => {
    const formattedAss = formatAssPath(assPath);
    const videoFilters = [];

    if (resolution && resolution !== 'original') {
      const [w, h] = resolution.split('x');
      const targetW = parseInt(w, 10);
      const targetH = parseInt(h, 10);
      if (targetW && targetH) {
        // Crop the input video to match target aspect ratio, then scale to target resolution
        videoFilters.push(`crop=min(iw\\,ih*${targetW}/${targetH}):min(ih\\,iw*${targetH}/${targetW})`);
        videoFilters.push(`scale=${targetW}:${targetH}`);
      }
    }
    // Burn ASS subtitles (must be applied after crop/scale so coordinates map to final cropped frame)
    videoFilters.push(`ass=${formattedAss}`);
    
    let ff = ffmpeg(videoPath)
      .videoCodec('libx264')
      .audioCodec('aac')
      .videoFilters(videoFilters)
      .outputOptions(`-crf ${crf}`)
      .outputOptions('-preset superfast');
    
    ff.output(outputPath)
      .on('start', (commandLine) => {
        console.log('Spawned FFmpeg burnCaptions: ' + commandLine);
      })
      .on('progress', (progress) => {
        if (onProgress && progress.percent) {
          onProgress(Math.round(progress.percent));
        }
      })
      .on('end', () => {
        resolve(outputPath);
      })
      .on('error', (err, stdout, stderr) => {
        console.error('FFmpeg burnCaptions Error:', err.message);
        reject(err);
      })
      .run();
  });
}

/**
 * Re-encode a video with quality (CRF) and resolution settings, without burning subtitles.
 */
function reencode(videoPath, outputPath, crf = 23, resolution = 'original', onProgress, audioPath = null) {
  return new Promise((resolve, reject) => {
    const videoFilters = [];

    if (resolution && resolution !== 'original') {
      const [w, h] = resolution.split('x');
      const targetW = parseInt(w, 10);
      const targetH = parseInt(h, 10);
      if (targetW && targetH) {
        // Crop the input video to match target aspect ratio, then scale to target resolution
        videoFilters.push(`crop=min(iw\\,ih*${targetW}/${targetH}):min(ih\\,iw*${targetH}/${targetW})`);
        videoFilters.push(`scale=${targetW}:${targetH}`);
      }
    }

    let ff = ffmpeg(videoPath);
    if (audioPath) {
      ff = ff.input(audioPath);
    }

    ff = ff.videoCodec('libx264')
      .audioCodec('aac')
      .outputOptions(`-crf ${crf}`)
      .outputOptions('-preset superfast');

    if (audioPath) {
      ff = ff.outputOptions('-map 0:v').outputOptions('-map 1:a');
    }

    if (videoFilters.length > 0) {
      ff = ff.videoFilters(videoFilters);
    }
    
    ff.output(outputPath)
      .on('start', (commandLine) => {
        console.log('Spawned FFmpeg reencode: ' + commandLine);
      })
      .on('progress', (progress) => {
        if (onProgress && progress.percent) {
          onProgress(Math.round(progress.percent));
        }
      })
      .on('end', () => {
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error('FFmpeg reencode Error:', err.message);
        reject(err);
      })
      .run();
  });
}

module.exports = {
  getVideoInfo,
  extractAudio,
  cutClip,
  thumbnail,
  trim,
  speed,
  crop,
  composite,
  burnCaptions,
  reencode
};

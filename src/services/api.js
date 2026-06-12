export const BASE = "http://localhost:3001";

// -------------------------------------------------------------
// WebSocket Setup for FFmpeg Job Progress
// -------------------------------------------------------------
const ws = new WebSocket("ws://localhost:3001");
const progressCallbacks = new Map();
const doneCallbacks = new Map();

ws.onmessage = (event) => {
  try {
    const data = JSON.parse(event.data);
    
    if (data.type === 'progress' && data.jobId) {
      const callback = progressCallbacks.get(data.jobId);
      if (callback) callback(data.percent);
    } 
    else if (data.type === 'done' && data.jobId) {
      const callback = doneCallbacks.get(data.jobId);
      if (callback) callback(data.outputFilename);
    }
    else if (data.type === 'error' && data.jobId) {
      const callback = progressCallbacks.get(data.jobId);
      if (callback) callback(-1, data.message);
    }
  } catch (err) {
    console.error("WS parse error:", err);
  }
};

/**
 * Register a callback for a specific job ID
 */
export function onJobProgress(jobId, callback) {
  progressCallbacks.set(jobId, callback);
}

// -------------------------------------------------------------
// File & FFmpeg API Endpoints
// -------------------------------------------------------------

/**
 * Helper for standard POST requests
 */
async function postJson(endpoint, body) {
  const res = await fetch(`${BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `API error: ${res.status}`);
  }
  return res.json();
}

/**
 * Uploads a video using XHR to track precise upload progress.
 * @param {File} file - Video file object
 * @param {Function} onProgress - Callback(percent)
 * @returns {Promise<Object>} File metadata + videoUrl
 */
export async function uploadVideo(file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable && onProgress) {
        const percent = Math.round((event.loaded * 100) / event.total);
        onProgress(percent);
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          data.videoUrl = `${BASE}/temp/${data.filename}`;
          resolve(data);
        } catch (e) {
          reject(new Error("Failed to parse upload response"));
        }
      } else {
        try {
          const errData = JSON.parse(xhr.responseText);
          reject(new Error(errData.error || "Upload failed"));
        } catch(e) {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Network Error")));
    xhr.addEventListener("abort", () => reject(new Error("Upload Aborted")));

    xhr.open("POST", `${BASE}/api/files/upload`);
    const formData = new FormData();
    formData.append("video", file);
    xhr.send(formData);
  });
}

export async function getVideoInfo(videoPath) {
  return postJson('/api/ffmpeg/info', { videoPath });
}

export async function extractAudio(videoPath) {
  const data = await postJson('/api/ffmpeg/extract-audio', { videoPath });
  data.audioUrl = `${BASE}/temp/${data.audioFilename}`;
  return data;
}

export async function cutClip(videoPath, start, end, outputName) {
  const data = await postJson('/api/ffmpeg/cut-clip', { videoPath, start, end, outputName });
  data.clipUrl = `${BASE}/temp/${data.clipFilename}`;
  return data;
}

export async function trimClip(videoPath, inPoint, outPoint, outputName) {
  const data = await postJson('/api/ffmpeg/trim', { videoPath, inPoint, outPoint, outputName });
  data.outputUrl = `${BASE}/temp/${data.outputFilename}`;
  return data;
}

export async function changeSpeed(videoPath, speed, outputName) {
  const data = await postJson('/api/ffmpeg/speed', { videoPath, speed, outputName });
  data.outputUrl = `${BASE}/temp/${data.outputFilename}`;
  return data;
}

export async function cropVideo(videoPath, x, y, w, h, outputName) {
  const data = await postJson('/api/ffmpeg/crop', { videoPath, x, y, w, h, outputName });
  data.outputUrl = `${BASE}/temp/${data.outputFilename}`;
  return data;
}

export async function getThumbnail(videoPath, timestamp = 1) {
  const data = await postJson('/api/ffmpeg/thumbnail', { videoPath, timestamp });
  data.thumbUrl = `${BASE}/temp/${data.thumbFilename}`;
  return data;
}

export async function demucsAudio(audioPath) {
  const data = await postJson('/api/transcribe/demucs', { audioPath });
  if (data.vocalsPath && !data.vocalsUrl) {
    data.vocalsUrl = `${BASE}/temp/${data.vocalsPath.split(/[\\/]/).pop()}`;
  }
  return data;
}

export async function denoiseAudio(audioPath) {
  const data = await postJson('/api/transcribe/denoise', { audioPath });
  if (data.cleanAudioPath && !data.cleanAudioUrl) {
    data.cleanAudioUrl = `${BASE}/temp/${data.cleanAudioPath.split(/[\\/]/).pop()}`;
  }
  return data;
}

export async function transcribeAudio(audioPath, language = 'auto') {
  return postJson('/api/transcribe/whisper', { audioPath, language });
}

export async function saveWordsJson(words) {
  const data = await postJson('/api/files/save-json', { data: words, prefix: 'words' });
  return data.filePath || data.wordsJsonPath || data.path;
}

export async function spacyBreaks(wordsJsonPath, language = 'en') {
  return postJson('/api/transcribe/spacy-breaks', { wordsJsonPath, language });
}

export async function translateWords(wordsJsonPath, targetLang, sourceLang = 'auto') {
  return postJson('/api/transcribe/translate', { wordsJsonPath, targetLang, sourceLang });
}

export async function getInsightFaceThumb(videoPath, startTime, endTime) {
  const data = await postJson('/api/thumb/insightface', { videoPath, startTime, endTime });
  if (data.thumbPath && !data.thumbUrl) {
    data.thumbUrl = `${BASE}/temp/${data.thumbPath.split(/[\\/]/).pop()}`;
  }
  return data;
}

/**
 * Hardcode captions into video asynchronously
 */
export async function burnCaptions(videoPath, assContent, outputName, settings, onProgress) {
  const { jobId } = await postJson('/api/ffmpeg/burn-captions', { 
    videoPath, 
    assContent,
    crf: settings?.crf,
    resolution: settings?.resolution
  });

  if (onProgress) {
    onJobProgress(jobId, onProgress);
  }

  return new Promise((resolve, reject) => {
    // Listen for the "done" WebSocket event
    doneCallbacks.set(jobId, (outputFilename) => {
      progressCallbacks.delete(jobId);
      doneCallbacks.delete(jobId);
      resolve({ outputUrl: `${BASE}/temp/${outputFilename}` });
    });
    
    // Override the progress callback temporarily to capture errors (percent = -1)
    const originalProgress = progressCallbacks.get(jobId);
    progressCallbacks.set(jobId, (percent) => {
      if (percent === -1) {
        progressCallbacks.delete(jobId);
        doneCallbacks.delete(jobId);
        reject(new Error("FFmpeg job failed during processing. Check backend logs."));
      } else if (originalProgress) {
        originalProgress(percent);
      }
    });
  });
}

export async function reencodeVideo(videoPath, settings, onProgress, audioPath = null) {
  const { jobId } = await postJson('/api/ffmpeg/reencode', { 
    videoPath, 
    crf: settings?.crf,
    resolution: settings?.resolution,
    audioPath
  });

  if (onProgress) {
    onJobProgress(jobId, onProgress);
  }

  return new Promise((resolve, reject) => {
    doneCallbacks.set(jobId, (outputFilename) => {
      progressCallbacks.delete(jobId);
      doneCallbacks.delete(jobId);
      resolve({ outputUrl: `${BASE}/temp/${outputFilename}` });
    });
    
    const originalProgress = progressCallbacks.get(jobId);
    progressCallbacks.set(jobId, (percent) => {
      if (percent === -1) {
        progressCallbacks.delete(jobId);
        doneCallbacks.delete(jobId);
        reject(new Error("FFmpeg job failed during processing. Check backend logs."));
      } else if (originalProgress) {
        originalProgress(percent);
      }
    });
  });
}

/**
 * Downloads or streams a YouTube video using yt-dlp on the backend
 */
export async function downloadYoutube(url, streamOnly = false, onProgress) {
  const jobId = `youtube_${Date.now()}`;
  if (onProgress) {
    onJobProgress(jobId, onProgress);
  }
  
  try {
    const data = await postJson('/api/files/download-youtube', { url, streamOnly, jobId });
    return data;
  } finally {
    if (onProgress) {
      progressCallbacks.delete(jobId);
    }
  }
}

/**
 * Downloads video from transitions download endpoint (Instagram, YouTube, TikTok)
 */
export async function downloadTransitionVideo(url) {
  return postJson('/api/transitions/download', { url });
}

/**
 * Detects transition cuts and segments from video filePath
 */
export async function detectTransitions(filePath) {
  return postJson('/api/transitions/detect', { filePath });
}

/**
 * Deep multi-signal analysis of transition video
 */
export async function analyzeTransitionsVideo(filePath) {
  return postJson('/api/transitions/analyze', { filePath });
}

/**
 * Uploads a photo for a slot
 */
export async function uploadPhoto(file) {
  const formData = new FormData();
  formData.append('image', file);
  
  const res = await fetch(`${BASE}/api/transitions/upload-photo`, {
    method: 'POST',
    body: formData
  });
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Upload photo failed with status: ${res.status}`);
  }
  return res.json();
}

/**
 * Renders the final transition reel from slots / recipe
 */
export async function renderTransitions(payload, onProgress) {
  const jobId = payload.jobId;
  if (onProgress && jobId) {
    onJobProgress(jobId, onProgress);
  }
  
  try {
    const data = await postJson('/api/transitions/render', payload);
    return data;
  } finally {
    if (onProgress && jobId) {
      progressCallbacks.delete(jobId);
    }
  }
}

// -------------------------------------------------------------
// Audio & Silence Processing API Endpoints
// -------------------------------------------------------------

export async function analyzeBeats(audioPath) {
  return postJson('/api/audio/beats', { audioPath });
}

export async function analyzeBeatsWithEnergy(audioPath) {
  return postJson('/api/audio/beats-with-energy', { audioPath });
}

export async function analyzeSilence(audioPath, threshold, minDuration) {
  return postJson('/api/audio/silence', { audioPath, threshold, minDuration });
}

export async function masterAudio(audioPath, targetLufs = -14) {
  return postJson('/api/audio/pedalboard-master', { audioPath, targetLufs });
}

export async function removeSilence(videoPath, silenceRanges, outputName, onProgress) {
  const { jobId } = await postJson('/api/ffmpeg/remove-silence', { 
    videoPath, 
    silenceRanges, 
    outputName 
  });

  if (onProgress) {
    onJobProgress(jobId, onProgress);
  }

  return new Promise((resolve, reject) => {
    doneCallbacks.set(jobId, (outputFilename) => {
      progressCallbacks.delete(jobId);
      doneCallbacks.delete(jobId);
      resolve({ 
        outputPath: `${BASE}/temp/${outputFilename}`,
        outputUrl: `${BASE}/temp/${outputFilename}` 
      });
    });
    
    const originalProgress = progressCallbacks.get(jobId);
    progressCallbacks.set(jobId, (percent) => {
      if (percent === -1) {
        progressCallbacks.delete(jobId);
        doneCallbacks.delete(jobId);
        reject(new Error("Silence removal job failed. Check backend logs."));
      } else if (originalProgress) {
        originalProgress(percent);
      }
    });
  });
}

export async function detectScenes(videoPath, threshold) {
  return postJson('/api/scene/detect', { videoPath, threshold });
}

export async function getClipVisualScore(videoPath, timestamps) {
  return postJson('/api/scene/clip-score', { videoPath, timestamps });
}

export async function renderRemotion(words, style, duration, videoWidth, videoHeight, onProgress) {
  const { jobId } = await postJson('/api/remotion/render', {
    words,
    style,
    duration,
    videoWidth,
    videoHeight
  });

  if (onProgress) {
    onJobProgress(jobId, onProgress);
  }

  return new Promise((resolve, reject) => {
    doneCallbacks.set(jobId, (outputFilename) => {
      progressCallbacks.delete(jobId);
      doneCallbacks.delete(jobId);
      resolve({
        outputPath: `${BASE}/temp/${outputFilename}`,
        outputUrl: `${BASE}/temp/${outputFilename}`,
        outputFilename
      });
    });

    const originalProgress = progressCallbacks.get(jobId);
    progressCallbacks.set(jobId, (percent, errorMsg) => {
      if (percent === -1) {
        progressCallbacks.delete(jobId);
        doneCallbacks.delete(jobId);
        reject(new Error(errorMsg || "Remotion render job failed. Check backend logs."));
      } else if (originalProgress) {
        originalProgress(percent);
      }
    });
  });
}

export async function compositeVideo(baseVideoPath, captionVideoPath, outputName) {
  return postJson('/api/ffmpeg/composite', { baseVideoPath, captionVideoPath, outputName });
}

export async function getSystemStatus() {
  const res = await fetch(`${BASE}/api/status`);
  if (!res.ok) {
    throw new Error(`Failed to fetch system status: ${res.status}`);
  }
  return res.json();
}


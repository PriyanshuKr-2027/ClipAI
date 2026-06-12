/**
 * Decodes audio data from a URL using the browser's Web Audio API.
 * @param {string} audioUrl 
 * @returns {Promise<AudioBuffer>}
 */
export async function decodeAudioBuffer(audioUrl) {
  const response = await fetch(audioUrl);
  const arrayBuffer = await response.arrayBuffer();
  
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const audioCtx = new AudioContextClass();
  
  try {
    return await audioCtx.decodeAudioData(arrayBuffer);
  } finally {
    audioCtx.close();
  }
}

/**
 * Downsamples Float32Array channel data to standard RMS energy buckets.
 * @param {AudioBuffer} audioBuffer 
 * @param {number} bucketCount 
 * @returns {Promise<Float32Array>}
 */
export async function computeWaveformBuckets(audioBuffer, bucketCount = 1000) {
  const channelData = audioBuffer.getChannelData(0); // Mono channel
  const totalSamples = channelData.length;
  const samplesPerBucket = Math.floor(totalSamples / bucketCount);
  const buckets = new Float32Array(bucketCount);
  
  for (let i = 0; i < bucketCount; i++) {
    const start = i * samplesPerBucket;
    const end = Math.min(start + samplesPerBucket, totalSamples);
    
    let sumSquares = 0;
    for (let s = start; s < end; s++) {
      sumSquares += channelData[s] * channelData[s];
    }
    
    buckets[i] = Math.sqrt(sumSquares / Math.max(1, end - start));
  }
  
  return buckets;
}

/**
 * Performs browser-side offline beat detection using a peak energy envelope analysis.
 * @param {AudioBuffer} audioBuffer 
 * @returns {Promise<Object>} { estimatedBpm, beats: number[] }
 */
export async function detectBeatsFromBuffer(audioBuffer) {
  const sampleRate = audioBuffer.sampleRate;
  const channelData = audioBuffer.getChannelData(0);
  
  // Analyze audio in 50ms chunks (frame size)
  const frameSize = Math.floor(sampleRate * 0.05);
  const numFrames = Math.floor(channelData.length / frameSize);
  
  const energies = new Float32Array(numFrames);
  for (let i = 0; i < numFrames; i++) {
    const start = i * frameSize;
    const end = start + frameSize;
    let sum = 0;
    for (let s = start; s < end; s++) {
      sum += channelData[s] * channelData[s];
    }
    energies[i] = sum / frameSize;
  }
  
  // Calculate local average over 1 second (20 frames surrounding the current frame)
  const localAvgWindow = 20;
  const peaks = [];
  
  for (let i = 0; i < numFrames; i++) {
    const startWin = Math.max(0, i - localAvgWindow / 2);
    const endWin = Math.min(numFrames, i + localAvgWindow / 2);
    let sumAvg = 0;
    for (let w = startWin; w < endWin; w++) {
      sumAvg += energies[w];
    }
    const avg = sumAvg / (endWin - startWin || 1);
    
    // We declare a peak if the energy is above average * threshold,
    // and it is a local maximum compared to its immediate neighbors
    const threshold = 1.35;
    const isPeak = energies[i] > avg * threshold &&
                   (i === 0 || energies[i] > energies[i - 1]) &&
                   (i === numFrames - 1 || energies[i] > energies[i + 1]);
                   
    if (isPeak) {
      // Enforce at least 250ms spacing (5 frames) between consecutive beats to avoid double triggering
      const lastPeakIdx = peaks.length > 0 ? peaks[peaks.length - 1] : -20;
      if (i - lastPeakIdx >= 5) {
        peaks.push(i);
      }
    }
  }
  
  // Convert frame indices to timestamps in seconds
  const beats = peaks.map(frameIdx => (frameIdx * frameSize) / sampleRate);
  
  // Estimate BPM based on intervals
  let estimatedBpm = 120; // Default fallback
  if (beats.length > 1) {
    const intervals = [];
    for (let i = 1; i < beats.length; i++) {
      intervals.push(beats[i] - beats[i - 1]);
    }
    
    // Sort and grab median interval to avoid outliers
    intervals.sort((a, b) => a - b);
    const medianInterval = intervals[Math.floor(intervals.length / 2)];
    
    if (medianInterval > 0) {
      estimatedBpm = Math.round(60 / medianInterval);
      // Clamp tempo estimation to natural ranges
      while (estimatedBpm < 60) estimatedBpm *= 2;
      while (estimatedBpm > 180) estimatedBpm /= 2;
      estimatedBpm = Math.round(estimatedBpm);
    }
  }
  
  return {
    estimatedBpm,
    beats,
  };
}

/**
 * Helper to snap a given time to the nearest beat timestamp if it falls within the tolerance limit.
 * @param {number} time - Time in seconds
 * @param {number[]} beats - Array of beat timestamps in seconds
 * @param {number} tolerance - Tolerance limit in seconds
 * @returns {number} Snapped time or original time
 */
export function snapToBeat(time, beats, tolerance = 0.15) {
  if (!beats || beats.length === 0) return time;
  
  let nearestBeat = beats[0];
  let minDiff = Math.abs(time - nearestBeat);
  
  for (let i = 1; i < beats.length; i++) {
    const diff = Math.abs(time - beats[i]);
    if (diff < minDiff) {
      minDiff = diff;
      nearestBeat = beats[i];
    }
  }
  
  if (minDiff <= tolerance) {
    return nearestBeat;
  }
  
  return time;
}

/**
 * Snaps start and end timings of a set of clips to the nearest beat.
 * @param {number[]} beats 
 * @param {Array} clips 
 * @returns {Array} Snapped clips with updated durations
 */
export function generateBeatSyncCuts(beats, clips) {
  if (!beats || beats.length === 0) return clips;
  
  return clips.map((clip) => {
    const start = snapToBeat(clip.start, beats, 0.15);
    const end = snapToBeat(clip.end, beats, 0.15);
    const originalDuration = clip.end - clip.start;
    
    const snappedEnd = end > start ? end : start + originalDuration;
    
    return {
      ...clip,
      start: +start.toFixed(3),
      end: +snappedEnd.toFixed(3),
      duration: +(snappedEnd - start).toFixed(1),
    };
  });
}

/**
 * Maps video segments to beat intervals sequentially to create a montage-style edit timeline.
 * @param {number[]} beats - Beat timestamps
 * @param {Array} videoSegments - Source video segments
 * @param {number} bpm - Beats per minute
 * @returns {Array} Timeline segments [{ videoPath, start, end, beatIn, beatOut }]
 */
export function buildBeatSyncTimeline(beats, videoSegments, bpm) {
  if (!beats || beats.length < 2 || !videoSegments || videoSegments.length === 0) return [];
  
  const timeline = [];
  let segmentIndex = 0;
  
  for (let i = 0; i < beats.length - 1; i++) {
    const beatIn = beats[i];
    const beatOut = beats[i + 1];
    const duration = beatOut - beatIn;
    
    if (duration <= 0) continue;
    
    const segment = videoSegments[segmentIndex % videoSegments.length];
    const srcStart = segment.start || 0;
    
    timeline.push({
      videoPath: segment.videoPath || segment.path,
      start: +srcStart.toFixed(3),
      end: +(srcStart + duration).toFixed(3),
      beatIn: +beatIn.toFixed(3),
      beatOut: +beatOut.toFixed(3),
      duration: +duration.toFixed(3),
    });
    
    segmentIndex++;
  }
  
  return timeline;
}

/**
 * Suggests montage clip boundaries aligned with beats to produce even clip intervals.
 * @param {number[]} beats 
 * @param {number} duration - Video duration
 * @param {number} targetClipCount - Number of clips to suggest
 * @returns {Array} Suggested boundaries [{ start, end }]
 */
export function suggestCutPoints(beats, duration, targetClipCount = 5) {
  if (duration <= 0 || targetClipCount <= 0) return [];
  
  const targetInterval = duration / targetClipCount;
  
  if (!beats || beats.length === 0) {
    const suggestions = [];
    for (let i = 0; i < targetClipCount; i++) {
      suggestions.push({
        start: +(i * targetInterval).toFixed(2),
        end: +((i + 1) * targetInterval).toFixed(2),
      });
    }
    return suggestions;
  }
  
  const suggestions = [];
  
  for (let i = 0; i < targetClipCount; i++) {
    const targetStart = i * targetInterval;
    const targetEnd = (i + 1) * targetInterval;
    
    // Snaps to nearest beat (unlimited tolerance to find the absolute closest beat)
    const start = snapToBeat(targetStart, beats, 999.0);
    const end = snapToBeat(targetEnd, beats, 999.0);
    
    if (end > start) {
      suggestions.push({
        start: +start.toFixed(3),
        end: +end.toFixed(3),
      });
    } else {
      // Fallback to even interval
      suggestions.push({
        start: +targetStart.toFixed(3),
        end: +targetEnd.toFixed(3),
      });
    }
  }
  
  return suggestions;
}

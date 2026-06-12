/**
 * Groups a flat array of words into lines based on word count and optional sentence break flags.
 * @param {Array} words - Array of word objects { word, start, end, sentenceBreak }
 * @param {number} maxWords - Maximum number of words per line
 * @param {boolean} useSentenceBreaks - Whether to break lines on sentenceBreak flags
 * @returns {Array} Array of line objects { words: [...], startTime, endTime }
 */
export function groupWordsIntoLines(words, maxWords = 5, useSentenceBreaks = true) {
  if (!words || words.length === 0) return [];
  
  const lines = [];
  let currentLine = [];
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    currentLine.push(word);
    
    const hitMaxWords = currentLine.length >= maxWords;
    const hitSentenceBreak = useSentenceBreaks && word.sentenceBreak === true;
    
    if (hitMaxWords || hitSentenceBreak || i === words.length - 1) {
      const lineWords = [...currentLine];
      const startTime = lineWords[0].start;
      const endTime = lineWords[lineWords.length - 1].end;
      
      lines.push({
        words: lineWords,
        startTime,
        endTime
      });
      
      currentLine = [];
    }
  }
  
  return lines;
}

/**
 * Uses binary search to find the index of the word currently being spoken.
 * @param {Array} words - Array of word objects { start, end }
 * @param {number} currentTimeSeconds - Active composition time in seconds
 * @returns {number} Index of the active word, or -1 if none match
 */
export function getActiveWordIndex(words, currentTimeSeconds) {
  if (!words || words.length === 0) return -1;
  
  let low = 0;
  let high = words.length - 1;
  
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const word = words[mid];
    
    if (currentTimeSeconds >= word.start && currentTimeSeconds <= word.end) {
      return mid;
    } else if (currentTimeSeconds < word.start) {
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }
  
  return -1;
}

/**
 * Converts seconds to frames at a given frame rate.
 * @param {number} seconds 
 * @param {number} fps 
 * @returns {number}
 */
export function secondsToFrames(seconds, fps = 30) {
  return Math.round(seconds * fps);
}

/**
 * Converts frames to seconds at a given frame rate.
 * @param {number} frames 
 * @param {number} fps 
 * @returns {number}
 */
export function framesToSeconds(frames, fps = 30) {
  return frames / fps;
}

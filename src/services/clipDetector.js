import * as api from './api.js';
import * as groq from './groq.js';

/**
 * Orchestrates the entire clip detection and cutting pipeline.
 * @param {string} videoPath - Backend path of the source video
 * @param {Function} onStatus - Callback to update UI status messages
 * @returns {Promise<Object>} { clips, fullWords, language, videoInfo }
 */
export async function generateClips(videoPath, onStatus) {
  onStatus("Getting video info...");
  const videoInfo = await api.getVideoInfo(videoPath);

  onStatus("Extracting audio track...");
  const { audioUrl } = await api.extractAudio(videoPath);

  onStatus("Transcribing with Whisper AI...");
  const { words, text, language } = await groq.transcribeAudio(audioUrl);

  const detectedLang = groq.detectLanguage(text);
  const stylePreset = detectedLang === 'hi' ? 'BoldDevanagari'
                    : detectedLang === 'mixed' ? 'HinglishFire'
                    : 'NeonPop';

  onStatus("AI analyzing for viral moments...");
  const transcriptStr = buildTimestampedTranscript(words);
  const suggestions = await groq.detectClips(transcriptStr, videoInfo.duration);

  const clips = [];
  for (let i = 0; i < suggestions.length; i++) {
    const s = suggestions[i];
    onStatus(`Cutting clip ${i+1}/${suggestions.length}: "${s.title}"`);
    const outputName = `clip_${Date.now()}_${i}`;
    
    // Generate the physical cut via backend
    const { clipPath, clipUrl } = await api.cutClip(videoPath, s.start, s.end, outputName);
    
    // Filter out words belonging to this clip, and normalize their timestamps relative to the cut
    const clipWords = words
      .filter(w => w.start >= s.start && w.end <= s.end)
      .map(w => ({ 
        ...w, 
        start: +(w.start - s.start).toFixed(3), 
        end: +(w.end - s.start).toFixed(3) 
      }));
      
    // Grab thumbnail at 1s mark (or start of video if it's super short)
    const { thumbUrl } = await api.getThumbnail(clipPath, 1);
    
    clips.push({
      id: outputName, 
      title: s.title, 
      hook: s.hook, 
      score: s.score, 
      reason: s.reason,
      start: s.start, 
      end: s.end, 
      duration: +(s.end - s.start).toFixed(1),
      videoPath: clipPath, 
      videoUrl: clipUrl, 
      thumbUrl,
      words: clipWords, 
      language: detectedLang, 
      stylePreset
    });
  }
  
  onStatus("Done!");
  return { clips, fullWords: words, language: detectedLang, videoInfo };
}

/**
 * Packs the words into dense timestamped strings (15 words per line)
 * for the LLM to process without exceeding max token context needlessly.
 */
function buildTimestampedTranscript(words) {
  const lines = [];
  for (let i = 0; i < words.length; i += 15) {
    const chunk = words.slice(i, i + 15);
    const m = Math.floor(chunk[0].start / 60);
    const s = Math.floor(chunk[0].start % 60);
    lines.push(`[${m}:${String(s).padStart(2,'0')}] ${chunk.map(w => w.word).join(' ')}`);
  }
  return lines.join('\n');
}

import * as api from './api.js';
import * as groq from './groq.js';

/**
 * Orchestrates the entire clip detection and cutting pipeline.
 * @param {string} videoPath - Backend path of the source video
 * @param {Function} onStatus - Callback to update UI status messages
 * @param {Object} options - Optional processing toggles
 * @returns {Promise<Object>} { clips, fullWords, language, videoInfo }
 */
export async function generateClips(videoPath, onStatus, options = {}) {
  const { useDemucs = false, useDenoise = false, useSpacy = true } = options;

  onStatus("Getting video info...");
  const videoInfo = await api.getVideoInfo(videoPath);

  onStatus("Extracting audio track...");
  const { audioPath, audioUrl } = await api.extractAudio(videoPath);
  // Note: extract-audio now returns WAV, not MP3.
  void audioUrl;

  let processedAudioPath = audioPath;

  if (useDemucs) {
    onStatus("Separating vocals (Demucs)...");
    const { vocalsPath } = await api.demucsAudio(audioPath);
    processedAudioPath = vocalsPath;
  }

  if (useDenoise) {
    onStatus("Reducing background noise...");
    const { cleanAudioPath } = await api.denoiseAudio(processedAudioPath);
    processedAudioPath = cleanAudioPath;
  }

  onStatus("Transcribing with Whisper AI...");
  const { words, text, language, backend } = await api.transcribeAudio(processedAudioPath);
  onStatus(`Transcription complete (${backend})`);

  let finalWords = words;
  let finalLanguage = language;
  let detectedLang = groq.detectLanguage(text);

  if (detectedLang === 'ur' || language === 'ur') {
    onStatus("Translating Urdu script to Hindi...");
    try {
      const wordsJsonPath = await api.saveWordsJson(words);
      const transResult = await api.translateWords(wordsJsonPath, 'hi', 'ur');
      finalWords = transResult.translatedWords || words;
      finalLanguage = 'hi';
      detectedLang = 'hi';
    } catch (err) {
      console.error("Auto Urdu-to-Hindi translation failed, falling back:", err);
    }
  }

  if (useSpacy) {
    onStatus("Applying sentence-aware caption breaks...");
    const wordsJsonPath = await api.saveWordsJson(finalWords);
    const { words: spacyWords } = await api.spacyBreaks(wordsJsonPath, finalLanguage);
    finalWords = spacyWords;
  }

  const stylePreset = detectedLang === 'hi' ? 'BoldDevanagari'
                    : detectedLang === 'mixed' ? 'HinglishFire'
                    : 'NeonPop';

  onStatus("AI finding viral moments...");
  const transcriptStr = buildTimestampedTranscript(finalWords);
  const suggestions = await groq.detectClips(transcriptStr, videoInfo.duration);

  const clips = [];
  for (let i = 0; i < suggestions.length; i++) {
    const s = suggestions[i];
    onStatus(`Cutting clip ${i+1}/${suggestions.length}: "${s.title}"`);
    const outputName = `clip_${Date.now()}_${i}`;
    
    // Generate the physical cut via backend
    const { clipPath, clipUrl } = await api.cutClip(videoPath, s.start, s.end, outputName);
    
    const clipWords = finalWords
      .filter(w => w.start >= s.start && w.end <= s.end)
      .map(w => ({ 
        ...w, 
        start: +(w.start - s.start).toFixed(3), 
        end: +(w.end - s.start).toFixed(3) 
      }));

    let thumbUrl;
    let thumbTimestamp = 1;
    try {
      onStatus(`Getting best thumbnail for clip ${i+1}...`);
      const thumbResult = await api.getInsightFaceThumb(clipPath, 0, s.end - s.start);
      thumbUrl = thumbResult.thumbUrl;
      thumbTimestamp = thumbResult.timestamp;
    } catch {
      const fallback = await api.getThumbnail(clipPath, 1);
      thumbUrl = fallback.thumbUrl;
    }
    
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
      thumbTimestamp,
      words: clipWords, 
      language: detectedLang, 
      stylePreset,
      backend
    });
  }
  
  onStatus("Done!");
  return { clips, fullWords: finalWords, language: detectedLang, videoInfo };
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

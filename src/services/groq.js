const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;

/**
 * Utility to fetch with a single retry on 429/Network errors
 */
async function fetchWithRetry(url, options, retries = 1) {
  try {
    const res = await fetch(url, options);
    if (res.status === 429 && retries > 0) {
      console.warn('Groq API rate limit (429) hit, retrying in 2s...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      return fetchWithRetry(url, options, retries - 1);
    }
    return res;
  } catch (error) {
    if (retries > 0) {
      console.warn('Network error, retrying in 2s...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      return fetchWithRetry(url, options, retries - 1);
    }
    throw error;
  }
}

/**
 * Transcribes an audio blob/url using Groq's whisper model
 * @param {string} audioUrl - Blob URL or backend static URL for the audio
 * @returns {Promise<Object>} { words, text, language, segments }
 */
export async function transcribeAudio(audioUrl) {
  if (!GROQ_API_KEY) {
    throw new Error("VITE_GROQ_API_KEY is not defined in environment variables");
  }

  // Fetch the audio file as a Blob
  const blobRes = await fetch(audioUrl);
  const blob = await blobRes.blob();

  const formData = new FormData();
  // Using 'audio.mp3' as a fallback filename if it's a generic blob
  formData.append('file', blob, 'audio.mp3');
  formData.append('model', 'whisper-large-v3-turbo');
  formData.append('response_format', 'verbose_json');
  formData.append('timestamp_granularities[]', 'word');
  // Guide script selection: Force Devanagari script for Hindi, Latin for English/Hinglish, and ban Urdu/Arabic script.
  formData.append('prompt', 'यह वीडियो हिंदी, हिंग्लिश या अंग्रेजी में है। हिंदी शब्दों को देवनागरी लिपि में लिखें। Write Hindi/Hinglish words or English in Latin/English script if spoken that way. उर्दू लिपि (Urdu script) का उपयोग बिल्कुल न करें। Do not write in Urdu Arabic Nastaliq script.');

  const res = await fetchWithRetry('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`
    },
    body: formData
  });

  if (!res.ok) {
    let errMsg = `Transcription failed with status ${res.status}`;
    try {
      const err = await res.json();
      if (err.error?.message) errMsg = err.error.message;
    } catch(e) {}
    throw new Error(errMsg);
  }

  const data = await res.json();
  
  return {
    words: data.words || [],
    text: data.text || '',
    language: data.language || '',
    segments: data.segments || []
  };
}

/**
 * Analyzes a transcript to find engaging short-form segments
 * @param {string} transcriptStr - Full transcript text
 * @param {number} videoDuration - Total duration of the video in seconds
 * @returns {Promise<Array>} Validated array of clip objects
 */
export async function detectClips(transcriptStr, videoDuration) {
  if (!GROQ_API_KEY) {
    throw new Error("VITE_GROQ_API_KEY is not defined in environment variables");
  }

  const systemPrompt = `You are a viral short-form content expert for Indian social media.
Find 5-8 engaging 30-60 second segments. Return ONLY valid JSON array.
Format: [{"start": number, "end": number, "title": "string", "hook": "string", "score": number, "reason": "string"}]
start/end in seconds, score 1-10.`;

  const userPrompt = `Duration: ${videoDuration}s\n\nTranscript:\n${transcriptStr}`;

  const res = await fetchWithRetry('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 2000,
      temperature: 0.3,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    })
  });

  if (!res.ok) {
    let errMsg = `Clip detection failed with status ${res.status}`;
    try {
      const err = await res.json();
      if (err.error?.message) errMsg = err.error.message;
    } catch(e) {}
    throw new Error(errMsg);
  }

  const data = await res.json();
  let content = data.choices[0]?.message?.content?.trim() || '[]';
  
  // Clean markdown JSON ticks if the model adds them
  if (content.startsWith('```json')) {
    content = content.replace(/^```json/, '').replace(/```$/, '').trim();
  } else if (content.startsWith('```')) {
    content = content.replace(/^```/, '').replace(/```$/, '').trim();
  }

  let clips = [];
  try {
    clips = JSON.parse(content);
  } catch (e) {
    try {
      // Handle edge case where the model returns an object { "clips": [...] }
      const parsed = JSON.parse(content);
      if (parsed.clips && Array.isArray(parsed.clips)) {
        clips = parsed.clips;
      } else {
        throw e;
      }
    } catch (e2) {
      throw new Error("Failed to parse JSON array from model output.");
    }
  }

  if (!Array.isArray(clips)) {
    throw new Error("Model did not return a JSON array.");
  }

  // Validate fields
  return clips.filter(clip => {
    if (typeof clip.start !== 'number' || typeof clip.end !== 'number') return false;
    if (clip.start >= clip.end) return false;
    
    // Bounds clamping
    if (clip.end > videoDuration) clip.end = videoDuration;
    if (clip.start < 0) clip.start = 0;
    
    // Ensure score is a number
    if (typeof clip.score !== 'number') clip.score = parseFloat(clip.score) || 0;
    return true;
  });
}

/**
 * Heuristically detects if text is Hindi, English, or Mixed based on Unicode ranges
 * @param {string} text - Text to analyze
 * @returns {string} 'hi' | 'en' | 'mixed'
 */
export function detectLanguage(text) {
  if (!text) return 'en';
  
  const devanagariMatches = text.match(/[\u0900-\u097F]/g);
  const letterMatches = text.match(/[a-zA-Z\u0900-\u097F]/g);
  
  if (!letterMatches || letterMatches.length === 0) return 'en';
  
  const devRatio = (devanagariMatches ? devanagariMatches.length : 0) / letterMatches.length;
  
  if (devRatio > 0.7) return 'hi';
  if (devRatio < 0.3) return 'en';
  return 'mixed';
}

/**
 * Analyzes video slots/transitions using Groq Llama model
 * @param {Array} slots - Array of video slots
 * @param {number} totalDuration - Total video duration in seconds
 * @param {number} fps - Video FPS
 * @returns {Promise<Array>} Array of analyzed transitions
 */
export async function analyzeTransitions(slots, totalDuration, fps) {
  if (!GROQ_API_KEY) {
    throw new Error("VITE_GROQ_API_KEY is not defined in environment variables");
  }

  const systemPrompt = `You are a video transition analysis expert. I have extracted cut points from a trending short-form video.

Here is the slot data with timestamps:
${JSON.stringify(slots)}

Total video duration: ${totalDuration}s
FPS: ${fps}

For EACH slot, classify:
1. transitionOut: what type of transition likely follows this slot before the next one begins
   Options: "swipe_right", "swipe_left", "swipe_up", "zoom_in", "zoom_out", "spin", "fade", "flash", "glitch", "whip_pan", "none"

2. motionSuggestion: what camera/photo motion to apply TO the photo during this slot
   Options: "static", "slow_zoom_in", "slow_zoom_out", "pan_left", "pan_right", "tilt_up", "tilt_down", "slight_rotate"

3. beatSynced: boolean — is this slot likely synced to a music beat (duration is close to 0.5, 1.0, 1.5, 2.0 seconds)?

Respond ONLY with a valid JSON array, no markdown, no explanation:
[
  {
    "slotIndex": 0,
    "transitionOut": "swipe_right",
    "motionSuggestion": "slow_zoom_in",
    "beatSynced": true
  },
  ...
]`;

  const res = await fetchWithRetry('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 2000,
      temperature: 0.2,
      messages: [
        { role: 'user', content: systemPrompt }
      ]
    })
  });

  if (!res.ok) {
    let errMsg = `Transition analysis failed with status ${res.status}`;
    try {
      const err = await res.json();
      if (err.error?.message) errMsg = err.error.message;
    } catch(e) {}
    throw new Error(errMsg);
  }

  const data = await res.json();
  let content = data.choices[0]?.message?.content?.trim() || '[]';

  // Clean markdown JSON ticks if the model adds them
  if (content.startsWith('```json')) {
    content = content.replace(/^```json/, '').replace(/```$/, '').trim();
  } else if (content.startsWith('```')) {
    content = content.replace(/^```/, '').replace(/```$/, '').trim();
  }

  try {
    return JSON.parse(content);
  } catch (e) {
    throw new Error("Failed to parse JSON array from model output.");
  }
}

/**
 * Analyzes video signals using Groq Llama model to reverse-engineer the technique
 * @param {Object} signals - Raw signals object from /analyze
 * @param {number} totalDuration - Total video duration in seconds
 * @param {number} fps - Video FPS
 * @param {Object} rawFrameDiffs - Raw frame diffs list
 * @returns {Promise<Object>} Reverse-engineered recipe JSON
 */
export async function analyzeVideoTechnique(signals, totalDuration, fps, rawFrameDiffs) {
  if (!GROQ_API_KEY) {
    throw new Error("VITE_GROQ_API_KEY is not defined in environment variables");
  }

  const systemPrompt = `You are an expert short-form video editor who can reverse-engineer any video transition technique just from its technical signal data.`;

  const userPrompt = `I analyzed a trending video and extracted these raw signals:

Total duration: ${totalDuration}s
FPS: ${fps}

Cut timestamps (scene changes): ${JSON.stringify((signals.cuts || []).map(c => c.timestamp))}

Freeze windows: ${JSON.stringify(signals.freezes || [])}

Frame difference samples (0=frozen, high=fast motion):
${JSON.stringify(rawFrameDiffs || [])}

Overlay events (region of screen that suddenly changed independently):
${JSON.stringify(signals.overlayEvents || [])}

Beat timestamps: ${JSON.stringify(signals.beatTimestamps || [])}

---

Based on these signals, do the following:

TASK 1 — Identify the primary technique of this video.
Choose the ONE that best describes it (or "hybrid" if multiple):
- "slideshow_cuts": simple photos/clips cut to beat, no special effects
- "freeze_overlay": video freezes, photos appear as overlays on top
- "speed_ramp": video speeds up and slows down dramatically  
- "freeze_resume": video plays, pauses, photos shown, video resumes
- "text_reveal": content appears word by word or element by element
- "zoom_transitions": each clip zooms in/out to transition to next
- "whip_pan": fast directional motion between clips
- "layered_composite": multiple elements layered simultaneously
- "hybrid": combination — describe which ones

TASK 2 — Build a SLOT TIMELINE.
A slot is one "beat" in the template where the user needs to provide a photo or clip.
For each slot provide:
{
  slotIndex: number,
  type: "photo" | "video_clip" | "text" | "background_video",
  startTime: number,
  endTime: number, 
  duration: number,
  layer: "background" | "overlay" | "foreground",
  position: "full" | "top_left" | "top_right" | "bottom_left" | "bottom_right" | "center",
  animationIn: "none" | "slide_left" | "slide_right" | "slide_up" | "slide_down" | "zoom_in" | "zoom_out" | "fade" | "spin" | "flip",
  animationDuration: number,
  beatSynced: boolean,
  notes: string
}

TASK 3 — Identify any BACKGROUND elements that persist across slots.
{ 
  hasBackground: boolean, 
  backgroundType: "none" | "original_video" | "solid_color" | "blurred_video",
  backgroundVideoStart: number,
  backgroundVideoEnd: number
}

TASK 4 — Identify speed ramp segments if any.
[{ start: number, end: number, speedFactor: number }]
speedFactor: 0.5 = slow-mo, 2.0 = 2x speed, etc.

TASK 5 — Write a plain English description of the technique for the user to see.
Example: "The background video plays normally until 3.2s, then freezes. 5 photos slide in from the right one by one (0.3s apart), stacking on the frozen frame. At 6.8s the video resumes at normal speed."

Respond ONLY with valid JSON, no markdown, no explanation outside the JSON:
{
  "technique": string,
  "techniqueDescription": string,
  "slots": [...],
  "background": {...},
  "speedRamps": [...],
  "totalSlots": number,
  "requiresBackgroundVideo": boolean
}`;

  const res = await fetchWithRetry('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 3000,
      temperature: 0.2,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    })
  });

  if (!res.ok) {
    let errMsg = `Technique analysis failed with status ${res.status}`;
    try {
      const err = await res.json();
      if (err.error?.message) errMsg = err.error.message;
    } catch(e) {}
    throw new Error(errMsg);
  }

  const data = await res.json();
  let content = data.choices[0]?.message?.content?.trim() || '{}';

  if (content.startsWith('```json')) {
    content = content.replace(/^```json/, '').replace(/```$/, '').trim();
  } else if (content.startsWith('```')) {
    content = content.replace(/^```/, '').replace(/```$/, '').trim();
  }

  try {
    return JSON.parse(content);
  } catch (e) {
    throw new Error("Failed to parse JSON technique recipe from model output.");
  }
}


// server/services/aiPromptParser.js
// Parses free-text user prompts into structured edit action arrays using Groq LLaMA.
// CommonJS module to match server "type": "commonjs".

const axios = require('axios');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_KEY = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY;

const ACTION_SCHEMA = `
Available actions (return as JSON array of action objects):
[
  { "action": "remove_silence" },
  { "action": "beat_sync_cuts" },
  { "action": "translate_captions", "params": { "targetLang": "hi" } },
  { "action": "set_caption_style", "params": { "style": "NeonPop" } },
  { "action": "set_font_size", "params": { "size": 80 } },
  { "action": "add_zoom", "params": { "word": "fire", "intensity": 1.3 } },
  { "action": "trim_start", "params": { "seconds": 3 } },
  { "action": "trim_end", "params": { "seconds": 5 } },
  { "action": "set_speed", "params": { "multiplier": 1.5 } },
  { "action": "make_cinematic", "params": { "style": "cinematic" } },
  { "action": "add_music", "params": { "mood": "upbeat" } },
  { "action": "reframe_to_portrait" },
  { "action": "set_export_platform", "params": { "platform": "reels" } },
  { "action": "auto_edit" }
]
`;

/**
 * Parses a free-text prompt into a structured array of edit actions via Groq LLaMA.
 *
 * @param {string} promptText - User's natural language instruction
 * @param {object} currentState - { language, selectedStyle, hasBeats, hasSilences, duration }
 * @returns {Promise<Array>} Array of action objects: [{ action, params? }, ...]
 */
async function parsePromptToActions(promptText, currentState = {}) {
  if (!GROQ_KEY) {
    throw new Error('GROQ_API_KEY is not set in environment variables');
  }

  const systemPrompt = `You are an AI video editing assistant for ClipAI.
Parse the user's editing request into a JSON array of edit actions.
Current video state: ${JSON.stringify(currentState)}
${ACTION_SCHEMA}
Return ONLY a valid JSON array. No explanation. If unclear, return the closest matching action.`;

  const response = await axios.post(
    GROQ_API_URL,
    {
      model: 'llama-3.3-70b-versatile',
      max_tokens: 500,
      temperature: 0.1,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: promptText },
      ],
    },
    {
      headers: {
        Authorization: `Bearer ${GROQ_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    }
  );

  const text = response.data.choices[0]?.message?.content?.trim() || '[]';

  // Strip markdown fences if the model wraps the JSON
  const clean = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();

  let actions;
  try {
    actions = JSON.parse(clean);
  } catch (err) {
    throw new Error(`Failed to parse LLaMA response as JSON: ${clean.slice(0, 200)}`);
  }

  if (!Array.isArray(actions)) {
    throw new Error('LLaMA did not return a JSON array of actions');
  }

  return actions; // [{ action, params? }, ...]
}

/**
 * Returns a human-readable summary of what a set of actions will do.
 * Used for the diff preview before the user confirms.
 *
 * @param {Array} actions - Array of action objects
 * @returns {string} Bullet-separated description
 */
function describeActions(actions) {
  if (!Array.isArray(actions) || actions.length === 0) return 'No actions';

  return actions.map((a) => {
    const map = {
      remove_silence: 'Remove all silent pauses',
      beat_sync_cuts: 'Snap clip cuts to music beats',
      translate_captions: `Translate captions to ${a.params?.targetLang || '?'}`,
      set_caption_style: `Change caption style to ${a.params?.style || '?'}`,
      set_font_size: `Set font size to ${a.params?.size || '?'}px`,
      add_zoom: `Add zoom punch on word "${a.params?.word || '?'}"`,
      trim_start: `Trim ${a.params?.seconds || '?'}s from the start`,
      trim_end: `Trim ${a.params?.seconds || '?'}s from the end`,
      set_speed: `Set playback speed to ${a.params?.multiplier || '?'}×`,
      make_cinematic: 'Apply cinematic color grade and pacing',
      add_music: `Add ${a.params?.mood || 'background'} music`,
      reframe_to_portrait: 'Reframe to 9:16 portrait with face tracking',
      set_export_platform: `Set export preset for ${a.params?.platform || '?'}`,
      auto_edit: 'Run full auto-edit pipeline',
    };
    return map[a.action] || a.action;
  }).join(' • ');
}

module.exports = { parsePromptToActions, describeActions };

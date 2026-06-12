const assert = require('assert');
const fs = require('fs');
const path = require('path');
const test = require('node:test');

const groqSource = fs.readFileSync(path.join(__dirname, '../src/services/groq.js'), 'utf8');
const clipDetectorSource = fs.readFileSync(path.join(__dirname, '../src/services/clipDetector.js'), 'utf8');
const captionEditorSource = fs.readFileSync(path.join(__dirname, '../src/screens/CaptionEditor.jsx'), 'utf8');

test('groq service routes transcription through the backend server', () => {
  assert.doesNotMatch(groqSource, /export async function transcribeAudio/);
  assert.doesNotMatch(groqSource, /audio\/transcriptions/);
  assert.match(groqSource, /export async function transcribeViaServer\(audioPath, language = 'auto', onProgress\)/);
  assert.match(groqSource, /http:\/\/localhost:3001\/api\/transcribe\/whisper/);
  assert.match(groqSource, /Both Groq and local Whisper unavailable/);
});

test('groq service keeps browser-side Groq key for LLaMA calls and documents server key', () => {
  assert.match(groqSource, /const GROQ_API_KEY = import\.meta\.env\.VITE_GROQ_API_KEY/);
  assert.match(groqSource, /GROQ_API_KEY \(server-side, no VITE_ prefix\) is used for server-side Whisper calls via transcribeService\.js/);
  assert.match(groqSource, /export async function detectClips/);
  assert.match(groqSource, /export function detectLanguage/);
});

test('clip detector uses server transcription API with audioPath', () => {
  assert.match(clipDetectorSource, /audioPath/);
  assert.match(clipDetectorSource, /api\.transcribeAudio\(processedAudioPath\)/);
  assert.doesNotMatch(clipDetectorSource, /groq\.transcribeAudio/);
});

test('caption editor uses server transcription with audioPath', () => {
  assert.match(captionEditorSource, /audioPath/);
  assert.match(captionEditorSource, /groq\.transcribeViaServer\(audioPath/);
  assert.doesNotMatch(captionEditorSource, /groq\.transcribeAudio/);
});

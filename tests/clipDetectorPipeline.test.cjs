const assert = require('assert');
const fs = require('fs');
const path = require('path');
const test = require('node:test');

const clipDetectorSource = fs.readFileSync(path.join(__dirname, '../src/services/clipDetector.js'), 'utf8');
const apiSource = fs.readFileSync(path.join(__dirname, '../src/services/api.js'), 'utf8');
const filesRouteSource = fs.readFileSync(path.join(__dirname, '../server/routes/files.js'), 'utf8');
const thumbnailRoutePath = path.join(__dirname, '../server/routes/thumbnail.js');

test('clip detector uses the V3 server transcription pipeline', () => {
  assert.match(clipDetectorSource, /export async function generateClips\(videoPath, onStatus, options = \{\}\)/);
  assert.match(clipDetectorSource, /useDemucs = false/);
  assert.match(clipDetectorSource, /useDenoise = false/);
  assert.match(clipDetectorSource, /useSpacy = true/);
  assert.match(clipDetectorSource, /api\.demucsAudio\(audioPath\)/);
  assert.match(clipDetectorSource, /api\.denoiseAudio\(processedAudioPath\)/);
  assert.match(clipDetectorSource, /api\.transcribeAudio\(processedAudioPath\)/);
  assert.match(clipDetectorSource, /api\.saveWordsJson\(words\)/);
  assert.match(clipDetectorSource, /api\.spacyBreaks\(wordsJsonPath, language\)/);
  assert.match(clipDetectorSource, /api\.getInsightFaceThumb\(clipPath, 0, s\.end - s\.start\)/);
  assert.match(clipDetectorSource, /backend/);
});

test('api client exposes helpers for the V3 transcription pipeline', () => {
  assert.match(apiSource, /export async function demucsAudio/);
  assert.match(apiSource, /\/api\/transcribe\/demucs/);
  assert.match(apiSource, /export async function denoiseAudio/);
  assert.match(apiSource, /\/api\/transcribe\/denoise/);
  assert.match(apiSource, /export async function transcribeAudio/);
  assert.match(apiSource, /\/api\/transcribe\/whisper/);
  assert.match(apiSource, /export async function saveWordsJson/);
  assert.match(apiSource, /\/api\/files\/save-json/);
  assert.match(apiSource, /export async function spacyBreaks/);
  assert.match(apiSource, /\/api\/transcribe\/spacy-breaks/);
  assert.match(apiSource, /export async function getInsightFaceThumb/);
});

test('server files route supports saving words JSON for spaCy processing', () => {
  assert.match(filesRouteSource, /router\.post\('\/save-json'/);
  assert.match(filesRouteSource, /fs\.writeFileSync\(filePath, JSON\.stringify\(data/);
  assert.match(filesRouteSource, /filePath/);
});

test('server thumbnail route exposes InsightFace thumbnail generation', () => {
  assert.ok(fs.existsSync(thumbnailRoutePath));
  const thumbnailRouteSource = fs.readFileSync(thumbnailRoutePath, 'utf8');

  assert.match(thumbnailRouteSource, /router\.post\('\/insightface'/);
  assert.match(thumbnailRouteSource, /runPythonScript\([\s\S]*'insightface_thumb\.py'/);
  assert.match(thumbnailRouteSource, /thumbUrl/);
});

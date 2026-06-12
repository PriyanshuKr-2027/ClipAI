const assert = require('assert');
const fs = require('fs');
const path = require('path');
const test = require('node:test');

const routePath = path.join(__dirname, '../routes/transcribe.js');

test('transcribe router defines all requested endpoints', () => {
  assert.ok(fs.existsSync(routePath));
  const source = fs.readFileSync(routePath, 'utf8');

  assert.match(source, /router\.post\('\/whisper'/);
  assert.match(source, /router\.post\('\/demucs'/);
  assert.match(source, /router\.post\('\/denoise'/);
  assert.match(source, /router\.post\('\/spacy-breaks'/);
  assert.match(source, /router\.post\('\/translate'/);
});

test('transcribe router calls services and emits transcribe websocket progress', () => {
  const source = fs.readFileSync(routePath, 'utf8');

  assert.match(source, /transcribeService\.transcribeAudio\(audioPath, language/);
  assert.match(source, /runPythonScript\('demucs_separate\.py', \[audioPath, tempDir\]/);
  assert.match(source, /runPythonScript\('noisereduce_pass\.py', \[audioPath\]/);
  assert.match(source, /runPythonScript\('spacy_breaks\.py', \[wordsJsonPath, language\]/);
  assert.match(source, /runPythonScript\('translate_captions\.py', \[wordsJsonPath, targetLang, sourceLang\]/);
  assert.match(source, /type: 'transcribe'/);
});

test('transcribe router validates temp file paths and returns temp URLs', () => {
  const source = fs.readFileSync(routePath, 'utf8');

  assert.match(source, /validateTempFile\(audioPath\)/);
  assert.match(source, /vocalsUrl/);
  assert.match(source, /cleanAudioUrl/);
});

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const test = require('node:test');

const servicePath = path.join(__dirname, '../services/transcribeService.js');

test('transcribe service defines Groq primary and Faster-Whisper fallback', () => {
  assert.ok(fs.existsSync(servicePath));
  const source = fs.readFileSync(servicePath, 'utf8');

  assert.match(source, /GROQ_API_URL/);
  assert.match(source, /whisper-large-v3-turbo/);
  assert.match(source, /timestamp_granularities\[\]/);
  assert.match(source, /runPythonScript\('faster_whisper_server\.py'/);
  assert.match(source, /backend: 'groq'/);
  assert.match(source, /backend: 'faster-whisper'/);
});

test('transcribe service chunks files over the Groq size limit and stitches timestamps', () => {
  const source = fs.readFileSync(servicePath, 'utf8');

  assert.match(source, /MAX_GROQ_SIZE_BYTES = 25 \* 1024 \* 1024/);
  assert.match(source, /transcribeChunked\(audioPath, language, onProgress\)/);
  assert.match(source, /adjustedWords/);
  assert.match(source, /word\.start \+ chunk\.start/);
  assert.match(source, /fs\.unlinkSync\(chunk\.path\)/);
});

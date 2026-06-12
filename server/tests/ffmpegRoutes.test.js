const assert = require('assert');
const fs = require('fs');
const path = require('path');
const test = require('node:test');

const routeSource = fs.readFileSync(path.join(__dirname, '../routes/ffmpeg.js'), 'utf8');
const serviceSource = fs.readFileSync(path.join(__dirname, '../services/ffmpeg.js'), 'utf8');

test('extract-audio writes a 16kHz mono PCM WAV file', () => {
  assert.match(routeSource, /getTempPaths\('wav'\)/);
  assert.match(serviceSource, /\.audioCodec\('pcm_s16le'\)/);
  assert.match(serviceSource, /\.audioFrequency\(16000\)/);
  assert.match(serviceSource, /\.audioChannels\(1\)/);
});

test('composite overlays caption video and keeps base audio', () => {
  assert.match(routeSource, /router\.post\('\/composite'/);
  assert.match(serviceSource, /\[0:v\]\[1:v\]overlay=0:0/);
  assert.match(serviceSource, /-map 0:a\?/);
});

test('remove-silence returns a job id and concatenates inverted keep ranges', () => {
  assert.match(routeSource, /router\.post\('\/remove-silence'/);
  assert.match(routeSource, /segments\.txt/);
  assert.match(routeSource, /'-f', 'concat'/);
  assert.match(routeSource, /global\.broadcastDone\(jobId, outputFilename\)/);
});

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const test = require('node:test');

const pythonDir = path.join(__dirname, '../python');
const indexPath = path.join(__dirname, '../index.js');

test('python setup helper scripts and dependency checker exist', () => {
  assert.ok(fs.existsSync(path.join(pythonDir, 'setup.sh')));
  assert.ok(fs.existsSync(path.join(pythonDir, 'setup.bat')));
  assert.ok(fs.existsSync(path.join(pythonDir, 'check_deps.py')));
});

test('dependency checker reports available packages and allReady as JSON', () => {
  const source = fs.readFileSync(path.join(pythonDir, 'check_deps.py'), 'utf8');

  assert.match(source, /faster_whisper/);
  assert.match(source, /demucs/);
  assert.match(source, /librosa/);
  assert.match(source, /scenedetect/);
  assert.match(source, /ultralytics/);
  assert.match(source, /json\.dumps\(\{"available": available, "allReady": all_ready\}\)/);
});

test('server exposes python-derived feature status', () => {
  const source = fs.readFileSync(indexPath, 'utf8');

  assert.match(source, /global\.availableFeatures/);
  assert.match(source, /check_deps\.py/);
  assert.match(source, /app\.get\('\/api\/status'/);
  assert.match(source, /fasterWhisper/);
  assert.match(source, /insightface/);
});

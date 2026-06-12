const assert = require('assert');
const fs = require('fs');
const path = require('path');
const test = require('node:test');

const sharpService = require('../services/sharpService');
const sceneRouter = require('../routes/scene');
const thumbnailRouter = require('../routes/thumbnail');

test('sharpService exports expected functions', () => {
  assert.strictEqual(typeof sharpService.optimizeThumbnail, 'function');
  assert.strictEqual(typeof sharpService.computeSharpness, 'function');
  assert.strictEqual(typeof sharpService.extractBestFrame, 'function');
});

test('scene router is an express router', () => {
  assert.strictEqual(typeof sceneRouter, 'function');
  assert.strictEqual(typeof sceneRouter.post, 'function');
});

test('thumbnail router is an express router', () => {
  assert.strictEqual(typeof thumbnailRouter, 'function');
  assert.strictEqual(typeof thumbnailRouter.post, 'function');
});

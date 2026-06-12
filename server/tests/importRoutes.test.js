const assert = require('assert');
const test = require('node:test');

const importer = require('../services/importer');
const importRouter = require('../routes/import');

test('importer exports expected functions', () => {
  assert.strictEqual(typeof importer.importFromYtDlp, 'function');
  assert.strictEqual(typeof importer.importFromInstagram, 'function');
  assert.strictEqual(typeof importer.importFromPlaywright, 'function');
});

test('import router is an express router', () => {
  assert.strictEqual(typeof importRouter, 'function');
  assert.strictEqual(typeof importRouter.post, 'function');
});

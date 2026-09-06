'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const jsonFile = require('../src/storage/json-file');

// Isolate Electron's user-data path; exercise the real settings and JSON storage.
test('language survives reopening settings and preserves unrelated preferences', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tayf-language-'));
  const file = path.join(directory, 'settings.json');
  const module = { exports: {} };
  try {
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/storage/settings.js'), 'utf8'), {
      module,
      require: (name) => name === './paths' ? { settingsFile: () => file } : jsonFile
    });
    const { createSettings } = module.exports;
    const settings = createSettings();
    assert.equal(settings.get('language'), 'ar');
    settings.set('theme', 'nord');
    settings.set('language', 'en');
    const reopened = createSettings();
    assert.equal(reopened.get('language'), 'en');
    assert.equal(reopened.get('theme'), 'nord');
    reopened.set('language', 'ar');
    assert.equal(createSettings().get('language'), 'ar');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

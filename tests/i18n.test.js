'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadPanel } = require('./helpers/load-panel');
const { makeRealGetMessage } = require('./helpers/real-i18n');

test('localization (i18n)', async (t) => {
  await t.test('the keys in it/messages.json and en/messages.json match exactly', () => {
    const it = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '_locales', 'it', 'messages.json'), 'utf8'));
    const en = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '_locales', 'en', 'messages.json'), 'utf8'));
    const itKeys = new Set(Object.keys(it));
    const enKeys = new Set(Object.keys(en));
    assert.deepEqual([...itKeys].sort(), [...enKeys].sort());
  });

  await t.test('t() correctly substitutes placeholders (real IT messages)', async () => {
    const { panel } = loadPanel({ getMessage: makeRealGetMessage('it') });
    assert.equal(panel.t('chordsNotFoundFor', ['Bohemian Rhapsody']), 'Accordi non trovati per "Bohemian Rhapsody"');
    assert.equal(panel.t('removeItemAria', ['Vita Spericolata']), 'Rimuovi Vita Spericolata dalla lista');
    assert.equal(panel.t('exportSummary', ['2', '10', '5']), 'Esportate 2 preferiti, 10 recenti, 5 statistiche.');
  });

  await t.test('t() correctly substitutes placeholders (real EN messages)', async () => {
    const { panel } = loadPanel({ getMessage: makeRealGetMessage('en') });
    assert.equal(panel.t('chordsNotFoundFor', ['Bohemian Rhapsody']), 'Chords not found for "Bohemian Rhapsody"');
    assert.equal(panel.t('close'), 'Close');
  });

  await t.test('manifest.json references only keys that exist in _locales', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'manifest.json'), 'utf8'));
    const it = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '_locales', 'it', 'messages.json'), 'utf8'));
    const refs = JSON.stringify(manifest).match(/__MSG_([a-zA-Z0-9_]+)__/g) || [];
    for (const ref of refs) {
      const key = ref.replace(/^__MSG_/, '').replace(/__$/, '');
      assert.ok(key in it, `manifest.json references "${key}" but it doesn't exist in _locales/it/messages.json`);
    }
    assert.ok(refs.length > 0, 'the manifest must reference at least one __MSG_x__ key');
  });
});

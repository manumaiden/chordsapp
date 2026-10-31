'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadPanel } = require('./helpers/load-panel');

test('font size and per-song key persistence', async (t) => {
  await t.test('saveFontSize + loadSettings: font size survives a panel "restart"', async () => {
    const { panel, store } = loadPanel();
    panel.state.fontSize = 21;
    panel.saveFontSize();

    // Simulates reopening the panel: fresh state instance, same underlying storage.
    const { panel: reopened } = loadPanel({ store });
    assert.equal(reopened.state.fontSize, 13, 'before loadSettings the default remains');
    await reopened.loadSettings();
    assert.equal(reopened.state.fontSize, 21, 'after loadSettings it recovers the saved value');
  });

  await t.test('loadSettings does not touch the default when nothing is saved', async () => {
    const { panel } = loadPanel();
    await panel.loadSettings();
    assert.equal(panel.state.fontSize, 13);
  });

  await t.test('persistTranspose saves the key on the existing recents entry', async () => {
    const { panel } = loadPanel();
    await panel.addToRecents({
      title: 'Song', artist: 'A', content: 'DO SOL', url: 'https://song/1',
      notation: 'italian', chordFormat: 'heuristic', transpose: 0, savedAt: 1
    });
    panel.state.sourceUrl = 'https://song/1';
    panel.state.transpose = 3;
    await panel.persistTranspose();

    assert.equal(await panel.getSavedTranspose('https://song/1'), 3);
  });

  await t.test('persistTranspose does not create new entries for unsaved songs', async () => {
    const { panel } = loadPanel();
    panel.state.sourceUrl = 'https://never-saved/1';
    panel.state.transpose = 5;
    await panel.persistTranspose();

    const recents = await panel.getList(panel.LIBRARY_KEYS.recents);
    const favorites = await panel.getList(panel.LIBRARY_KEYS.favorites);
    assert.equal(recents.length, 0);
    assert.equal(favorites.length, 0);
  });

  await t.test('getSavedTranspose returns 0 for a never-seen song', async () => {
    const { panel } = loadPanel();
    assert.equal(await panel.getSavedTranspose('https://never-seen/1'), 0);
  });

  await t.test('displayResult automatically restores the saved key', async () => {
    const { panel } = loadPanel();
    await panel.addToRecents({
      title: 'Song', artist: 'A', content: 'DO SOL', url: 'https://song/2',
      notation: 'italian', chordFormat: 'heuristic', transpose: -2, savedAt: 1
    });

    await panel.displayResult({
      title: 'Song', artist: 'A', content: 'DO SOL', url: 'https://song/2',
      notation: 'italian', chordFormat: 'heuristic', source: 'accordiespartiti.it'
    });

    assert.equal(panel.state.transpose, -2);
  });

  await t.test('anti race-condition guard: a stale displayResult never overwrites a newer song', async () => {
    const { panel } = loadPanel();
    const song = (id) => ({
      title: id, artist: 'A', content: 'DO SOL', url: `https://song/${id}`,
      notation: 'italian', chordFormat: 'heuristic', source: 'accordiespartiti.it'
    });
    // Slow down the first displayResult's storage reads (favorites + recents), so it
    // resumes only after the newer one has finished — the real "quick video change" case.
    const realGet = global.chrome.storage.local.get;
    let delayed = 2;
    global.chrome.storage.local.get = async (key) => {
      if (delayed > 0) { delayed--; await new Promise(r => setTimeout(r, 20)); }
      return realGet(key);
    };

    const stale = panel.displayResult(song('old'));
    await panel.openLibraryEntry(song('new'));
    await stale;

    assert.equal(panel.state.sourceUrl, 'https://song/new');
  });

  await t.test('formatTranspose formats with an explicit sign only for positive values', () => {
    const { panel } = loadPanel();
    assert.equal(panel.formatTranspose(3), '+3');
    assert.equal(panel.formatTranspose(0), '0');
    assert.equal(panel.formatTranspose(-2), '-2');
  });

  await t.test('formatVersionTag composes the version string in the expected format', () => {
    const { panel } = loadPanel();
    assert.equal(
      panel.formatVersionTag('1.6.2', '25082026'),
      'version 1.6.2 (25082026) by manumaiden'
    );
  });
});

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadPanel } = require('./helpers/load-panel');

test('cleanTitle', async (t) => {
  const { panel } = loadPanel();

  await t.test('removes (Official Video)', () => {
    assert.equal(panel.cleanTitle('YUNGBLUD - Zombie (Official Music Video)'), 'YUNGBLUD - Zombie');
  });

  await t.test('removes (Official Audio)', () => {
    assert.equal(panel.cleanTitle('Eagles - Hotel California (Official Audio)'), 'Eagles - Hotel California');
  });

  await t.test('removes [OFFICIAL VIDEO] and [HD] together', () => {
    assert.equal(
      panel.cleanTitle('Slipknot - Vermilion Pt. 2 [OFFICIAL VIDEO] [HD]'),
      'Slipknot - Vermilion Pt. 2'
    );
  });

  await t.test('removes (Visual) and (Visualizer)', () => {
    assert.equal(panel.cleanTitle('Timoria - Senza Far Rumore (Visual)'), 'Timoria - Senza Far Rumore');
    assert.equal(panel.cleanTitle('Artist - Song (Visualizer)'), 'Artist - Song');
  });

  await t.test('removes (Lyric Video) and (Official Lyric Video)', () => {
    assert.equal(panel.cleanTitle('Song Title (Lyric Video)'), 'Song Title');
    assert.equal(panel.cleanTitle('Song Title (Official Lyric Video)'), 'Song Title');
  });

  await t.test('removes year in parentheses', () => {
    assert.equal(panel.cleanTitle('Song Title (2023)'), 'Song Title');
  });

  await t.test('multiple suffix combination', () => {
    assert.equal(panel.cleanTitle('Song Title (Official Video) (HD) (2023)'), 'Song Title');
  });
});

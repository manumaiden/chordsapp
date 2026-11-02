'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadPanel } = require('./helpers/load-panel');

test('notation conversion (DO↔C)', async (t) => {
  const { panel } = loadPanel();

  await t.test('Italian chord line → English, columns stay aligned with the lyrics', () => {
    const line = 'DO   SOL  LAm/DO';
    const converted = panel.convertChordLine(line);
    assert.equal(converted, 'C    G    Am/C');
    assert.equal(converted.indexOf('G'), line.indexOf('SOL'));
    assert.equal(converted.indexOf('Am'), line.indexOf('LAm'));
  });

  await t.test('flats come out as sharps, same as transposing', () => {
    assert.equal(panel.convertChordLine('SIb MIb'), 'A#  D#'); // one char shorter: one space added
  });

  await t.test('UG marked text → Italian: only inside [ch], aligned, lyrics untouched', () => {
    const text = '[ch]G[/ch]   [ch]Em[/ch]\nChorus: Gonna be';
    assert.equal(panel.convertMarkedText(text, true), '[ch]SOL[/ch] [ch]MIm[/ch]\nChorus: Gonna be');
  });

  await t.test('a longer name never glues two chords together (one space kept)', () => {
    assert.equal(panel.convertMarkedText('[ch]C[/ch] [ch]G[/ch]', true), '[ch]DO[/ch] [ch]SOL[/ch]');
  });

  await t.test('shown notation: the source until the user picks one, then always the pick', () => {
    const { panel: p } = loadPanel();
    p.state.notation = 'english';
    assert.equal(p.shownNotation(), 'english');
    p.state.displayNotation = 'italian';
    assert.equal(p.shownNotation(), 'italian');
  });
});

test('per-video chosen version', async (t) => {
  const song = (id) => ({
    title: id, artist: 'A', content: 'DO SOL', url: `https://song/${id}`,
    notation: 'italian', chordFormat: 'heuristic', source: 'accordiespartiti.it'
  });

  await t.test('a saved choice opens straight away, with no network at all', async () => {
    const { panel } = loadPanel();
    await panel.saveVideoChoice('vid1', song('picked'));
    global.fetch = async () => { throw new Error('no network expected'); };

    await panel.searchAndDisplay('Some Video Title', 'vid1');
    assert.equal(panel.state.sourceUrl, 'https://song/picked');
  });

  await t.test('choosing again for the same video replaces the old choice', async () => {
    const { panel } = loadPanel();
    await panel.saveVideoChoice('vid1', song('first'));
    await panel.saveVideoChoice('vid1', song('second'));
    assert.equal((await panel.getVideoChoice('vid1')).url, 'https://song/second');
    assert.equal((await panel.getList('videoChoices')).length, 1);
  });

  await t.test('another video gets nothing', async () => {
    const { panel } = loadPanel();
    await panel.saveVideoChoice('vid1', song('picked'));
    assert.equal(await panel.getVideoChoice('vid2'), null);
  });
});

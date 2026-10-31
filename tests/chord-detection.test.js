'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadPanel } = require('./helpers/load-panel');

test('chord detection and transpose', async (t) => {
  await t.test('"marked" format (Ultimate Guitar): uses [ch] markers, no heuristic', async (t2) => {
    const { panel } = loadPanel();

    await t2.test('parseUGMarkup preserves [ch] tags, only strips [tab]', () => {
      const raw = '[tab][ch]C[/ch] [ch]Am[/ch][/tab]';
      assert.equal(panel.parseUGMarkup(raw), '[ch]C[/ch] [ch]Am[/ch]');
    });

    await t2.test('colorizeMarkedLine marks only tokens inside [ch]...[/ch]', () => {
      const line = '[ch]C[/ch] [ch]Am[/ch] [ch]F[/ch] [ch]G[/ch]';
      assert.equal(
        panel.colorizeMarkedLine(line),
        '<span class="chord">C</span> <span class="chord">Am</span> <span class="chord">F</span> <span class="chord">G</span>'
      );
    });

    await t2.test('"Chorus" is NEVER marked as a chord (structural fix)', () => {
      assert.equal(panel.colorizeMarkedLine('Chorus'), 'Chorus');
    });

    await t2.test('transposeMarkedText only transforms inside markers, never text outside them', () => {
      const content = '[ch]C[/ch] [ch]Am[/ch] [ch]F[/ch] [ch]G[/ch]\nChorus\nSome lyrics here';
      const transposed = panel.transposeMarkedText(content, 2);
      const lines = transposed.split('\n');
      assert.equal(lines[0], '[ch]D[/ch] [ch]Bm[/ch] [ch]G[/ch] [ch]A[/ch]');
      assert.equal(lines[1], 'Chorus', '"Chorus" must never become "Dhorus"');
      assert.equal(lines[2], 'Some lyrics here');
    });
  });

  await t.test('"heuristic" format (accordiespartiti.it): safe for Italian thanks to UPPERCASE', async (t2) => {
    const { panel } = loadPanel();

    await t2.test('a line of Italian chords only is recognized', () => {
      assert.equal(panel.isChordLine('DO SOL LAm FA'), true);
    });

    await t2.test('a normal text line is not recognized as chords', () => {
      assert.equal(panel.isChordLine('Sto pensando a te'), false);
    });

    await t2.test('transposeLine correctly shifts Italian notes', () => {
      assert.equal(panel.transposeLine('DO SOL LAm FA', 2), 'RE LA SIm SOL');
    });
  });
});

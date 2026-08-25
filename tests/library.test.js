'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadPanel } = require('./helpers/load-panel');

test('library: favorites, recents, most played', async (t) => {
  await t.test('addToRecents: dedup by url, RECENTS_MAX cap, updates to the most recent content', async () => {
    const { panel } = loadPanel();
    const song = (n) => ({ title: `Song ${n}`, artist: 'A', content: 'x', url: `https://x/${n}`, notation: 'italian', chordFormat: 'heuristic', savedAt: n });

    for (let i = 1; i <= 12; i++) await panel.addToRecents(song(i));
    const recents = await panel.getList(panel.LIBRARY_KEYS.recents);
    assert.equal(recents.length, panel.RECENTS_MAX);
    assert.deepEqual(recents.map(r => r.url), Array.from({ length: 10 }, (_, i) => `https://x/${12 - i}`));

    await panel.addToRecents({ ...song(5), title: 'Song 5 (revisited)' });
    const recents2 = await panel.getList(panel.LIBRARY_KEYS.recents);
    assert.equal(recents2[0].url, 'https://x/5', 'a song already present moves to the top');
    assert.equal(recents2.length, panel.RECENTS_MAX, 'no duplicates, length unchanged');
    assert.equal(recents2[0].title, 'Song 5 (revisited)', 'content is updated to the most recent version');
  });

  await t.test('toggleFavorite: adds/removes and updates the button UI', async () => {
    const { panel, el } = loadPanel();
    panel.state.sourceUrl = 'https://song/a';
    panel.state.title = 'A Song';
    panel.state.artist = 'An Artist';
    panel.state.source = 'accordiespartiti.it';
    panel.state.rawContent = 'DO SOL LAm FA';
    panel.state.notation = 'italian';
    panel.state.chordFormat = 'heuristic';

    assert.equal(await panel.isFavorite('https://song/a'), false);
    await panel.toggleFavorite();
    assert.equal(await panel.isFavorite('https://song/a'), true);
    assert.equal(el('favorite-toggle').textContent, '★');

    await panel.toggleFavorite();
    assert.equal(await panel.isFavorite('https://song/a'), false);
    assert.equal(el('favorite-toggle').textContent, '☆');
  });

  await t.test('incrementPlayStat: accumulates the count, independent of the recents cap', async () => {
    const { panel } = loadPanel();
    const song = (n) => ({ title: `Song ${n}`, artist: 'A', content: 'x', url: `https://x/${n}`, notation: 'italian', chordFormat: 'heuristic' });

    await panel.incrementPlayStat(song(1));
    await panel.incrementPlayStat(song(1));
    await panel.incrementPlayStat(song(1));
    await panel.incrementPlayStat(song(2));

    const top = await panel.getTopPlayed(10);
    assert.equal(top.find(s => s.url === 'https://x/1').count, 3);
    assert.deepEqual(top.map(s => s.url), ['https://x/1', 'https://x/2'], 'sorted by descending count');
  });

  await t.test('playStats respects PLAYSTATS_MAX, evicting the least played', async () => {
    const { panel } = loadPanel();
    const song = (n) => ({ title: `Song ${n}`, artist: 'A', content: 'x', url: `https://x/${n}`, notation: 'italian', chordFormat: 'heuristic' });

    await panel.incrementPlayStat(song(1));
    await panel.incrementPlayStat(song(1));
    await panel.incrementPlayStat(song(1)); // count=3, the most played

    for (let i = 2; i <= panel.PLAYSTATS_MAX + 5; i++) await panel.incrementPlayStat(song(i));

    const stats = await panel.getList(panel.LIBRARY_KEYS.playStats);
    assert.equal(stats.length, panel.PLAYSTATS_MAX);
    assert.ok(stats.some(s => s.url === 'https://x/1'), 'the most played song survives the cap');
  });

  await t.test('mergeByUrl: merges by url, pickWinner decides the "winner"', async () => {
    const { panel } = loadPanel();
    const merged = panel.mergeByUrl(
      [{ url: 'x', count: 5 }],
      [{ url: 'x', count: 2 }, { url: 'y', count: 9 }],
      (a, b) => (b.count ?? 0) > (a.count ?? 0) ? b : a
    );
    assert.equal(merged.find(m => m.url === 'x').count, 5, 'keeps the higher count on matching url');
    assert.ok(merged.some(m => m.url === 'y'), 'adds the new entries');
  });

  await t.test('importLibraryData: non-destructive merge, conflict resolved by most recent savedAt', async () => {
    const { panel } = loadPanel();
    await panel.setList(panel.LIBRARY_KEYS.favorites, [{ title: 'Old', url: 'https://a', savedAt: 100 }]);

    const result = await panel.importLibraryData({
      format: 'chordsapp-library',
      favorites: [
        { title: 'New (imported)', url: 'https://a', savedAt: 200 },
        { title: 'B', url: 'https://b', savedAt: 50 }
      ],
      recents: [],
      playStats: []
    });

    const favs = await panel.getList(panel.LIBRARY_KEYS.favorites);
    assert.equal(result.favorites, 2);
    assert.equal(favs.find(f => f.url === 'https://a').title, 'New (imported)');
    assert.equal(favs.filter(f => f.url === 'https://a').length, 1, 'no duplicates by url');
    assert.ok(favs.some(f => f.url === 'https://b'));
  });
});

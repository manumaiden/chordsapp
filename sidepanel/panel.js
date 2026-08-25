'use strict';

// ─── Italian note mappings ──────────────────────────────────────────────────
const IT_NOTE_TO_SEMI = {
  'DO': 0, 'DO#': 1, 'REb': 1, 'RE': 2, 'RE#': 3, 'MIb': 3,
  'MI': 4, 'FA': 5, 'FA#': 6, 'SOLb': 6, 'SOL': 7, 'SOL#': 8,
  'LAb': 8, 'LA': 9, 'LA#': 10, 'SIb': 10, 'SI': 11
};
const IT_SEMI_TO_NOTE = ['DO','DO#','RE','RE#','MI','FA','FA#','SOL','SOL#','LA','LA#','SI'];
const IT_ROOT_PAT = 'SOL#|SOLb|LA#|SIb|DO#|REb|RE#|MIb|FA#|LAb|SOL|DO|RE|MI|FA|LA|SI';

// ─── English note mappings (Ultimate Guitar) ──────────────────────────────────
const EN_NOTE_TO_SEMI = {
  'C#': 1, 'Db': 1, 'D#': 3, 'Eb': 3, 'F#': 6, 'Gb': 6,
  'G#': 8, 'Ab': 8, 'A#': 10, 'Bb': 10,
  'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11
};
const EN_SEMI_TO_NOTE = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const EN_ROOT_PAT = 'C#|Db|D#|Eb|F#|Gb|G#|Ab|A#|Bb|[CDEFGAB]';

// ─── App state ────────────────────────────────────────────────────────────
const state = {
  title: '',
  artist: '',
  source: '',
  rawContent: '',
  notation: 'italian',
  chordFormat: 'heuristic',   // 'marked' (chords delimited by the source, e.g. UG) | 'heuristic' (detected via regex)
  sourceUrl: '',
  transpose: 0,
  fontSize: 13
};

// Last "real" state shown (idle/loading/error/results/result) — the library is an
// overlay: closing it should return here, not always to 'idle'.
let currentStateName = 'idle';

// ─── Auto-scroll state ────────────────────────────────────────────────────────
const scroll = {
  interval: null,
  speed: 3   // 1–10
};
// Milliseconds per pixel at each speed level (1px/tick, variable interval)
const SCROLL_MS = [0, 250, 167, 111, 80, 57, 40, 28, 20, 14, 10];

// ─── Search cache (session) ────────────────────────────────────────────────
const SEARCH_CACHE_KEY = 'searchCache';
const SEARCH_CACHE_MAX = 20;

// ─── Library: favorites (unlimited) and recents (persistent, chrome.storage.local) ──
const LIBRARY_KEYS = { favorites: 'favorites', recents: 'recents', playStats: 'playStats' };
const RECENTS_MAX = 10;
const PLAYSTATS_MAX = 50;
const PLAYSTATS_TOP_N = 10;

// ─── Version (shown in header) ─────────────────────────────────────────────
// Release date in DDMMYYYY format — must be updated manually on every version
// bump in manifest.json (same discipline as CHANGELOG.md/README.md/CLAUDE.md).
// The version number itself must never be updated here: it's read dynamically
// from chrome.runtime.getManifest(), the single source of truth.
const RELEASE_DATE = '25082026';

function formatVersionTag(version, releaseDate) {
  return `version ${version} (${releaseDate}) by manumaiden`;
}

function renderVersionTag() {
  const version = chrome.runtime.getManifest().version;
  $('version-tag').textContent = formatVersionTag(version, RELEASE_DATE);
}

// ─── Persistent settings (font size, global) ──────────────────────
const SETTINGS_KEY = 'settings';

async function loadSettings() {
  try {
    const { [SETTINGS_KEY]: settings } = await chrome.storage.local.get(SETTINGS_KEY);
    if (settings?.fontSize) state.fontSize = settings.fontSize;
  } catch (e) {
    console.warn('[ChordsApp] loadSettings:', e.message);
  }
}

function saveFontSize() {
  chrome.storage.local.set({ [SETTINGS_KEY]: { fontSize: state.fontSize } }).catch(() => {});
}

// ─── Search sequence (anti race-condition guard) ──────────────────────
let searchToken = 0;

// ─── DOM helpers ──────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

// ─── i18n ─────────────────────────────────────────────────────────────────────
// Shortcut over chrome.i18n.getMessage(); Chrome automatically picks the browser's
// language among those available in _locales/, falling back to default_locale (it).
const t = (key, subs) => chrome.i18n.getMessage(key, subs);

// Applies the static translations declared in panel.html via data-i18n(-*).
function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.getAttribute('data-i18n-title'));
  });
  document.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
    el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria-label')));
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
  });
}

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  applyI18n();
  setupListeners();
  renderVersionTag();
  await loadSettings();
  $('scroll-speed-val').textContent = scroll.speed;

  const stored = await chrome.storage.session.get('videoTitle');
  if (stored.videoTitle) {
    $('search-input').value = cleanTitle(stored.videoTitle);
    searchAndDisplay(stored.videoTitle);
  } else {
    showState('idle');
    refreshIdleLibraryPreview();
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'session' && changes.videoTitle?.newValue) {
      const title = changes.videoTitle.newValue;
      $('search-input').value = cleanTitle(title);
      searchAndDisplay(title);
    }
  });
});

function setupListeners() {
  $('search-btn').addEventListener('click', () => {
    const q = $('search-input').value.trim();
    if (q) searchAndDisplay(q);
  });

  $('search-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const q = $('search-input').value.trim();
      if (q) searchAndDisplay(q);
    }
  });

  $('transpose-up').addEventListener('click',    () => adjustTranspose(+1));
  $('transpose-down').addEventListener('click',  () => adjustTranspose(-1));
  $('transpose-reset').addEventListener('click', () => adjustTranspose(0, true));
  $('font-increase').addEventListener('click',   () => adjustFont(+2));
  $('font-decrease').addEventListener('click',   () => adjustFont(-2));

  $('scroll-play').addEventListener('click',    () => toggleScroll());
  $('scroll-faster').addEventListener('click',  () => adjustScrollSpeed(+1));
  $('scroll-slower').addEventListener('click',  () => adjustScrollSpeed(-1));

  $('library-btn').addEventListener('click',   () => openLibrary());
  $('library-close').addEventListener('click', () => closeLibrary());
  $('favorite-toggle').addEventListener('click', () => toggleFavorite());

  $('library-export-btn').addEventListener('click', () => exportLibrary());
  $('library-import-btn').addEventListener('click', () => $('library-import-input').click());
  $('library-import-input').addEventListener('change', (e) => handleImportFile(e));
}

// ─── Search and display ────────────────────────────────────────────────────
async function searchAndDisplay(rawQuery) {
  const query = cleanTitle(rawQuery);
  const myToken = ++searchToken;
  const cacheKey = query.toLowerCase();

  $('search-input').value = query;
  // The key is not reset here: displayResult() restores it from the saved value
  // for this song (or 0 if there isn't one), avoiding a "0" flash before restoring.
  stopScroll();
  showState('loading');

  const cached = await getCachedResult(cacheKey);
  if (myToken !== searchToken) return; // superseded by a more recent search
  if (cached) { displayResult(cached); return; }

  let candidates = [];
  try {
    candidates = await fetchSearchCandidates(query);
  } catch (e) {
    console.warn('[ChordsApp] accordiespartiti.it search:', e.message);
  }
  if (myToken !== searchToken) return;

  if (candidates.length === 1) {
    try {
      const result = await fetchChordPage(candidates[0].url);
      if (myToken !== searchToken) return;
      if (result) { displayResult(result); setCachedResult(cacheKey, result); return; }
    } catch (e) {
      console.warn('[ChordsApp] accordiespartiti.it fetch:', e.message);
    }
  } else if (candidates.length > 1) {
    showResults(candidates, query);
    return;
  }

  try {
    const result = await fetchFromUltimateGuitar(query);
    if (myToken !== searchToken) return;
    if (result) { displayResult(result); setCachedResult(cacheKey, result); return; }
  } catch (e) {
    console.warn('[ChordsApp] Ultimate Guitar:', e.message);
  }

  if (myToken !== searchToken) return;
  showError(t('chordsNotFoundFor', [query]), query);
}

// ─── Search cache ────────────────────────────────────────────────────────────
async function getCachedResult(key) {
  try {
    const { [SEARCH_CACHE_KEY]: cache } = await chrome.storage.session.get(SEARCH_CACHE_KEY);
    return cache?.[key] ?? null;
  } catch {
    return null;
  }
}

async function setCachedResult(key, result) {
  try {
    const { [SEARCH_CACHE_KEY]: existing } = await chrome.storage.session.get(SEARCH_CACHE_KEY);
    const cache = existing ?? {};
    delete cache[key];       // move to the end (most recent) if already present
    cache[key] = result;
    const keys = Object.keys(cache);
    if (keys.length > SEARCH_CACHE_MAX) delete cache[keys[0]]; // evict the oldest one
    await chrome.storage.session.set({ [SEARCH_CACHE_KEY]: cache });
  } catch (e) {
    console.warn('[ChordsApp] cache write:', e.message);
  }
}

// ─── Library: favorites and recents ────────────────────────────────────────────
function currentLibraryEntry() {
  return {
    title: state.title,
    artist: state.artist,
    content: state.rawContent,
    source: state.source,
    url: state.sourceUrl,
    notation: state.notation,
    chordFormat: state.chordFormat,
    transpose: state.transpose,
    savedAt: Date.now()
  };
}

// Looks up the saved key for this song (favorites or recents) — returns 0
// if not found, so the same song always starts from the same transposition
// instead of requiring it to be reset manually every time.
async function getSavedTranspose(url) {
  if (!url) return 0;
  const [favorites, recents] = await Promise.all([
    getList(LIBRARY_KEYS.favorites),
    getList(LIBRARY_KEYS.recents)
  ]);
  const entry = favorites.find(f => f.url === url) || recents.find(r => r.url === url);
  return entry?.transpose ?? 0;
}

// Updates the saved key on the existing entries (favorites/recents) for this
// song, if present — never creates new entries, only syncs the ones already saved.
async function persistTranspose() {
  if (!state.sourceUrl) return;
  const [favorites, recents] = await Promise.all([
    getList(LIBRARY_KEYS.favorites),
    getList(LIBRARY_KEYS.recents)
  ]);
  const fav = favorites.find(f => f.url === state.sourceUrl);
  if (fav && fav.transpose !== state.transpose) {
    fav.transpose = state.transpose;
    await setList(LIBRARY_KEYS.favorites, favorites);
  }
  const rec = recents.find(r => r.url === state.sourceUrl);
  if (rec && rec.transpose !== state.transpose) {
    rec.transpose = state.transpose;
    await setList(LIBRARY_KEYS.recents, recents);
  }
}

function formatTranspose(v) {
  return v > 0 ? `+${v}` : String(v);
}

async function getList(key) {
  try {
    const { [key]: list } = await chrome.storage.local.get(key);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

async function setList(key, list) {
  try {
    await chrome.storage.local.set({ [key]: list });
  } catch (e) {
    console.warn('[ChordsApp] storage.local write:', e.message);
  }
}

async function addToRecents(entry) {
  if (!entry.url) return;
  let recents = await getList(LIBRARY_KEYS.recents);
  recents = recents.filter(r => r.url !== entry.url);
  recents.unshift(entry);
  if (recents.length > RECENTS_MAX) recents = recents.slice(0, RECENTS_MAX);
  await setList(LIBRARY_KEYS.recents, recents);
}

// "Most played" counter independent from the recents cap: a song replayed a
// lot shouldn't lose its history just because it's fallen out of the last 10.
async function incrementPlayStat(entry) {
  if (!entry.url) return;
  const stats = await getList(LIBRARY_KEYS.playStats);
  const idx = stats.findIndex(s => s.url === entry.url);
  const count = idx >= 0 ? stats[idx].count + 1 : 1;
  const updated = { ...entry, count, lastPlayedAt: Date.now() };
  if (idx >= 0) {
    stats[idx] = updated;
  } else {
    stats.push(updated);
    if (stats.length > PLAYSTATS_MAX) {
      stats.sort((a, b) => a.count - b.count); // evict the least played one
      stats.shift();
    }
  }
  await setList(LIBRARY_KEYS.playStats, stats);
}

async function getTopPlayed(limit = PLAYSTATS_TOP_N) {
  const stats = await getList(LIBRARY_KEYS.playStats);
  return [...stats].sort((a, b) => b.count - a.count).slice(0, limit);
}

async function removePlayStat(entry) {
  let stats = await getList(LIBRARY_KEYS.playStats);
  stats = stats.filter(s => s.url !== entry.url);
  await setList(LIBRARY_KEYS.playStats, stats);
  renderLibraryPanel();
  refreshIdleLibraryPreview();
}

// ─── Library export / import (JSON) ──────────────────────────────────────────
const LIBRARY_EXPORT_FORMAT = 'chordsapp-library';

async function exportLibrary() {
  const [favorites, recents, playStats] = await Promise.all([
    getList(LIBRARY_KEYS.favorites),
    getList(LIBRARY_KEYS.recents),
    getList(LIBRARY_KEYS.playStats)
  ]);

  const payload = {
    format: LIBRARY_EXPORT_FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    favorites, recents, playStats
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `chordsapp-libreria-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);

  showLibraryIOStatus(t('exportSummary', [String(favorites.length), String(recents.length), String(playStats.length)]));
}

// Merges two lists by url; on a matching url, whichever entry pickWinner considers "better" wins
function mergeByUrl(existing, incoming, pickWinner) {
  const map = new Map(existing.map(e => [e.url, e]));
  for (const item of incoming) {
    if (!item?.url) continue;
    const current = map.get(item.url);
    map.set(item.url, current ? pickWinner(current, item) : item);
  }
  return Array.from(map.values());
}

async function importLibraryData(data) {
  const incomingFavorites = Array.isArray(data.favorites) ? data.favorites : [];
  const incomingRecents = Array.isArray(data.recents) ? data.recents : [];
  const incomingPlayStats = Array.isArray(data.playStats) ? data.playStats : [];

  const [existingFavorites, existingRecents, existingPlayStats] = await Promise.all([
    getList(LIBRARY_KEYS.favorites),
    getList(LIBRARY_KEYS.recents),
    getList(LIBRARY_KEYS.playStats)
  ]);

  const byMostRecentSave = (a, b) => (b.savedAt ?? 0) > (a.savedAt ?? 0) ? b : a;

  const mergedFavorites = mergeByUrl(existingFavorites, incomingFavorites, byMostRecentSave);

  let mergedRecents = mergeByUrl(existingRecents, incomingRecents, byMostRecentSave);
  mergedRecents.sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0));
  mergedRecents = mergedRecents.slice(0, RECENTS_MAX);

  let mergedPlayStats = mergeByUrl(existingPlayStats, incomingPlayStats, (a, b) => (b.count ?? 0) > (a.count ?? 0) ? b : a);
  mergedPlayStats.sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
  mergedPlayStats = mergedPlayStats.slice(0, PLAYSTATS_MAX);

  await Promise.all([
    setList(LIBRARY_KEYS.favorites, mergedFavorites),
    setList(LIBRARY_KEYS.recents, mergedRecents),
    setList(LIBRARY_KEYS.playStats, mergedPlayStats)
  ]);

  return { favorites: mergedFavorites.length, recents: mergedRecents.length, playStats: mergedPlayStats.length };
}

async function handleImportFile(e) {
  const file = e.target.files?.[0];
  e.target.value = ''; // allows reselecting the same file later
  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const hasKnownList = Array.isArray(data.favorites) || Array.isArray(data.recents) || Array.isArray(data.playStats);
    if (data.format !== LIBRARY_EXPORT_FORMAT || !hasKnownList) {
      throw new Error(t('importFormatError'));
    }

    const result = await importLibraryData(data);
    renderLibraryPanel();
    refreshIdleLibraryPreview();
    refreshFavoriteButton();
    showLibraryIOStatus(t('importSummary', [String(result.favorites), String(result.recents), String(result.playStats)]));
  } catch (err) {
    showLibraryIOStatus(t('importFailedPrefix', [err.message]), true);
  }
}

function showLibraryIOStatus(msg, isError = false) {
  const el = $('library-io-status');
  el.textContent = msg;
  el.classList.remove('hidden');
  el.classList.toggle('library-io-status--error', isError);
}

function hideLibraryIOStatus() {
  $('library-io-status').classList.add('hidden');
}

async function isFavorite(url) {
  const favorites = await getList(LIBRARY_KEYS.favorites);
  return favorites.some(f => f.url === url);
}

async function toggleFavorite() {
  if (!state.sourceUrl) return;
  let favorites = await getList(LIBRARY_KEYS.favorites);
  const exists = favorites.some(f => f.url === state.sourceUrl);
  favorites = exists
    ? favorites.filter(f => f.url !== state.sourceUrl)
    : [currentLibraryEntry(), ...favorites];
  await setList(LIBRARY_KEYS.favorites, favorites);
  updateFavoriteButtonUI(!exists);
  renderLibraryPanel();
  refreshIdleLibraryPreview();
}

async function removeFavorite(entry) {
  let favorites = await getList(LIBRARY_KEYS.favorites);
  favorites = favorites.filter(f => f.url !== entry.url);
  await setList(LIBRARY_KEYS.favorites, favorites);
  if (state.sourceUrl === entry.url) updateFavoriteButtonUI(false);
  renderLibraryPanel();
  refreshIdleLibraryPreview();
}

async function removeRecent(entry) {
  let recents = await getList(LIBRARY_KEYS.recents);
  recents = recents.filter(r => r.url !== entry.url);
  await setList(LIBRARY_KEYS.recents, recents);
  renderLibraryPanel();
  refreshIdleLibraryPreview();
}

async function refreshFavoriteButton() {
  updateFavoriteButtonUI(await isFavorite(state.sourceUrl));
}

function updateFavoriteButtonUI(isFav) {
  const btn = $('favorite-toggle');
  btn.textContent = isFav ? '★' : '☆';
  btn.classList.toggle('active', isFav);
  const label = isFav ? t('removeFromFavorites') : t('addToFavorites');
  btn.title = label;
  btn.setAttribute('aria-label', label);
}

function openLibrary() {
  renderLibraryPanel();
  hideLibraryIOStatus();
  showState('library');
}

function closeLibrary() {
  showState(currentStateName);
}

// Opens a saved song (favorite or recent): no fetch, content already in the local cache
function openLibraryEntry(entry) {
  ++searchToken; // invalidates any network searches still in flight
  stopScroll();
  displayResult(entry);
}

function buildLibraryItem(entry, { removable = false, onRemove, showCount = false } = {}) {
  const li = document.createElement('li');
  li.className = 'result-item library-item';

  const label = document.createElement('span');
  label.className = 'library-item-label';
  label.textContent = entry.title
    ? `${entry.title}${entry.artist ? ' — ' + entry.artist : ''}`
    : slugToLabel(entry.url);
  li.appendChild(label);

  li.addEventListener('click', () => openLibraryEntry(entry));

  if (showCount && entry.count) {
    const badge = document.createElement('span');
    badge.className = 'library-item-count';
    badge.textContent = `×${entry.count}`;
    li.appendChild(badge);
  }

  if (removable) {
    const removeBtn = document.createElement('button');
    removeBtn.className = 'library-item-remove';
    removeBtn.textContent = '×';
    removeBtn.title = t('remove');
    removeBtn.setAttribute('aria-label', t('removeItemAria', [entry.title || t('genericItem')]));
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      onRemove?.(entry);
    });
    li.appendChild(removeBtn);
  }

  return li;
}

function fillList(ulEl, emptyEl, items, options) {
  ulEl.innerHTML = '';
  items.forEach(entry => ulEl.appendChild(buildLibraryItem(entry, options)));
  if (emptyEl) emptyEl.classList.toggle('hidden', items.length > 0);
}

async function renderLibraryPanel() {
  const [favorites, recents, topPlayed] = await Promise.all([
    getList(LIBRARY_KEYS.favorites),
    getList(LIBRARY_KEYS.recents),
    getTopPlayed()
  ]);
  fillList($('favorites-list'), $('favorites-empty'), favorites, { removable: true, onRemove: removeFavorite });
  fillList($('recents-list'), $('recents-empty'), recents, { removable: true, onRemove: removeRecent });
  fillList($('playstats-list'), $('playstats-empty'), topPlayed, { removable: true, onRemove: removePlayStat, showCount: true });
}

async function refreshIdleLibraryPreview() {
  const container = $('idle-library');
  const [favorites, recents, topPlayed] = await Promise.all([
    getList(LIBRARY_KEYS.favorites),
    getList(LIBRARY_KEYS.recents),
    getTopPlayed()
  ]);

  container.classList.toggle('hidden', favorites.length === 0 && recents.length === 0 && topPlayed.length === 0);
  $('idle-favorites-section').classList.toggle('hidden', favorites.length === 0);
  $('idle-recents-section').classList.toggle('hidden', recents.length === 0);
  $('idle-playstats-section').classList.toggle('hidden', topPlayed.length === 0);

  fillList($('idle-favorites-list'), null, favorites.slice(0, 5), {});
  fillList($('idle-recents-list'), null, recents.slice(0, 5), {});
  fillList($('idle-playstats-list'), null, topPlayed.slice(0, 5), { showCount: true });
}

// ─── Primary source: accordiespartiti.it ──────────────────────────────────────
async function fetchSearchCandidates(query) {
  const searchUrl = `https://www.accordiespartiti.it/?s=${encodeURIComponent(query)}`;
  const res = await fetchWithRetry(searchUrl);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const doc = parseHTML(await res.text());

  const seen = new Set();
  const candidates = Array.from(doc.querySelectorAll('a[href*="/accordi/"]'))
    .filter(a => {
      if (a.closest('nav, header, footer, .menu, .widget, .sidebar')) return false;
      const href = a.getAttribute('href') || '';
      const segments = href.split('/').filter(Boolean);
      return segments.length >= 4;
    })
    .filter(a => {
      const href = a.getAttribute('href') || '';
      if (seen.has(href)) return false;
      seen.add(href);
      return true;
    });

  if (!candidates.length) return [];

  const scored = candidates.map(a => ({
    url: a.href || a.getAttribute('href'),
    label: a.textContent?.trim() || '',
    score: titleMatchScore(query, a.getAttribute('href') || '')
  }));

  scored.sort((x, y) => y.score - x.score);
  return scored.filter(c => c.score >= 0.2).slice(0, 5);
}

async function fetchChordPage(url) {
  const res = await fetchWithRetry(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const doc = parseHTML(await res.text());
  return parseAcordiespartiti(doc, url);
}

// Shows the multiple-results list
function showResults(candidates, query) {
  const cacheKey = query.toLowerCase();
  const list = $('results-list');
  list.innerHTML = '';

  candidates.forEach(c => {
    const li = document.createElement('li');
    li.className = 'result-item';
    li.textContent = c.label || slugToLabel(c.url);
    li.addEventListener('click', async () => {
      const myToken = ++searchToken; // the click is a new user action, it becomes the current search
      showState('loading');
      try {
        const result = await fetchChordPage(c.url);
        if (myToken !== searchToken) return;
        if (result) { displayResult(result); setCachedResult(cacheKey, result); }
        else showError(t('contentUnavailable'), query);
      } catch (e) {
        if (myToken !== searchToken) return;
        showError(e.message, query);
      }
    });
    list.appendChild(li);
  });

  // Ultimate Guitar fallback option at the bottom of the list
  const ugLi = document.createElement('li');
  ugLi.className = 'result-item result-item--ug';
  ugLi.textContent = t('searchOnUG');
  ugLi.addEventListener('click', async () => {
    const myToken = ++searchToken;
    showState('loading');
    try {
      const result = await fetchFromUltimateGuitar(query);
      if (myToken !== searchToken) return;
      if (result) { displayResult(result); setCachedResult(cacheKey, result); }
      else showError(t('chordsNotFoundFor', [query]), query);
    } catch (e) {
      if (myToken !== searchToken) return;
      showError(e.message, query);
    }
  });
  list.appendChild(ugLi);

  showState('results');
}

function slugToLabel(url) {
  return url.split('/').filter(Boolean).slice(-2).map(s => s.replace(/-/g, ' ')).join(' — ');
}

// Word-overlap score between the query and the result's URL slug (0–1)
function titleMatchScore(query, href) {
  const normalize = s =>
    s.toLowerCase()
     .normalize('NFD').replace(/[̀-ͯ]/g, '')
     .replace(/[^a-z0-9\s]/g, ' ')
     .split(/\s+/)
     .filter(w => w.length > 2);

  const qWords = new Set(normalize(query));
  const slugParts = href.split('/').filter(Boolean).slice(-2).join(' ').replace(/-/g, ' ');
  const uWords = normalize(slugParts);

  if (!qWords.size || !uWords.length) return 0;
  const matches = uWords.filter(w => qWords.has(w)).length;
  return matches / Math.max(qWords.size, uWords.length);
}

function parseAcordiespartiti(doc, url) {
  const titleEl = doc.querySelector('.entry-title, h1, h2.entry-title');
  const title = titleEl?.textContent?.trim() ?? '';

  const artistEl = doc.querySelector('.entry-content a[href*="/accordi/"]');
  const artist = artistEl?.textContent?.trim() || artistFromUrl(url);

  const contentEl = doc.querySelector('.entry-content, .post-content, article .content, main article');
  if (!contentEl) return null;

  const clone = contentEl.cloneNode(true);
  clone.querySelectorAll(
    'script, style, [class*="share"], [class*="social"], [class*="related"],' +
    '[class*="widget"], .wp-block-buttons, nav, footer, .comments-area,' +
    '.comment-form, .navigation, .post-navigation, .addtoany_share_save_container'
  ).forEach(el => el.remove());

  const pre = clone.querySelector('pre');
  let content;
  if (pre) {
    content = pre.textContent;
  } else {
    clone.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
    content = clone.textContent;
  }

  content = content.trim();
  if (content.length < 30) return null;

  return { title, artist, content, source: 'accordiespartiti.it', url, notation: 'italian', chordFormat: 'heuristic' };
}

// Fallback: derives the artist from the URL slug when the page doesn't expose a
// recognizable link (e.g. /accordi/{artist}/{song}/) — an additional attempt, doesn't replace the page-based extraction
function artistFromUrl(url) {
  try {
    const segments = new URL(url).pathname.split('/').filter(Boolean);
    const idx = segments.indexOf('accordi');
    const slug = idx >= 0 ? segments[idx + 1] : undefined;
    if (!slug) return '';
    return slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  } catch {
    return '';
  }
}

// ─── Secondary source: Ultimate Guitar ───────────────────────────────────────
async function fetchFromUltimateGuitar(query) {
  const searchUrl =
    `https://www.ultimate-guitar.com/search.php?search_type=title&value=${encodeURIComponent(query)}&type=300`;
  const res = await fetchWithRetry(searchUrl, { headers: { 'Accept': 'text/html' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const searchDoc = parseHTML(await res.text());
  const searchData = parseJsStore(searchDoc);
  const results = searchData?.store?.page?.data?.results;
  if (!results?.length) return null;

  const tab = results.find(r => r.type === 'Chords') ?? results[0];
  if (!tab?.tab_url) return null;

  const res2 = await fetchWithRetry(tab.tab_url, { headers: { 'Accept': 'text/html' } });
  if (!res2.ok) throw new Error(`HTTP ${res2.status}`);

  const tabDoc = parseHTML(await res2.text());
  const tabData = parseJsStore(tabDoc);
  const tabView = tabData?.store?.page?.data?.tab_view;
  if (!tabView) throw new Error('Nessun tab_view nel js-store');

  const raw = tabView.wiki_tab?.content ?? '';
  const content = parseUGMarkup(raw);
  if (!content.trim()) return null;

  return {
    title: tabView.tab?.song_name ?? tab.song_name ?? '',
    artist: tabView.tab?.artist_name ?? tab.artist_name ?? '',
    content,
    source: 'Ultimate Guitar',
    url: tab.tab_url,
    notation: 'english',
    chordFormat: 'marked'
  };
}

function parseJsStore(doc) {
  const el = doc.querySelector('.js-store[data-content]');
  if (!el) return null;
  try { return JSON.parse(el.getAttribute('data-content')); }
  catch { return null; }
}

// Only strips [tab] tags (formatting wrapper); the [ch]...[/ch] tags are
// preserved and used as the ground-truth chord boundaries during rendering/transpose
// (see chordFormat 'marked'), instead of re-guessing them with a regex heuristic.
function parseUGMarkup(raw) {
  return raw
    .replace(/\[tab\]/g, '').replace(/\[\/tab\]/g, '');
}

// ─── Result rendering ──────────────────────────────────────────────────────
async function displayResult(result) {
  // The saved-key lookup is async: the token is captured before any await and
  // re-checked afterwards, the same anti-race-condition guard as the "Search"
  // section — if a more recent action starts in the meantime, this one is
  // discarded without touching the shared state (no mutation of `state` before the check).
  const myToken = searchToken;
  const transpose = await getSavedTranspose(result.url);
  if (myToken !== searchToken) return;

  state.title       = result.title  || '';
  state.artist      = result.artist || '';
  state.source      = result.source || '';
  state.rawContent  = result.content;
  state.notation    = result.notation;
  state.chordFormat = result.chordFormat || 'heuristic';
  state.sourceUrl   = result.url;
  state.transpose   = transpose;

  $('song-title').textContent   = result.title  || t('unknownTitle');
  $('song-artist').textContent  = result.artist || '';
  $('source-badge').textContent = result.source;
  $('source-link').href         = result.url;
  $('transpose-value').textContent = formatTranspose(state.transpose);

  showState('result');
  renderChords();
  $('chords-content').scrollTop = 0; // new song: always starts from the top, not wherever the previous scroll had left off

  addToRecents(currentLibraryEntry());
  incrementPlayStat(currentLibraryEntry());
  refreshFavoriteButton();
}

function renderChords() {
  const isMarked = state.chordFormat === 'marked';

  const text = state.transpose !== 0
    ? (isMarked
        ? transposeMarkedText(state.rawContent, state.transpose)
        : transposeText(state.rawContent, state.notation, state.transpose))
    : state.rawContent;

  const pre = document.createElement('pre');
  pre.style.fontSize = `${state.fontSize}px`;

  const html = text.split('\n').map(line =>
    isMarked
      ? colorizeMarkedLine(line)
      : (isChordLine(line, state.notation)
          ? colorizeChordLine(line, state.notation)
          : escapeHtml(line))
  ).join('\n');

  pre.innerHTML = html;

  const container = $('chords-content');
  container.innerHTML = '';
  container.appendChild(pre);
}

// ─── Rendering/transpose based on source markers (e.g. Ultimate Guitar) ───
// Unlike colorizeChordLine/transposeLine (heuristic), here the chord
// boundaries are the ones declared by the source itself: no text-only line
// can ever be mistaken for a chord line.
const UG_CHORD_PATTERN = '\\[ch\\](.*?)\\[/ch\\]';

function colorizeMarkedLine(line) {
  const regex = new RegExp(UG_CHORD_PATTERN, 'g');
  let result = '';
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(line)) !== null) {
    result += escapeHtml(line.slice(lastIndex, match.index));
    result += `<span class="chord">${escapeHtml(match[1])}</span>`;
    lastIndex = regex.lastIndex;
  }
  result += escapeHtml(line.slice(lastIndex));
  return result;
}

function transposeMarkedText(text, semitones) {
  const norm = ((semitones % 12) + 12) % 12;
  if (norm === 0) return text;

  return text.replace(new RegExp(UG_CHORD_PATTERN, 'g'), (_, chordName) => {
    const transposed = chordName.replace(new RegExp(EN_ROOT_PAT, 'g'), root => {
      const semi = EN_NOTE_TO_SEMI[root];
      if (semi === undefined) return root;
      return EN_SEMI_TO_NOTE[((semi + semitones) % 12 + 12) % 12];
    });
    return `[ch]${transposed}[/ch]`;
  });
}

// ─── Chord coloring ──────────────────────────────────────────────────────
function colorizeChordLine(line, notation) {
  const pat = notation === 'italian'
    ? `(${IT_ROOT_PAT})[a-zA-Z0-9#+°øΔ]*(\/[A-Za-z0-9#b]+)?`
    : `(C#|Db|D#|Eb|F#|Gb|G#|Ab|A#|Bb|[CDEFGAB])[a-zA-Z0-9#+°øΔ]*(\/[A-Za-z0-9#b]+)?`;

  const regex = new RegExp(pat, 'g');
  let result = '';
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(line)) !== null) {
    result += escapeHtml(line.slice(lastIndex, match.index));
    result += `<span class="chord">${escapeHtml(match[0])}</span>`;
    lastIndex = regex.lastIndex;
  }
  result += escapeHtml(line.slice(lastIndex));
  return result;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─── Transpose ────────────────────────────────────────────────────────────────
function adjustTranspose(delta, reset = false) {
  state.transpose = reset ? 0 : Math.max(-11, Math.min(11, state.transpose + delta));
  $('transpose-value').textContent = formatTranspose(state.transpose);
  renderChords();
  persistTranspose();
}

function transposeText(text, notation, semitones) {
  const norm = ((semitones % 12) + 12) % 12;
  if (norm === 0) return text;

  return text.split('\n').map(line =>
    isChordLine(line, notation) ? transposeLine(line, notation, norm) : line
  ).join('\n');
}

function isChordLine(line, notation) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('[')) return false;
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  return tokens.length > 0 && tokens.every(t => isChordToken(t, notation));
}

function isChordToken(token, notation) {
  const base = token.split('/')[0];
  if (notation === 'italian') {
    return new RegExp(`^(${IT_ROOT_PAT})[a-zA-Z0-9#+°øΔ]*$`).test(base);
  }
  return /^[A-G][#b]?[a-zA-Z0-9#+°øΔ]*$/.test(base);
}

function transposeLine(line, notation, semitones) {
  if (notation === 'italian') {
    return line.replace(new RegExp(IT_ROOT_PAT, 'g'), root => {
      const semi = IT_NOTE_TO_SEMI[root];
      if (semi === undefined) return root;
      return IT_SEMI_TO_NOTE[((semi + semitones) % 12 + 12) % 12];
    });
  }
  return line.replace(new RegExp(EN_ROOT_PAT, 'g'), root => {
    const semi = EN_NOTE_TO_SEMI[root];
    if (semi === undefined) return root;
    return EN_SEMI_TO_NOTE[((semi + semitones) % 12 + 12) % 12];
  });
}

// ─── Auto-scroll ──────────────────────────────────────────────────────────────
function toggleScroll() {
  scroll.interval ? stopScroll() : startScroll();
}

function startScroll() {
  const el = $('chords-content');
  scroll.interval = setInterval(() => {
    el.scrollTop += 1;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 2) stopScroll();
  }, SCROLL_MS[scroll.speed]);
  $('scroll-play').textContent = '⏸';
  $('scroll-play').classList.add('active');
  $('scroll-play').setAttribute('aria-label', t('scrollPauseAria'));
}

function stopScroll() {
  if (!scroll.interval) return;
  clearInterval(scroll.interval);
  scroll.interval = null;
  $('scroll-play').textContent = '▶';
  $('scroll-play').classList.remove('active');
  $('scroll-play').setAttribute('aria-label', t('scrollPlayAria'));
}

function adjustScrollSpeed(delta) {
  scroll.speed = Math.max(1, Math.min(10, scroll.speed + delta));
  $('scroll-speed-val').textContent = scroll.speed;
  if (scroll.interval) {
    stopScroll();
    startScroll();
  }
}

// ─── Font size ──────────────────────────────────────────────────────────────
function adjustFont(delta) {
  state.fontSize = Math.max(10, Math.min(24, state.fontSize + delta));
  const pre = $('chords-content').querySelector('pre');
  if (pre) pre.style.fontSize = `${state.fontSize}px`;
  saveFontSize();
}

// ─── Utilities ────────────────────────────────────────────────────────────────

// One retry on a transient network failure (fetch exception) or a 5xx server error —
// never on 4xx (e.g. 404: not a transient problem, retrying wouldn't help).
async function fetchWithRetry(url, options, retries = 1, delayMs = 600) {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, options);
      if (!res.ok && res.status >= 500 && attempt < retries) {
        await new Promise(r => setTimeout(r, delayMs));
        continue;
      }
      return res;
    } catch (e) {
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, delayMs));
        continue;
      }
      throw e;
    }
  }
}

function parseHTML(html) {
  return new DOMParser().parseFromString(html, 'text/html');
}

function cleanTitle(title) {
  return title
    .replace(/\(official\s*(music\s*)?video\)/gi, '')
    .replace(/\(official\s*audio\)/gi, '')
    .replace(/\(official\s*lyric\s*video\)/gi, '')
    .replace(/\(lyrics?\)/gi, '')
    .replace(/\(lyric\s*video\)/gi, '')
    .replace(/[([]\s*visual(?:izer)?\s*[)\]]/gi, '')
    .replace(/\[testo[^\]]*\]/gi, '')
    .replace(/\(live[^)]*\)/gi, '')
    .replace(/\(remaster(?:ed)?[^)]*\)/gi, '')
    .replace(/\[official[^\]]*\]/gi, '')
    .replace(/[([]\s*(hd|4k)\s*[)\]]/gi, '')
    .replace(/\(\d{4}\)/g, '')
    .replace(/\bft\..*/gi, '')
    .replace(/\bfeat\..*/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function showState(name) {
  if (name !== 'library') currentStateName = name; // the library is an overlay, not a "real" state
  ['idle', 'loading', 'error', 'results', 'result', 'library'].forEach(s => {
    const el = $(`state-${s}`);
    if (el) el.classList.toggle('hidden', s !== name);
  });
}

function showError(msg, query) {
  $('error-msg').textContent = msg;
  $('ug-link').href =
    `https://www.ultimate-guitar.com/search.php?search_type=title&value=${encodeURIComponent(query)}`;
  $('fallback-links').classList.remove('hidden');
  showState('error');
}

// ─── Export for tests (Node, via require after setting global.document/chrome) ──
// Has no effect in the real extension: browsers/Chrome extensions don't define
// `module`, so this block is never executed there.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    // state and constants
    state, scroll, LIBRARY_KEYS, RECENTS_MAX, PLAYSTATS_MAX, SETTINGS_KEY,
    RELEASE_DATE, formatVersionTag,
    // search / title
    cleanTitle, titleMatchScore, slugToLabel, artistFromUrl,
    // chords: detection, coloring, transpose
    isChordLine, isChordToken, transposeLine, transposeText,
    colorizeChordLine, colorizeMarkedLine, transposeMarkedText, escapeHtml,
    parseUGMarkup,
    // library: favorites / recents / most played / export-import
    getList, setList, currentLibraryEntry, addToRecents, incrementPlayStat,
    getTopPlayed, removeFavorite, removeRecent, removePlayStat, toggleFavorite,
    isFavorite, mergeByUrl, importLibraryData, exportLibrary,
    // persistent key/font
    getSavedTranspose, persistTranspose, formatTranspose, loadSettings, saveFontSize,
    // rendering/main flow
    displayResult, renderChords, applyI18n, t,
    // network retry (added in this session)
    fetchWithRetry
  };
}

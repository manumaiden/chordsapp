# Changelog

All notable changes to ChordsApp are documented here.
Format: [Semantic Versioning](https://semver.org/) — MAJOR.MINOR.PATCH

---

## [1.7.0] — 2026-11-02

### Added
- **Other versions (⇄)**: if the chords that opened aren't the right version, pick another one from the list (every match from accordiespartiti.it plus Ultimate Guitar), with a way back to the current song
- **Your pick is remembered per YouTube video**: the next time that video plays, the chosen version opens instantly — no search, no network
- **DO ↔ C notation toggle**: show any song's chords in Italian (DO RE MI) or English (C D E) notation, kept aligned with the lyrics; the choice is remembered

---

## [1.6.4] — 2026-10-31

### Fixed
- Only the YouTube tab you're looking at drives the panel: a background tab's autoplay no longer replaces the song you're playing, and switching back to a tab brings its video back
- Channel, search and home pages on YouTube no longer start chord searches
- Library import now skips malformed entries and reports a failure if the library can't be saved
- Clearer, localized error message when a selected result can't be loaded
- The library no longer closes by itself when a search finishes in the background
- Better title cleanup for `(feat. X)`, `ft X`, `| Official Video`, `(Official Video HD)`

### Changed
- Fewer permissions: removed `activeTab` and the youtube.com host permission; chord sites limited to `https://`
- Internal cleanup (dead code removed); test suite grown to 50 tests

---

## [1.6.3] — 2026-08-25

### Added

Initial public release. ChordsApp is a Chrome extension that shows guitar chords in a side panel while you watch YouTube — no backend, everything runs client-side. Highlights:

- Automatic YouTube video title detection, with smart chord search against **accordiespartiti.it** (primary source, Italian notation) and automatic fallback to **Ultimate Guitar** (English notation)
- Chord transposition (±11 semitones), adjustable auto-scroll speed, adjustable font size — both persisted across sessions
- Favorites, recent songs, and a "most played" counter, all stored locally (`chrome.storage.local`) — no account, no server
- Library export/import in JSON, for backup or moving your library to another computer
- Automatic retry on transient network errors before showing an error message
- Bilingual interface (Italian/English, follows the browser's language) with full accessibility support (`aria-label` on every control)
- Formal test suite (`npm test`, 46 tests, zero external dependencies)

See [README.md](README.md) for installation and usage instructions.

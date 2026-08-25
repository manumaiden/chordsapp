# Changelog

All notable changes to ChordsApp are documented here.
Format: [Semantic Versioning](https://semver.org/) — MAJOR.MINOR.PATCH

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

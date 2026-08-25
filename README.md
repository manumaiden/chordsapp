# ChordsApp `v1.6.3`

A Chrome extension that shows guitar chords in a side panel while you watch YouTube. One browser, no duplicate tabs.

## Features

- Automatically detects the YouTube video title
- Searches for chords on **accordiespartiti.it** (primary source, Italian notation) with smart matching against the searched title
- Shows a **clickable list** to pick the right version when there are multiple valid results
- Automatic fallback to **Ultimate Guitar** if nothing is found or the match confidence is too low
- **Chords highlighted in amber** on chord lines, visually distinguishing them from lyrics
- Chord transposition (+/- semitones)
- Auto-scroll with adjustable speed (1–10, from 4 to 100 px/s)
- Manual search with a text field
- Adjustable font size
- Link to the original chord page
- **Favorites and recent songs**: save songs with the star (☆/★), find them instantly from the library button (☰) in the header — no network fetch needed
- **Most played songs**: a persistent counter of how many times you reopen each song
- **Library export/import** in JSON (favorites + recents + stats), useful as a backup or to move your library to another computer
- **Italian/English**: the interface automatically follows the browser's language
- Keyboard/screen-reader accessible (`aria-label` on every control)
- **Persistent text size and key**: the chosen font size stays set between sessions; the key of every saved song (favorites/recents) is remembered and automatically restored when reopening it
- **Automatic retry** on transient network errors, before showing an error message

## Installation

1. Download / clone this folder
2. Open Chrome → go to `chrome://extensions`
3. Enable **Developer mode** (toggle in the top right)
4. Click **Load unpacked**
5. Select the `chordsapp/` folder
6. The extension icon will appear in the Chrome toolbar

## Usage

1. Open YouTube and go to a music video
2. Click the **ChordsApp** icon in the Chrome toolbar
3. The side panel opens with the song's chords
4. Navigate to another video → the chords update automatically
5. Use **Key +/−** to transpose, **A+/A−** to change the text size
6. Click the star (☆) to save the song to your favorites; the ☰ button in the header opens the library with favorites and recent songs

If the chords aren't found automatically, type the song name in the search field.

## Tech stack

- Chrome Extension Manifest V3
- Vanilla JS + HTML/CSS (no framework)
- Side Panel API (Chrome 114+)
- No backend — everything is fetched client-side

## Known limitations

- accordiespartiti.it is optimized for Italian songs
- Ultimate Guitar may block fetches in the future (the site has anti-scraping measures)
- Transposing can slightly shift the chord/lyric alignment when note names change length
- Requires Chrome 114 or later for the Side Panel

## Development / Tests

Pure-logic test suite (Node, no external dependencies, no real-Chrome testing):

```
npm test
```

## Versions

See [CHANGELOG.md](CHANGELOG.md) for the change history.

## License

MIT — see [LICENSE](LICENSE).

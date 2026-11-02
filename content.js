'use strict';

(function () {
  let lastSentTitle = '';

  // Selectors to try in order for the YouTube video title
  const TITLE_SELECTORS = [
    'h1.ytd-watch-metadata yt-formatted-string',
    '#title h1 yt-formatted-string',
    'ytd-watch-metadata h1',
    'h1.title.ytd-video-primary-info-renderer'
  ];

  function extractTitle() {
    for (const sel of TITLE_SELECTORS) {
      const el = document.querySelector(sel);
      if (el?.textContent?.trim()) return el.textContent.trim();
    }
    // Fallback: document.title with the "(3) " notification counter and " - YouTube" stripped
    const t = document.title.replace(/^\(\d+\)\s*/, '').replace(/ - YouTube$/, '').trim();
    return t !== 'YouTube' ? t : '';
  }

  function sendTitle(title) {
    if (!title || title === lastSentTitle) return;
    lastSentTitle = title;
    // The video id lets the panel remember the chord version picked for this video
    const videoId = new URLSearchParams(location.search).get('v') || '';
    chrome.runtime.sendMessage({ type: 'VIDEO_TITLE', title, videoId }).catch(() => {});
  }

  function tryNotify() {
    // Only the visible tab drives the panel (a background tab's autoplay must not
    // replace the song being played), and only on video pages (channel/search/home
    // titles are not songs).
    if (document.hidden || location.pathname !== '/watch') return;
    const title = extractTitle();
    if (title) sendTitle(title);
  }

  // Switching back to a tab makes its video the current one again
  // (lastSentTitle reset: another tab may have changed the panel's song meanwhile)
  document.addEventListener('visibilitychange', () => {
    lastSentTitle = '';
    tryNotify();
  });

  // YouTube is an SPA: listen for the native navigation event
  window.addEventListener('yt-navigate-finish', () => {
    // Small delay: the title DOM updates a few ms after navigation
    setTimeout(tryNotify, 1200);
  });

  // Observer on the document's <title> as a secondary fallback
  const titleTag = document.querySelector('title');
  if (titleTag) {
    new MutationObserver(() => setTimeout(tryNotify, 800))
      .observe(titleTag, { childList: true });
  }

  // First run: wait for the page to be ready
  setTimeout(tryNotify, 1500);
})();

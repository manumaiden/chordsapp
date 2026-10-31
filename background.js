'use strict';

// Opens the side panel when the action bar icon is clicked
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// Receives the title from the content script and saves it to session storage:
// the panel reads it on open and reacts live via chrome.storage.onChanged
chrome.runtime.onMessage.addListener((message) => {
  if (message.type !== 'VIDEO_TITLE') return;

  chrome.storage.session.set({ videoTitle: message.title }).catch(() => {});
});

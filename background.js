'use strict';

// Opens the side panel when the action bar icon is clicked
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// Receives the title from the content script, saves it to session storage
// and tries to notify the panel (if open)
chrome.runtime.onMessage.addListener((message) => {
  if (message.type !== 'VIDEO_TITLE') return;

  chrome.storage.session.set({ videoTitle: message.title }).catch(() => {});

  // Notify the panel — silent if it isn't open
  chrome.runtime.sendMessage({ type: 'TITLE_UPDATED', title: message.title }).catch(() => {});
});

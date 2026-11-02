'use strict';

// Opens the side panel when the action bar icon is clicked
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// Receives the title (+ video id) from the content script and saves it to session
// storage as one object: the panel reads it on open and reacts live via
// chrome.storage.onChanged (a single event carrying both fields)
chrome.runtime.onMessage.addListener((message) => {
  if (message.type !== 'VIDEO_TITLE') return;

  chrome.storage.session.set({ video: { title: message.title, id: message.videoId || '' } }).catch(() => {});
});

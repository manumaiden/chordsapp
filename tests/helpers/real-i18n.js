'use strict';
// Faithful implementation of chrome.i18n.getMessage based on the project's real
// messages.json files, to verify that $PLACEHOLDER$ substitutions work exactly
// as they do in Chrome (not just that the key exists).

const fs = require('fs');
const path = require('path');

function makeRealGetMessage(locale = 'it') {
  const messages = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', '..', '_locales', locale, 'messages.json'), 'utf8')
  );

  return function getMessage(key, subs) {
    const entry = messages[key];
    if (!entry) return '';
    let msg = entry.message;
    if (entry.placeholders) {
      for (const [name, def] of Object.entries(entry.placeholders)) {
        const idx = parseInt(def.content.replace('$', ''), 10) - 1;
        const value = Array.isArray(subs) ? subs[idx] : subs;
        msg = msg.replace(new RegExp(`\\$${name.toUpperCase()}\\$`, 'g'), value ?? '');
      }
    }
    return msg;
  };
}

module.exports = { makeRealGetMessage };

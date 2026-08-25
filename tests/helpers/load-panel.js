'use strict';
// Loads sidepanel/panel.js in Node, with minimal document/chrome/window stubs
// (no real layout engine: CSS/layout bugs instead need a browser test,
// e.g. Playwright — see CLAUDE.md). Each call returns a fresh instance
// (require cache invalidated), so state doesn't leak between tests.

const path = require('path');
const PANEL_PATH = require.resolve('../../sidepanel/panel.js');

function makeFakeElement(id, registry) {
  return {
    _classes: new Set(['hidden']),
    classList: {
      toggle(cls, force) {
        const el = registry.get(id);
        const has = force === undefined ? !el._classes.has(cls) : force;
        if (has) el._classes.add(cls); else el._classes.delete(cls);
      },
      add(cls) { registry.get(id)._classes.add(cls); },
      remove(cls) { registry.get(id)._classes.delete(cls); },
      contains(cls) { return registry.get(id)._classes.has(cls); }
    },
    dataset: {},
    setAttribute(name, value) { this[`_attr_${name}`] = value; },
    getAttribute(name) { return this[`_attr_${name}`] ?? null; },
    textContent: '', title: '', innerHTML: '', value: '', href: '', placeholder: '',
    style: {},
    appendChild() {},
    querySelector() { return null; },
    querySelectorAll() { return []; }
  };
}

/**
 * @param {object} [opts]
 * @param {(key: string, subs?: string[]) => string} [opts.getMessage] - override for
 *   chrome.i18n.getMessage; default: identity stub (returns the key).
 * @param {object} [opts.store] - pre-existing storage.local to reuse, to simulate a
 *   panel "restart" (fresh state instance, same underlying storage).
 * @returns {{ panel: object, store: object, el: (id: string) => object }}
 */
function loadPanel(opts = {}) {
  delete require.cache[PANEL_PATH];

  const registry = new Map();
  const el = (id) => {
    if (!registry.has(id)) registry.set(id, makeFakeElement(id, registry));
    return registry.get(id);
  };

  global.document = {
    addEventListener: () => {},
    getElementById: (id) => el(id),
    querySelectorAll: () => [],
    createElement: () => ({
      className: '', textContent: '', title: '', style: {}, innerHTML: '',
      appendChild() {}, addEventListener() {}, setAttribute() {},
      classList: { add() {}, remove() {}, toggle() {} }
    })
  };

  const store = opts.store || {};
  global.chrome = {
    i18n: { getMessage: opts.getMessage || ((key) => key) },
    storage: {
      local: {
        get: async (key) => ({ [key]: store[key] }),
        set: async (obj) => Object.assign(store, obj)
      },
      session: { get: async () => ({}) },
      onChanged: { addListener: () => {} }
    },
    runtime: { getManifest: () => ({ version: '0.0.0-test' }) }
  };

  const panel = require(PANEL_PATH);
  return { panel, store, el };
}

module.exports = { loadPanel };

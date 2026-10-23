import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

/**
 * Shared test setup.
 *
 * jsdom implements neither localStorage quota behaviour nor several browser
 * APIs this app touches on mount, so they are stubbed once here rather than in
 * every test file.
 */

// --- localStorage -----------------------------------------------------------
// jsdom ships a working localStorage, but it is shared between tests in a file
// and never throws on quota. Both are wrong for us: a stale store leaks between
// tests, and the quota path is exactly what we want to exercise.
class MemoryStorage {
  constructor() {
    this._map = new Map();
  }
  get length() {
    return this._map.size;
  }
  key(index) {
    return [...this._map.keys()][index] ?? null;
  }
  getItem(key) {
    return this._map.has(String(key)) ? this._map.get(String(key)) : null;
  }
  setItem(key, value) {
    this._map.set(String(key), String(value));
  }
  removeItem(key) {
    this._map.delete(String(key));
  }
  clear() {
    this._map.clear();
  }
}

Object.defineProperty(globalThis, 'localStorage', {
  value: new MemoryStorage(),
  writable: true,
  configurable: true,
});

// --- APIs the app touches on mount ----------------------------------------
if (!globalThis.matchMedia) {
  globalThis.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  });
}

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (!globalThis.IntersectionObserver) {
  globalThis.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  };
}

// Audio is used by soundEffects.js on every interaction.
if (!globalThis.Audio) {
  globalThis.Audio = class {
    constructor() {
      this.volume = 1;
      this.currentTime = 0;
    }
    play() {
      return Promise.resolve();
    }
    pause() {}
    load() {}
  };
}

// window.print is called by the export paths.
globalThis.print = vi.fn();

// Clipboard, for the "copy missing keywords" button.
if (!navigator.clipboard) {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    writable: true,
    configurable: true,
  });
}

// Canvas is not implemented in jsdom. The crop modal and PDF export both need
// it; a no-op context is enough to render without throwing.
//
// The guard must test the RESULT of getContext, not its existence: jsdom does
// define HTMLCanvasElement.prototype.getContext, it just returns null and logs
// "Not implemented". An `if (!getContext)` guard therefore never fires and the
// stub is never installed.
const makeNoopContext = () => ({
  fillRect: vi.fn(),
  clearRect: vi.fn(),
  drawImage: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  translate: vi.fn(),
  rotate: vi.fn(),
  scale: vi.fn(),
  beginPath: vi.fn(),
  closePath: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  stroke: vi.fn(),
  setTransform: vi.fn(),
  measureText: () => ({ width: 0 }),
  getImageData: () => ({ data: [] }),
  putImageData: vi.fn(),
});

// Always override: jsdom's own getContext exists but returns null.
HTMLCanvasElement.prototype.getContext = () => makeNoopContext();
HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,';

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

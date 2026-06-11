/**
 * Integration test for the full Chat Attack game page in jsdom (task 41).
 *
 * **Validates: Requirements REQ-2 §§4, 6, REQ-3 §§4, 7, 8, REQ-6 §§4, 5, REQ-7 §§2, 5**
 *
 * Loads the real markup from `sandbox/sandbox/chat-attack.html` into jsdom,
 * stubs `fetch` for both the Gemini endpoint and the leaderboard, runs the
 * `bootstrap()` from `../index.js`, and drives the page end to end:
 *
 *   (a) Game tab visible by default with aria-selected="true"      (REQ-7 §2)
 *   (b) Free Play swap preserves the Game transcript on swap-back   (REQ-7 §5)
 *   (c) clearing levels 1-3 in sequence promotes each next level    (REQ-2 §4)
 *   (d) clicking a locked level shows the locked-message, no switch (REQ-2 §6)
 *   (e) reset confirm clears storage, cancel leaves it              (REQ-3 §§7,8)
 *   (f) reload after clearing 1-3 renders level 4 as current        (REQ-3 §4)
 *   (g) clearing all 7 levels enables the leaderboard submit button (REQ-6 §§4,5)
 *
 * The DOM is rebuilt fresh and localStorage cleared in `beforeEach`; the win
 * sequence is driven through the real DOM (input value + Send click) and all
 * post-submit assertions use `vi.waitFor` because the click handler's async
 * `submitMessage` is not awaited by `dispatchEvent`.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { bootstrap } from '../index.js';
import { STORAGE_KEY } from '../game/progress-store.js';

// ---------------------------------------------------------------------------
// Load the real HTML body once.
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
// __tests__ -> chat-attack -> js -> assets -> sandbox, then into sandbox/.
const HTML_PATH = resolve(__dirname, '../../../../sandbox/chat-attack.html');

/**
 * The inner <body> markup of chat-attack.html with <script> tags stripped so
 * jsdom does not try to load config.js or the module bundle when we set
 * innerHTML (innerHTML never executes scripts, but stripping keeps the DOM
 * clean and avoids stray nodes).
 * @type {string}
 */
const BODY_HTML = (() => {
  const html = readFileSync(HTML_PATH, 'utf8');
  const match = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const body = match ? match[1] : '';
  return body.replace(/<script[\s\S]*?<\/script>/gi, '');
})();

/** The seven level secret words, in order (design.md §Level definitions). */
const SECRETS = [
  'garnet',
  'lighthouse',
  'polaris',
  'obsidian',
  'cipher-fox',
  'aurora',
  'quasar',
];

// ---------------------------------------------------------------------------
// Fetch stub state.
// ---------------------------------------------------------------------------

/** The text the next Gemini call resolves with (set per submit to win). */
let nextGeminiText = 'A perfectly harmless reply with no hint at all.';

/** The array the leaderboard GET resolves with. */
let leaderboardData = [];

/**
 * Install a routed `fetch` stub: Gemini calls resolve with a canned response
 * whose text is `nextGeminiText`, leaderboard calls resolve with
 * `leaderboardData`. jsdom has no real `fetch`/`Response`, so we return plain
 * objects exposing `ok`, `status`, `headers.get`, and an async `json()`.
 */
function installFetchStub() {
  vi.stubGlobal(
    'fetch',
    vi.fn((url) => {
      const u = String(url);
      // Game + free-play now POST to the Worker proxy at /api/gemini-pro and
      // expect the normalized { ok:true, text } shape.
      if (u.includes('/api/gemini-pro')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: { get: () => null },
          json: async () => ({ ok: true, text: nextGeminiText }),
        });
      }
      if (u.includes('leaderboard')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: { get: () => null },
          json: async () => leaderboardData,
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({}),
      });
    })
  );
}

// ---------------------------------------------------------------------------
// DOM + driving helpers.
// ---------------------------------------------------------------------------

/** Build a fresh page body from the real HTML markup. */
function buildDom() {
  document.body.innerHTML = BODY_HTML;
}

/** Query a single element. */
function $(selector) {
  return document.querySelector(selector);
}

/** Query the level-selector entry button for a 1-based level index. */
function entry(n) {
  return document.querySelector(`.level-entry[data-level="${n}"]`);
}

/**
 * Switch the active level by clicking its selector entry (only valid for a
 * cleared or current entry).
 * @param {number} n
 */
function activateLevel(n) {
  const e = entry(n);
  if (e) {
    e.click();
  }
}

/**
 * Drive a winning submission on the active level `n`: set the canned Gemini
 * response to that level's secret, type a benign message (one that passes the
 * input filter for every level), click Send, and wait until the selector marks
 * level `n` cleared.
 *
 * @param {number} n 1-based level index expected to clear.
 * @returns {Promise<void>}
 */
async function winLevel(n) {
  nextGeminiText = `Of course, the answer is ${SECRETS[n - 1]} for you.`;
  const input = document.getElementById('gameUserInput');
  input.value = 'hello there friend';
  document.getElementById('gameSendBtn').click();
  await vi.waitFor(
    () => {
      const e = entry(n);
      expect(e && e.dataset.state).toBe('cleared');
    },
    { timeout: 1000 }
  );
}

/**
 * Clear levels 1..upTo in sequence, activating each next level between wins.
 * @param {number} upTo
 */
async function clearLevels(upTo) {
  for (let n = 1; n <= upTo; n += 1) {
    if (n > 1) {
      activateLevel(n);
    }
    // eslint-disable-next-line no-await-in-loop
    await winLevel(n);
  }
}

// ---------------------------------------------------------------------------
// Suite.
// ---------------------------------------------------------------------------

describe('Chat Attack page integration (jsdom)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.AISEC_WORKER_URL = 'https://worker.test';
    nextGeminiText = 'A perfectly harmless reply with no hint at all.';
    leaderboardData = [];
    installFetchStub();
    buildDom();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete window.AISEC_WORKER_URL;
    document.body.innerHTML = '';
  });

  // (a) Game tab visible by default with aria-selected="true" (REQ-7 §2).
  it('(a) shows the Game tab selected and its panel visible by default', () => {
    bootstrap();

    const gameTab = document.getElementById('tab-game');
    const freeTab = document.getElementById('tab-freeplay');
    const gamePanel = document.getElementById('panel-game');
    const freePanel = document.getElementById('panel-freeplay');

    expect(gameTab.getAttribute('aria-selected')).toBe('true');
    expect(freeTab.getAttribute('aria-selected')).toBe('false');
    expect(gamePanel.hasAttribute('hidden')).toBe(false);
    expect(freePanel.hasAttribute('hidden')).toBe(true);
  });

  // (b) Free Play swap preserves the Game transcript on swap-back (REQ-7 §5).
  it('(b) preserves the Game transcript when swapping to Free Play and back', async () => {
    bootstrap();

    // Drive one non-winning game message so the transcript has bubbles.
    nextGeminiText = 'I am just making small talk, nothing useful here.';
    const input = document.getElementById('gameUserInput');
    input.value = 'just chatting';
    document.getElementById('gameSendBtn').click();

    const messages = document.getElementById('gameChatMessages');
    await vi.waitFor(() => {
      expect(messages.childElementCount).toBeGreaterThanOrEqual(2);
    });
    const beforeCount = messages.childElementCount;

    // Swap to Free Play.
    document.getElementById('tab-freeplay').click();
    expect(document.getElementById('panel-freeplay').hasAttribute('hidden')).toBe(false);
    expect(document.getElementById('panel-game').hasAttribute('hidden')).toBe(true);

    // Swap back to Game; the transcript must still be there (panels are hidden,
    // never unmounted).
    document.getElementById('tab-game').click();
    expect(document.getElementById('panel-game').hasAttribute('hidden')).toBe(false);
    expect(messages.childElementCount).toBe(beforeCount);
  });

  // (c) Clearing levels 1-3 in sequence promotes each next level (REQ-2 §4).
  it('(c) promotes each next level as levels 1-3 are cleared in sequence', async () => {
    bootstrap();

    // Level 1 current at start.
    expect(entry(1).dataset.state).toBe('current');

    await winLevel(1);
    // Level 1 cleared, level 2 promoted to current.
    expect(entry(1).dataset.state).toBe('cleared');
    expect(entry(2).dataset.state).toBe('current');

    activateLevel(2);
    await winLevel(2);
    expect(entry(2).dataset.state).toBe('cleared');
    expect(entry(3).dataset.state).toBe('current');

    activateLevel(3);
    await winLevel(3);
    expect(entry(3).dataset.state).toBe('cleared');
    expect(entry(4).dataset.state).toBe('current');
  });

  // (d) Clicking a locked level shows the locked-message and does not switch
  // context (REQ-2 §6).
  it('(d) shows the locked-message and does not switch context on a locked entry', () => {
    bootstrap();

    const messages = document.getElementById('gameChatMessages');
    expect(messages.childElementCount).toBe(0);

    // Level 5 is locked from a fresh start.
    const locked = entry(5);
    expect(locked.dataset.state).toBe('locked');
    locked.click();

    const lockedMsg = document.querySelector('.level-locked-msg');
    expect(lockedMsg).not.toBeNull();
    expect(lockedMsg.hidden).toBe(false);
    expect(lockedMsg.textContent.length).toBeGreaterThan(0);

    // Context unchanged: level 1 still current, no transcript created.
    expect(entry(1).dataset.state).toBe('current');
    expect(messages.childElementCount).toBe(0);
  });

  // (e) Reset progress: confirm clears the storage key; cancel leaves it
  // (REQ-3 §§7, 8).
  it('(e) reset confirm clears the storage key and a reload shows the initial state', async () => {
    bootstrap();
    await winLevel(1);
    // Sanity: progress persisted with level 1 cleared.
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)).levels[0].cleared).toBe(true);

    window.confirm = vi.fn(() => true);
    document.getElementById('resetProgressBtn').click();

    // REQ-3 §7: the storage key is cleared.
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();

    // A reload reconstructs the initial selector state from the (now empty)
    // store: level 1 current, 2-7 locked, none cleared (REQ-3 §§4, 7).
    buildDom();
    bootstrap();
    expect(entry(1).dataset.state).toBe('current');
    for (let n = 2; n <= 7; n += 1) {
      expect(entry(n).dataset.state).toBe('locked');
    }
  });

  it('(e) reset cancel leaves the storage key unchanged', async () => {
    bootstrap();
    await winLevel(1);
    const before = window.localStorage.getItem(STORAGE_KEY);
    expect(JSON.parse(before).levels[0].cleared).toBe(true);

    window.confirm = vi.fn(() => false);
    document.getElementById('resetProgressBtn').click();

    // REQ-3 §8: the key is unchanged and level 1 is still cleared.
    const after = window.localStorage.getItem(STORAGE_KEY);
    expect(after).toBe(before);
    expect(JSON.parse(after).levels[0].cleared).toBe(true);
  });

  // (f) Reload after clearing levels 1-3 reads the persisted state and renders
  // level 4 as current (REQ-3 §4).
  it('(f) renders level 4 as current after reloading with levels 1-3 cleared', async () => {
    bootstrap();
    await clearLevels(3);

    // Persisted state has levels 1-3 cleared.
    const persisted = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
    expect(persisted.levels.slice(0, 3).every((l) => l.cleared === true)).toBe(true);

    // Simulate a reload: rebuild the DOM (a fresh #panel-game has no mounted
    // flag) and bootstrap again WITHOUT clearing localStorage.
    buildDom();
    bootstrap();

    expect(entry(1).dataset.state).toBe('cleared');
    expect(entry(2).dataset.state).toBe('cleared');
    expect(entry(3).dataset.state).toBe('cleared');
    expect(entry(4).dataset.state).toBe('current');
    expect(entry(5).dataset.state).toBe('locked');
  });

  // (g) Clearing all 7 levels enables the leaderboard submit button once a
  // valid handle is entered (REQ-6 §§4, 5).
  it('(g) enables the leaderboard submit button after clearing all 7 levels', async () => {
    bootstrap();
    await clearLevels(7);

    // All seven levels recorded as cleared in the store (REQ-6 §4 gate).
    const persisted = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
    expect(persisted.levels.every((l) => l.cleared === true)).toBe(true);

    // The level-7 victory CTA is "Submit to leaderboard"; activating it opens
    // the submission form.
    const cta = await vi.waitFor(() => {
      const el = document.querySelector('.victory-cta.submit-leaderboard');
      expect(el).not.toBeNull();
      return el;
    });
    cta.click();

    const submitBtn = await vi.waitFor(() => {
      const el = document.querySelector('.leaderboard-submit');
      expect(el).not.toBeNull();
      return el;
    });

    // REQ-6 §5: still disabled until a valid handle is typed.
    expect(submitBtn.disabled).toBe(true);

    const handleInput = document.getElementById('leaderboard-handle');
    handleInput.value = 'winner_7';
    handleInput.dispatchEvent(new Event('input'));

    // REQ-6 §4: with all levels cleared and a valid handle, submit is enabled.
    expect(submitBtn.disabled).toBe(false);
  });
});

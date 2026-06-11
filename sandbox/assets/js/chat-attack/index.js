/**
 * Bootstrap for the Chat Attack game tab (REQ-7 §§1-6).
 *
 * Wires together the shared and game modules into the two-tab Chat Attack
 * experience: the ARIA tab strip, the progress store, the level engine, the
 * level selector, the game chat input, the victory view, and the leaderboard
 * view. The "Free Play" tab's legacy logic is loaded lazily via a dynamic
 * import of `./free-play/chat.js` (created in task 28) so this bootstrap loads
 * and runs even before that module lands, and a failed import is caught.
 *
 * The module is intentionally harmless on pages without the new markup: every
 * DOM lookup is guarded, and if `#tablist` or `#panel-game` is absent the
 * bootstrap does nothing (logging a single console.info when the game panel is
 * missing). It auto-runs on `DOMContentLoaded` in a browser and is also
 * exported so the integration test (task 41) can build the DOM and call
 * `bootstrap()` directly. The wiring is idempotent: a `data-aisec-mounted`
 * flag on `#panel-game` guards against double-mounting.
 *
 * @module chat-attack/index
 */

import { mountTabs } from './shared/tabs.js';
import { createGeminiClient } from './shared/api-client.js';
import { createProgressStore } from './game/progress-store.js';
import { createLevelEngine } from './game/level-engine.js';
import { LEVELS } from './game/levels.js';
import { mountLevelSelector } from './game/level-selector.js';
import { mountVictoryView } from './game/victory-view.js';
import { mountLeaderboardView } from './game/leaderboard-view.js';

/** Marker attribute set on `#panel-game` once wiring completes (idempotency). */
const MOUNTED_FLAG = 'aisecMounted';

/**
 * Append a chat message bubble to the game transcript, mirroring the legacy
 * chat-attack markup (`<div class="message user-message|ai-message">` with a
 * `<strong>` sender and a `<p>` body) so the existing CSS applies. Defensive:
 * a missing container is a no-op.
 *
 * @param {HTMLElement|null} container - The `#gameChatMessages` element.
 * @param {'user' | 'assistant' | 'system'} role - Message author.
 * @param {string} text - Message body.
 * @returns {void}
 */
function appendMessage(container, role, text) {
  if (!container || typeof container.appendChild !== 'function') {
    return;
  }
  const wrapper = document.createElement('div');
  const cssRole = role === 'user' ? 'user-message' : 'ai-message';
  wrapper.className = `message ${cssRole}`;

  const sender = document.createElement('strong');
  sender.className = 'message-sender';
  sender.textContent =
    role === 'user' ? 'You' : role === 'system' ? 'System' : 'Assistant';

  const body = document.createElement('p');
  body.className = 'message-body';
  body.textContent = text == null ? '' : String(text);

  wrapper.append(sender, body);
  container.appendChild(wrapper);

  // Keep the latest message in view.
  if (typeof container.scrollTo === 'function') {
    container.scrollTo({ top: container.scrollHeight });
  } else {
    container.scrollTop = container.scrollHeight;
  }
}

/**
 * Wire the game chat input: the send button click and the Enter keypress in
 * the input both submit the current message. The user message is appended
 * locally, the input cleared, and `engine.submitMessage(text)` is awaited
 * inside a try/catch so a missing API key or network error surfaces a friendly
 * system message instead of crashing.
 *
 * @param {Object} ctx
 * @param {ReturnType<typeof createLevelEngine>} ctx.engine
 * @param {HTMLElement|null} ctx.messages - `#gameChatMessages`.
 * @param {HTMLInputElement|HTMLTextAreaElement|null} ctx.input - `#gameUserInput`.
 * @param {HTMLButtonElement|null} ctx.sendBtn - `#gameSendBtn`.
 * @returns {void}
 */
function wireGameChat({ engine, messages, input, sendBtn }) {
  /** Submit the current input value. */
  async function submit() {
    if (!input) {
      return;
    }
    const text = String(input.value || '').trim();
    if (text.length === 0) {
      return;
    }
    input.value = '';
    appendMessage(messages, 'user', text);
    try {
      await engine.submitMessage(text);
    } catch (err) {
      // A missing GEMINI_API_KEY or a network error must not crash the page.
      // eslint-disable-next-line no-console
      console.warn('[chat-attack] message submission failed', err);
      appendMessage(
        messages,
        'system',
        'Something went wrong reaching the model. Check the API key configuration and try again.'
      );
    }
  }

  if (sendBtn && typeof sendBtn.addEventListener === 'function') {
    sendBtn.addEventListener('click', () => {
      submit();
    });
  }
  if (input && typeof input.addEventListener === 'function') {
    input.addEventListener('keydown', (event) => {
      // Enter submits; Shift+Enter inserts a newline (for textarea inputs).
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        submit();
      }
    });
  }

  // The engine appends user messages to its transcript itself; here we only
  // render assistant/system messages it reports back (REQ-7 wiring step 7).
  engine.on('messageReceived', (payload) => {
    if (!payload) {
      return;
    }
    const role = payload.role === 'assistant' ? 'assistant' : 'system';
    appendMessage(messages, role, payload.content);
  });

  // A level switch resets the transcript, so clear the rendered messages too.
  engine.on('levelChanged', () => {
    if (messages) {
      messages.textContent = '';
    }
  });
}

/**
 * Wire and mount the Chat Attack game experience.
 *
 * Safe to call multiple times: if `#panel-game` is already flagged as mounted,
 * the call is a no-op. If the required markup (`#tablist` or `#panel-game`) is
 * absent, the function returns without side effects so the module stays inert
 * on pages without the new structure.
 *
 * @returns {void}
 */
export function bootstrap() {
  if (typeof document === 'undefined') {
    return;
  }

  const tablist = document.getElementById('tablist');
  const gamePanel = document.getElementById('panel-game');

  if (!tablist) {
    // No tab strip on this page; nothing to wire.
    return;
  }
  if (!gamePanel) {
    // eslint-disable-next-line no-console
    console.info('[chat-attack] game panel (#panel-game) not found, skipping bootstrap');
    return;
  }

  // Idempotency guard so calling bootstrap twice (auto-run + test) is safe.
  if (gamePanel.dataset && gamePanel.dataset[MOUNTED_FLAG] === 'true') {
    return;
  }
  if (gamePanel.dataset) {
    gamePanel.dataset[MOUNTED_FLAG] = 'true';
  }

  // 1. Progress store + initial record.
  const progressStore = createProgressStore({});
  const progress = progressStore.load();

  // 2. Gemini client (reads window.GEMINI_API_KEY at call time).
  const geminiClient = createGeminiClient({});

  // 3. Engine.
  const engine = createLevelEngine({ progressStore, levels: LEVELS, geminiClient });
  engine.init(progress);

  // 4. Tabs over #tablist and the two panels.
  const freePanel = document.getElementById('panel-freeplay');
  const tabs = mountTabs({ tablist, panels: [gamePanel, freePanel] });

  // 5. Level selector inside #panel-game .level-selector-host.
  const selectorHost = gamePanel.querySelector('.level-selector-host');
  const disclaimerHost = gamePanel.querySelector('.level-disclaimer-host');
  if (selectorHost) {
    mountLevelSelector({
      root: selectorHost,
      engine,
      progress,
      disclaimerHost: disclaimerHost || undefined,
    });
  }

  // 6. Leaderboard first (so the victory CTA can call showSubmitForm), then
  //    the victory view.
  const leaderboard = mountLeaderboardView({
    root: document.getElementById('leaderboardHost'),
    progressStore,
  });
  mountVictoryView({
    root: document.getElementById('victoryView'),
    engine,
    onSubmitLeaderboard: () => {
      // The leaderboard host lives under #panel-game, so make sure the Game
      // tab (index 0) is active before revealing the submit form.
      if (tabs && typeof tabs.activate === 'function') {
        tabs.activate(0);
      }
      leaderboard.showSubmitForm();
    },
  });

  // 7. Wire the game chat input.
  wireGameChat({
    engine,
    messages: document.getElementById('gameChatMessages'),
    input: document.getElementById('gameUserInput'),
    sendBtn: document.getElementById('gameSendBtn'),
  });

  // 8. Reset progress control (REQ-3 §§7-8).
  const resetBtn = document.getElementById('resetProgressBtn');
  if (resetBtn && typeof resetBtn.addEventListener === 'function') {
    resetBtn.addEventListener('click', () => {
      const confirmed =
        typeof window !== 'undefined' && typeof window.confirm === 'function'
          ? window.confirm('Reset all level progress? This cannot be undone.')
          : false;
      if (confirmed) {
        // The selector re-renders via the engine's levelChanged event.
        engine.reset();
      }
    });
  }

  // 9. Load the leaderboard list.
  leaderboard.load();

  // 10. Free Play: lazily mount the legacy chat logic. The import is dynamic so
  //     this bootstrap loads even before task 28 lands, and a failed import is
  //     caught gracefully.
  if (freePanel) {
    import('./free-play/chat.js')
      .then((mod) => {
        if (mod && typeof mod.mountFreePlay === 'function') {
          mod.mountFreePlay({ root: freePanel });
        }
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.warn('[chat-attack] free-play module not available yet', err);
      });
  }
}

// Auto-run on a real page load. In Node (no document) this is skipped, so the
// integration test can import the named `bootstrap` and call it itself.
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
  } else {
    bootstrap();
  }
}

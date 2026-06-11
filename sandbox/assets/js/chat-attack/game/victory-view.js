/**
 * Victory_View for the Chat Attack game tab.
 *
 * Renders the per-level victory state in a modal dialog: the revealed secret
 * word, the player message that triggered the clear (truncated to 500 chars),
 * and the model response that contained the secret (truncated to 1000 chars),
 * plus a call-to-action that advances to the next level (levels 1-6) or opens
 * the leaderboard submission flow (level 7).
 *
 * Behavior contract (REQ-4 §§1-7, REQ-9 §6):
 *   - Uses a native `<dialog>` with `showModal()` when supported (which traps
 *     focus and handles Escape natively); otherwise falls back to a
 *     `<div role="dialog" aria-modal="true">` with a manual focus trap from
 *     `shared/a11y.js`.
 *   - On `engine.on('levelCleared')` the dialog is populated and opened.
 *   - The player message is truncated to 500 chars and the model response to
 *     1000 chars, each with a visible `…` indicator when truncation occurs
 *     (REQ-4 §1).
 *   - Levels 1-6 render a "Next level →" CTA; level 7 renders a
 *     "Submit to leaderboard →" CTA (REQ-4 §§4, 5).
 *   - Keyboard focus moves to the CTA on open and the close control / Escape
 *     closes the dialog and returns focus to the chat input (REQ-4 §§6, 7).
 *   - A visually-hidden `aria-live="polite"` span is populated synchronously on
 *     open announcing the cleared level and secret (REQ-9 §6).
 *
 * The module performs no DOM access at import time, so it is safe to import in
 * Node/test environments without a document. All DOM operations are guarded.
 *
 * @module chat-attack/game/victory-view
 */

import { prefersReducedMotion, createFocusTrap, announce } from '../shared/a11y.js';

/** Max characters shown for the player message before truncation (REQ-4 §1). */
const USER_MESSAGE_MAX = 500;

/** Max characters shown for the model response before truncation (REQ-4 §1). */
const MODEL_RESPONSE_MAX = 1000;

/** The highest level index that gets a "Next level" CTA (REQ-4 §4). */
const MAX_NEXT_LEVEL_INDEX = 6;

/**
 * Truncate `text` to `max` characters, appending a `…` indicator when the
 * original is longer (REQ-4 §1). Non-string input is coerced to an empty
 * string.
 *
 * @param {unknown} text
 * @param {number} max
 * @returns {string}
 */
function truncate(text, max) {
  const str = typeof text === 'string' ? text : text == null ? '' : String(text);
  if (str.length <= max) {
    return str;
  }
  return str.slice(0, max) + '…';
}

/**
 * Whether the current environment supports the native modal `<dialog>`.
 * @returns {boolean}
 */
function supportsDialog() {
  return (
    typeof HTMLDialogElement !== 'undefined' &&
    'showModal' in HTMLDialogElement.prototype
  );
}

/**
 * Resolve the chat input element to return focus to on close (REQ-4 §6).
 * Prefers the game-mode input id, falling back to the legacy id. Returns
 * null when neither exists.
 *
 * @returns {HTMLElement|null}
 */
function findChatInput() {
  if (typeof document === 'undefined') {
    return null;
  }
  return (
    document.getElementById('gameUserInput') ||
    document.getElementById('userInput') ||
    null
  );
}

/**
 * Mount the Victory_View.
 *
 * @param {Object} opts
 * @param {Element|null} [opts.root]
 *   Host element. If it is already a `<dialog>` it is reused; if it is a
 *   container element a `<dialog>` is created inside it; if omitted, a
 *   `<dialog>` is created and appended to `document.body`.
 * @param {{ on: (event: string, handler: Function) => void, setActiveLevel: (index: number) => void }} opts.engine
 *   The Level_Engine. The view subscribes to `levelCleared` and advances via
 *   `setActiveLevel` for levels 1-6.
 * @param {() => void} [opts.onSubmitLeaderboard]
 *   Called when the level 7 "Submit to leaderboard" CTA is activated.
 * @returns {{ open: (payload: any) => void, close: () => void, destroy: () => void }}
 */
export function mountVictoryView({ root, engine, onSubmitLeaderboard } = {}) {
  // No DOM available (Node/tests importing without jsdom): return inert API.
  if (typeof document === 'undefined') {
    return { open() {}, close() {}, destroy() {} };
  }

  const useDialog = supportsDialog();

  // Resolve / create the host element.
  /** @type {HTMLElement} */
  let host;
  if (root && typeof root.tagName === 'string' && root.tagName.toLowerCase() === 'dialog') {
    host = /** @type {HTMLElement} */ (root);
  } else {
    host = document.createElement(useDialog ? 'dialog' : 'div');
    if (root && typeof root.appendChild === 'function') {
      root.appendChild(host);
    } else if (document.body) {
      document.body.appendChild(host);
    }
  }

  host.classList.add('victory-view');
  if (!useDialog) {
    // Fallback: emulate the dialog semantics.
    host.setAttribute('role', 'dialog');
    host.setAttribute('aria-modal', 'true');
    host.hidden = true;
  }

  // Build the inner structure once.
  host.innerHTML = '';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'victory-close';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.textContent = '×';

  const title = document.createElement('h2');
  title.className = 'victory-title';

  const liveRegion = document.createElement('span');
  liveRegion.className = 'visually-hidden';
  liveRegion.setAttribute('aria-live', 'polite');

  const secretSection = document.createElement('p');
  secretSection.className = 'victory-secret';
  const secretValue = document.createElement('span');
  secretValue.className = 'victory-secret-value';
  secretSection.append('The secret was: ', secretValue);

  const userSection = document.createElement('div');
  userSection.className = 'victory-user';
  const userLabel = document.createElement('p');
  userLabel.className = 'victory-label';
  userLabel.textContent = 'Your prompt:';
  const userBody = document.createElement('p');
  userBody.className = 'victory-user-message';
  userSection.append(userLabel, userBody);

  const modelSection = document.createElement('div');
  modelSection.className = 'victory-model';
  const modelLabel = document.createElement('p');
  modelLabel.className = 'victory-label';
  modelLabel.textContent = 'The model said:';
  const modelBody = document.createElement('p');
  modelBody.className = 'victory-model-response';
  modelSection.append(modelLabel, modelBody);

  const ctaContainer = document.createElement('div');
  ctaContainer.className = 'victory-cta-container';

  host.append(
    closeBtn,
    title,
    liveRegion,
    secretSection,
    userSection,
    modelSection,
    ctaContainer
  );

  // Manual focus trap for the non-dialog fallback only.
  const focusTrap = useDialog ? null : createFocusTrap(host);

  /** Element focused before the view opened, to restore on close. */
  let returnFocusEl = null;
  let isOpen = false;

  /**
   * Move keyboard focus to the CTA button (REQ-4 §7). Called on the next
   * frame so the dialog is laid out and focusable.
   * @param {HTMLElement} cta
   */
  function focusCta(cta) {
    if (!cta || typeof cta.focus !== 'function') {
      return;
    }
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => {
        try {
          cta.focus();
        } catch (_err) {
          /* ignore */
        }
      });
    } else {
      try {
        cta.focus();
      } catch (_err) {
        /* ignore */
      }
    }
  }

  /**
   * Populate the dialog from a `levelCleared` payload and open it.
   * @param {{ index: number, secretWord: string, userMessage: string, modelResponse: string, displayResponse?: string }} payload
   */
  function open(payload) {
    if (!payload) {
      return;
    }
    const index = payload.index;
    const secretWord = payload.secretWord == null ? '' : String(payload.secretWord);

    title.textContent = `Level ${index} cleared`;
    secretValue.textContent = secretWord;
    userBody.textContent = truncate(payload.userMessage, USER_MESSAGE_MAX);
    // REQ-4 §1: the model response that contained the secret is the raw,
    // pre-redaction response.
    modelBody.textContent = truncate(payload.modelResponse, MODEL_RESPONSE_MAX);

    // Reduced-motion: tag the host so CSS can disable the celebration
    // animation (REQ-4 §3, REQ-9 §5). The CTA is never gated on animation.
    if (prefersReducedMotion()) {
      host.classList.add('reduced-motion');
    } else {
      host.classList.remove('reduced-motion');
    }

    // Build the CTA fresh each open so the label/handler match the level.
    ctaContainer.innerHTML = '';
    const cta = document.createElement('button');
    cta.type = 'button';
    if (typeof index === 'number' && index <= MAX_NEXT_LEVEL_INDEX) {
      cta.className = 'victory-cta next-level';
      cta.textContent = 'Next level →';
      cta.addEventListener('click', () => {
        close();
        if (engine && typeof engine.setActiveLevel === 'function') {
          engine.setActiveLevel(index + 1);
        }
      });
    } else {
      cta.className = 'victory-cta submit-leaderboard';
      cta.textContent = 'Submit to leaderboard →';
      cta.addEventListener('click', () => {
        close();
        if (typeof onSubmitLeaderboard === 'function') {
          onSubmitLeaderboard();
        }
      });
    }
    ctaContainer.appendChild(cta);

    // REQ-9 §6: populate the visually-hidden live region synchronously on open.
    const announcement = `Level ${index} cleared, secret was ${secretWord}`;
    liveRegion.textContent = announcement;
    // Backup announcement via the shared singleton live region.
    announce(announcement);

    // Record where to return focus on close (REQ-4 §6).
    returnFocusEl =
      (document.activeElement && document.activeElement !== document.body
        ? document.activeElement
        : null) || findChatInput();

    // Open the dialog.
    if (useDialog && typeof host.showModal === 'function') {
      if (!host.open) {
        try {
          host.showModal();
        } catch (_err) {
          host.setAttribute('open', '');
        }
      }
    } else {
      host.hidden = false;
      host.setAttribute('open', '');
      if (focusTrap) {
        focusTrap.activate();
      }
    }

    isOpen = true;
    focusCta(cta);
  }

  /**
   * Close the view and return focus to the chat input (REQ-4 §6).
   * @returns {void}
   */
  function close() {
    if (!isOpen) {
      return;
    }
    isOpen = false;

    if (useDialog && typeof host.close === 'function') {
      if (host.open) {
        try {
          host.close();
        } catch (_err) {
          host.removeAttribute('open');
        }
      }
    } else {
      host.hidden = true;
      host.removeAttribute('open');
      if (focusTrap) {
        focusTrap.deactivate();
      }
    }

    // Return focus to the chat input (or the element focused before open).
    const target =
      (returnFocusEl &&
      typeof returnFocusEl.focus === 'function' &&
      (typeof returnFocusEl.isConnected !== 'boolean' || returnFocusEl.isConnected)
        ? returnFocusEl
        : null) || findChatInput();
    if (target && typeof target.focus === 'function') {
      try {
        target.focus();
      } catch (_err) {
        /* ignore */
      }
    }
    returnFocusEl = null;
  }

  // Close on the close-X button.
  closeBtn.addEventListener('click', () => close());

  // Escape handling. Native <dialog> fires a 'cancel' event on Escape and
  // closes itself; we hook 'close' to run our focus-return logic. The
  // fallback needs an explicit keydown listener.
  /** @param {KeyboardEvent} event */
  function onKeydown(event) {
    if (event.key === 'Escape' && isOpen) {
      event.preventDefault();
      close();
    }
  }

  if (useDialog) {
    // When the dialog is closed by any means (Escape, form, programmatic),
    // ensure our focus-return runs exactly once.
    host.addEventListener('cancel', (event) => {
      event.preventDefault();
      close();
    });
  } else {
    host.addEventListener('keydown', onKeydown);
  }

  // Subscribe to engine clears.
  if (engine && typeof engine.on === 'function') {
    engine.on('levelCleared', open);
  }

  /**
   * Tear down listeners and remove the host from the DOM.
   * @returns {void}
   */
  function destroy() {
    if (isOpen) {
      close();
    }
    if (!useDialog) {
      host.removeEventListener('keydown', onKeydown);
    }
    if (host && typeof host.remove === 'function') {
      host.remove();
    }
  }

  return { open, close, destroy };
}

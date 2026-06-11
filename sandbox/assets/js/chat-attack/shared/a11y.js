/**
 * Accessibility helpers for the Chat Attack game.
 *
 * Provides three small, framework-free utilities used by the Victory_View
 * (focus trap + live announcements, REQ-4 §§3, 7) and the reduced-motion
 * checks elsewhere (REQ-9 §§5, 6):
 *
 *   - `prefersReducedMotion()` — reads the user's motion preference.
 *   - `createFocusTrap(rootEl)` — traps Tab focus within an element.
 *   - `announce(text)` — pushes a message to a singleton polite live region.
 *
 * All functions are defensive against a missing DOM/`window` so the module is
 * safe to import in Node/test environments without a document.
 */

/**
 * CSS selector matching the elements considered focusable for the focus trap.
 * Excludes disabled controls and elements explicitly removed from the tab order
 * (`tabindex="-1"`).
 * @type {string}
 */
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), ' +
  'input:not([disabled]), select:not([disabled]), ' +
  '[tabindex]:not([tabindex="-1"])';

/**
 * Whether the user has requested reduced motion via the OS/browser.
 *
 * Reads `(prefers-reduced-motion: reduce)` live each call so it reflects the
 * current preference. Returns `false` when `window`/`matchMedia` are absent.
 *
 * @returns {boolean} `true` if reduced motion is preferred.
 */
export function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Create a keyboard focus trap scoped to `rootEl`.
 *
 * `activate()` records the currently-focused element, then installs a `keydown`
 * listener on `rootEl` that keeps Tab/Shift+Tab focus cycling within the
 * focusable descendants of `rootEl`. Focusable descendants are recomputed on
 * every Tab press so dynamically added/removed nodes are handled. If there are
 * no focusable descendants, Tab is swallowed so focus cannot escape the trap.
 *
 * `deactivate()` removes the listener and restores focus to the element that
 * was focused before the trap was activated (when it is still connected).
 *
 * Returns inert no-ops when `rootEl` is missing.
 *
 * @param {Element|null|undefined} rootEl - The element to trap focus within.
 * @returns {{ activate: () => void, deactivate: () => void }}
 */
export function createFocusTrap(rootEl) {
  if (!rootEl || typeof rootEl.addEventListener !== 'function') {
    return { activate() {}, deactivate() {} };
  }

  /** @type {Element|null} */
  let previouslyFocused = null;

  /**
   * @param {KeyboardEvent} event
   */
  function onKeydown(event) {
    if (event.key !== 'Tab') {
      return;
    }

    const focusable = Array.prototype.slice.call(
      rootEl.querySelectorAll(FOCUSABLE_SELECTOR)
    );

    // No focusable elements: keep focus locked inside the trap.
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active =
      typeof document !== 'undefined' ? document.activeElement : null;

    if (event.shiftKey) {
      // Shift+Tab on the first element wraps to the last.
      if (active === first || !rootEl.contains(active)) {
        event.preventDefault();
        last.focus();
      }
    } else if (active === last || !rootEl.contains(active)) {
      // Tab on the last element wraps to the first.
      event.preventDefault();
      first.focus();
    }
  }

  return {
    activate() {
      previouslyFocused =
        typeof document !== 'undefined' ? document.activeElement : null;
      rootEl.addEventListener('keydown', onKeydown);
    },
    deactivate() {
      rootEl.removeEventListener('keydown', onKeydown);
      if (
        previouslyFocused &&
        typeof previouslyFocused.focus === 'function' &&
        (typeof previouslyFocused.isConnected !== 'boolean' ||
          previouslyFocused.isConnected)
      ) {
        previouslyFocused.focus();
      }
      previouslyFocused = null;
    },
  };
}

/**
 * Visually-hidden inline styles for the live region. Keeps the announcement
 * available to assistive tech while removing it from the visual layout.
 * @type {string}
 */
const VISUALLY_HIDDEN_STYLE =
  'position:absolute;width:1px;height:1px;overflow:hidden;' +
  'clip:rect(0 0 0 0);white-space:nowrap;border:0;padding:0;margin:-1px;';

/** ID of the singleton polite live region (REQ-9 §6 host). */
const LIVE_REGION_ID = 'aisec-live';

/**
 * Announce `text` to assistive technologies via a singleton polite live region.
 *
 * Finds or creates a visually-hidden `<div id="aisec-live" aria-live="polite"
 * aria-atomic="true">` mounted on `document.body`. The text is cleared then set
 * on a short timer so repeated identical announcements are re-read.
 *
 * No-ops when `document` is unavailable (Node/tests).
 *
 * @param {string} text - The message to announce.
 * @returns {void}
 */
export function announce(text) {
  if (typeof document === 'undefined' || !document.body) {
    return;
  }

  let region = document.getElementById(LIVE_REGION_ID);
  if (!region) {
    region = document.createElement('div');
    region.id = LIVE_REGION_ID;
    region.setAttribute('aria-live', 'polite');
    region.setAttribute('aria-atomic', 'true');
    region.setAttribute('style', VISUALLY_HIDDEN_STYLE);
    document.body.appendChild(region);
  }

  // Clear then set so repeated identical messages are announced again.
  region.textContent = '';
  const message = String(text == null ? '' : text);
  setTimeout(() => {
    region.textContent = message;
  }, 50);
}

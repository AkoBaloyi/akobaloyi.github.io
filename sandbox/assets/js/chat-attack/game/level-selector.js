/**
 * Level_Selector view for the Chat Attack game tab.
 *
 * Renders a strip of seven `<button class="level-entry">` step indicators,
 * one per level, each in exactly one of three mutually exclusive visual
 * states: cleared, current, locked (REQ-2 §§1-2). State is conveyed through
 * three perceptual channels so it never relies on color alone (REQ-2 §2):
 *   1. a `data-state` attribute that drives the border color via CSS (task 32),
 *   2. a state icon glyph (cleared the check, current the star, locked the lock),
 *   3. a visible text state label ("Cleared" / "Current" / "Locked").
 *
 * Interaction (REQ-2 §§5-6, REQ-9 §§3-4):
 *   - Clicking or activating a cleared or current entry calls
 *     `engine.setActiveLevel(N)`.
 *   - Clicking or activating a locked entry shows an inline locked-message in
 *     a `role="status"` live region and keeps focus on the activated button;
 *     it does not switch the active level.
 *
 * Keyboard model (REQ-2 §7, REQ-9 §§1-2):
 *   - Every entry has `tabindex="0"`, including locked entries, so Tab and
 *     Shift+Tab traverse the entries in DOM order with no roving tabindex and
 *     no focus trap. Enter and Space activate the focused entry.
 *   - The current entry carries `aria-current="step"` and locked entries carry
 *     `aria-disabled="true"`; each entry's accessible name exposes its level
 *     index and state to assistive technology (REQ-2 §7, REQ-9 §1).
 *
 * The Level 7 honest-copy disclaimer (REQ-11 §4) is always rendered into the
 * DOM adjacent to the selector; CSS (task 32) gates its visibility on
 * `(min-width: 1280px) and (min-height: 720px)` via the `.level-disclaimer`
 * class, so it is present for assistive tech but only shown where there is room.
 *
 * The module performs no DOM access at import time; it touches the DOM only
 * when `mountLevelSelector` is called. The integration test (task 41) mounts
 * it in jsdom.
 *
 * @module chat-attack/game/level-selector
 */

import { LEVELS, LEVEL_7_DISCLAIMER } from './levels.js';

/**
 * The message shown when a player activates a locked entry (REQ-2 §6).
 * @type {string}
 */
export const LOCKED_MESSAGE = 'Clear the earlier levels first.';

/**
 * Per-state presentation: the icon glyph and the visible text label that
 * accompany the `data-state` attribute as the second and third perceptual
 * channels (REQ-2 §2). Glyphs are decorative (`aria-hidden`); the textual
 * state is what assistive tech reads, both inline and in the accessible name.
 * @type {Record<'cleared' | 'current' | 'locked', { icon: string, label: string }>}
 */
const STATE_PRESENTATION = {
  cleared: { icon: '\u2713', label: 'Cleared' }, // check mark
  current: { icon: '\u2605', label: 'Current' }, // black star
  locked: { icon: '\uD83D\uDD12', label: 'Locked' }, // lock
};

/**
 * Compute the lowest-indexed (1-based) not-yet-cleared level, or the last
 * level when every level is cleared (REQ-2 §3 mapping).
 *
 * @param {boolean[]} cleared - Per-level cleared flags, indexed 0-based.
 * @param {number} levelCount
 * @returns {number} 1-based current level index.
 */
function deriveCurrentIndex(cleared, levelCount) {
  for (let i = 0; i < levelCount; i += 1) {
    if (cleared[i] !== true) {
      return i + 1;
    }
  }
  return levelCount;
}

/**
 * Derive the visual state for the level at the given 1-based index.
 *
 * A level is reachable when it is cleared OR its index is at most the current
 * index; any higher, still-uncleared level is locked (REQ-2 §3).
 *
 * @param {number} index - 1-based level index.
 * @param {boolean[]} cleared - Per-level cleared flags, indexed 0-based.
 * @param {number} currentIndex - 1-based current level index.
 * @returns {'cleared' | 'current' | 'locked'}
 */
function deriveState(index, cleared, currentIndex) {
  if (cleared[index - 1] === true) {
    return 'cleared';
  }
  if (index === currentIndex) {
    return 'current';
  }
  // Reachable (index <= currentIndex) but uncleared cannot happen given a
  // monotonic unlock, so anything not cleared and not current is locked.
  return 'locked';
}

/**
 * Mount the Level_Selector into `root`.
 *
 * @param {Object} options
 * @param {HTMLElement} options.root - Container the selector renders into.
 * @param {{
 *   setActiveLevel: (index: number) => void,
 *   on: (event: string, handler: Function) => void
 * }} options.engine - The Level_Engine. The selector calls `setActiveLevel`
 *   for reachable entries and subscribes to `levelCleared` and `levelChanged`
 *   to re-render.
 * @param {{ levels: { cleared: boolean }[] }} [options.progress] - Initial
 *   ProgressRecord used to seed the cleared flags for the first render. The
 *   selector recomputes state from engine events afterwards.
 * @param {HTMLElement} [options.disclaimerHost] - Optional element to render
 *   the Level 7 disclaimer into. Defaults to appending it to `root`.
 * @param {ReadonlyArray<import('./levels.js').LevelDef>} [options.levels] -
 *   The level table. Defaults to `LEVELS`.
 * @returns {{ render: () => void, destroy: () => void }}
 */
export function mountLevelSelector({
  root,
  engine,
  progress,
  disclaimerHost,
  levels = LEVELS,
} = {}) {
  if (!root || typeof root.appendChild !== 'function') {
    throw new Error('[chat-attack] mountLevelSelector requires a root element');
  }
  if (!engine || typeof engine.setActiveLevel !== 'function') {
    throw new Error('[chat-attack] mountLevelSelector requires an engine');
  }

  const levelCount = levels.length;

  /**
   * Local mirror of per-level cleared flags, seeded from `progress` and kept
   * in sync via engine events. Indexed 0-based.
   * @type {boolean[]}
   */
  const cleared = new Array(levelCount).fill(false);
  if (progress && Array.isArray(progress.levels)) {
    for (let i = 0; i < levelCount; i += 1) {
      cleared[i] = !!(progress.levels[i] && progress.levels[i].cleared === true);
    }
  }

  /** 1-based current level index, recomputed on cleared transitions. */
  let currentIndex = deriveCurrentIndex(cleared, levelCount);

  /**
   * The inline locked-message live region. Created once on mount and reused
   * across renders so its `role="status"` association is stable (REQ-2 §6).
   * @type {HTMLElement | null}
   */
  let lockedMsgEl = null;

  /**
   * The list element holding the seven entries. Rebuilt on every render.
   * @type {HTMLElement | null}
   */
  let listEl = null;

  /**
   * Activate the entry for the given 1-based level index. Reachable entries
   * switch the active level; locked entries show the locked-message and keep
   * focus on the button (REQ-2 §§5-6, REQ-9 §§3-4).
   *
   * @param {number} index
   * @param {HTMLButtonElement} button
   * @returns {void}
   */
  function activate(index, button) {
    const state = deriveState(index, cleared, currentIndex);
    if (state === 'locked') {
      showLockedMessage();
      // Keep focus on the activated locked entry (REQ-9 §4).
      if (typeof button.focus === 'function') {
        button.focus();
      }
      return;
    }
    // Reachable entry: clear any visible locked-message and switch levels.
    hideLockedMessage();
    engine.setActiveLevel(index);
  }

  /**
   * Show the inline locked-message (REQ-2 §6). It stays visible until another
   * entry is activated.
   * @returns {void}
   */
  function showLockedMessage() {
    if (lockedMsgEl) {
      lockedMsgEl.textContent = LOCKED_MESSAGE;
      lockedMsgEl.hidden = false;
    }
  }

  /**
   * Hide and clear the inline locked-message.
   * @returns {void}
   */
  function hideLockedMessage() {
    if (lockedMsgEl) {
      lockedMsgEl.textContent = '';
      lockedMsgEl.hidden = true;
    }
  }

  /**
   * Build a single level entry button for the given level definition.
   *
   * @param {import('./levels.js').LevelDef} level
   * @returns {HTMLButtonElement}
   */
  function buildEntry(level) {
    const index = level.index;
    const state = deriveState(index, cleared, currentIndex);
    const presentation = STATE_PRESENTATION[state];

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'level-entry';
    button.dataset.level = String(index);
    button.dataset.state = state;
    // DOM-order Tab traversal, no roving tabindex: every entry is tabbable,
    // including locked ones so Enter/Space can surface the locked-message
    // (REQ-9 §§2, 4).
    button.tabIndex = 0;

    if (state === 'current') {
      button.setAttribute('aria-current', 'step');
    }
    if (state === 'locked') {
      button.setAttribute('aria-disabled', 'true');
    }
    // Accessible name carries level index + state (REQ-2 §7).
    button.setAttribute('aria-label', `Level ${index}, ${presentation.label.toLowerCase()}`);

    // Channel 2: decorative state icon glyph.
    const icon = document.createElement('span');
    icon.className = 'level-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = presentation.icon;
    button.appendChild(icon);

    // Visible level number.
    const number = document.createElement('span');
    number.className = 'level-number';
    number.textContent = `Level ${index}`;
    button.appendChild(number);

    // Channel 3: visible text state label.
    const stateLabel = document.createElement('span');
    stateLabel.className = 'level-state-label';
    stateLabel.textContent = presentation.label;
    button.appendChild(stateLabel);

    button.addEventListener('click', () => activate(index, button));
    button.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
        // Prevent Space from scrolling the page; Tab/Shift+Tab are left to
        // native DOM-order traversal (REQ-9 §2).
        event.preventDefault();
        activate(index, button);
      }
    });

    return button;
  }

  /**
   * Render (or re-render) the full selector into `root`.
   * @returns {void}
   */
  function render() {
    currentIndex = deriveCurrentIndex(cleared, levelCount);

    // Preserve whether the locked-message was visible across re-renders.
    const wasLockedVisible = !!(lockedMsgEl && lockedMsgEl.hidden === false);

    root.textContent = '';

    listEl = document.createElement('div');
    listEl.className = 'level-selector';
    listEl.setAttribute('role', 'group');
    listEl.setAttribute('aria-label', 'Level selector');

    for (const level of levels) {
      const entry = buildEntry(level);
      listEl.appendChild(entry);

      // Render the Level 7 disclaimer adjacent to level 7's entry unless a
      // dedicated host was provided (REQ-11 §4). CSS gates its visibility.
      if (level.index === levelCount && !disclaimerHost) {
        listEl.appendChild(buildDisclaimer());
      }
    }

    root.appendChild(listEl);

    // (Re)create the locked-message region after the list so it reads after
    // the entries in DOM order.
    lockedMsgEl = document.createElement('div');
    lockedMsgEl.className = 'level-locked-msg';
    lockedMsgEl.setAttribute('role', 'status');
    lockedMsgEl.setAttribute('aria-live', 'polite');
    lockedMsgEl.hidden = !wasLockedVisible;
    lockedMsgEl.textContent = wasLockedVisible ? LOCKED_MESSAGE : '';
    root.appendChild(lockedMsgEl);

    // When a dedicated disclaimer host is provided, render into it once.
    if (disclaimerHost) {
      disclaimerHost.textContent = '';
      disclaimerHost.appendChild(buildDisclaimer());
    }
  }

  /**
   * Build the Level 7 honest-copy disclaimer element (REQ-11 §4). The
   * `.level-disclaimer` class is what CSS (task 32) gates on
   * `(min-width: 1280px) and (min-height: 720px)`.
   * @returns {HTMLParagraphElement}
   */
  function buildDisclaimer() {
    const p = document.createElement('p');
    p.className = 'level-disclaimer';
    p.textContent = LEVEL_7_DISCLAIMER;
    return p;
  }

  /**
   * Tear down the selector: clear `root` and any dedicated disclaimer host.
   * Event listeners are attached to the buttons inside `root`, so clearing
   * `root` drops them along with the nodes.
   * @returns {void}
   */
  function destroy() {
    root.textContent = '';
    if (disclaimerHost) {
      disclaimerHost.textContent = '';
    }
    listEl = null;
    lockedMsgEl = null;
  }

  // Subscribe to engine events to keep the rendered state in sync.
  if (typeof engine.on === 'function') {
    engine.on('levelCleared', (payload) => {
      const index = payload && payload.index;
      if (Number.isInteger(index) && index >= 1 && index <= levelCount) {
        cleared[index - 1] = true;
      }
      render();
    });
    engine.on('levelChanged', (payload) => {
      const index = payload && payload.index;
      if (Number.isInteger(index) && index >= 1 && index <= levelCount) {
        currentIndex = index;
      }
      render();
    });
  }

  // Initial render.
  render();

  return { render, destroy };
}

/**
 * ARIA tabs shared component for the Chat Attack page.
 *
 * Implements the WAI-ARIA tabs pattern with automatic activation: ArrowLeft /
 * ArrowRight cycle (wrapping) between tabs, Home / End jump to the first / last
 * tab, and click plus Enter / Space activate a tab. Only the active tab carries
 * `aria-selected="true"` and `tabindex="0"` (roving tabindex); only the active
 * panel has its `hidden` attribute removed.
 *
 * Hidden panels are never unmounted or cleared, so each tab's transcript, input
 * value, and scroll position persist for the duration of the page session
 * (REQ-7 §5). No DOM is destroyed on switch; only the `hidden` attribute and the
 * ARIA/tabindex state are toggled.
 *
 * No external dependencies; pure DOM.
 */

/**
 * A no-op controller returned when the tablist is missing or has no tabs, so
 * callers can always rely on the same shape without null checks.
 *
 * @returns {{ activate: (indexOrTab: number | Element) => void, getActiveIndex: () => number }}
 */
function noopController() {
  return {
    activate() {},
    getActiveIndex() {
      return -1;
    },
  };
}

/**
 * Mount the ARIA tabs behavior over an existing tablist and its panels.
 *
 * The DOM is expected to already contain the `role="tablist"` container with
 * `role="tab"` buttons inside it, each pointing at its panel via
 * `aria-controls`. This function wires up keyboard and pointer interaction and
 * applies the initial selected/hidden state without stealing focus.
 *
 * @param {{ tablist: Element | null, panels?: Element[] }} options
 *   - `tablist`: the container element with `role="tablist"` holding the tabs.
 *   - `panels`: optional explicit array of panel elements. When omitted, panels
 *     are derived from each tab's `aria-controls` attribute via
 *     `document.getElementById`.
 * @returns {{ activate: (indexOrTab: number | Element) => void, getActiveIndex: () => number }}
 *   A controller for programmatic activation and querying the active index.
 */
export function mountTabs({ tablist, panels } = {}) {
  if (!tablist || typeof tablist.querySelectorAll !== 'function') {
    return noopController();
  }

  const tabs = Array.from(tablist.querySelectorAll('[role="tab"]'));
  if (tabs.length === 0) {
    return noopController();
  }

  // Derive panels from each tab's aria-controls unless an explicit array is
  // provided. Index alignment with `tabs` is preserved; a missing panel is null.
  const resolvedPanels = Array.isArray(panels)
    ? panels
    : tabs.map((tab) => {
        const id = tab.getAttribute('aria-controls');
        return id ? document.getElementById(id) : null;
      });

  /**
   * Apply selected state to `tabs[activeIndex]` and reveal its panel, hiding
   * all others. Optionally move focus to the active tab.
   *
   * @param {number} activeIndex - Index into `tabs`.
   * @param {boolean} focusTab - When true, move keyboard focus to the active tab.
   */
  function applyState(activeIndex, focusTab) {
    tabs.forEach((tab, i) => {
      const isActive = i === activeIndex;
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
      tab.tabIndex = isActive ? 0 : -1;
    });

    resolvedPanels.forEach((panel, i) => {
      if (!panel) return;
      if (i === activeIndex) {
        panel.removeAttribute('hidden');
      } else {
        // Never unmount or clear the panel; only hide it so state persists.
        panel.setAttribute('hidden', '');
      }
    });

    if (focusTab && tabs[activeIndex]) {
      tabs[activeIndex].focus();
    }
  }

  /**
   * Resolve the index of the initially selected tab: the one already marked
   * `aria-selected="true"` in the DOM, or the first tab as a fallback.
   *
   * @returns {number}
   */
  function initialIndex() {
    const selected = tabs.findIndex(
      (tab) => tab.getAttribute('aria-selected') === 'true'
    );
    return selected === -1 ? 0 : selected;
  }

  let activeIndex = initialIndex();

  /**
   * Activate the tab at `index`, clamped to the valid range.
   *
   * @param {number} index
   * @param {boolean} focusTab - Whether to move focus to the tab.
   */
  function activateIndex(index, focusTab) {
    if (index < 0 || index >= tabs.length) return;
    activeIndex = index;
    applyState(activeIndex, focusTab);
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => {
      activateIndex(i, true);
    });

    tab.addEventListener('keydown', (event) => {
      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowDown': {
          event.preventDefault();
          activateIndex((i + 1) % tabs.length, true);
          break;
        }
        case 'ArrowLeft':
        case 'ArrowUp': {
          event.preventDefault();
          activateIndex((i - 1 + tabs.length) % tabs.length, true);
          break;
        }
        case 'Home': {
          event.preventDefault();
          activateIndex(0, true);
          break;
        }
        case 'End': {
          event.preventDefault();
          activateIndex(tabs.length - 1, true);
          break;
        }
        case 'Enter':
        case ' ':
        case 'Spacebar': {
          event.preventDefault();
          activateIndex(i, true);
          break;
        }
        default:
          break;
      }
    });
  });

  // Apply the initial state without stealing focus on mount.
  applyState(activeIndex, false);

  return {
    /**
     * Programmatically activate a tab by index or by element reference.
     * Moves focus to the activated tab (consistent with keyboard/click).
     *
     * @param {number | Element} indexOrTab
     */
    activate(indexOrTab) {
      const index =
        typeof indexOrTab === 'number'
          ? indexOrTab
          : tabs.indexOf(indexOrTab);
      activateIndex(index, true);
    },

    /**
     * @returns {number} The index of the currently active tab.
     */
    getActiveIndex() {
      return activeIndex;
    },
  };
}

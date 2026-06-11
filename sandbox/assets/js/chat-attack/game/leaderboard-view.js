/**
 * Leaderboard_View for the Chat Attack game tab.
 *
 * Renders the global leaderboard list and the post-victory submission form.
 * The list view fetches `GET {base}/leaderboard` on mount and on retry, wrapped
 * in `withTimeout(..., 10_000)` (REQ-6 §1), and renders the top up-to-20 entries
 * as a `<table>` with columns handle, levels cleared, attempts, and total time
 * formatted `HH:MM:SS`. While the fetch is in flight a skeleton loader is shown
 * (REQ-6 §2); on any non-2xx / network error / timeout the literal message
 * `Leaderboard unavailable, try again later` plus a Retry button is shown
 * (REQ-6 §3).
 *
 * The submission form is rendered enabled only when every level in the progress
 * store is cleared (REQ-6 §§4, 5) and the handle matches
 * `/^[A-Za-z0-9_-]{3,16}$/` (REQ-6 §§6, 7). On submit it POSTs
 * `{ handle, levelsCleared: 7, totalAttempts, totalTimeSeconds }` to
 * `{base}/leaderboard`, also wrapped in `withTimeout(..., 10_000)` (REQ-6 §8),
 * carrying the same `x-sandbox-token` header used by the existing
 * `/api/gemini-pro` calls (the Origin header is set automatically by the
 * browser on the cross-origin request). Response handling follows the table in
 * design.md §Leaderboard_View: 201 refreshes the list and highlights the freshly
 * submitted row for >= 3 seconds (REQ-6 §9); 422 shows
 * `That handle is not allowed, choose another` (REQ-6 §10); 429 shows
 * `Daily submission limit reached, try again later` plus the `Retry-After`
 * wait time formatted `HH:MM:SS` (REQ-6 §11); any other failure shows
 * `Submission failed, try again` (REQ-6 §12).
 *
 * Worker wiring: production must set `window.AISEC_WORKER_URL` to the deployed
 * Worker origin so the leaderboard routes resolve. When unset the base defaults
 * to '' (same-origin relative `/leaderboard`). The dev token is read from
 * `window.SANDBOX_DEV_TOKEN` when present; the `x-sandbox-token` header is only
 * sent when a token exists.
 *
 * The module performs no DOM access at import time, so it is safe to import in
 * Node/test environments without a document. All DOM operations are guarded.
 *
 * @module chat-attack/game/leaderboard-view
 */

import { withTimeout } from '../shared/api-client.js';

/** Per-request timeout for both GET and POST (REQ-6 §§1, 8). */
const TIMEOUT_MS = 10000;

/** Maximum number of leaderboard rows rendered (REQ-6 §1). */
const MAX_ROWS = 20;

/** Number of cleared levels a full run reports (REQ-6 §8). */
const LEVELS_REQUIRED = 7;

/** Client-side handle validation regex (REQ-6 §§6, 7). */
const HANDLE_REGEX = /^[A-Za-z0-9_-]{3,16}$/;

/** Duration the freshly-submitted row stays highlighted (REQ-6 §9). */
const HIGHLIGHT_MS = 3000;

/** Literal user-facing messages (REQ-6 §§3, 7, 10, 11, 12). */
const MSG_LIST_ERROR = 'Leaderboard unavailable, try again later';
const MSG_HANDLE_VALIDATION =
  'Allowed: 3 to 16 characters, letters, digits, underscore, hyphen';
const MSG_HANDLE_REJECTED = 'That handle is not allowed, choose another';
const MSG_RATE_LIMITED = 'Daily submission limit reached, try again later';
const MSG_SUBMIT_FAILED = 'Submission failed, try again';

/**
 * Format a whole number of seconds as `HH:MM:SS`, zero-padded to two digits
 * per field (REQ-6 §§1, 11). Negative or non-finite inputs clamp to 0.
 *
 * Hours are not capped at 24, but the leaderboard's max total time is 86400s
 * (= `24:00:00`), so two-digit hours are always sufficient for displayed data.
 *
 * @param {unknown} totalSeconds
 * @returns {string} `HH:MM:SS`
 */
export function formatHMS(totalSeconds) {
  let s =
    typeof totalSeconds === 'number' && Number.isFinite(totalSeconds)
      ? Math.floor(totalSeconds)
      : 0;
  if (s < 0) {
    s = 0;
  }
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

/**
 * Resolve the configured Worker base URL.
 *
 * Production must set `window.AISEC_WORKER_URL` to the deployed Worker origin.
 * When unset, falls back to '' so the leaderboard routes resolve same-origin
 * (relative `/leaderboard`).
 *
 * @returns {string}
 */
function resolveWorkerBaseUrl() {
  if (typeof window !== 'undefined' && typeof window.AISEC_WORKER_URL === 'string') {
    return window.AISEC_WORKER_URL;
  }
  return '';
}

/**
 * Resolve the dev sandbox token. Returns undefined when none is configured so
 * the `x-sandbox-token` header is omitted entirely.
 *
 * @returns {string | undefined}
 */
function resolveSandboxToken() {
  if (typeof window !== 'undefined' && typeof window.SANDBOX_DEV_TOKEN === 'string') {
    return window.SANDBOX_DEV_TOKEN;
  }
  return undefined;
}

/**
 * Replicate the Worker's server-side handle sanitization so the freshly
 * submitted row can be matched after a successful 201 (REQ-6 §9). Mirrors
 * `sanitizeHandle` in cloudflare-worker/src/index.js: lowercase, strip anything
 * outside `[a-z0-9_-]`, truncate to 16 characters.
 *
 * @param {string} handle
 * @returns {string}
 */
function sanitizeHandle(handle) {
  return String(handle)
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 16);
}

/**
 * Sum the per-level attempts and time-to-clear across the progress record
 * (REQ-6 §8). Missing or null values count as 0.
 *
 * @param {{ levels?: Array<{ attempts?: number, timeToClearSeconds?: number|null }> }} record
 * @returns {{ totalAttempts: number, totalTimeSeconds: number, allCleared: boolean }}
 */
function summarizeProgress(record) {
  const levels = record && Array.isArray(record.levels) ? record.levels : [];
  let totalAttempts = 0;
  let totalTimeSeconds = 0;
  for (const level of levels) {
    if (level && typeof level.attempts === 'number' && Number.isFinite(level.attempts)) {
      totalAttempts += level.attempts;
    }
    if (
      level &&
      typeof level.timeToClearSeconds === 'number' &&
      Number.isFinite(level.timeToClearSeconds)
    ) {
      totalTimeSeconds += level.timeToClearSeconds;
    }
  }
  const allCleared = levels.length > 0 && levels.every((l) => l && l.cleared === true);
  return { totalAttempts, totalTimeSeconds, allCleared };
}

/**
 * Mount the Leaderboard_View.
 *
 * @param {Object} opts
 * @param {Element|null} [opts.root]
 *   Host element the view renders into. When omitted in a DOM environment a
 *   `<div>` is appended to `document.body`.
 * @param {{ load: () => any }} opts.progressStore
 *   The Progress_Store instance. `load()` returns the ProgressRecord used to
 *   gate the submit form and compute submission totals.
 * @param {string} [opts.workerBaseUrl]
 *   Base URL for the leaderboard routes. Defaults to `window.AISEC_WORKER_URL`
 *   when set, else '' (same-origin relative).
 * @param {string} [opts.sandboxToken]
 *   Dev token sent as `x-sandbox-token`. Defaults to `window.SANDBOX_DEV_TOKEN`
 *   when set, else undefined (header omitted).
 * @returns {{ load: () => void, showSubmitForm: () => void, destroy: () => void }}
 */
export function mountLeaderboardView({
  root,
  progressStore,
  workerBaseUrl,
  sandboxToken,
} = {}) {
  // No DOM available (Node/tests importing without jsdom): return inert API.
  if (typeof document === 'undefined') {
    return { load() {}, showSubmitForm() {}, destroy() {} };
  }

  const base =
    typeof workerBaseUrl === 'string' ? workerBaseUrl : resolveWorkerBaseUrl();
  const token =
    typeof sandboxToken === 'string' ? sandboxToken : resolveSandboxToken();

  // Resolve / create the host element.
  /** @type {HTMLElement} */
  let host;
  if (root && typeof root.appendChild === 'function') {
    host = /** @type {HTMLElement} */ (root);
  } else {
    host = document.createElement('div');
    if (document.body) {
      document.body.appendChild(host);
    }
  }
  host.classList.add('leaderboard-view');
  host.innerHTML = '';

  // Two regions: the list and the submit form.
  const listRegion = document.createElement('div');
  listRegion.className = 'leaderboard-list';

  const formRegion = document.createElement('div');
  formRegion.className = 'leaderboard-form-region';
  formRegion.hidden = true;

  host.append(listRegion, formRegion);

  /** Tracks the active highlight timer so it can be cleared on destroy. */
  let highlightTimer = null;
  let destroyed = false;

  /**
   * Build the request headers. `x-sandbox-token` is only included when a token
   * is configured. `Content-Type: application/json` is always present for POST;
   * for GET it is harmless and kept consistent with the existing client.
   *
   * @param {boolean} json - Whether to include the JSON content-type.
   * @returns {Record<string, string>}
   */
  function buildHeaders(json) {
    /** @type {Record<string, string>} */
    const headers = {};
    if (json) {
      headers['Content-Type'] = 'application/json';
    }
    if (token) {
      headers['x-sandbox-token'] = token;
    }
    return headers;
  }

  /**
   * Render the loading skeleton (REQ-6 §2).
   * @returns {void}
   */
  function renderLoading() {
    listRegion.innerHTML = '';
    const loading = document.createElement('div');
    loading.className = 'leaderboard-loading';
    loading.setAttribute('aria-busy', 'true');
    loading.setAttribute('aria-label', 'Loading leaderboard');
    for (let i = 0; i < 5; i += 1) {
      const row = document.createElement('div');
      row.className = 'leaderboard-skeleton-row';
      loading.appendChild(row);
    }
    listRegion.appendChild(loading);
  }

  /**
   * Render the error state with a Retry control (REQ-6 §3).
   * @returns {void}
   */
  function renderError() {
    listRegion.innerHTML = '';
    const message = document.createElement('p');
    message.className = 'leaderboard-error';
    message.textContent = MSG_LIST_ERROR;

    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'leaderboard-retry';
    retry.textContent = 'Retry';
    retry.addEventListener('click', () => {
      loadLeaderboard();
    });

    listRegion.append(message, retry);
  }

  /**
   * Render the leaderboard table from an array of entries (REQ-6 §1).
   * Renders up to 20 rows and formats total time via `formatHMS`. When
   * `highlightHandle` is provided, the row whose sanitized handle matches is
   * given the `highlight` class for >= 3 seconds (REQ-6 §9).
   *
   * @param {Array<{ handle?: string, levelsCleared?: number, totalAttempts?: number, totalTimeSeconds?: number }>} entries
   * @param {string|null} [highlightHandle]
   * @returns {void}
   */
  function renderTable(entries, highlightHandle) {
    listRegion.innerHTML = '';
    const list = Array.isArray(entries) ? entries.slice(0, MAX_ROWS) : [];

    const table = document.createElement('table');
    table.className = 'leaderboard-table';

    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    for (const label of ['Handle', 'Levels', 'Attempts', 'Time']) {
      const th = document.createElement('th');
      th.scope = 'col';
      th.textContent = label;
      headRow.appendChild(th);
    }
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    const target = highlightHandle ? sanitizeHandle(highlightHandle) : null;
    /** @type {HTMLElement|null} */
    let highlightedRow = null;

    for (const entry of list) {
      const tr = document.createElement('tr');
      const handle = entry && entry.handle != null ? String(entry.handle) : '';

      const handleCell = document.createElement('td');
      handleCell.className = 'leaderboard-cell-handle';
      handleCell.textContent = handle;

      const levelsCell = document.createElement('td');
      levelsCell.textContent = String(
        entry && entry.levelsCleared != null ? entry.levelsCleared : ''
      );

      const attemptsCell = document.createElement('td');
      attemptsCell.textContent = String(
        entry && entry.totalAttempts != null ? entry.totalAttempts : ''
      );

      const timeCell = document.createElement('td');
      timeCell.textContent = formatHMS(entry && entry.totalTimeSeconds);

      tr.append(handleCell, levelsCell, attemptsCell, timeCell);

      if (target && !highlightedRow && sanitizeHandle(handle) === target) {
        tr.classList.add('highlight');
        highlightedRow = tr;
      }

      tbody.appendChild(tr);
    }
    table.appendChild(tbody);

    if (list.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'leaderboard-empty';
      empty.textContent = 'No entries yet, be the first.';
      listRegion.append(table, empty);
    } else {
      listRegion.appendChild(table);
    }

    // Maintain the highlight for >= 3 seconds (REQ-6 §9).
    if (highlightedRow) {
      if (highlightTimer) {
        clearTimeout(highlightTimer);
      }
      highlightTimer = setTimeout(() => {
        if (highlightedRow && highlightedRow.classList) {
          highlightedRow.classList.remove('highlight');
        }
        highlightTimer = null;
      }, HIGHLIGHT_MS);
    }
  }

  /**
   * Fetch the leaderboard and render the result (REQ-6 §§1-3).
   *
   * @param {string|null} [highlightHandle] - Handle to highlight after a refresh.
   * @returns {Promise<void>}
   */
  async function loadLeaderboard(highlightHandle) {
    renderLoading();
    try {
      const res = await withTimeout(
        fetch(`${base}/leaderboard`, {
          method: 'GET',
          headers: buildHeaders(false),
        }),
        TIMEOUT_MS
      );
      if (!res || !res.ok) {
        renderError();
        return;
      }
      const data = await res.json();
      if (destroyed) {
        return;
      }
      renderTable(data, highlightHandle || null);
    } catch (_err) {
      if (!destroyed) {
        renderError();
      }
    }
  }

  // ---- Submit form ----------------------------------------------------------

  /**
   * Render the submission form (REQ-6 §§4-7). The submit button is disabled
   * unless every level is cleared AND the handle matches the regex.
   * @returns {void}
   */
  function renderSubmitForm() {
    formRegion.hidden = false;
    formRegion.innerHTML = '';

    const { allCleared } = summarizeProgress(safeLoad());

    const form = document.createElement('form');
    form.className = 'leaderboard-form';

    const label = document.createElement('label');
    label.className = 'leaderboard-form-label';
    label.textContent = 'Choose a handle';
    label.htmlFor = 'leaderboard-handle';

    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'leaderboard-handle';
    input.className = 'leaderboard-handle';
    input.maxLength = 16;
    input.autocomplete = 'off';

    const validationMsg = document.createElement('p');
    validationMsg.className = 'leaderboard-validation';
    validationMsg.setAttribute('aria-live', 'polite');

    const statusMsg = document.createElement('p');
    statusMsg.className = 'leaderboard-status';
    statusMsg.setAttribute('aria-live', 'polite');

    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.className = 'leaderboard-submit';
    submit.textContent = 'Submit';
    submit.disabled = true;

    /**
     * Recompute the submit button's enabled state and the inline validation
     * message based on the current handle and progress (REQ-6 §§4, 5, 7).
     */
    function refreshValidity() {
      const handle = input.value;
      const handleValid = HANDLE_REGEX.test(handle);
      const cleared = summarizeProgress(safeLoad()).allCleared;
      submit.disabled = !(handleValid && cleared);

      if (handle.length > 0 && !handleValid) {
        validationMsg.textContent = MSG_HANDLE_VALIDATION;
      } else {
        validationMsg.textContent = '';
      }
    }

    input.addEventListener('input', () => {
      statusMsg.textContent = '';
      refreshValidity();
    });

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      handleSubmit(input.value, { form, input, submit, statusMsg });
    });

    form.append(label, input, validationMsg, submit, statusMsg);
    formRegion.appendChild(form);

    // Initial validity reflects the empty handle and cleared gate (REQ-6 §5).
    refreshValidity();
    if (!allCleared) {
      submit.disabled = true;
    }

    if (typeof input.focus === 'function') {
      try {
        input.focus();
      } catch (_err) {
        /* ignore */
      }
    }
  }

  /**
   * POST the run to the leaderboard and handle the response (REQ-6 §§8-12).
   *
   * @param {string} handle
   * @param {{ form: HTMLElement, input: HTMLInputElement, submit: HTMLButtonElement, statusMsg: HTMLElement }} ui
   * @returns {Promise<void>}
   */
  async function handleSubmit(handle, ui) {
    if (!HANDLE_REGEX.test(handle)) {
      return;
    }
    const { totalAttempts, totalTimeSeconds } = summarizeProgress(safeLoad());
    const body = {
      handle,
      levelsCleared: LEVELS_REQUIRED,
      totalAttempts,
      totalTimeSeconds,
    };

    ui.submit.disabled = true;
    ui.statusMsg.textContent = '';

    let res;
    try {
      res = await withTimeout(
        fetch(`${base}/leaderboard`, {
          method: 'POST',
          headers: buildHeaders(true),
          body: JSON.stringify(body),
        }),
        TIMEOUT_MS
      );
    } catch (_err) {
      // Network error or timeout (REQ-6 §12). Keep form open with handle.
      ui.statusMsg.textContent = MSG_SUBMIT_FAILED;
      ui.submit.disabled = false;
      return;
    }

    if (res && res.status === 201) {
      // Success: refresh the list and highlight the submitted row (REQ-6 §9).
      formRegion.hidden = true;
      formRegion.innerHTML = '';
      await loadLeaderboard(handle);
      return;
    }

    if (res && res.status === 422) {
      // Handle rejected (REQ-6 §10). Preserve the entered handle.
      ui.statusMsg.textContent = MSG_HANDLE_REJECTED;
      ui.submit.disabled = false;
      return;
    }

    if (res && res.status === 429) {
      // Rate limited (REQ-6 §11). Format Retry-After as HH:MM:SS.
      let retryAfter = 0;
      if (res.headers && typeof res.headers.get === 'function') {
        retryAfter = parseInt(res.headers.get('Retry-After'), 10);
        if (!Number.isFinite(retryAfter)) {
          retryAfter = 0;
        }
      }
      ui.statusMsg.textContent = `${MSG_RATE_LIMITED} (${formatHMS(retryAfter)})`;
      ui.submit.disabled = false;
      return;
    }

    // Any other non-2xx (REQ-6 §12). Preserve the entered handle.
    ui.statusMsg.textContent = MSG_SUBMIT_FAILED;
    ui.submit.disabled = false;
  }

  /**
   * Safely load the progress record, tolerating a missing or throwing store.
   * @returns {{ levels?: Array<any> }}
   */
  function safeLoad() {
    if (progressStore && typeof progressStore.load === 'function') {
      try {
        return progressStore.load() || { levels: [] };
      } catch (_err) {
        return { levels: [] };
      }
    }
    return { levels: [] };
  }

  // ---- Public API -----------------------------------------------------------

  /**
   * Load (or reload) the leaderboard list (REQ-6 §1).
   * @returns {void}
   */
  function load() {
    loadLeaderboard();
  }

  /**
   * Reveal the submission form. Triggered by the level-7 victory CTA via
   * `onSubmitLeaderboard` (REQ-6 §6).
   * @returns {void}
   */
  function showSubmitForm() {
    renderSubmitForm();
  }

  /**
   * Tear down timers and clear rendered DOM.
   * @returns {void}
   */
  function destroy() {
    destroyed = true;
    if (highlightTimer) {
      clearTimeout(highlightTimer);
      highlightTimer = null;
    }
    listRegion.innerHTML = '';
    formRegion.innerHTML = '';
    formRegion.hidden = true;
  }

  return { load, showSubmitForm, destroy };
}

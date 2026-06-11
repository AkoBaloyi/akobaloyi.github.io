/**
 * Persistent progress store for the Chat Attack game tab.
 *
 * Owns the single localStorage namespace `aisec.chatAttack.progress.v1`
 * (REQ-3 §1) and the in-memory mirror of the seven-level progress record.
 * Every persisted record carries `schemaVersion: 1` (REQ-12 §2) and is
 * validated end-to-end on load (REQ-3 §6, REQ-12 §§3-4); any deviation
 * triggers a single console warning and a fresh empty record. Writes
 * are wrapped in try/catch with a single warning on failure so a full
 * quota or a SecurityError in private mode never aborts the cleared
 * transition that triggered the write (REQ-3 §9, REQ-12 §5).
 *
 * Monotonicity: `markCleared` only flips `cleared` from false to true
 * (REQ-3 §10). The only path that resets cleared back to false is
 * `reset()`, which is wired to the explicit "Reset progress" control in
 * the UI (REQ-3 §7).
 *
 * Synchronous write contract: `markCleared` calls `save` inline so the
 * cleared transition is persisted within the same JavaScript task as
 * the in-memory mutation, before yielding to the event loop (REQ-3 §3).
 *
 * Storage indirection: tests inject an in-memory storage stub so the
 * module is testable without a DOM. In Node or any environment without
 * `window.localStorage`, the store still functions as an in-memory
 * fallback that warns once on the first save attempt.
 *
 * @module chat-attack/game/progress-store
 */

/**
 * The single localStorage key (REQ-3 §1).
 * @type {string}
 */
export const STORAGE_KEY = 'aisec.chatAttack.progress.v1';

/**
 * Persisted schema version (REQ-12 §2).
 * @type {1}
 */
export const SCHEMA_VERSION = 1;

/**
 * Number of levels in a valid progress record (REQ-3 §2).
 * @type {number}
 */
export const LEVEL_COUNT = 7;

/**
 * Inclusive upper bound for the per-level attempts counter (REQ-3 §2).
 * @type {number}
 */
export const MAX_ATTEMPTS = 9999;

/**
 * Inclusive upper bound for the per-level time-to-clear counter in
 * seconds (REQ-3 §2).
 * @type {number}
 */
export const MAX_TIME_SECONDS = 86400;

const CORRUPT_WARNING = '[chat-attack] progress data corrupted, resetting';
const PERSIST_WARNING =
  '[chat-attack] progress persistence failed, keeping in-memory state';

/**
 * @typedef {Object} LevelProgress
 * @property {boolean} cleared
 * @property {number} attempts             integer in [0, 9999]
 * @property {number | null} timeToClearSeconds integer in [0, 86400] or null
 * @property {string | null} firstClearAt  ISO 8601 string or null
 */

/**
 * @typedef {Object} ProgressRecord
 * @property {1} schemaVersion
 * @property {LevelProgress[]} levels      length === 7
 */

/**
 * Build a fresh empty progress record (REQ-3 §5, REQ-12 §2).
 *
 * Every level entry is independently allocated so callers can mutate the
 * returned record without aliasing.
 *
 * @returns {ProgressRecord}
 */
export function createEmptyRecord() {
  const levels = [];
  for (let i = 0; i < LEVEL_COUNT; i += 1) {
    levels.push({
      cleared: false,
      attempts: 0,
      timeToClearSeconds: null,
      firstClearAt: null,
    });
  }
  return { schemaVersion: SCHEMA_VERSION, levels };
}

/**
 * Strict integer-in-range check used by the validator.
 *
 * @param {unknown} value
 * @param {number} min
 * @param {number} max
 * @returns {boolean}
 */
function isIntegerInRange(value, min, max) {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

/**
 * Validate a parsed object against the persisted progress schema
 * (REQ-3 §§2, 6, REQ-12 §§1, 3).
 *
 * Returns true iff:
 *   - `value` is a non-null object;
 *   - `value.schemaVersion === 1` (strict integer compare);
 *   - `value.levels` is an array of length exactly `LEVEL_COUNT`;
 *   - every level entry has:
 *       - `cleared` strictly boolean,
 *       - `attempts` integer in [0, 9999],
 *       - `timeToClearSeconds` either null or integer in [0, 86400],
 *       - `firstClearAt` either null or a non-empty string.
 *
 * Any deviation, including unknown fields with the wrong type, returns
 * false. Unknown extra fields on the level entries are tolerated and
 * stripped by `cloneRecord` so they never round-trip back to disk.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function validateRecord(value) {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const record = /** @type {{ schemaVersion?: unknown, levels?: unknown }} */ (value);

  if (record.schemaVersion !== SCHEMA_VERSION) {
    return false;
  }

  if (!Array.isArray(record.levels) || record.levels.length !== LEVEL_COUNT) {
    return false;
  }

  for (const entry of record.levels) {
    if (entry === null || typeof entry !== 'object') {
      return false;
    }
    const level = /** @type {Record<string, unknown>} */ (entry);

    if (typeof level.cleared !== 'boolean') {
      return false;
    }
    if (!isIntegerInRange(level.attempts, 0, MAX_ATTEMPTS)) {
      return false;
    }
    if (
      level.timeToClearSeconds !== null &&
      !isIntegerInRange(level.timeToClearSeconds, 0, MAX_TIME_SECONDS)
    ) {
      return false;
    }
    if (
      level.firstClearAt !== null &&
      (typeof level.firstClearAt !== 'string' || level.firstClearAt.length === 0)
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Deep-clone a validated record into a canonical shape with only the
 * known fields. Used so the in-memory mirror cannot be mutated by an
 * external reference and so unknown extra fields do not round-trip.
 *
 * @param {ProgressRecord} record
 * @returns {ProgressRecord}
 */
function cloneRecord(record) {
  const cloned = createEmptyRecord();
  for (let i = 0; i < LEVEL_COUNT; i += 1) {
    const src = record.levels[i];
    cloned.levels[i] = {
      cleared: src.cleared === true,
      attempts: src.attempts | 0,
      timeToClearSeconds:
        src.timeToClearSeconds === null ? null : src.timeToClearSeconds | 0,
      firstClearAt: src.firstClearAt === null ? null : String(src.firstClearAt),
    };
  }
  return cloned;
}

/**
 * Resolve a default storage backend.
 *
 * Returns `window.localStorage` when running in a browser, or `undefined`
 * in any environment without `window` (Node, tests, web workers). The
 * store treats `undefined` as a graceful in-memory fallback.
 *
 * @returns {Storage | undefined}
 */
function defaultStorage() {
  if (typeof window === 'undefined') {
    return undefined;
  }
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

/**
 * Create a progress store bound to the given storage backend.
 *
 * The returned object holds an in-memory mirror of the persisted record
 * and exposes four operations:
 *   - `load()`   reads and validates from storage, falling back on a
 *                fresh empty record on any failure (REQ-3 §§5, 6).
 *   - `save(record)` writes the record to storage, never throwing
 *                    (REQ-3 §9, REQ-12 §5).
 *   - `markCleared(index, attempts, seconds, isoTs)` flips a level to
 *                    cleared and persists synchronously (REQ-3 §3) while
 *                    enforcing monotonicity (REQ-3 §10).
 *   - `reset()`  clears the storage key and returns a fresh empty record
 *                (REQ-3 §7).
 *
 * Storage backend contract: any object with `getItem(key)`, `setItem(key, value)`,
 * and `removeItem(key)` works. Tests pass a small Map-backed stub. The
 * default is `window.localStorage`; if that is unavailable the store
 * runs as an in-memory fallback and warns once on the first save.
 *
 * @param {{ storage?: Storage }} [options]
 * @returns {{
 *   load: () => ProgressRecord,
 *   save: (record: ProgressRecord) => ProgressRecord,
 *   markCleared: (index: number, attempts: number, seconds: number, isoTs: string) => ProgressRecord,
 *   reset: () => ProgressRecord
 * }}
 */
export function createProgressStore({ storage = defaultStorage() } = {}) {
  /** @type {ProgressRecord} */
  let current = createEmptyRecord();

  /** Latched once per store lifetime so the warning fires at most once. */
  let saveWarnedFailed = false;

  /**
   * Emit the persistence-failure warning at most once per store
   * lifetime (REQ-3 §9, REQ-12 §5).
   */
  function warnSaveFailedOnce() {
    if (saveWarnedFailed) {
      return;
    }
    saveWarnedFailed = true;
    // eslint-disable-next-line no-console
    console.warn(PERSIST_WARNING);
  }

  /**
   * Read the persisted record from storage and validate it.
   *
   * Returns a fresh empty record and warns once for the call when:
   *   - storage is unavailable (no warning, just a fresh record);
   *   - the key is missing (no warning, just a fresh record);
   *   - JSON parsing throws;
   *   - validation fails for any reason listed in `validateRecord`.
   *
   * The warning is the literal string from REQ-3 §6 and fires at most
   * once per `load()` call, regardless of how many validation paths
   * could have triggered it.
   *
   * @returns {ProgressRecord}
   */
  function load() {
    if (!storage) {
      current = createEmptyRecord();
      return current;
    }

    let raw;
    try {
      raw = storage.getItem(STORAGE_KEY);
    } catch {
      // Some browsers throw on getItem in private mode; treat as missing.
      current = createEmptyRecord();
      return current;
    }

    if (raw === null || raw === undefined) {
      current = createEmptyRecord();
      return current;
    }

    let warned = false;
    /** @returns {ProgressRecord} */
    const fallback = () => {
      if (!warned) {
        warned = true;
        // eslint-disable-next-line no-console
        console.warn(CORRUPT_WARNING);
      }
      current = createEmptyRecord();
      return current;
    };

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return fallback();
    }

    if (!validateRecord(parsed)) {
      return fallback();
    }

    current = cloneRecord(/** @type {ProgressRecord} */ (parsed));
    return current;
  }

  /**
   * Persist `record` to storage and update the in-memory mirror.
   *
   * The record is cloned through `cloneRecord` so external mutation of
   * the input cannot drift the mirror. If `storage` is unavailable, the
   * mirror is still updated and the persistence-failure warning fires
   * exactly once. If `setItem` throws (quota exceeded, SecurityError in
   * private mode, disabled storage, etc.) the same warning fires once
   * and the mirror is preserved (REQ-3 §9, REQ-12 §5).
   *
   * Returns the new in-memory record so callers can chain reads.
   *
   * @param {ProgressRecord} record
   * @returns {ProgressRecord}
   */
  function save(record) {
    if (!validateRecord(record)) {
      // Defensive: refuse to persist an invalid record. The legacy
      // mirror is preserved unchanged so the in-memory state stays
      // self-consistent.
      warnSaveFailedOnce();
      return current;
    }

    current = cloneRecord(record);

    if (!storage) {
      warnSaveFailedOnce();
      return current;
    }

    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(current));
    } catch {
      warnSaveFailedOnce();
    }
    return current;
  }

  /**
   * Mark a level as cleared and persist synchronously (REQ-3 §3).
   *
   * Arguments are validated and clamped where possible:
   *   - `index` must be an integer in [1, 7]; out-of-range indices are
   *     rejected without mutation.
   *   - `attempts` is clamped into [0, 9999] when finite, or coerced to
   *     0 when the input is unusable.
   *   - `seconds` is clamped into [0, 86400] when finite, or coerced to
   *     0 when the input is unusable.
   *   - `isoTs` falls back to `new Date().toISOString()` when not a
   *     non-empty string.
   *
   * Monotonicity (REQ-3 §10): a level whose `cleared` is already true
   * is not touched, so the original first-clear metrics are preserved
   * across replays. The cleared bit never flips back to false outside
   * of `reset()`.
   *
   * @param {number} index   1-based level index
   * @param {number} attempts
   * @param {number} seconds
   * @param {string} isoTs
   * @returns {ProgressRecord}
   */
  function markCleared(index, attempts, seconds, isoTs) {
    if (!Number.isInteger(index) || index < 1 || index > LEVEL_COUNT) {
      return current;
    }

    const entry = current.levels[index - 1];
    if (entry.cleared === true) {
      // REQ-3 §10 monotonicity: never overwrite an already-cleared entry.
      return current;
    }

    const clampedAttempts = clampInteger(attempts, 0, MAX_ATTEMPTS, 0);
    const clampedSeconds = clampInteger(seconds, 0, MAX_TIME_SECONDS, 0);
    const safeTs =
      typeof isoTs === 'string' && isoTs.length > 0
        ? isoTs
        : new Date().toISOString();

    entry.cleared = true;
    entry.attempts = clampedAttempts;
    entry.timeToClearSeconds = clampedSeconds;
    entry.firstClearAt = safeTs;

    // Synchronous write before yielding to the event loop (REQ-3 §3).
    save(current);
    return current;
  }

  /**
   * Drop the persisted progress and return a fresh empty record
   * (REQ-3 §7, REQ-12 §3 fallback).
   *
   * If `removeItem` throws, the in-memory mirror is still reset and the
   * persistence-failure warning fires once. The mirror is the source of
   * truth for the rest of the session.
   *
   * @returns {ProgressRecord}
   */
  function reset() {
    if (storage) {
      try {
        storage.removeItem(STORAGE_KEY);
      } catch {
        warnSaveFailedOnce();
      }
    }
    current = createEmptyRecord();
    return current;
  }

  return { load, save, markCleared, reset };
}

/**
 * Clamp a numeric input into `[min, max]`, coercing non-finite or
 * non-integer values to `fallback`.
 *
 * @param {unknown} value
 * @param {number} min
 * @param {number} max
 * @param {number} fallback
 * @returns {number}
 */
function clampInteger(value, min, max, fallback) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  const truncated = Math.trunc(value);
  if (truncated < min) return min;
  if (truncated > max) return max;
  return truncated;
}

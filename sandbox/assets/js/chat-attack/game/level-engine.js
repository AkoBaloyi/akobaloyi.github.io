/**
 * Level_Engine for the Chat Attack game tab.
 *
 * The engine is the single source of truth for the active level, the
 * per-level attempts counter, per-level timing, the per-level state
 * machine, and the in-memory transcripts. It coordinates the defense
 * pipeline (input filter, system instruction, output filter), the win
 * condition, and the Progress_Store, and it broadcasts state changes to
 * subscribers (the Level_Selector and Victory_View) via a tiny pub/sub.
 *
 * The engine is pure logic plus two injected collaborators
 * (`geminiClient` and `progressStore`); it performs no DOM access, so
 * tests can inject stubs (design.md §Coordination_model, §Testing
 * strategy).
 *
 * Per-level state machine (design.md §Level_Engine):
 *
 *        +--------+   first user msg   +--------+   win   +---------+
 *   ---> |  IDLE  | -----------------> | ACTIVE | ------> | CLEARED |
 *        +--------+                    +--------+         +---------+
 *
 *   - IDLE: no timer running.
 *   - ACTIVE: `startedAt` recorded on the first user message (REQ-1 §5).
 *   - CLEARED: reached when `checkWin` is true on the pre-redaction
 *     response. The engine writes to the Progress_Store within the same
 *     JavaScript task (REQ-1 §4, REQ-3 §3) before yielding to render the
 *     Victory_View.
 *
 * Invariants enforced here:
 *   - REQ-1 §6: attempts increments before the request is sent, whether
 *     or not the input filter blocks.
 *   - REQ-1 §8: when the secret appears in the user message but not in
 *     the model response, the level stays ACTIVE and is not cleared.
 *   - REQ-3 §10: a CLEARED level is never flipped back (replays do not
 *     undo the cleared state; the Progress_Store also guards this).
 *   - REQ-3 §11: a level is never marked cleared while any lower-index
 *     level remains uncleared (unlock invariant), and `setActiveLevel`
 *     refuses to switch to a locked level.
 *
 * @module chat-attack/game/level-engine
 */

import { LEVELS } from './levels.js';
import { checkWin, userEmittedSecret } from './win-condition.js';
import { composeDefenses } from './defenses/pipeline.js';

/** @typedef {'IDLE' | 'ACTIVE' | 'CLEARED'} LevelState */

/**
 * @typedef {Object} TranscriptEntry
 * @property {'user' | 'assistant' | 'system'} role
 * @property {string} content
 * @property {boolean=} blocked
 * @property {string=} reason
 */

/**
 * The set of events the engine emits. Subscribers register via `on`.
 * @typedef {'levelChanged' | 'attemptIncremented' | 'levelCleared' | 'messageReceived'} LevelEngineEvent
 */

/**
 * Coerce a model response of unknown shape into a string. Task 21's
 * api-client resolves with the model text directly, but we stay
 * defensive: if a future client resolves with `{ text }` (or any object
 * exposing a string `text`), use that; otherwise stringify.
 *
 * @param {unknown} response
 * @returns {string}
 */
function coerceResponseText(response) {
  if (typeof response === 'string') {
    return response;
  }
  if (
    response !== null &&
    typeof response === 'object' &&
    typeof (/** @type {{ text?: unknown }} */ (response).text) === 'string'
  ) {
    return /** @type {{ text: string }} */ (response).text;
  }
  return String(response == null ? '' : response);
}

/**
 * Create a Level_Engine.
 *
 * @param {Object} deps
 * @param {{
 *   load: () => any,
 *   markCleared: (index: number, attempts: number, seconds: number, isoTs: string) => any,
 *   reset: () => any
 * }} deps.progressStore
 *   The Progress_Store instance. The engine reads via `load()`, writes
 *   via `markCleared(...)`, and clears via `reset()`.
 * @param {ReadonlyArray<import('./levels.js').LevelDef>} [deps.levels]
 *   The level table. Defaults to `LEVELS`.
 * @param {{ send: (req: { systemInstruction: string, userMessage: string, history: TranscriptEntry[] }) => Promise<any> }} deps.geminiClient
 *   The Gemini client wrapper (task 21). `send` resolves with the model
 *   text (or an object exposing a string `text`).
 * @param {(event: LevelEngineEvent, payload: any) => void} [deps.onEvent]
 *   Optional catch-all event callback. Called for every emitted event in
 *   addition to the handlers registered via `on`.
 * @returns {{
 *   init: (progress?: any) => void,
 *   getActiveLevel: () => import('./levels.js').LevelDef,
 *   setActiveLevel: (index: number) => void,
 *   submitMessage: (text: string) => Promise<void>,
 *   on: (event: LevelEngineEvent, handler: Function) => void,
 *   reset: () => void
 * }}
 */
export function createLevelEngine({ progressStore, levels = LEVELS, geminiClient, onEvent } = {}) {
  const levelCount = levels.length;

  /** Active level index, 1-based (REQ-2 §3). */
  let activeIndex = 1;

  /**
   * Per-level state, indexed 0..levelCount-1 for levels 1..levelCount.
   * @type {LevelState[]}
   */
  const levelState = new Array(levelCount).fill('IDLE');

  /**
   * Per-level in-memory attempts counter, indexed 0-based.
   * @type {number[]}
   */
  const attempts = new Array(levelCount).fill(0);

  /**
   * Per-level timing anchor (ms since epoch) for the current ACTIVE
   * session, or null until the first user message. Indexed 0-based.
   * @type {(number | null)[]}
   */
  const startedAt = new Array(levelCount).fill(null);

  /**
   * In-memory transcripts keyed by 1-based level index.
   * @type {Map<number, TranscriptEntry[]>}
   */
  const transcripts = new Map();
  for (let i = 1; i <= levelCount; i += 1) {
    transcripts.set(i, []);
  }

  /**
   * Event listeners keyed by event name.
   * @type {Map<string, Set<Function>>}
   */
  const listeners = new Map();

  /**
   * Register an event handler.
   *
   * @param {LevelEngineEvent} event
   * @param {Function} handler
   * @returns {void}
   */
  function on(event, handler) {
    if (typeof handler !== 'function') {
      return;
    }
    let set = listeners.get(event);
    if (!set) {
      set = new Set();
      listeners.set(event, set);
    }
    set.add(handler);
  }

  /**
   * Emit an event to all registered handlers and the optional
   * catch-all `onEvent` callback. Handler exceptions are isolated so one
   * bad subscriber cannot break the engine or other subscribers.
   *
   * @param {LevelEngineEvent} event
   * @param {any} payload
   * @returns {void}
   */
  function emit(event, payload) {
    const set = listeners.get(event);
    if (set) {
      for (const handler of set) {
        try {
          handler(payload);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error(`[chat-attack] level-engine listener for "${event}" threw`, err);
        }
      }
    }
    if (typeof onEvent === 'function') {
      try {
        onEvent(event, payload);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`[chat-attack] level-engine onEvent for "${event}" threw`, err);
      }
    }
  }

  /**
   * Index (1-based) of the lowest level whose `cleared` is false, or
   * `levelCount` when every level is cleared (REQ-2 §3 mapping).
   *
   * @param {{ levels: { cleared: boolean }[] }} record
   * @returns {number}
   */
  function firstUnclearedIndex(record) {
    for (let i = 0; i < levelCount; i += 1) {
      if (!record.levels[i] || record.levels[i].cleared !== true) {
        return i + 1;
      }
    }
    return levelCount;
  }

  /**
   * Read whether the level at the given 1-based index is recorded as
   * cleared in the latest progress snapshot.
   *
   * @param {number} index
   * @returns {boolean}
   */
  function isClearedInProgress(index) {
    const record = progressStore.load();
    const entry = record && record.levels ? record.levels[index - 1] : null;
    return !!(entry && entry.cleared === true);
  }

  /**
   * Initialize engine state from a progress record. Reads the passed-in
   * record or, when omitted, `progressStore.load()`. Reconstructs
   * `levelState`, `attempts`, and `activeIndex` (REQ-3 §4). A level whose
   * `cleared` is true starts as CLEARED.
   *
   * @param {{ levels: { cleared: boolean, attempts?: number }[] } | undefined} [progress]
   * @returns {void}
   */
  function init(progress) {
    const record = progress && progress.levels ? progress : progressStore.load();

    for (let i = 0; i < levelCount; i += 1) {
      const entry = record.levels[i] || {};
      const cleared = entry.cleared === true;
      levelState[i] = cleared ? 'CLEARED' : 'IDLE';
      attempts[i] = typeof entry.attempts === 'number' && entry.attempts >= 0 ? entry.attempts : 0;
      startedAt[i] = null;
    }

    // activeIndex = lowest uncleared level, or the last level when all
    // cleared (the selector handles UI; the engine just needs a sane
    // active level).
    activeIndex = firstUnclearedIndex(record);
  }

  /**
   * Return the active level definition.
   *
   * @returns {import('./levels.js').LevelDef}
   */
  function getActiveLevel() {
    return levels[activeIndex - 1];
  }

  /**
   * Switch the active level (REQ-2 §§5, 6, REQ-3 §11).
   *
   * A switch to level `n` is allowed iff `n` is cleared OR `n` is the
   * current lowest-uncleared level (`n <= firstUnclearedIndex`). Any
   * higher, still-locked level is rejected as a no-op that emits
   * `lockedAttempt` so the UI can surface the locked message.
   *
   * On a successful switch the engine resets the in-memory transcript
   * for `n` (REQ-2 §5), sets its state to CLEARED when progress says so
   * else IDLE, and emits `levelChanged`.
   *
   * @param {number} index 1-based level index.
   * @returns {void}
   */
  function setActiveLevel(index) {
    if (!Number.isInteger(index) || index < 1 || index > levelCount) {
      return;
    }

    const record = progressStore.load();
    const cleared = !!(record.levels[index - 1] && record.levels[index - 1].cleared === true);
    const unlockedCurrent = index <= firstUnclearedIndex(record);

    if (!cleared && !unlockedCurrent) {
      // REQ-2 §6 / REQ-3 §11: locked level, do not switch.
      emit('lockedAttempt', { index });
      return;
    }

    activeIndex = index;
    // REQ-2 §5: reset the in-memory transcript for the newly active level.
    transcripts.set(index, []);
    levelState[index - 1] = cleared ? 'CLEARED' : 'IDLE';
    startedAt[index - 1] = null;

    emit('levelChanged', { index, level: getActiveLevel() });
  }

  /**
   * Submit a user message on the active level.
   *
   * Flow (design.md §Level_Engine, task 19 contract):
   *   1. Resolve the active level L and index i.
   *   2. IDLE -> ACTIVE on the first user message; record `startedAt`
   *      (REQ-1 §5).
   *   3. Compose the defense pipeline for L.
   *   4. Run `beforeSend` (input filter).
   *   5. Increment attempts before sending (REQ-1 §6), whether or not
   *      the filter blocks. Push the user message to the transcript and
   *      emit `attemptIncremented`.
   *   6. If blocked, push a synthetic blocked system message, emit
   *      `messageReceived`, and return without calling Gemini.
   *   7. Otherwise call `geminiClient.send(...)`, run `afterReceive`
   *      (output filter) for display, push the assistant message, and
   *      emit `messageReceived`.
   *   8. Win check runs on the PRE-redaction raw response (REQ-1 §4).
   *   9. REQ-1 §8: secret in the user message but not the model response
   *      does not clear the level.
   *  10. On a first-time win, mark cleared synchronously (REQ-3 §3),
   *      enforce the unlock invariant (REQ-3 §11), set CLEARED, and emit
   *      `levelCleared`.
   *
   * @param {string} text The user's submitted message.
   * @returns {Promise<void>}
   */
  async function submitMessage(text) {
    const level = getActiveLevel();
    const i = activeIndex;
    const slot = i - 1;
    const transcript = transcripts.get(i);

    // 2. IDLE -> ACTIVE on the first user message of this session.
    if (levelState[slot] === 'IDLE') {
      levelState[slot] = 'ACTIVE';
      startedAt[slot] = Date.now();
    }

    // 3. Compose the defense pipeline for the active level.
    const pipeline = composeDefenses(level);

    // 4. Input filter.
    const decision = pipeline.beforeSend(text);

    // 5. Attempts increment before sending (REQ-1 §6).
    attempts[slot] += 1;
    transcript.push({ role: 'user', content: text });
    emit('attemptIncremented', { index: i, attempts: attempts[slot] });

    // 6. Short-circuit when the input filter blocks.
    if (decision && decision.allowed === false) {
      /** @type {TranscriptEntry} */
      const blockedMessage = {
        role: 'system',
        content: 'Your message was blocked by the input filter.',
        blocked: true,
        reason: decision.reason,
      };
      transcript.push(blockedMessage);
      emit('messageReceived', { index: i, ...blockedMessage });
      return;
    }

    // 7. Call Gemini and redact the response for display.
    const sanitizedMessage =
      decision && typeof decision.sanitizedMessage === 'string'
        ? decision.sanitizedMessage
        : text;

    const rawResult = await geminiClient.send({
      systemInstruction: pipeline.systemInstructionFor(level.secretWord),
      userMessage: sanitizedMessage,
      history: transcript,
    });
    const rawResponse = coerceResponseText(rawResult);

    const displayResponse = pipeline.afterReceive(rawResponse);
    transcript.push({ role: 'assistant', content: displayResponse });
    emit('messageReceived', {
      index: i,
      role: 'assistant',
      content: displayResponse,
      raw: rawResponse,
    });

    // 8. Win check on the PRE-redaction response (REQ-1 §4).
    const won = checkWin(rawResponse, level.secretWord);

    // 9. REQ-1 §8: secret only in the user message does not clear.
    // Detected for clarity; the only required behavior is "do not clear",
    // which falls out of the `won` gate below.
    if (!won && userEmittedSecret(text, level.secretWord)) {
      return;
    }

    // 10. First-time win: mark cleared synchronously and emit.
    if (won && levelState[slot] !== 'CLEARED') {
      // REQ-3 §11 unlock invariant: never clear level i while any lower
      // level remains uncleared. By construction activeIndex is either a
      // cleared level or the lowest uncleared one, so this holds; assert
      // it defensively.
      const record = progressStore.load();
      for (let j = 0; j < slot; j += 1) {
        if (!(record.levels[j] && record.levels[j].cleared === true)) {
          // eslint-disable-next-line no-console
          console.warn(
            `[chat-attack] refusing to clear level ${i}: lower level ${j + 1} is uncleared (REQ-3 §11)`
          );
          return;
        }
      }

      const anchor = startedAt[slot];
      const seconds = anchor === null ? 0 : Math.max(0, Math.floor((Date.now() - anchor) / 1000));
      const isoTs = new Date().toISOString();

      // Synchronous write before yielding (REQ-3 §3).
      progressStore.markCleared(i, attempts[slot], seconds, isoTs);
      levelState[slot] = 'CLEARED';

      emit('levelCleared', {
        index: i,
        level,
        secretWord: level.secretWord,
        userMessage: text,
        modelResponse: rawResponse,
        displayResponse,
        attempts: attempts[slot],
        seconds,
      });
    }
  }

  /**
   * Reset all progress and in-memory state (REQ-3 §7 flow). Clears the
   * Progress_Store, returns the engine to its initial state (level 1
   * active, everything IDLE), and emits `levelChanged` for level 1.
   *
   * @returns {void}
   */
  function reset() {
    progressStore.reset();
    activeIndex = 1;
    for (let i = 0; i < levelCount; i += 1) {
      levelState[i] = 'IDLE';
      attempts[i] = 0;
      startedAt[i] = null;
    }
    for (let i = 1; i <= levelCount; i += 1) {
      transcripts.set(i, []);
    }
    emit('levelChanged', { index: 1, level: getActiveLevel() });
  }

  return { init, getActiveLevel, setActiveLevel, submitMessage, on, reset };
}

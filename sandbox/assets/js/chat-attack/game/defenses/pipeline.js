/**
 * Defense pipeline composer.
 *
 * Wraps the three pure defense modules (input filter, output filter,
 * meta-classifier) into a single `DefensePipeline` object that the
 * Level_Engine drives for the active level. The composer itself is
 * pure: given the same `level`, it returns functionally identical
 * pipelines. Each returned method delegates to a pure function, so the
 * pipeline as a whole has no I/O, no global state, and no console
 * output (design.md §Defense_pipeline).
 *
 * `DefensePipeline` interface (matches design.md):
 *   - `beforeSend(userMessage)` → `{ allowed, reason?, sanitizedMessage }`
 *     Decides whether the user message may reach gemini-2.0-flash for
 *     the active level. Delegates to `applyInputFilter`.
 *   - `systemInstructionFor(secretWord)` → `string`
 *     Builds the final system-instruction string passed to the model.
 *     For consistency with REQ-1 §3 (each level's prompt embeds only
 *     that level's secret) we ignore the `secretWord` argument and use
 *     `level.systemInstruction`, which already embeds the level's own
 *     secret and, for Levels 6 and 7, the multilingual aliases. The
 *     argument is part of the interface for future flexibility (for
 *     example, a caller that wanted to swap the secret at runtime) but
 *     using it would risk leaking another level's secret into this
 *     level's prompt, so the composer ignores it.
 *   - `afterReceive(modelResponse)` → `string`
 *     Redacts the level's secret(s) from the model response for
 *     display. Delegates to `applyOutputFilter`. The Level_Engine still
 *     runs `checkWin` on the pre-redaction response (design.md
 *     §Defense_pipeline).
 *
 * @module chat-attack/game/defenses/pipeline
 */

import { applyInputFilter } from './input-filter.js';
import { applyOutputFilter } from './output-filter.js';
import { buildMetaInstruction } from './meta-classifier.js';

/**
 * @typedef {Object} InputFilterDecision
 * @property {boolean} allowed
 * @property {string=} reason
 * @property {string} sanitizedMessage
 */

/**
 * @typedef {Object} DefensePipeline
 * @property {(userMessage: string) => InputFilterDecision} beforeSend
 * @property {(secretWord?: string) => string} systemInstructionFor
 * @property {(modelResponse: string) => string} afterReceive
 */

/**
 * Compose the three pure defenses into a `DefensePipeline` for the
 * given level.
 *
 * @param {{ defenseLayer?: string, secretWord?: string,
 *           systemInstruction?: string,
 *           multilingualSecrets?: { en?: string, fr?: string, es?: string } }} level
 *   The active level definition. Must expose `defenseLayer` and
 *   `systemInstruction`. May expose `secretWord` and
 *   `multilingualSecrets`.
 * @returns {DefensePipeline} A pipeline whose methods delegate to the
 *   three pure defense modules and whose `systemInstructionFor` builds
 *   the final system-instruction string from the level's base prompt
 *   and the meta-classifier sentence (when present).
 */
export function composeDefenses(level) {
  const baseInstruction =
    level && typeof level.systemInstruction === 'string'
      ? level.systemInstruction
      : '';
  const metaInstruction = buildMetaInstruction(level);

  // Append the meta sentence only when it is non-empty AND not already
  // present verbatim in the level's base prompt. The current `levels.js`
  // already inlines the same sentence for Levels 5 and 7, so dedupe
  // keeps the final string identical to `level.systemInstruction`. If a
  // future `levels.js` change drops the inline meta sentence, this
  // branch automatically appends it so the meta defense still applies.
  const finalInstruction =
    metaInstruction !== '' && !baseInstruction.includes(metaInstruction)
      ? (baseInstruction === ''
          ? metaInstruction
          : `${baseInstruction} ${metaInstruction}`)
      : baseInstruction;

  return {
    /**
     * Run the input filter for the active level.
     *
     * @param {string} userMessage
     * @returns {InputFilterDecision}
     */
    beforeSend(userMessage) {
      return applyInputFilter(userMessage, level);
    },

    /**
     * Return the final system-instruction string for the active level.
     *
     * The `secretWord` parameter is part of the `DefensePipeline`
     * interface for future flexibility but is intentionally ignored
     * here: each level's `systemInstruction` already embeds only that
     * level's secret (REQ-1 §3), and using a caller-supplied secret
     * could leak another level's secret into this level's prompt.
     *
     * @param {string=} _secretWord
     * @returns {string}
     */
    systemInstructionFor(_secretWord) {
      return finalInstruction;
    },

    /**
     * Run the output filter for the active level.
     *
     * @param {string} modelResponse
     * @returns {string}
     */
    afterReceive(modelResponse) {
      return applyOutputFilter(modelResponse, level);
    },
  };
}

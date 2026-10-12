// Decides which article words a guess matches.

import { normalizeWord } from "./text.js";

/**
 * Create a matcher with an optional ordered list of key functions.
 * The first function that returns a key wins.
 * If no match is found, the word itself is the key.
 * @param {((normalizedWord: string) => string | null)[]} keyFunctions
 * @returns {{keyOf: (word: string) => string}}
 */
export function createMatcher(keyFunctions = []) {
  return {
    keyOf(word) {
      const normalized = normalizeWord(word);
      for (const keyFunction of keyFunctions) {
        const key = keyFunction(normalized);
        if (key) return key;
      }
      return normalized;
    },
  };
}

// Text utils (splitting and normalizing)

// A word is a span of letters and/or digits
const WORD_OR_GAP = /[\p{L}\p{N}]+|[^\p{L}\p{N}]+/gu;
const HAS_WORD_CHAR = /[\p{L}\p{N}]/u;

/**
 * Split text into words and gaps (space/punctuation).
 * @param {string} text
 * @returns {{text: string, isWord: boolean}[]}
 */
export function tokenize(text) {
  const pieces = text.normalize("NFC").match(WORD_OR_GAP) ?? [];
  return pieces.map((piece) => ({
    text: piece,
    isWord: HAS_WORD_CHAR.test(piece),
  }));
}

/**
 * Normalize and lowercase a word.
 * @param {string} word
 * @returns {string}
 */
export function normalizeWord(word) {
  return word.normalize("NFC").toLocaleLowerCase("nb");
}

/**
 * Normalize the input word.
 * Drops surrounding spaces and punctuation and lowercases.
 * Returns "" if the input has no word in it.
 * @param {string} rawGuess
 * @returns {string}
 */
export function processInput(rawGuess) {
  const word = tokenize(rawGuess.trim()).find((piece) => piece.isWord);
  return word ? normalizeWord(word.text) : "";
}

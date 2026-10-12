// Game state and rules.

import { normalizeWord, processInput, tokenize } from "./text.js";

// Stop words shown from the start.
const INITIALLY_REVEALED = ["og", "i", "det", "på", "som", "er", "en", "til", "å", "han"];

/**
 * @typedef {{
 *   id: number, text: string, isWord: boolean, key: string | null, revealed: boolean,
 *   shownPrefixLength: number,
 * }} Token
 * @typedef {{kind: "heading" | "paragraph", tokenIds: number[]}} TokenBlock
 * @typedef {{number: number, word: string, key: string, hits: number}} Guess
 * @typedef {"playing" | "won" | "gaveUp"} GameStatus
 * @typedef {
 *   | {status: "accepted", guess: Guess, newlyRevealedIds: number[], won: boolean}
 *   | {status: "duplicate", guess: Guess}
 *   | {status: "empty" | "gameOver"}
 * } GuessResult
 */

export class Game {
  /**
   * @param {import("./snl-api.js").Article} article
   * @param {{keyOf: (word: string) => string}} matcher
   */
  constructor(article, matcher) {
    this.article = article;
    this.matcher = matcher;
    /** @type {Token[]} */
    this.tokens = [];
    /** @type {Guess[]} */
    this.guesses = [];
    /** @type {GameStatus} */
    this.status = "playing";

    // Title and body become token blocks that share one token list.
    this.titleTokenIds = this.#addTokens(article.title);
    /** @type {TokenBlock[]} */
    this.blocks = article.blocks.map((block) => ({
      kind: block.kind,
      tokenIds: this.#addTokens(block.text),
    }));

    // Keys of the title words, used to keep them hidden in hints.
    this.titleKeys = new Set(
      this.titleTokenIds
        .map((id) => this.tokens[id].key)
        .filter((key) => key !== null),
    );

    // Show the common words from the start.
    const initialKeys = new Set(
      INITIALLY_REVEALED.map((word) => matcher.keyOf(word)),
    );
    for (const token of this.tokens) {
      if (token.isWord && initialKeys.has(token.key)) token.revealed = true;
    }
  }

  /** Number of guesses made so far. */
  get guessCount() {
    return this.guesses.length;
  }

  get isOver() {
    return this.status !== "playing";
  }

  /**
   * Try one guess and reveal matching words.
   * @param {string} rawGuess
   * @returns {GuessResult}
   */
  guess(rawGuess) {
    if (this.isOver) return { status: "gameOver" };

    const word = processInput(rawGuess);
    if (!word) return { status: "empty" };

    // Repeated guesses don't count.
    const key = this.matcher.keyOf(word);
    const previous = this.guesses.find((guess) => guess.key === key);
    if (previous) return { status: "duplicate", guess: previous };

    // Reveal every word with the same key.
    const matchingTokens = this.tokens.filter((token) => token.key === key);
    const newlyRevealedIds = [];
    for (const token of matchingTokens) {
      if (!token.revealed) {
        token.revealed = true;
        newlyRevealedIds.push(token.id);
      }
    }

    const guess = {
      number: this.guesses.length + 1,
      word: word,
      key,
      hits: matchingTokens.length,
    };
    this.guesses.push(guess);

    // Won when every title word is visible.
    const won = this.#isTitleRevealed();
    if (won) this.#finish("won");
    return { status: "accepted", guess, newlyRevealedIds, won };
  }

  /** Reveal everything and end the game. */
  giveUp() {
    if (!this.isOver) this.#finish("gaveUp");
  }

  /**
   * Ids of all tokens matching a guess key.
   * @param {string} key
   * @returns {number[]}
   */
  tokenIdsForKey(key) {
    return this.tokens
      .filter((token) => token.key === key)
      .map((token) => token.id);
  }

  /**
   * Reveal specific tokens. Returns the ones that were hidden.
   * @param {number[]} tokenIds
   * @returns {number[]}
   */
  revealTokens(tokenIds) {
    const newlyRevealedIds = tokenIds.filter((id) => !this.tokens[id].revealed);
    for (const id of newlyRevealedIds) this.tokens[id].revealed = true;
    return newlyRevealedIds;
  }

  /**
   * Show the first letter of the title's first word. Returns that token's id, or null.
   * @returns {number | null}
   */
  revealTitleFirstLetter() {
    const firstWord = this.titleTokenIds
      .map((id) => this.tokens[id])
      .find((token) => token.isWord);
    if (!firstWord || firstWord.revealed) return null;
    firstWord.shownPrefixLength = 1;
    return firstWord.id;
  }

  /**
   * Word tokens in the first sentence of the first paragraph, minus title words.
   * @returns {number[]}
   */
  firstSentenceTokenIds() {
    const firstParagraph = this.blocks.find(
      (block) => block.kind === "paragraph",
    );
    if (!firstParagraph) return [];

    // Walk until a gap with sentence-ending punctuation followed by a space.
    const sentenceIds = [];
    for (const id of firstParagraph.tokenIds) {
      const token = this.tokens[id];
      if (!token.isWord && /[.!?]\s/.test(token.text)) break;
      sentenceIds.push(id);
    }

    // Title words stay hidden.
    return sentenceIds.filter(
      (id) =>
        this.tokens[id].isWord && !this.titleKeys.has(this.tokens[id].key),
    );
  }

  /**
   * Checks whether a text contains a title word.
   * Also checks inside longer words ("Frankrikes").
   * Very short title words (like "og") are ignored.
   * @param {string} text
   * @returns {boolean}
   */
  textRevealsTitle(text) {
    const lowerText = normalizeWord(text);
    return this.titleTokenIds
      .map((id) => this.tokens[id])
      .filter((token) => token.isWord && token.text.length >= 3)
      .some((token) => lowerText.includes(normalizeWord(token.text)));
  }

  /**
   * Replace title words in a text with blocks.
   * @param {string} text
   * @returns {string}
   */
  maskTitleWords(text) {
    return tokenize(text)
      .map((piece) =>
        piece.isWord && this.titleKeys.has(this.matcher.keyOf(piece.text))
          ? "█".repeat(piece.text.length)
          : piece.text,
      )
      .join("");
  }

  /**
   * Add tokens for a text and return their ids.
   * @param {string} text
   * @returns {number[]}
   */
  #addTokens(text) {
    return tokenize(text).map((piece) => {
      const token = {
        id: this.tokens.length,
        text: piece.text,
        isWord: piece.isWord,
        key: piece.isWord ? this.matcher.keyOf(piece.text) : null,
        revealed: !piece.isWord,
        shownPrefixLength: 0,
      };
      this.tokens.push(token);
      return token.id;
    });
  }

  #isTitleRevealed() {
    return this.titleTokenIds.every((id) => this.tokens[id].revealed);
  }

  /** @param {GameStatus} status */
  #finish(status) {
    this.status = status;
    for (const token of this.tokens) token.revealed = true;
  }
}

// UI

const MASK_CHARACTER = "█";

/**
 * @typedef {import("./game.js").Game} Game
 * @typedef {import("./game.js").Guess} Guess
 */

export class GameView {
  /**
   * @param {{
   *   title: HTMLElement, article: HTMLElement, guessList: HTMLElement,
   *   guessCount: HTMLElement, message: HTMLElement, end: HTMLElement,
   * }} elements
   */
  constructor(elements) {
    this.elements = elements;
    /** @type {Map<number, HTMLSpanElement>} */
    this.tokenSpans = new Map();
    /** @type {Map<string, HTMLTableRowElement>} */
    this.guessRows = new Map();
    /** @type {{key: string, position: number} | null} */
    this.selection = null;
    /** @type {Game | null} */
    this.game = null;
  }

  /**
   * Draw a new game.
   * @param {Game} game
   */
  renderGame(game) {
    this.game = game;
    this.tokenSpans.clear();
    this.guessRows.clear();
    this.selection = null;

    // Title and article blocks.
    this.elements.title.replaceChildren(...this.#spansFor(game.titleTokenIds));
    this.elements.article.replaceChildren(
      ...game.blocks.map((block) => {
        const element = document.createElement(
          block.kind === "heading" ? "h3" : "p",
        );
        element.append(...this.#spansFor(block.tokenIds));
        return element;
      }),
    );

    // Empty guess list and end screen.
    this.elements.guessList.replaceChildren();
    this.elements.end.hidden = true;
    this.elements.end.replaceChildren();
    this.showMessage("");
    this.#updateGuessCount();
  }

  /**
   * Show a newly accepted guess and the words it revealed.
   * @param {Guess} guess
   * @param {number[]} newlyRevealedIds
   */
  addGuess(guess, newlyRevealedIds) {
    // New row at the top of the list.
    const row = document.createElement("tr");
    row.className = guess.hits === 0 ? "guess no-hits" : "guess";
    row.tabIndex = 0;
    row.title =
      guess.hits === 0 ? "Ingen treff" : "Klikk for å hoppe til treffene i artikkelen";
    for (const value of [guess.number, guess.word, guess.hits]) {
      const cell = document.createElement("td");
      cell.textContent = String(value);
      row.append(cell);
    }
    row.addEventListener("click", () =>
      this.#stepThroughOccurrences(guess.key),
    );
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        this.#stepThroughOccurrences(guess.key);
      }
    });
    this.elements.guessList.prepend(row);
    this.guessRows.set(guess.key, row);

    this.revealTokens(newlyRevealedIds);

    // Highlight the latest guess, without scrolling.
    this.#select(guess.key);
    this.#updateGuessCount();
  }

  /**
   * Reveal correctly guessed words.
   * @param {number[]} tokenIds
   */
  revealTokens(tokenIds) {
    for (const id of tokenIds) {
      this.#updateToken(id);
      this.#playAnimation(this.tokenSpans.get(id), "just-revealed");
    }
  }

  /**
   * Flash a word that was already guessed.
   * @param {Guess} guess
   */
  flashDuplicate(guess) {
    const row = this.guessRows.get(guess.key);
    this.#playAnimation(row, "flash");
    row?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    this.#select(guess.key);
  }

  /** @param {string} text */
  showMessage(text) {
    this.elements.message.textContent = text;
  }

  /** Reveal everything and show the win or give-up screen. */
  renderEnd() {
    const game = this.game;
    if (!game) return;
    for (const id of this.tokenSpans.keys()) this.#updateToken(id);

    // Summary text.
    const summary = document.createElement("p");
    summary.className = game.status === "won" ? "end-won" : "end-gave-up";
    summary.textContent =
      game.status === "won"
        ? `🎉 Du fant "${game.article.title}" på ${game.guessCount} gjett!`
        : `Svaret var "${game.article.title}". Du ga opp etter ${game.guessCount} gjett.`;

    // Link to the real article.
    const link = document.createElement("a");
    link.href = `https://snl.no/${encodeURIComponent(game.article.slug)}`;
    link.textContent = "Les artikkelen på snl.no";
    link.target = "_blank";
    link.rel = "noopener noreferrer";

    this.elements.end.replaceChildren(summary, link);

    // Article image, if there is one.
    if (game.article.imageUrl) {
      const image = document.createElement("img");
      image.src = game.article.imageUrl;
      image.alt = `Bilde fra artikkelen "${game.article.title}"`;
      image.id = "end-image";
      this.elements.end.append(image);
    }
    this.elements.end.hidden = false;
  }

  /**
   * Build spans for a list of token ids.
   * @param {number[]} tokenIds
   * @returns {HTMLSpanElement[]}
   */
  #spansFor(tokenIds) {
    return tokenIds.map((id) => {
      const span = document.createElement("span");
      this.tokenSpans.set(id, span);
      this.#updateToken(id);
      return span;
    });
  }

  /**
   * Show a token as either hidden blocks or real text.
   * @param {number} id
   */
  #updateToken(id) {
    const token = this.game?.tokens[id];
    const span = this.tokenSpans.get(id);
    if (!token || !span) return;
    if (token.revealed) {
      span.textContent = token.text;
      span.className = token.isWord ? "word revealed" : "gap";
      span.removeAttribute("title");
    } else {
      // Hidden, except for any letters a hint has shown.
      const prefixLength = token.shownPrefixLength;
      const mask = MASK_CHARACTER.repeat(token.text.length - prefixLength);
      if (prefixLength > 0) {
        const prefix = document.createElement("span");
        prefix.className = "shown-prefix";
        prefix.textContent = token.text.slice(0, prefixLength);
        span.replaceChildren(prefix, mask);
      } else {
        span.textContent = mask;
      }
      span.className = "word censored";
      span.title = `${token.text.length} tegn`;
    }
  }

  /**
   * Highlight all words for a key; clicking again jumps to the next one.
   * @param {string} key
   */
  #stepThroughOccurrences(key) {
    const ids = this.game?.tokenIdsForKey(key) ?? [];
    if (ids.length === 0) return;

    // Same guess clicked again: move on to the next occurrence.
    const position =
      this.selection?.key === key
        ? (this.selection.position + 1) % ids.length
        : 0;
    this.#select(key, position);

    // Scroll the current occurrence into view.
    this.tokenSpans
      .get(ids[position])
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  /**
   * Mark the words for one key and the selected guess row.
   * @param {string} key
   * @param {number} position index of the "current" occurrence, or -1 for none
   */
  #select(key, position = -1) {
    // Clear the old highlight.
    for (const span of document.querySelectorAll(".highlight")) {
      span.classList.remove("highlight", "highlight-current");
    }
    for (const row of this.guessRows.values()) row.classList.remove("selected");

    // Add the new one.
    const ids = this.game?.tokenIdsForKey(key) ?? [];
    ids.forEach((id, index) => {
      const span = this.tokenSpans.get(id);
      span?.classList.add("highlight");
      if (index === position) span?.classList.add("highlight-current");
    });
    this.guessRows.get(key)?.classList.add("selected");
    this.selection = { key, position };
  }

  #updateGuessCount() {
    this.elements.guessCount.textContent = String(this.game?.guessCount ?? 0);
  }

  /**
   * Restart a CSS animation class on an element.
   * @param {HTMLElement | undefined} element
   * @param {string} className
   */
  #playAnimation(element, className) {
    if (!element) return;
    element.classList.remove(className);
    void element.offsetWidth;
    element.classList.add(className);
    element.addEventListener(
      "animationend",
      () => element.classList.remove(className),
      { once: true },
    );
  }
}

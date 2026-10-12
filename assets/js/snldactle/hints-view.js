// Draws the hint box

import { nextLockedHint } from "./hints.js";

/** @typedef {import("./hints.js").Hint} Hint */

export class HintsView {
  /**
   * @param {{list: HTMLElement, next: HTMLElement}} elements
   */
  constructor(elements) {
    this.elements = elements;
    /** @type {Hint[]} */
    this.hints = [];
    /** @type {HTMLImageElement | null} */
    this.image = null;
  }

  /**
   * Start over with the hints for a new game.
   * @param {Hint[]} hints
   */
  reset(hints) {
    this.hints = hints;
    this.image = null;
    this.elements.list.replaceChildren();
    this.updateNext(0);
  }

  /**
   * Add one unlocked hint to the list.
   * @param {Hint} hint
   */
  unlock(hint) {
    const { text, imageUrl, imageBlurPx, showsCard = true } = hint.content;

    // Hints without a card just change what's already on the page.
    if (!showsCard) {
      if (imageBlurPx !== undefined) this.#setBlur(imageBlurPx);
      return;
    }

    const item = document.createElement("li");
    item.className = "hint just-unlocked";

    // Label and text.
    const label = document.createElement("strong");
    label.textContent = `${hint.label}: `;
    item.append(label);
    if (text) item.append(text);

    // A new image, or a sharper version of the existing one.
    if (imageUrl) {
      this.image = document.createElement("img");
      this.image.src = imageUrl;
      this.image.alt = "Uskarpt bilde fra artikkelen";
      this.image.className = "hint-image";

      // The frame clips the blur so it doesn't spill outside the image.
      const frame = document.createElement("div");
      frame.className = "hint-image-frame";
      frame.append(this.image);
      item.append(frame);
    }
    if (imageBlurPx !== undefined) this.#setBlur(imageBlurPx);

    this.elements.list.append(item);
  }

  /**
   * Show how many guesses are left until the next hint.
   * @param {number} guessCount
   */
  updateNext(guessCount) {
    const next = nextLockedHint(this.hints, guessCount);
    if (!next) {
      this.elements.next.textContent = this.hints.length
        ? "Alle hint er låst opp."
        : "";
      return;
    }
    const remaining = next.afterGuesses - guessCount;
    this.elements.next.textContent = `Neste hint (${next.label.toLowerCase()}) om ${remaining} gjett.`;
  }

  /** Game over: sharpen the image and drop the "next hint" line. */
  finish() {
    this.#setBlur(0);
    this.elements.next.textContent = "";
  }

  /** @param {number} blurPx */
  #setBlur(blurPx) {
    if (this.image)
      this.image.style.filter = blurPx > 0 ? `blur(${blurPx}px)` : "none";
  }
}

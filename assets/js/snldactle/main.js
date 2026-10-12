// Picks an article and starts game.

import { fetchArticle } from "./snl-api.js";
import { createMatcher } from "./matcher.js";
import { Game } from "./game.js";
import { GameView } from "./ui.js";
import { buildHints, hintsUnlockedBetween } from "./hints.js";
import { HintsView } from "./hints-view.js";

// Temporary pool until daily function
const ARTICLE_NAMES = [
  "sperregrense",
  "Moldova",
  "Frankrike",
  "Chile",
  "Antarktis",
  "Senterpartiet",
  "sjakk",
  "internett",
];

const form = /** @type {HTMLFormElement} */ (
  document.getElementById("guess-form")
);
const guessInput = /** @type {HTMLInputElement} */ (
  document.getElementById("guess")
);
const submitButton = /** @type {HTMLButtonElement} */ (
  document.getElementById("submit")
);
const giveUpButton = /** @type {HTMLButtonElement} */ (
  document.getElementById("give-up")
);

/**
 * Look up an element by id, failing loudly if the HTML doesn't have it.
 * @param {string} id
 * @returns {HTMLElement}
 */
function requireElement(id) {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Fant ikke #${id} i snldactle.html`);
  return element;
}

const view = new GameView({
  title: requireElement("article-title"),
  article: requireElement("article"),
  guessList: requireElement("guess-list"),
  guessCount: requireElement("guess-count"),
  message: requireElement("message"),
  end: requireElement("game-ended"),
});

const hintsView = new HintsView({
  list: document.getElementById("hint-list"),
  next: document.getElementById("next-hint"),
});

setUpHelp({
  openButton: /** @type {HTMLButtonElement} */ (
    document.getElementById("help-open")
  ),
  dialog: /** @type {HTMLDialogElement} */ (
    document.getElementById("help-dialog")
  ),
  hintList: document.getElementById("help-hints"),
});

/** @type {Game | null} */
let game = null;
/** @type {import("./hints.js").Hint[]} */
let hints = [];

/**
 * Pick a random article from a list.
 * @param {string[]} articles
 * @returns {string}
 */
function pickRandom(articles) {
  return articles[Math.floor(Math.random() * articles.length)];
}

/**
 * Enable or disable the guess controls.
 * @param {boolean} enabled
 */
function setControlsEnabled(enabled) {
  guessInput.disabled = !enabled;
  submitButton.disabled = !enabled;
  giveUpButton.disabled = !enabled;
}

/**
 * Fetch an article and start a new game with it.
 * @param {string} slug
 */
async function startGame(slug) {
  view.showMessage("Henter artikkel ...");
  let article;
  try {
    article = await fetchArticle(slug);
  } catch (error) {
    console.error(error);
    view.showMessage("Klarte ikke å hente artikkelen.");
    return;
  }

  game = new Game(article, createMatcher());
  hints = buildHints(game);
  view.renderGame(game);
  hintsView.reset(hints);
  setControlsEnabled(true);
  guessInput.focus();
}

/**
 * Show hints unlocked by the latest guess, and apply their effects.
 * @param {Game} currentGame
 */
function unlockHints(currentGame) {
  const count = currentGame.guessCount;
  for (const hint of hintsUnlockedBetween(hints, count - 1, count)) {
    hintsView.unlock(hint);

    // Some hints uncover words in the article.
    const tokenIds = hint.content.revealTokenIds;
    if (tokenIds) view.revealTokens(currentGame.revealTokens(tokenIds));

    // The first-letter hint uncovers part of the title.
    if (hint.content.revealTitleFirstLetter) {
      const tokenId = currentGame.revealTitleFirstLetter();
      if (tokenId !== null) view.revealTokens([tokenId]);
    }
  }
  hintsView.updateNext(count);
}

/** Lock the controls and show the end screen. */
function endGame() {
  setControlsEnabled(false);
  view.renderEnd();
  hintsView.finish();
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const rawGuess = guessInput.value.trim();

  // Only one word per guess.
  if (/\s/.test(rawGuess)) {
    view.showMessage(MESSAGES.multipleWords);
    guessInput.focus();
    return;
  }

  // Try the guess, then clear the field.
  const result = game.guess(rawGuess);
  guessInput.value = "";
  guessInput.focus();

  // Update the page based on the result.
  if (result.status === "accepted") {
    view.showMessage("");
    view.addGuess(result.guess, result.newlyRevealedIds);
    if (result.won) endGame();
    else unlockHints(game);
  } else if (result.status === "duplicate") {
    view.showMessage("Allerede gjetta.");
    view.flashDuplicate(result.guess);
  } else if (result.status === "multipleWords") {
    view.showMessage("Ett ord om gangen!");
  } else {
    view.showMessage("");
  }
});

let giveUpArmedTimer = 0;
giveUpButton.addEventListener("click", () => {
  if (!game || game.isOver) return;
  if (!giveUpArmedTimer) {
    giveUpButton.textContent = "Sikker?";
    giveUpArmedTimer = window.setTimeout(resetGiveUpButton, 3000);
    return;
  }
  resetGiveUpButton();
  game.giveUp();
  endGame();
});

function resetGiveUpButton() {
  window.clearTimeout(giveUpArmedTimer);
  giveUpArmedTimer = 0;
  giveUpButton.textContent = "Gi opp";
}

await startGame(pickRandom(ARTICLE_NAMES));

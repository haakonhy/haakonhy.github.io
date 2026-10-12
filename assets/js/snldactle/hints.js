// The hint ladder

/**
 * @typedef {import("./game.js").Game} Game
 * @typedef {"subject" | "image" | "person" | "sharperImage" | "firstSentence" | "firstLetter"} HintId
 * @typedef {{
 *   text?: string,
 *   imageUrl?: string,
 *   imageBlurPx?: number,
 *   revealTokenIds?: number[],
 *   revealTitleFirstLetter?: boolean,
 *   showsCard?: boolean,
 * }} HintContent
 * @typedef {{id: HintId, afterGuesses: number, label: string, content: HintContent}} Hint
 */

/** @type {{id: HintId, afterGuesses: number, label: string, description: string}[]} */
export const HINT_LADDER = [
  {
    id: "subject",
    afterGuesses: 10,
    label: "Fagområde",
    description: "hvilket fagområde artikkelen hører til",
  },
  {
    id: "image",
    afterGuesses: 20,
    label: "Bilde",
    description: "et uskarpt bilde fra artikkelen",
  },
  {
    id: "person",
    afterGuesses: 30,
    label: "Person",
    description: "yrke og årstall, hvis artikkelen handler om en person",
  },
  {
    id: "sharperImage",
    afterGuesses: 40,
    label: "Skarpere bilde",
    description: "bildet blir skarpere",
  },
  {
    id: "firstSentence",
    afterGuesses: 50,
    label: "Første setning",
    description: "første setning avsløres (unntatt tittelordene)",
  },
  {
    id: "firstLetter",
    afterGuesses: 60,
    label: "Første bokstav",
    description: "første bokstav i tittelen vises",
  },
];

// How blurry the image is, before and after the "sharperImage" hint.
const STRONG_BLUR_PX = 16;
const LIGHT_BLUR_PX = 5;

/** @type {Record<HintId, (game: Game) => HintContent | null>} */
const HINT_BUILDERS = {
  subject: (game) => {
    const subject = game.article.subjectTitle;
    // Skip it when the subject gives the title away (e.g. "Antarktis" in "Antarktis").
    if (!subject || game.textRevealsTitle(subject)) return null;
    return { text: subject };
  },

  image: (game) => {
    const url = game.article.imageUrl;
    return url ? { imageUrl: url, imageBlurPx: STRONG_BLUR_PX } : null;
  },

  person: (game) => {
    const person = game.article.person;
    if (!person) return null;

    // E.g. "Forfatter, 1946–2020" or "Forfatter, født 1946".
    const parts = [];
    if (person.occupation)
      parts.push(capitalize(game.maskTitleWords(person.occupation)));
    if (person.birthYear && person.deathYear)
      parts.push(`${person.birthYear}–${person.deathYear}`);
    else if (person.birthYear) parts.push(`født ${person.birthYear}`);
    return { text: parts.join(", ") };
  },

  sharperImage: (game) =>
    game.article.imageUrl
      ? { imageBlurPx: LIGHT_BLUR_PX, showsCard: false }
      : null,

  firstSentence: (game) => {
    const tokenIds = game.firstSentenceTokenIds();
    return tokenIds.length > 0
      ? { revealTokenIds: tokenIds, showsCard: false }
      : null;
  },

  firstLetter: (game) =>
    game.titleTokenIds.length > 0
      ? { revealTitleFirstLetter: true, showsCard: false }
      : null,
};

/**
 * Build the hints this article has data for, in unlock order.
 * @param {Game} game
 * @returns {Hint[]}
 */
export function buildHints(game) {
  return HINT_LADDER.map((step) => ({
    ...step,
    content: HINT_BUILDERS[step.id](game),
  }))
    .filter((hint) => hint.content !== null)
    .map((hint) => /** @type {Hint} */ (hint));
}

/**
 * Hints that unlock when the guess count goes from `before` to `after`.
 * @param {Hint[]} hints
 * @param {number} before
 * @param {number} after
 * @returns {Hint[]}
 */
export function hintsUnlockedBetween(hints, before, after) {
  return hints.filter(
    (hint) => hint.afterGuesses > before && hint.afterGuesses <= after,
  );
}

/**
 * The next locked hint, or null if all are unlocked.
 * @param {Hint[]} hints
 * @param {number} guessCount
 * @returns {Hint | null}
 */
export function nextLockedHint(hints, guessCount) {
  return hints.find((hint) => hint.afterGuesses > guessCount) ?? null;
}

/**
 * @param {string} text
 * @returns {string}
 */
function capitalize(text) {
  return text.charAt(0).toLocaleUpperCase("nb") + text.slice(1);
}

// Fetches an article from Store norske leksikon and turns it into plain blocks.

// Block-level tags to be kept. Everything else is flattened.
const BLOCK_SELECTOR = "h1, h2, h3, h4, h5, h6, p, li";

/**
 * @typedef {{kind: "heading" | "paragraph", text: string}} ArticleBlock
 * @typedef {{
 *   articleName: string,
 *   title: string,
 *   blocks: ArticleBlock[],
 *   imageUrl: string | null,
 *   subjectTitle: string | null,
 *   authors: string[],
 *   person: PersonFacts | null,
 * }} Article
 * @typedef {{occupation: string | null, birthYear: string | null, deathYear: string | null}} PersonFacts
 */

/**
 * Fetch one SNL article by its articleName, e.g. "sjakk".
 * @param {string} articleName
 * @returns {Promise<Article>}
 */
export async function fetchArticle(articleName) {
  const response = await fetch(
    `https://snl.no/${encodeURIComponent(articleName)}.json`,
  );
  if (!response.ok) {
    throw new Error(
      `Henting av artikkel "${articleName}" ga ${response.status}: ${response.statusText}`,
    );
  }
  const data = await response.json();
  return {
    articleName,
    title: data.title,
    blocks: htmlToBlocks(data.xhtml_body ?? ""),
    imageUrl: firstImageUrl(data.images),
    subjectTitle: data.subject_title ?? null,
    authors: (data.authors ?? []).map((author) => author.full_name),
    person: personFacts(data),
  };
}

/**
 * Turn SNL's article HTML into headings and paragraphs of plain text.
 * @param {string} html
 * @returns {ArticleBlock[]}
 */
export function htmlToBlocks(html) {
  // Parse without running scripts or loading images.
  const doc = new DOMParser().parseFromString(html, "text/html");

  // Skip figures and image captions.
  doc
    .querySelectorAll("figure, figcaption, img")
    .forEach((element) => element.remove());

  // Keep only the innermost blocks, so a <p> inside an <li> isn't counted twice.
  const blocks = [...doc.body.querySelectorAll(BLOCK_SELECTOR)]
    .filter((element) => !element.querySelector(BLOCK_SELECTOR))
    .map((element) => ({
      kind: /^H\d$/.test(element.tagName) ? "heading" : "paragraph",
      text: element.textContent.replace(/\s+/g, " ").trim(),
    }))
    .filter((block) => block.text.length > 0);

  // Fall back to one big paragraph if the HTML had no block tags.
  if (blocks.length === 0) {
    const text = doc.body.textContent.replace(/\s+/g, " ").trim();
    return text ? [{ kind: "paragraph", text }] : [];
  }
  return blocks;
}

/**
 * @param {{standard_size_url?: string, full_size_url?: string}[] | undefined} images
 * @returns {string | null}
 */
function firstImageUrl(images) {
  const image = images?.[0];
  return image?.standard_size_url ?? image?.full_size_url ?? null;
}

/**
 * Pick out occupation and life years for articles about people.
 * @param {any} data
 * @returns {PersonFacts | null}
 */
function personFacts(data) {
  const metadata = data.metadata ?? {};

  // Occupation from metadata, or else from the professions list.
  const professions = (data.professions ?? [])
    .map((profession) =>
      typeof profession === "string"
        ? profession
        : (profession?.title ?? profession?.name),
    )
    .filter(Boolean);
  const occupation = metadata.occupation || professions.join(", ") || null;

  const birthYear = yearIn(metadata.birth_date);
  const deathYear = yearIn(metadata.death_date);
  if (!occupation && !birthYear) return null;
  return { occupation, birthYear, deathYear };
}

/**
 * Find a year in a date string like "1946-06-14" or "14. juni 1946".
 * @param {unknown} date
 * @returns {string | null}
 */
function yearIn(date) {
  if (typeof date !== "string") return null;
  return date.match(/\d{3,4}/)?.[0] ?? null;
}

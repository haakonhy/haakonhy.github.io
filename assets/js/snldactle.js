let rawTitle = "";
let rawText = "";
let imageUrl = null;

// Fjerner HTML fra xhtml_body
function stripHtml(html) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
}

// Henter data fra SNL-url og kaller initializeGame()
async function fetchSNLData(article) {
  const resp = await fetch(`https://snl.no/${article}.json`);
  const data = await resp.json();
  rawTitle = data.title;
  rawText = stripHtml(data.xhtml_body);
  if (data.images && data.images.length > 0 && data.images[0].full_size_url) {
    imageUrl = data.images[0].full_size_url;
  }
  initializeGame();
}

// Starter spillet
function initializeGame() {
  tokens.length = 0;
  tokenize(rawText).forEach((t) => {
    const isWord = /\w/.test(t);
    tokens.push({
      text: t,
      norm: isWord ? t : null,
      isWord,
      revealed: false,
    });
  });

  // Vis standardord (topp 10 frekvente)
  const initialRevealedWords = [
    "og",
    "i",
    "det",
    "på",
    "som",
    "er",
    "en",
    "til",
    "å",
    "han",
  ];
  tokens.forEach((t) => {
    if (t.isWord && initialRevealedWords.includes(t.norm)) {
      t.revealed = true;
    }
  });
  renderArticle();
  guessesEl.innerHTML = "";
  winEl.hidden = true;
}

function normalizeWord(w) {
  // Gjør om til små bokstaver
  return w.replace(/^[^\w']+|[^\w']+$/g, "").toLowerCase();
}

function tokenize(text) {
  // Skiller ut tegnsetting
  const re = /(\s+|[^\s]+)/g;
  return Array.from(text.matchAll(re), (m) => m[0]);
}

const tokens = [];
const articleEl = document.getElementById("article");

function renderArticle() {
  articleEl.innerHTML = "";
  tokens.forEach((token, i) => {
    const span = document.createElement("span");
    span.className = "token";
    if (token.isWord && !token.revealed) {
      const mask = "█".repeat(normalizeWord(token.text).length);
      span.textContent = mask;
      span.classList.add("censored");
      span.title = "Guess this word";
    } else {
      span.textContent = token.text;
      span.classList.add("revealed");
    }
    articleEl.appendChild(span);
  });
}

const guessInput = document.getElementById("guess");
const submitBtn = document.getElementById("submit");
const guessesEl = document.getElementById("guesses");
const winEl = document.getElementById("win");
const guessedSet = new Set();

function handleGuess(rawGuess) {
  const g = normalizeWord(rawGuess || "");
  if (!g) return;
  if (guessedSet.has(g)) return; // ignorerer gjentagelser
  guessedSet.add(g);
  // Tidligere gjett
  const pill = document.createElement("span");
  pill.textContent = rawGuess;
  pill.style.marginRight = "6px";
  guessesEl.appendChild(pill);

  // Riktig tittel?
  if (g === normalizeWord(rawTitle)) {
    // Vis alle
    tokens.forEach((t) => (t.revealed = true));
    renderArticle();
    winEl.hidden = false;
    // Vis bilde, hvis det finnes
    if (imageUrl) {
      let img = document.createElement("img");
      img.src = imageUrl;
      img.alt = "Artikkelbilde";
      img.id = "win-image";
      img.style.maxWidth = "100%";
      img.style.display = "block";
      img.style.margin = "1em auto";
      winEl.appendChild(img);
    }
    return;
  }

  // Riktig ord?
  let found = false;
  tokens.forEach((t) => {
    if (t.isWord && t.norm === g) {
      t.revealed = true;
      found = true;
    }
  });

  if (!found) {
    const no = document.createElement("span");
    no.textContent = "";
    no.style.color = "#a00";
    guessesEl.appendChild(no);
  }

  renderArticle();
}

submitBtn.addEventListener("click", () => {
  handleGuess(guessInput.value);
  guessInput.value = "";
  guessInput.focus();
});
guessInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    submitBtn.click();
  }
});

function getRandomArticle() {
  articles = ["sperregrense", "Moldova", "Frankrike", "Chile", "Antarktis", "Senterpartiet", "sjakk", "internett"]
  return articles[Math.floor(Math.random() * articles.length)];
}

fetchSNLData(getRandomArticle());

const WORDS_URL = "./data/woerter.md";
const MNEMONICS_URL = "./data/eselsbruecken.md";
const STORAGE_KEY = "artikeltrainer.v1";
const TARGET_QUEUE = 30;

const fallbackWords = [
  { word: "Baum", article: "der", ending: "-aum", example: "Der Baum ist hoch." },
  { word: "Sonne", article: "die", ending: "-e", example: "Die Sonne scheint." },
  { word: "Auto", article: "das", ending: "-o", example: "Das Auto ist neu." }
];

const state = {
  words: [],
  mnemonics: new Map(),
  queue: [],
  current: null,
  stats: loadStats()
};

const ui = {
  word: document.querySelector("#wordDisplay"),
  ending: document.querySelector("#endingDisplay"),
  example: document.querySelector("#exampleDisplay"),
  feedback: document.querySelector("#feedback"),
  next: document.querySelector("#nextBtn"),
  buttons: Array.from(document.querySelectorAll(".choice")),
  queueBadge: document.querySelector("#queueBadge"),
  onlineBadge: document.querySelector("#onlineBadge"),
  statsArticle: document.querySelector("#statsArticle"),
  statsDay: document.querySelector("#statsDay"),
  statsEnding: document.querySelector("#statsEnding"),
  mistakeList: document.querySelector("#mistakeList")
};

init().catch((error) => {
  console.error(error);
  ui.feedback.textContent = "Fehler beim Laden. Offline-Fallback aktiv.";
  state.words = fallbackWords;
  fillQueue();
  showNextWord();
});

async function init() {
  await registerServiceWorker();
  const [wordsText, mnemonicText] = await Promise.all([
    fetchText(WORDS_URL),
    fetchText(MNEMONICS_URL)
  ]);

  state.words = parseMarkdownTable(wordsText)
    .map((row, idx) => ({
      id: String(idx + 1),
      word: row.Wort?.trim(),
      article: row.Artikel?.trim(),
      ending: row.Endung?.trim() || detectEnding(row.Wort?.trim() || ""),
      example: row.Beispielsatz?.trim() || ""
    }))
    .filter((entry) => entry.word && ["der", "die", "das"].includes(entry.article));

  state.mnemonics = new Map(
    parseMarkdownTable(mnemonicText)
      .filter((row) => row.Wort && row.Eselsbruecke)
      .map((row) => [row.Wort.trim().toLowerCase(), row.Eselsbruecke.trim()])
  );

  if (state.words.length === 0) {
    state.words = fallbackWords;
  }

  attachEvents();
  syncOnlineStatus();
  fillQueue();
  showNextWord();
  renderStats();
}

function attachEvents() {
  ui.buttons.forEach((button) => {
    button.addEventListener("click", () => handleChoice(button.dataset.article));
  });

  ui.next.addEventListener("click", () => {
    showNextWord();
  });

  window.addEventListener("online", syncOnlineStatus);
  window.addEventListener("offline", syncOnlineStatus);
}

function fillQueue() {
  const inQueue = new Set(state.queue.map((item) => item.word.toLowerCase()));
  let guard = 0;

  while (state.queue.length < TARGET_QUEUE && guard < TARGET_QUEUE * 20) {
    guard += 1;
    const candidate = pickWeightedWord();
    if (!candidate) break;

    if (!inQueue.has(candidate.word.toLowerCase()) || inQueue.size >= state.words.length) {
      state.queue.push(candidate);
      inQueue.add(candidate.word.toLowerCase());
    }
  }

  ui.queueBadge.textContent = `Queue: ${state.queue.length}/${TARGET_QUEUE}`;
}

function pickWeightedWord() {
  if (state.words.length === 0) return null;

  const weighted = state.words.map((entry) => {
    const wordStat = state.stats.byWord[entry.word] || { wrong: 0, asked: 0 };
    const weight = 1 + wordStat.wrong * 3 + Math.max(0, 3 - wordStat.asked);
    return { entry, weight };
  });

  const totalWeight = weighted.reduce((sum, row) => sum + row.weight, 0);
  let ticket = Math.random() * totalWeight;

  for (const row of weighted) {
    ticket -= row.weight;
    if (ticket <= 0) return row.entry;
  }

  return weighted[weighted.length - 1].entry;
}

function showNextWord() {
  resetChoices();
  if (state.queue.length < Math.floor(TARGET_QUEUE / 2)) {
    fillQueue();
  }

  state.current = state.queue.shift() || pickWeightedWord();
  fillQueue();

  if (!state.current) {
    ui.word.textContent = "Keine Wörter verfügbar";
    return;
  }

  ui.word.textContent = state.current.word;
  ui.ending.textContent = `Endung: ${state.current.ending || "(unbekannt)"}`;
  ui.example.textContent = state.current.example || "";
  ui.feedback.textContent = "Wähle den passenden Artikel.";
  ui.next.disabled = true;
}

function handleChoice(selectedArticle) {
  if (!state.current) return;

  const correct = selectedArticle === state.current.article;
  const today = new Date().toISOString().slice(0, 10);

  updateStats(state.current, selectedArticle, correct, today);
  saveStats(state.stats);

  ui.buttons.forEach((btn) => {
    btn.disabled = true;
    if (btn.dataset.article === state.current.article) btn.classList.add("correct");
    if (btn.dataset.article === selectedArticle && !correct) btn.classList.add("wrong");
  });

  if (correct) {
    ui.feedback.textContent = `Richtig: ${state.current.article} ${state.current.word}`;
  } else {
    const mnemonic = resolveMnemonic(state.current);
    ui.feedback.textContent = `Falsch. Richtig ist ${state.current.article} ${state.current.word}. ${mnemonic}`;
  }

  ui.next.disabled = false;
  renderStats();
}

function updateStats(word, selectedArticle, correct, day) {
  const byArticle = state.stats.byArticle[word.article] || { correct: 0, wrong: 0 };
  const byDay = state.stats.byDay[day] || { correct: 0, wrong: 0, total: 0 };
  const byEnding = state.stats.byEnding[word.ending] || { correct: 0, wrong: 0 };
  const byWord = state.stats.byWord[word.word] || { asked: 0, correct: 0, wrong: 0, mnemonic: "" };

  byWord.asked += 1;
  byDay.total += 1;

  if (correct) {
    byArticle.correct += 1;
    byDay.correct += 1;
    byEnding.correct += 1;
    byWord.correct += 1;
  } else {
    byArticle.wrong += 1;
    byDay.wrong += 1;
    byEnding.wrong += 1;
    byWord.wrong += 1;
    if (byWord.wrong >= 5 && !byWord.mnemonic) {
      byWord.mnemonic = autoMnemonic(word);
    }
  }

  state.stats.byArticle[word.article] = byArticle;
  state.stats.byDay[day] = byDay;
  state.stats.byEnding[word.ending] = byEnding;
  state.stats.byWord[word.word] = byWord;
  state.stats.history.unshift({
    day,
    word: word.word,
    correctArticle: word.article,
    selectedArticle,
    correct
  });
  state.stats.history = state.stats.history.slice(0, 300);
}

function resolveMnemonic(word) {
  const wordStat = state.stats.byWord[word.word];
  if (wordStat?.mnemonic) return `Eselsbrücke: ${wordStat.mnemonic}`;

  const curated = state.mnemonics.get(word.word.toLowerCase());
  if (curated) return `Eselsbrücke: ${curated}`;

  return "";
}

function autoMnemonic(word) {
  const endingHint = word.ending ? `Achte auf die Endung ${word.ending}.` : "";
  if (word.article === "die") {
    return `${endingHint} Stell dir eine Diva vor: DIE ${word.word}.`.trim();
  }
  if (word.article === "der") {
    return `${endingHint} Stell dir einen Ritter vor: DER ${word.word}.`.trim();
  }
  return `${endingHint} Stell dir ein Kind vor: DAS ${word.word}.`.trim();
}

function renderStats() {
  const articles = ["der", "die", "das"];
  ui.statsArticle.innerHTML = articles
    .map((art) => {
      const row = state.stats.byArticle[art] || { correct: 0, wrong: 0 };
      return `<li><strong>${art}</strong>: ✅ ${row.correct} · ❌ ${row.wrong}</li>`;
    })
    .join("");

  const days = Object.entries(state.stats.byDay)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 7);
  ui.statsDay.innerHTML = days
    .map(([day, row]) => `<li>${day}: ${row.correct}/${row.total} richtig</li>`)
    .join("") || "<li>Noch keine Daten</li>";

  const endings = Object.entries(state.stats.byEnding)
    .sort((a, b) => (b[1].wrong || 0) - (a[1].wrong || 0))
    .slice(0, 10);
  ui.statsEnding.innerHTML = endings
    .map(([ending, row]) => `<li>${ending}: ✅ ${row.correct} · ❌ ${row.wrong}</li>`)
    .join("") || "<li>Noch keine Daten</li>";

  const mistakes = Object.entries(state.stats.byWord)
    .sort((a, b) => (b[1].wrong || 0) - (a[1].wrong || 0))
    .slice(0, 12);

  ui.mistakeList.innerHTML = mistakes
    .map(([word, row]) => {
      const m = row.mnemonic ? ` — ${row.mnemonic}` : "";
      const marker = row.wrong >= 5 ? " <strong>(>=5 Fehler)</strong>" : "";
      return `<li>${word}: ❌ ${row.wrong} / ✅ ${row.correct}${marker}${m}</li>`;
    })
    .join("") || "<li>Noch keine Daten</li>";
}

function syncOnlineStatus() {
  ui.onlineBadge.textContent = navigator.onLine ? "Status: online" : "Status: offline";
}

function resetChoices() {
  ui.buttons.forEach((btn) => {
    btn.disabled = false;
    btn.classList.remove("correct", "wrong");
  });
}

function parseMarkdownTable(markdown) {
  if (!markdown) return [];

  const lines = markdown
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|") && line.endsWith("|"));

  if (lines.length < 2) return [];

  const headers = lines[0]
    .slice(1, -1)
    .split("|")
    .map((item) => item.trim());

  return lines
    .slice(2)
    .map((line) =>
      line
        .slice(1, -1)
        .split("|")
        .map((item) => item.trim())
    )
    .filter((cells) => cells.length === headers.length)
    .map((cells) => Object.fromEntries(headers.map((key, idx) => [key, cells[idx]])));
}

function detectEnding(word) {
  const lower = String(word || "").toLowerCase();
  const endings = ["ung", "heit", "keit", "schaft", "tion", "chen", "lein", "ment", "tum", "nis"];
  const found = endings.find((ending) => lower.endsWith(ending));
  return found ? `-${found}` : "(frei)";
}

async function fetchText(url) {
  const response = await fetch(url, { cache: "no-cache" });
  if (!response.ok) throw new Error(`Datei nicht ladbar: ${url}`);
  return response.text();
}

function loadStats() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) throw new Error("empty");
    return JSON.parse(raw);
  } catch {
    return {
      byArticle: { der: { correct: 0, wrong: 0 }, die: { correct: 0, wrong: 0 }, das: { correct: 0, wrong: 0 } },
      byDay: {},
      byEnding: {},
      byWord: {},
      history: []
    };
  }
}

function saveStats(stats) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register("./sw.js");
  } catch (error) {
    console.warn("Service Worker konnte nicht registriert werden", error);
  }
}

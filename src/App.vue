<script setup>
import { computed, onMounted, ref, watch } from "vue";
import {
  getCurrentUser,
  loadRememberedCredentials,
  loginUser,
  logoutUser,
  registerUser,
  requestPasswordReset,
  resetPassword
} from "./core/auth";
import { detectEnding, parseMarkdownTable } from "./core/parser";
import { enrichWordFromSources } from "./core/sources";
import { loadStatsForUser, resetLegacyAndSharedStatsOnce, saveStatsForUser } from "./core/storage";
import { createInitialStats, updateStats } from "./core/stats";
import { fillQueue, resolveMnemonic, TARGET_QUEUE } from "./core/trainer";
import { registerPwa } from "./pwa/registerPwa";

const WORDS_URL = "/data/woerter.md";
const MNEMONICS_URL = "/data/eselsbruecken.md";

const fallbackWords = [
  { word: "Baum", article: "der", ending: "-aum", example: "Der Baum ist hoch." },
  { word: "Sonne", article: "die", ending: "-e", example: "Die Sonne scheint." },
  { word: "Auto", article: "das", ending: "-o", example: "Das Auto ist neu." }
];

const words = ref([]);
const queue = ref([]);
const current = ref(null);
const curatedMnemonics = ref(new Map());
const stats = ref(createInitialStats());
const feedback = ref("Wähle den passenden Artikel.");
const isOnline = ref(navigator.onLine);
const selectedArticle = ref(null);
const sourceHint = ref("");
const dynamicExample = ref("");
const showCorrectOverlay = ref(false);
const correctOverlayText = ref("");
const statsView = ref("list");
const selectedDifficulty = ref("alle");
const exampleSourceMode = ref("wiktionary");

const authUser = ref(getCurrentUser());
const authMode = ref("login");
const authMessage = ref("");
const authForm = ref({
  name: "",
  email: "",
  password: "",
  remember: true,
  resetCode: "",
  newPassword: ""
});

const remembered = loadRememberedCredentials();
if (remembered) {
  authForm.value.email = remembered.email;
  authForm.value.password = remembered.password;
  authForm.value.remember = true;
}

const queueLabel = computed(() => `Queue: ${queue.value.length}/${TARGET_QUEUE}`);
const onlineLabel = computed(() => `Status: ${isOnline.value ? "online" : "offline"}`);
const endingLabel = computed(() => `Endung: ${current.value?.ending || "(unbekannt)"}`);
const displayedExample = computed(() => {
  if (!current.value) return "";
  if (selectedArticle.value) return dynamicExample.value;
  return maskArticleInExample(dynamicExample.value, current.value.article);
});
const currentMnemonic = computed(() => {
  if (!current.value) return "";
  return resolveMnemonic(current.value, stats.value.byWord, curatedMnemonics.value);
});
const filteredWords = computed(() => {
  if (selectedDifficulty.value === "alle") return words.value;
  return words.value.filter((w) => w.difficulty === selectedDifficulty.value);
});

const statsByArticle = computed(() => ["der", "die", "das"].map((a) => ({ article: a, ...(stats.value.byArticle[a] || { correct: 0, wrong: 0 }) })));
const statsByDay = computed(() =>
  Object.entries(stats.value.byDay)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 7)
    .map(([day, row]) => ({ day, ...row }))
);
const statsByEnding = computed(() =>
  Object.entries(stats.value.byEnding)
    .sort((a, b) => (b[1].wrong || 0) - (a[1].wrong || 0))
    .slice(0, 10)
    .map(([ending, row]) => ({ ending, ...row }))
);
const endingMistakesByArticle = computed(() => {
  const wordMeta = new Map(words.value.map((w) => [w.word, { article: w.article, ending: w.ending || "(frei)" }]));
  const groups = { der: {}, die: {}, das: {} };

  Object.entries(stats.value.byWord || {}).forEach(([word, row]) => {
    const meta = wordMeta.get(word);
    if (!meta || !row?.wrong) return;
    const current = groups[meta.article][meta.ending] || { wrong: 0, correct: 0 };
    current.wrong += row.wrong || 0;
    current.correct += row.correct || 0;
    groups[meta.article][meta.ending] = current;
  });

  return ["der", "die", "das"].map((article) => ({
    article,
    endings: Object.entries(groups[article])
      .sort((a, b) => b[1].wrong - a[1].wrong)
      .map(([ending, row]) => ({ ending, ...row }))
  }));
});
const topMistakes = computed(() =>
  Object.entries(stats.value.byWord)
    .filter(([, row]) => row?.todoActive)
    .sort((a, b) => (b[1].wrong || 0) - (a[1].wrong || 0))
    .slice(0, 12)
    .map(([word, row]) => ({ word, ...row }))
);
const articleChart = computed(() => {
  const rows = ["der", "die", "das"].map((article) => {
    const row = stats.value.byArticle[article] || { correct: 0, wrong: 0 };
    return { article, wrong: row.wrong || 0, correct: row.correct || 0, total: (row.wrong || 0) + (row.correct || 0) };
  });
  const maxWrong = Math.max(1, ...rows.map((r) => r.wrong));
  return rows.map((r) => ({ ...r, width: Math.round((r.wrong / maxWrong) * 100) }));
});
const endingChart = computed(() => {
  const flattened = endingMistakesByArticle.value
    .flatMap((group) => group.endings.map((ending) => ({ article: group.article, ...ending })))
    .sort((a, b) => b.wrong - a.wrong)
    .slice(0, 10);
  const maxWrong = Math.max(1, ...flattened.map((r) => r.wrong));
  return flattened.map((r) => ({ ...r, width: Math.round((r.wrong / maxWrong) * 100) }));
});

onMounted(async () => {
  resetLegacyAndSharedStatsOnce();
  window.addEventListener("online", syncOnlineStatus);
  window.addEventListener("offline", syncOnlineStatus);
  await registerPwa();
  await loadData();
  if (authUser.value) {
    stats.value = loadStatsForUser(authUser.value);
    refillQueue();
    await nextWord();
  }
});

watch([selectedDifficulty, exampleSourceMode], async () => {
  if (!authUser.value) return;
  queue.value = [];
  await nextWord();
});

async function onLogin() {
  authMessage.value = "";
  try {
    authUser.value = loginUser(authForm.value.email, authForm.value.password, authForm.value.remember);
    stats.value = loadStatsForUser(authUser.value);
    if (!current.value) {
      refillQueue();
      await nextWord();
    }
  } catch (error) {
    authMessage.value = error.message;
  }
}

function onRegister() {
  authMessage.value = "";
  try {
    registerUser(authForm.value.name, authForm.value.email, authForm.value.password);
    authMode.value = "login";
    authMessage.value = "Registriert. Jetzt anmelden.";
  } catch (error) {
    authMessage.value = error.message;
  }
}

function onRequestReset() {
  authMessage.value = "";
  try {
    const code = requestPasswordReset(authForm.value.email);
    authMessage.value = `Reset-Code (Demo): ${code}`;
  } catch (error) {
    authMessage.value = error.message;
  }
}

function onResetPassword() {
  authMessage.value = "";
  try {
    resetPassword(authForm.value.email, authForm.value.resetCode, authForm.value.newPassword);
    authMode.value = "login";
    authMessage.value = "Passwort zurückgesetzt.";
  } catch (error) {
    authMessage.value = error.message;
  }
}

function onLogout() {
  logoutUser();
  authUser.value = null;
  stats.value = createInitialStats();
  current.value = null;
  queue.value = [];
}

async function loadData() {
  try {
    const [wordsText, mnemonicText] = await Promise.all([fetchText(WORDS_URL), fetchText(MNEMONICS_URL)]);
    words.value = parseMarkdownTable(wordsText)
      .map((row, idx) => ({
        id: String(idx + 1),
        word: row.Wort?.trim(),
        article: row.Artikel?.trim(),
        ending: row.Endung?.trim() || detectEnding(row.Wort?.trim() || ""),
        example: row.Beispielsatz?.trim() || "",
        difficulty: normalizeDifficulty(row.Schwierigkeitsgrad, idx)
      }))
      .filter((entry) => entry.word && ["der", "die", "das"].includes(entry.article));

    curatedMnemonics.value = new Map(
      parseMarkdownTable(mnemonicText)
        .filter((row) => row.Wort && row.Eselsbruecke)
        .map((row) => [row.Wort.trim().toLowerCase(), row.Eselsbruecke.trim()])
    );
  } catch {
    words.value = fallbackWords;
    if (!stats.value?.byArticle) stats.value = createInitialStats();
    feedback.value = "Fehler beim Laden. Offline-Fallback aktiv.";
  }

  if (!words.value.length) words.value = fallbackWords;
}

function refillQueue() {
  queue.value = fillQueue(queue.value, filteredWords.value, stats.value.byWord, TARGET_QUEUE);
}

async function nextWord() {
  if (!authUser.value) return;
  if (queue.value.length < Math.floor(TARGET_QUEUE / 2)) refillQueue();
  current.value = queue.value.shift() || null;
  refillQueue();
  selectedArticle.value = null;
  showCorrectOverlay.value = false;
  correctOverlayText.value = "";
  sourceHint.value = "";
  dynamicExample.value = current.value?.example || "";
  feedback.value = "Wähle den passenden Artikel.";

  if (current.value?.word) {
    const enrichment = await enrichWordFromSources(current.value.word, fetch, localStorage, exampleSourceMode.value);
    if (enrichment?.example) {
      dynamicExample.value = enrichment.example;
      sourceHint.value = `Beispielquelle: ${enrichment.source}`;
    }
  }
}

function chooseArticle(article) {
  if (!authUser.value || !current.value || selectedArticle.value) return;
  selectedArticle.value = article;
  const correct = article === current.value.article;
  const today = new Date().toISOString().slice(0, 10);

  stats.value = updateStats(stats.value, current.value, article, correct, today);
  saveStatsForUser(authUser.value, stats.value);

  if (correct) {
    feedback.value = `Richtig: ${current.value.article} ${current.value.word}`;
  } else {
    const mnemonic = resolveMnemonic(current.value, stats.value.byWord, curatedMnemonics.value);
    feedback.value = `Falsch. Richtig ist ${current.value.article} ${current.value.word}. ${mnemonic}`;
    correctOverlayText.value = `${current.value.article.toUpperCase()} ${current.value.word}`;
    showCorrectOverlay.value = true;
  }

  const delayMs = correct ? 950 : 2000;
  setTimeout(() => {
    nextWord();
  }, delayMs);
}

function buttonClass(article) {
  if (!selectedArticle.value) return "choice";
  if (article !== selectedArticle.value) return "choice";
  if (selectedArticle.value === current.value?.article) return "choice correct";
  return "choice wrong";
  return "choice";
}

function syncOnlineStatus() {
  isOnline.value = navigator.onLine;
}

async function fetchText(url) {
  const response = await fetch(url, { cache: "no-cache" });
  if (!response.ok) throw new Error(`Datei nicht ladbar: ${url}`);
  return response.text();
}

function maskArticleInExample(example, article) {
  if (!example || !article) return example || "";
  const escaped = article.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`\\b${escaped}\\b`, "i");
  return example.replace(regex, "___");
}

function normalizeDifficulty(raw, idx) {
  const normalized = String(raw || "").trim().toLowerCase();
  if (["leicht", "mittel", "schwer", "sehrschwer"].includes(normalized)) return normalized;
  if (idx < 18) return "leicht";
  if (idx < 38) return "mittel";
  if (idx < 52) return "schwer";
  return "sehrschwer";
}

</script>

<template>
  <main class="app">
    <header class="card">
      <h1>DerDieDas</h1>
      <p>Ein Wort, drei Artikel, direktes Feedback.</p>
      <div class="badges">
        <span class="badge" v-if="authUser">User: {{ authUser.name }} ({{ authUser.email }})</span>
        <span class="badge">{{ onlineLabel }}</span>
        <span class="badge">{{ queueLabel }}</span>
        <span class="badge">Level: {{ selectedDifficulty }}</span>
        <button v-if="authUser" class="tiny" @click="onLogout">Abmelden</button>
      </div>
    </header>

    <section v-if="!authUser" class="card auth">
      <h3>Anmeldung</h3>
      <div class="auth-tabs">
        <button class="tiny" :class="{ active: authMode === 'login' }" @click="authMode = 'login'">Login</button>
        <button class="tiny" :class="{ active: authMode === 'register' }" @click="authMode = 'register'">Registrieren</button>
        <button class="tiny" :class="{ active: authMode === 'reset' }" @click="authMode = 'reset'">Passwort-Reset</button>
      </div>

      <div class="auth-grid" v-if="authMode === 'login'">
        <input v-model="authForm.email" type="email" placeholder="E-Mail" />
        <input v-model="authForm.password" type="password" placeholder="Passwort" />
        <label class="remember"><input v-model="authForm.remember" type="checkbox" /> Passwort auf Gerät speichern</label>
        <button class="tiny primary" @click="onLogin">Einloggen</button>
      </div>

      <div class="auth-grid" v-else-if="authMode === 'register'">
        <input v-model="authForm.name" type="text" placeholder="Name" />
        <input v-model="authForm.email" type="email" placeholder="E-Mail" />
        <input v-model="authForm.password" type="password" placeholder="Passwort" />
        <button class="tiny primary" @click="onRegister">Registrieren</button>
      </div>

      <div class="auth-grid" v-else>
        <input v-model="authForm.email" type="email" placeholder="E-Mail" />
        <button class="tiny" @click="onRequestReset">Reset-Code anfordern</button>
        <input v-model="authForm.resetCode" type="text" placeholder="Reset-Code" />
        <input v-model="authForm.newPassword" type="password" placeholder="Neues Passwort" />
        <button class="tiny primary" @click="onResetPassword">Passwort ändern</button>
      </div>

      <p class="muted">{{ authMessage }}</p>
    </section>

    <section v-if="authUser" class="card trainer" aria-live="polite">
      <div v-if="showCorrectOverlay" class="correct-overlay">{{ correctOverlayText }}</div>
      <div class="auth-tabs">
        <button class="tiny" :class="{ active: selectedDifficulty === 'alle' }" @click="selectedDifficulty = 'alle'">alle</button>
        <button class="tiny" :class="{ active: selectedDifficulty === 'leicht' }" @click="selectedDifficulty = 'leicht'">leicht</button>
        <button class="tiny" :class="{ active: selectedDifficulty === 'mittel' }" @click="selectedDifficulty = 'mittel'">mittel</button>
        <button class="tiny" :class="{ active: selectedDifficulty === 'schwer' }" @click="selectedDifficulty = 'schwer'">schwer</button>
        <button class="tiny" :class="{ active: selectedDifficulty === 'sehrschwer' }" @click="selectedDifficulty = 'sehrschwer'">sehrschwer</button>
      </div>
      <div class="auth-tabs">
        <button class="tiny" :class="{ active: exampleSourceMode === 'wiktionary' }" @click="exampleSourceMode = 'wiktionary'">Wiktionary</button>
        <button class="tiny" :class="{ active: exampleSourceMode === 'dwds' }" @click="exampleSourceMode = 'dwds'">DWDS</button>
      </div>
      <div class="word-wrap">
        <p class="label">Wort</p>
        <h2 id="wordDisplay">{{ current?.word || "Keine Wörter verfügbar" }}</h2>
        <p class="muted">{{ endingLabel }}</p>
        <p v-if="currentMnemonic" class="mnemonic">{{ currentMnemonic }}</p>
        <p class="example">{{ displayedExample }}</p>
        <p class="muted">{{ sourceHint }}</p>
      </div>

      <div class="choices">
        <button :class="buttonClass('der')" :disabled="!current || !!selectedArticle" @click="chooseArticle('der')">der</button>
        <button :class="buttonClass('die')" :disabled="!current || !!selectedArticle" @click="chooseArticle('die')">die</button>
        <button :class="buttonClass('das')" :disabled="!current || !!selectedArticle" @click="chooseArticle('das')">das</button>
      </div>

      <p class="feedback">{{ feedback }}</p>
    </section>

    <section v-if="authUser" class="card stats">
      <h3>Statistik</h3>
      <div class="auth-tabs">
        <button class="tiny" :class="{ active: statsView === 'list' }" @click="statsView = 'list'">Liste</button>
        <button class="tiny" :class="{ active: statsView === 'graph' }" @click="statsView = 'graph'">Grafik</button>
      </div>

      <div v-if="statsView === 'graph'" class="chart-wrap">
        <h4>Fehler pro Artikel</h4>
        <div class="chart-row" v-for="row in articleChart" :key="`chart-${row.article}`">
          <span>{{ row.article }}</span>
          <div class="bar-bg"><div class="bar" :style="{ width: `${row.width}%` }"></div></div>
          <strong>❌ {{ row.wrong }}</strong>
        </div>

        <h4>Top Fehler-Endungen (mit Artikel)</h4>
        <div class="chart-row" v-for="row in endingChart" :key="`ending-${row.article}-${row.ending}`">
          <span>{{ row.article }} {{ row.ending }}</span>
          <div class="bar-bg"><div class="bar bad" :style="{ width: `${row.width}%` }"></div></div>
          <strong>❌ {{ row.wrong }}</strong>
        </div>
      </div>

      <div class="stats-grid">
        <template v-if="statsView === 'list'">
        <article>
          <h4>Pro Artikel</h4>
          <ul>
            <li v-for="row in statsByArticle" :key="row.article"><strong>{{ row.article }}</strong>: ✅ {{ row.correct }} · ❌ {{ row.wrong }}</li>
          </ul>
        </article>
        <article>
          <h4>Pro Tag</h4>
          <ul>
            <li v-if="!statsByDay.length">Noch keine Daten</li>
            <li v-for="row in statsByDay" :key="row.day">{{ row.day }}: {{ row.correct }}/{{ row.total }} richtig</li>
          </ul>
        </article>
        <article>
          <h4>Pro Wort-Endung</h4>
          <ul>
            <li v-if="!statsByEnding.length">Noch keine Daten</li>
            <li v-for="row in statsByEnding" :key="row.ending">{{ row.ending }}: ✅ {{ row.correct }} · ❌ {{ row.wrong }}</li>
          </ul>

          <div class="ending-groups">
            <h4>Fehler-Endungen nach Artikel</h4>
            <div class="ending-columns">
              <article v-for="group in endingMistakesByArticle" :key="group.article" class="ending-column">
                <h5>{{ group.article }}</h5>
                <ul>
                  <li v-if="!group.endings.length">Keine Fehler</li>
                  <li v-for="row in group.endings" :key="`${group.article}-${row.ending}`">
                    {{ row.ending }}: ❌ {{ row.wrong }} · ✅ {{ row.correct }}
                  </li>
                </ul>
              </article>
            </div>
          </div>
        </article>
        </template>
      </div>
    </section>

    <section v-if="authUser" class="card mistakes">
      <h3>TODOs (offene Fehler)</h3>
      <ul>
        <li v-if="!topMistakes.length">Noch keine Daten</li>
        <li v-for="row in topMistakes" :key="row.word">
          {{ row.word }}: ❌ {{ row.wrong }} / ✅ {{ row.correct }}
          <strong v-if="row.wrong >= 5">(>=5 Fehler)</strong>
          <span v-if="row.mnemonic"> — {{ row.mnemonic }}</span>
        </li>
      </ul>
    </section>
  </main>
</template>

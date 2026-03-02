/**
 * Worthäufigkeit über die DWDS-API (https://www.dwds.de/d/api).
 * frequency 0–6 (logarithmische Skala): 6 = sehr häufig, 0 = sehr selten.
 * Wird in Schwierigkeitsstufen übersetzt: häufig = leicht, selten = schwer.
 */

const DWDS_ORIGIN = typeof import.meta !== "undefined" && import.meta.env?.VITE_DWDS_PROXY
  ? import.meta.env.VITE_DWDS_PROXY.replace(/\/$/, "")
  : "https://www.dwds.de";
const DWDS_FREQUENCY_URL = `${DWDS_ORIGIN}/api/frequency`;
const FREQUENCY_CACHE_KEY = "artikeltrainer.frequency.v1";
const FREQUENCY_CACHE_DAYS = 30;
const CONCURRENCY = 4;

const DIFFICULTY_LEVELS = ["leicht", "mittel", "schwer", "sehrschwer"];

/**
 * DWDS frequency 0–6 → Schwierigkeitsstufe.
 * Hohe Häufigkeit = häufiges Wort = leicht; niedrige Häufigkeit = schwer.
 */
export function frequencyToDifficulty(frequency) {
  if (typeof frequency !== "number" || Number.isNaN(frequency)) return null;
  const n = Math.max(0, Math.min(6, Math.floor(frequency)));
  if (n >= 5) return "leicht";
  if (n >= 3) return "mittel";
  if (n >= 2) return "schwer";
  return "sehrschwer";
}

export function loadFrequencyCache(storage = localStorage) {
  try {
    const raw = storage.getItem(FREQUENCY_CACHE_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw);
    const cutoff = Date.now() - FREQUENCY_CACHE_DAYS * 24 * 60 * 60 * 1000;
    const out = {};
    for (const [word, entry] of Object.entries(data)) {
      if (entry && typeof entry.frequency === "number" && entry.ts > cutoff) out[word.toLowerCase()] = entry;
    }
    return out;
  } catch {
    return {};
  }
}

export function saveFrequencyCache(cache, storage = localStorage) {
  try {
    storage.setItem(FREQUENCY_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // ignore
  }
}

/**
 * Einzelnes Wort bei DWDS abfragen.
 * @returns {{ frequency: number } | null}
 */
export async function fetchWordFrequency(word, fetchFn = fetch) {
  if (!word || typeof word !== "string") return null;
  const q = word.trim();
  if (!q) return null;
  const url = `${DWDS_FREQUENCY_URL}/?q=${encodeURIComponent(q)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetchFn(url, { cache: "no-cache", signal: controller.signal });
    if (!res.ok) return null;
    const data = await res.json();
    const freq = data.frequency;
    if (typeof freq !== "number" || Number.isNaN(freq)) return null;
    return { frequency: Math.max(0, Math.min(6, Math.floor(freq))) };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Führt bis zu `concurrency` Promises parallel aus.
 */
async function runWithLimit(items, fn, limit = CONCURRENCY) {
  const results = [];
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const i = index++;
      const item = items[i];
      const value = await fn(item, i);
      results[i] = value;
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

/**
 * Frequenzen für mehrere Wörter laden; nutzt Cache, fehlende Werte per API (mit Begrenzung).
 * @param {string[]} words - Liste der Wörter
 * @param {{ fetchFn?: typeof fetch, storage?: Storage, concurrency?: number }} options
 * @returns {Promise<Record<string, number>>} word (lowercase) → frequency 0–6
 */
export async function fetchWordsFrequencies(words, options = {}) {
  const { fetchFn = fetch, storage = localStorage, concurrency = CONCURRENCY } = options;
  const cache = loadFrequencyCache(storage);
  const unique = [...new Set(words.map((w) => (w && w.word ? w.word : w).toString().trim().toLowerCase()).filter(Boolean))];
  const toFetch = unique.filter((w) => cache[w] === undefined);
  const result = { ...Object.fromEntries(Object.entries(cache).map(([k, v]) => [k, v.frequency])) };

  if (toFetch.length === 0) return result;

  const fetched = await runWithLimit(
    toFetch,
    async (word) => {
      const data = await fetchWordFrequency(word, fetchFn);
      return { word, data };
    },
    concurrency
  );

  let cacheChanged = false;
  for (const { word, data } of fetched) {
    if (data) {
      result[word] = data.frequency;
      cache[word] = { frequency: data.frequency, ts: Date.now() };
      cacheChanged = true;
    }
  }
  if (cacheChanged) saveFrequencyCache(cache, storage);
  return result;
}

/**
 * Weist Schwierigkeit relativ zur Wortliste zu (gleiche Verteilung pro Stufe).
 * Verhindert, dass „sehrschwer“ nur wenige Wörter enthält.
 * @param {Array<{ word: string, frequency?: number, [key: string]: unknown }>} words
 * @returns {Array<{ difficulty: string, [key: string]: unknown }>}
 */
export function assignDifficultyByRank(words) {
  if (!words?.length) return [];
  const withFreq = words.map((w, i) => ({
    ...w,
    _sortFreq: typeof w.frequency === "number" ? w.frequency : 3,
    _idx: i
  }));
  withFreq.sort((a, b) => a._sortFreq - b._sortFreq);
  const n = withFreq.length;
  // Rang 0 = seltenstes Wort → sehrschwer, hoher Rang → leicht
  const rankToDifficulty = (rank) => DIFFICULTY_LEVELS[3 - Math.min(3, Math.floor((rank / n) * 4))];
  const byIndex = [];
  withFreq.forEach((w, rank) => {
    byIndex[w._idx] = { ...w, difficulty: rankToDifficulty(rank) };
  });
  return byIndex.map(({ _sortFreq, _idx, ...rest }) => rest);
}

export { DIFFICULTY_LEVELS };

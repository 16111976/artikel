const SOURCE_CACHE_KEY = "artikeltrainer.source-cache.v1";
const SOURCE_TTL_MS = 1000 * 60 * 60 * 24 * 7;

const sources = {
  wiktionary: {
    name: "Wiktionary",
    buildUrl: (word) => `https://de.wiktionary.org/api/rest_v1/page/summary/${encodeURIComponent(word)}`,
    parse: async (res) => {
      const json = await res.json();
      const text = String(json.extract || "").trim();
      return text ? { example: text, score: Math.min(100, text.length), source: "Wiktionary" } : null;
    }
  },
  dwds: {
    name: "DWDS",
    buildUrl: (word) => `https://www.dwds.de/wb/${encodeURIComponent(word)}`,
    parse: async (res) => {
      const html = await res.text();
      const plain = html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      const sentence = plain.match(/[^.!?]{15,140}[.!?]/)?.[0]?.trim();
      return sentence ? { example: sentence, score: 70, source: "DWDS" } : null;
    }
  }
};

export async function enrichWordFromSources(word, fetchFn = fetch, storage = localStorage, mode = "wiktionary") {
  const chosen = sources[mode] || sources.wiktionary;
  const cache = loadSourceCache(storage);
  const key = `${mode}:${word.toLowerCase()}`;
  const cached = cache[key];

  if (cached && Date.now() - cached.ts < SOURCE_TTL_MS) {
    return cached.payload;
  }

  let best = null;
  try {
    const response = await fetchWithTimeout(fetchFn, chosen.buildUrl(word), 1600);
    if (response.ok) {
      best = await chosen.parse(response);
    }
  } catch {
    best = null;
  }

  if (best) {
    cache[key] = { ts: Date.now(), payload: best };
    saveSourceCache(cache, storage);
  }

  return best;
}

export function loadSourceCache(storage = localStorage) {
  try {
    const raw = storage.getItem(SOURCE_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveSourceCache(cache, storage = localStorage) {
  storage.setItem(SOURCE_CACHE_KEY, JSON.stringify(cache));
}

async function fetchWithTimeout(fetchFn, url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchFn(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

const SOURCE_CACHE_KEY = "artikeltrainer.source-cache.v3";
const SOURCE_TTL_MS = 1000 * 60 * 60 * 24 * 7;

const DWDS_BASE =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_DWDS_PROXY
    ? import.meta.env.VITE_DWDS_PROXY.replace(/\/$/, "")
    : "https://www.dwds.de";

function decodeHtmlEntities(text) {
  if (!text) return "";
  return text
    .replace(/&middot;/gi, "·")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim();
}

/** Siebt Phrasen-Listen und Platzhalter aus (nur echte Sätze). */
function isPhraseListOrPlaceholder(text) {
  const t = text.trim();
  if (/___/.test(t)) return true;
  const dots = (t.match(/ · /g) || []).length;
  if (dots >= 2) return true;
  if (/^[^.]* · [^.]* · /.test(t)) return true;
  return false;
}

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
    buildUrl: (word) => `${DWDS_BASE}/wb/${encodeURIComponent(word)}`,
    parse: async (res, word) => {
      const html = await res.text();
      let plain = html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      plain = decodeHtmlEntities(plain);
      const boilerplate =
        /JavaScript|aktiviert sein|Etymologie|Synonyme|Bedeutung.*Beispiele|vollen Funktionsumfang|DWDS\s*$/i;
      const candidates = plain.match(/[^.!?]{15,180}[.!?]/g) || [];
      const wordLower = (word || "").toLowerCase();
      const sentence = candidates.find((s) => {
        const t = decodeHtmlEntities(s).trim();
        if (boilerplate.test(t)) return false;
        if (isPhraseListOrPlaceholder(t)) return false;
        if (t.length < 20 || t.length > 160) return false;
        return wordLower ? t.toLowerCase().includes(wordLower) : true;
      });
      const cleaned = sentence ? decodeHtmlEntities(sentence).trim() : null;
      return cleaned ? { example: cleaned, score: 70, source: "DWDS" } : null;
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
      best = await chosen.parse(response, word);
    } else {
      // Body verbrauchen (z. B. bei 404), damit keine Warnung entsteht
      await response.text().catch(() => {});
    }
  } catch {
    // CORS oder Netzwerkfehler (z. B. DWDS von localhost) – Fallback auf Wiktionary
    if (mode === "dwds") {
      best = await trySource(word, sources.wiktionary, fetchFn);
    }
  }

  if (best) {
    cache[key] = { ts: Date.now(), payload: best };
    saveSourceCache(cache, storage);
  }

  return best;
}

async function trySource(word, source, fetchFn) {
  try {
    const response = await fetchWithTimeout(fetchFn, source.buildUrl(word), 1600);
    if (!response.ok) return null;
    return await source.parse(response, word);
  } catch {
    return null;
  }
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

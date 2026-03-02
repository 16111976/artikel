/**
 * Befüllt die Tabelle nouns aus german-nouns CSV (GitHub), wenn die Tabelle leer ist.
 * Quelle: https://github.com/gambolputty/german-nouns (CC BY-SA 4.0)
 */

const CSV_URL = "https://raw.githubusercontent.com/gambolputty/german-nouns/main/german_nouns/nouns.csv";
const BATCH_SIZE = 2000;

const articleByGenus = { m: "der", f: "die", n: "das" };

function parseCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if ((c === "," && !inQuotes) || (c === "\n" && !inQuotes)) {
      result.push(current.trim());
      current = "";
      if (c === "\n") break;
    } else {
      current += c;
    }
  }
  if (current !== "") result.push(current.trim());
  return result;
}

function deriveEnding(lemma) {
  if (!lemma || lemma.length < 2) return null;
  const lower = lemma.toLowerCase();
  const endings = ["-heit", "-keit", "-ung", "-schaft", "-tion", "-tion", "-chen", "-lein", "-nis", "-ment", "-um", "-ismus", "-ik", "-e", "-er", "-el", "-en"];
  for (const e of endings) {
    const suf = e.startsWith("-") ? e.slice(1) : e;
    if (lower.endsWith(suf)) return "-" + suf;
  }
  if (lower.endsWith("e")) return "-e";
  if (lower.endsWith("er")) return "-er";
  if (lower.endsWith("el")) return "-el";
  if (lower.endsWith("en")) return "-en";
  return null;
}

async function fetchCsv() {
  const res = await fetch(CSV_URL);
  if (!res.ok) throw new Error(`CSV fetch failed: ${res.status}`);
  return res.text();
}

function* parseCsvToNouns(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const header = lines[0];
  if (!header.startsWith("lemma,")) return;
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const lemma = (cols[0] || "").trim();
    const pos = (cols[1] || "").toLowerCase();
    const genus = (cols[2] || "").trim().toLowerCase();
    if (!lemma || lemma.startsWith("-")) continue;
    if (!pos.includes("substantiv")) continue;
    if (genus !== "m" && genus !== "f" && genus !== "n") continue;
    const article = articleByGenus[genus];
    if (!article) continue;
    yield {
      lemma: lemma.slice(0, 191),
      article,
      ending: deriveEnding(lemma),
      base_example: null,
      mnemonic: null,
      freq_dwds: null
    };
  }
}

export async function runSeed(pool) {
  const [rows] = await pool.query("SELECT COUNT(*) AS c FROM nouns");
  if (Number(rows[0]?.c) > 0) {
    return { seeded: false, count: Number(rows[0].c) };
  }
  const text = await fetchCsv();
  const conn = await pool.getConnection();
  let inserted = 0;
  let batch = [];
  try {
    for (const row of parseCsvToNouns(text)) {
      batch.push([row.lemma, row.article, row.ending, row.base_example, row.mnemonic, row.freq_dwds]);
      if (batch.length >= BATCH_SIZE) {
        await conn.query(
          "INSERT IGNORE INTO nouns (lemma, article, ending, base_example, mnemonic, freq_dwds) VALUES ?",
          [batch]
        );
        inserted += batch.length;
        batch = [];
      }
    }
    if (batch.length) {
      await conn.query(
        "INSERT IGNORE INTO nouns (lemma, article, ending, base_example, mnemonic, freq_dwds) VALUES ?",
        [batch]
      );
      inserted += batch.length;
    }
  } finally {
    conn.release();
  }
  return { seeded: true, count: inserted };
}

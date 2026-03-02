import http from "http";
import { ensureDatabaseAndTable, getPool, closePool } from "./db.js";
import { runSeed } from "./seed.js";

const PORT = Number(process.env.PORT) || 6001;

async function handleWords(req, res, url) {
  const limit = Math.min(5000, Math.max(1, parseInt(url.searchParams.get("limit") || "200", 10)));
  const difficulty = url.searchParams.get("difficulty") || "alle";
  const pool = getPool();
  if (!pool) {
    res.writeHead(503, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Database not ready" }));
    return;
  }
  try {
    const [rows] = await pool.query(
      "SELECT id, lemma AS word, article, ending, base_example AS example, mnemonic, freq_dwds AS frequency FROM nouns ORDER BY RAND() LIMIT ?",
      [limit]
    );
    const list = rows.map((r) => ({
      id: String(r.id),
      word: r.word,
      article: r.article,
      ending: r.ending || null,
      example: r.example || "",
      difficulty: null,
      ...(r.frequency != null && { frequency: r.frequency })
    }));
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify(list));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: String(err.message) }));
  }
}

async function handleWordsStats(req, res) {
  const pool = getPool();
  if (!pool) {
    res.writeHead(503, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Database not ready" }));
    return;
  }
  try {
    const [totalRow] = await pool.query("SELECT COUNT(*) AS total FROM nouns");
    const [byArticle] = await pool.query(
      "SELECT article, COUNT(*) AS count FROM nouns GROUP BY article"
    );
    const total = Number(totalRow[0]?.total ?? 0);
    const byArticleMap = { der: 0, die: 0, das: 0 };
    for (const row of byArticle) {
      if (row.article in byArticleMap) byArticleMap[row.article] = Number(row.count);
    }
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify({ total, byArticle: byArticleMap }));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: String(err.message) }));
  }
}

function notFound(res) {
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  if (req.method === "GET" && url.pathname === "/api/words") {
    return handleWords(req, res, url);
  }
  if (req.method === "GET" && url.pathname === "/api/words/stats") {
    return handleWordsStats(req, res);
  }
  if (req.method === "GET" && url.pathname === "/api/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, db: !!getPool() }));
    return;
  }
  notFound(res);
});

async function initDb() {
  try {
    await ensureDatabaseAndTable();
    const result = await runSeed(getPool());
    if (result.seeded) {
      console.log("Seed completed: inserted", result.count, "nouns");
    } else {
      console.log("Nouns table already has", result.count, "rows, skip seed");
    }
  } catch (err) {
    console.error("DB init or seed failed (API antwortet mit 503 bis MySQL erreichbar):", err.message);
  }
}

server.listen(PORT, () => {
  console.log("API listening on port", PORT);
  initDb();
});

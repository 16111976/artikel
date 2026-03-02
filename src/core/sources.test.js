import { describe, expect, it, vi } from "vitest";
import { enrichWordFromSources, loadSourceCache } from "./sources";

function makeStorage(seed = {}) {
  const db = { ...seed };
  return {
    getItem: (k) => (k in db ? db[k] : null),
    setItem: (k, v) => {
      db[k] = v;
    }
  };
}

describe("sources", () => {
  it("nutzt wiktionary als beispielquelle", async () => {
    const fetchFn = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ extract: "kurz" }) }));

    const result = await enrichWordFromSources("Baum", fetchFn, makeStorage());
    expect(result.source).toBe("Wiktionary");
  });

  it("nutzt cache und vermeidet erneuten fetch", async () => {
    const storage = makeStorage();
    const fetchFn = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ extract: "abc" }) }));
    await enrichWordFromSources("Auto", fetchFn, storage);
    const firstCalls = fetchFn.mock.calls.length;
    await enrichWordFromSources("Auto", fetchFn, storage);
    expect(fetchFn.mock.calls.length).toBe(firstCalls);
  });

  it("unterstützt dwds modus", async () => {
    const fetchFn = vi.fn(() =>
      Promise.resolve({
        ok: true,
        text: () => Promise.resolve("<html><body>Der Baum steht im Garten.</body></html>")
      })
    );
    const result = await enrichWordFromSources("Baum", fetchFn, makeStorage(), "dwds");
    expect(result.source).toBe("DWDS");
    expect(result.example).toContain("Baum");
  });

  it("lädt leeren cache robust", () => {
    expect(loadSourceCache(makeStorage())).toEqual({});
  });

  it("verwirft DWDS-Phrasenlisten und &middot;-Texte", async () => {
    const fetchFn = vi.fn(() =>
      Promise.resolve({
        ok: true,
        text: () =>
          Promise.resolve(
            "<html><body>hängt ___ Himmel voller Geigen &middot; Geschenk des Himmels &middot; Himmel noch mal!</body></html>"
          )
      })
    );
    const result = await enrichWordFromSources("Himmel", fetchFn, makeStorage(), "dwds");
    expect(result).toBeNull();
  });

  it("verwirft DWDS-Boilerplate (z. B. JavaScript-Hinweis)", async () => {
    const fetchFn = vi.fn(() =>
      Promise.resolve({
        ok: true,
        text: () =>
          Promise.resolve(
            "<html><body>Bedeutung, Etymologie, Synonyme, Beispiele | DWDS. Um den vollen Funktionsumfang dieser Webseite nutzen zu können, muss JavaScript aktiviert sein.</body></html>"
          )
      })
    );
    const result = await enrichWordFromSources("Minute", fetchFn, makeStorage(), "dwds");
    expect(result).toBeNull();
  });

  it("fällt bei DWDS-Fehler (z. B. CORS) auf Wiktionary zurück", async () => {
    const fetchFn = vi.fn((url) => {
      if (String(url).includes("dwds.de")) return Promise.reject(new Error("CORS"));
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ extract: "Fallback aus Wiktionary." }) });
    });
    const result = await enrichWordFromSources("Freiheit", fetchFn, makeStorage(), "dwds");
    expect(result).not.toBeNull();
    expect(result.source).toBe("Wiktionary");
    expect(result.example).toContain("Fallback");
  });
});

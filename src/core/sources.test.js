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
    const fetchFn = vi.fn(() => Promise.resolve({ ok: true, text: () => Promise.resolve("<html><body>Kurzer Satz aus Zeitung.</body></html>") }));
    const result = await enrichWordFromSources("Baum", fetchFn, makeStorage(), "dwds");
    expect(result.source).toBe("DWDS");
  });

  it("lädt leeren cache robust", () => {
    expect(loadSourceCache(makeStorage())).toEqual({});
  });
});

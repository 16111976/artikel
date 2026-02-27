import { describe, expect, it } from "vitest";
import {
  getUserStatsKey,
  loadStats,
  loadStatsForUser,
  resetLegacyAndSharedStatsOnce,
  saveStats,
  saveStatsForUser,
  STORAGE_KEY
} from "./storage";

function makeStorage(seed = {}) {
  const db = { ...seed };
  return {
    get length() {
      return Object.keys(db).length;
    },
    key: (i) => Object.keys(db)[i] || null,
    getItem: (k) => (k in db ? db[k] : null),
    setItem: (k, v) => {
      db[k] = v;
    },
    removeItem: (k) => {
      delete db[k];
    }
  };
}

describe("storage", () => {
  it("liefert defaults bei leerem storage", () => {
    const stats = loadStats(makeStorage());
    expect(stats.byArticle.der.correct).toBe(0);
  });

  it("lädt vorhandene daten", () => {
    const storage = makeStorage({ [STORAGE_KEY]: JSON.stringify({ byWord: { Baum: { wrong: 2 } } }) });
    const stats = loadStats(storage);
    expect(stats.byWord.Baum.wrong).toBe(2);
  });

  it("speichert daten", () => {
    const storage = makeStorage();
    saveStats({ byWord: { X: { wrong: 1 } } }, storage);
    expect(storage.getItem(STORAGE_KEY)).toContain('"wrong":1');
  });

  it("speichert statistik pro user getrennt", () => {
    const storage = makeStorage();
    const denis = { id: "u-denis", email: "denis@example.com" };
    const info = { id: "u-info", email: "info@example.com" };

    saveStatsForUser(denis, { byWord: { Baum: { wrong: 2 } } }, storage);
    saveStatsForUser(info, { byWord: { Baum: { wrong: 0 } } }, storage);

    expect(loadStatsForUser(denis, storage).byWord.Baum.wrong).toBe(2);
    expect(loadStatsForUser(info, storage).byWord.Baum.wrong).toBe(0);
    expect(getUserStatsKey(denis)).not.toBe(getUserStatsKey(info));
  });

  it("resetet alte gemeinsam gesammelte statistik einmalig", () => {
    const storage = makeStorage({ [STORAGE_KEY]: JSON.stringify({ byWord: { Alt: { wrong: 10 } } }) });
    resetLegacyAndSharedStatsOnce(storage);
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
  });
});

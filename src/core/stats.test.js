import { describe, expect, it } from "vitest";
import { createInitialStats, updateStats } from "./stats";

const word = { word: "Zeitung", article: "die", ending: "-ung" };

describe("stats", () => {
  it("initialisiert statistik korrekt", () => {
    const stats = createInitialStats();
    expect(stats.byArticle.der.correct).toBe(0);
    expect(stats.history).toHaveLength(0);
  });

  it("zählt richtige antwort", () => {
    const next = updateStats(createInitialStats(), word, "die", true, "2026-02-27");
    expect(next.byArticle.die.correct).toBe(1);
    expect(next.byDay["2026-02-27"].total).toBe(1);
    expect(next.byEnding["-ung"].correct).toBe(1);
  });

  it("zählt falsche antwort", () => {
    const next = updateStats(createInitialStats(), word, "der", false, "2026-02-27");
    expect(next.byArticle.die.wrong).toBe(1);
    expect(next.byWord.Zeitung.wrong).toBe(1);
  });

  it("legt ab 5 fehlern eine eselsbrücke an", () => {
    let stats = createInitialStats();
    for (let i = 0; i < 5; i += 1) {
      stats = updateStats(stats, word, "der", false, "2026-02-27");
    }
    expect(stats.byWord.Zeitung.mnemonic.length).toBeGreaterThan(0);
  });

  it("nimmt wort aus TODO nach 1 falsch + 2 richtig", () => {
    let stats = createInitialStats();
    stats = updateStats(stats, word, "der", false, "2026-02-27");
    stats = updateStats(stats, word, "die", true, "2026-02-27");
    stats = updateStats(stats, word, "die", true, "2026-02-27");
    expect(stats.byWord.Zeitung.todoActive).toBe(false);
  });

  it("begrenzt history auf 300 einträge", () => {
    let stats = createInitialStats();
    for (let i = 0; i < 350; i += 1) {
      stats = updateStats(stats, { word: `W${i}`, article: "der", ending: "(frei)" }, "der", true, "2026-02-27");
    }
    expect(stats.history.length).toBe(300);
  });
});

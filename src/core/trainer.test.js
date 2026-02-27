import { describe, expect, it } from "vitest";
import { autoMnemonic, fillQueue, pickWeightedWord, resolveMnemonic } from "./trainer";

const words = [
  { word: "Baum", article: "der", ending: "-aum" },
  { word: "Sonne", article: "die", ending: "-e" },
  { word: "Auto", article: "das", ending: "-o" }
];

describe("pickWeightedWord", () => {
  it("liefert null bei leerer menge", () => {
    expect(pickWeightedWord([], {})).toBeNull();
  });

  it("bevorzugt häufig falsche wörter", () => {
    const stats = {
      Baum: { wrong: 0, asked: 10 },
      Sonne: { wrong: 6, asked: 1 },
      Auto: { wrong: 0, asked: 10 }
    };
    const selected = pickWeightedWord(words, stats, () => 0.5);
    expect(selected.word).toBe("Sonne");
  });

  it("ignoriert fehler-prio bei erledigtem TODO", () => {
    const stats = {
      Baum: { wrong: 0, asked: 10 },
      Sonne: { wrong: 8, asked: 10, todoActive: false },
      Auto: { wrong: 0, asked: 0 }
    };
    const selected = pickWeightedWord(words, stats, () => 0.95);
    expect(selected.word).toBe("Auto");
  });
});

describe("fillQueue", () => {
  it("füllt bis zur zielgröße", () => {
    const queue = fillQueue([], words, {}, 5, () => 0.2);
    expect(queue.length).toBe(5);
  });

  it("behält vorhandene queue-elemente", () => {
    const queue = fillQueue([words[0]], words, {}, 3, () => 0.8);
    expect(queue[0].word).toBe("Baum");
    expect(queue.length).toBe(3);
  });
});

describe("mnemonic helpers", () => {
  it("erstellt automatische eselsbrücke", () => {
    expect(autoMnemonic({ word: "Zeitung", article: "die", ending: "-ung" })).toContain("Diva");
  });

  it("nutzt persönliche eselsbrücke aus stats", () => {
    const text = resolveMnemonic(
      { word: "Baum" },
      { Baum: { mnemonic: "Baum = der Mann" } },
      new Map([ ["baum", "kuratiert"] ])
    );
    expect(text).toContain("Baum = der Mann");
  });

  it("fällt auf kuratierte eselsbrücke zurück", () => {
    const text = resolveMnemonic({ word: "Baum" }, {}, new Map([["baum", "merkhilfe"]]));
    expect(text).toContain("merkhilfe");
  });
});

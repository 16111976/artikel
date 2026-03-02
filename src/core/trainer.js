export const TARGET_QUEUE = 30;

export function pickWeightedWord(words, statsByWord, globalIndex = 0, random = Math.random) {
  if (!words?.length) return null;

  const COOLDOWN_THRESHOLD = 1000;

  const weighted = words.map((entry) => {
    const wordStat = statsByWord?.[entry.word] || { wrong: 0, asked: 0, lastAskedGlobalIndex: -1 };
    const effectiveWrong = wordStat.todoActive === false ? 0 : wordStat.wrong || 0;
    let weight = 1 + effectiveWrong * 3 + Math.max(0, 3 - (wordStat.asked || 0));

    // Wenn richtig beantwortet und weniger als 1000 Wörter her, stark reduzieren
    if (wordStat.correct > 0 && wordStat.lastAskedGlobalIndex >= 0) {
      const questionsSince = globalIndex - wordStat.lastAskedGlobalIndex;
      if (questionsSince < COOLDOWN_THRESHOLD) {
        weight = weight * 0.01; // Stark reduzierte Chance
      }
    }

    return { entry, weight };
  });

  const totalWeight = weighted.reduce((sum, row) => sum + row.weight, 0);
  let ticket = random() * totalWeight;

  for (const row of weighted) {
    ticket -= row.weight;
    if (ticket <= 0) return row.entry;
  }

  return weighted[weighted.length - 1].entry;
}

/**
 * @param {object} [options] - optional
 * @param {string} [options.excludeWord] - Wort (z. B. aktuell angezeigtes) nicht in die Queue aufnehmen
 */
export function fillQueue(queue, words, statsByWord, globalIndex = 0, target = TARGET_QUEUE, random = Math.random, options = {}) {
  const nextQueue = [...queue];
  const inQueue = new Set(nextQueue.map((item) => item.word.toLowerCase()));
  const exclude = (options.excludeWord || "").trim().toLowerCase();
  if (exclude) inQueue.add(exclude);

  let guard = 0;

  while (nextQueue.length < target && guard < target * 20) {
    guard += 1;
    let candidate = pickWeightedWord(words, statsByWord, globalIndex, random);
    if (!candidate) break;

    if (inQueue.has(candidate.word.toLowerCase())) {
      const next = words.find((w) => !inQueue.has(w.word.toLowerCase()));
      if (next) candidate = next;
    }
    // Ausgeschlossenes Wort (z. B. aktuell angezeigt) nie aufnehmen, ggf. anderes wiederholen
    if (exclude && candidate.word.toLowerCase() === exclude) {
      const other = words.find((w) => w.word.toLowerCase() !== exclude);
      if (other) candidate = other;
    }

    nextQueue.push(candidate);
    inQueue.add(candidate.word.toLowerCase());
  }

  return nextQueue;
}

export function autoMnemonic(word) {
  const endingHint = word.ending ? `Achte auf die Endung ${word.ending}.` : "";
  if (word.article === "die") return `${endingHint} Stell dir eine Diva vor: DIE ${word.word}.`.trim();
  if (word.article === "der") return `${endingHint} Stell dir einen Ritter vor: DER ${word.word}.`.trim();
  return `${endingHint} Stell dir ein Kind vor: DAS ${word.word}.`.trim();
}

export function resolveMnemonic(word, byWord, curatedMnemonics) {
  const wordStat = byWord?.[word.word];
  if (wordStat?.mnemonic) return `Eselsbrücke: ${wordStat.mnemonic}`;
  const curated = curatedMnemonics.get(word.word.toLowerCase());
  if (curated) return `Eselsbrücke: ${curated}`;
  return "";
}

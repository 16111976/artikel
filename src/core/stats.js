import { autoMnemonic } from "./trainer";

export function createInitialStats() {
  return {
    byArticle: { der: { correct: 0, wrong: 0 }, die: { correct: 0, wrong: 0 }, das: { correct: 0, wrong: 0 } },
    byDay: {},
    byEnding: {},
    byWord: {},
    history: [],
    globalIndex: 0
  };
}

export function updateStats(stats, word, selectedArticle, correct, day) {
  const next = {
    ...stats,
    byArticle: { ...(stats.byArticle || {}) },
    byDay: { ...(stats.byDay || {}) },
    byEnding: { ...(stats.byEnding || {}) },
    byWord: { ...(stats.byWord || {}) },
    history: [...(stats.history || [])]
  };

  const byArticle = { ...(next.byArticle[word.article] || { correct: 0, wrong: 0 }) };
  const byDay = { ...(next.byDay[day] || { correct: 0, wrong: 0, total: 0 }) };
  const byEnding = { ...(next.byEnding[word.ending] || { correct: 0, wrong: 0 }) };
  const byWord = {
    ...(next.byWord[word.word] || {
      asked: 0,
      correct: 0,
      wrong: 0,
      mnemonic: "",
      todoActive: false,
      todoWrongCount: 0,
      todoRecoveryCorrect: 0,
      lastAskedGlobalIndex: -1
    })
  };

  byWord.asked += 1;
  byWord.lastAskedGlobalIndex = stats.globalIndex || 0;
  byDay.total += 1;
  
  next.globalIndex = (stats.globalIndex || 0) + 1;

  if (correct) {
    byArticle.correct += 1;
    byDay.correct += 1;
    byEnding.correct += 1;
    byWord.correct += 1;
    if (byWord.todoActive) {
      byWord.todoRecoveryCorrect = (byWord.todoRecoveryCorrect || 0) + 1;
      if ((byWord.todoWrongCount || 0) === 1 && byWord.todoRecoveryCorrect >= 2) {
        byWord.todoActive = false;
        byWord.todoWrongCount = 0;
        byWord.todoRecoveryCorrect = 0;
      }
    }
  } else {
    byArticle.wrong += 1;
    byDay.wrong += 1;
    byEnding.wrong += 1;
    byWord.wrong += 1;
    byWord.todoActive = true;
    byWord.todoWrongCount = (byWord.todoWrongCount || 0) + 1;
    byWord.todoRecoveryCorrect = 0;
    if (byWord.wrong >= 5 && !byWord.mnemonic) {
      byWord.mnemonic = autoMnemonic(word);
    }
  }

  next.byArticle[word.article] = byArticle;
  next.byDay[day] = byDay;
  next.byEnding[word.ending] = byEnding;
  next.byWord[word.word] = byWord;
  next.history.unshift({ day, word: word.word, correctArticle: word.article, selectedArticle, correct });
  next.history = next.history.slice(0, 300);

  return next;
}

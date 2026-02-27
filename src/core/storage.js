import { createInitialStats } from "./stats";

export const STORAGE_KEY = "artikeltrainer.v1";
export const USER_STATS_PREFIX = "derdiedas.stats.user.";
const RESET_MARKER_KEY = "derdiedas.stats.reset.done.v1";

function normalizeUserKey(user) {
  if (!user) return "guest";
  if (user.id) return String(user.id);
  if (user.email) return String(user.email).trim().toLowerCase();
  return "guest";
}

export function getUserStatsKey(user) {
  return `${USER_STATS_PREFIX}${normalizeUserKey(user)}`;
}

export function resetLegacyAndSharedStatsOnce(storage = localStorage) {
  try {
    if (storage.getItem(RESET_MARKER_KEY)) return;

    storage.removeItem(STORAGE_KEY);
    const keys = listKeys(storage);
    keys.filter((k) => k.startsWith(USER_STATS_PREFIX)).forEach((k) => storage.removeItem(k));
    storage.setItem(RESET_MARKER_KEY, "1");
  } catch {
    // ignore
  }
}

function listKeys(storage) {
  if (typeof storage.length === "number" && typeof storage.key === "function") {
    const keys = [];
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (key) keys.push(key);
    }
    return keys;
  }
  return [];
}

export function loadStats(storage = localStorage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return createInitialStats();
    return { ...createInitialStats(), ...JSON.parse(raw) };
  } catch {
    return createInitialStats();
  }
}

export function saveStats(stats, storage = localStorage) {
  storage.setItem(STORAGE_KEY, JSON.stringify(stats));
}

export function loadStatsForUser(user, storage = localStorage) {
  try {
    const raw = storage.getItem(getUserStatsKey(user));
    if (!raw) return createInitialStats();
    return { ...createInitialStats(), ...JSON.parse(raw) };
  } catch {
    return createInitialStats();
  }
}

export function saveStatsForUser(user, stats, storage = localStorage) {
  storage.setItem(getUserStatsKey(user), JSON.stringify(stats));
}

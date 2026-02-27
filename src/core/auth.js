const USERS_KEY = "derdiedas.users.v1";
const SESSION_KEY = "derdiedas.session.v1";
const REMEMBER_KEY = "derdiedas.remember.v1";
const RESET_KEY = "derdiedas.reset.v1";

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function registerUser(name, email, password) {
  const users = read(USERS_KEY, []);
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!name || !normalizedEmail || !password) throw new Error("Bitte alle Felder ausfüllen.");
  if (users.some((u) => u.email === normalizedEmail)) throw new Error("E-Mail bereits registriert.");
  users.push({ id: crypto.randomUUID(), name: String(name).trim(), email: normalizedEmail, password: String(password) });
  write(USERS_KEY, users);
}

export function loginUser(email, password, remember = false) {
  const users = read(USERS_KEY, []);
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const user = users.find((u) => u.email === normalizedEmail && u.password === String(password));
  if (!user) throw new Error("Login fehlgeschlagen.");
  const sessionUser = { id: user.id, name: user.name, email: user.email };
  write(SESSION_KEY, sessionUser);
  if (remember) write(REMEMBER_KEY, { email: normalizedEmail, password: String(password) });
  else localStorage.removeItem(REMEMBER_KEY);
  return sessionUser;
}

export function getCurrentUser() {
  return read(SESSION_KEY, null);
}

export function logoutUser() {
  localStorage.removeItem(SESSION_KEY);
}

export function loadRememberedCredentials() {
  return read(REMEMBER_KEY, null);
}

export function requestPasswordReset(email) {
  const users = read(USERS_KEY, []);
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const user = users.find((u) => u.email === normalizedEmail);
  if (!user) throw new Error("E-Mail nicht gefunden.");

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const payload = read(RESET_KEY, {});
  payload[normalizedEmail] = { code, expiresAt: Date.now() + 1000 * 60 * 10 };
  write(RESET_KEY, payload);
  return code;
}

export function resetPassword(email, code, newPassword) {
  const users = read(USERS_KEY, []);
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const payload = read(RESET_KEY, {});
  const reset = payload[normalizedEmail];
  if (!reset) throw new Error("Kein Reset angefordert.");
  if (Date.now() > reset.expiresAt) throw new Error("Reset-Code abgelaufen.");
  if (String(code) !== String(reset.code)) throw new Error("Reset-Code ungültig.");
  if (!newPassword) throw new Error("Neues Passwort fehlt.");

  const updated = users.map((u) => (u.email === normalizedEmail ? { ...u, password: String(newPassword) } : u));
  write(USERS_KEY, updated);
  delete payload[normalizedEmail];
  write(RESET_KEY, payload);
}

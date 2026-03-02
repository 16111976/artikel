# DerDieDas — Artikeltrainer (Vue + PWA)

Eine moderne Lern-App für deutsche Artikel: **der**, **die**, **das**. Mit Offline‑Unterstützung, Statistik und sauberer, testbarer Architektur.

## Highlights

- ⚡️ Vue 3 + Vite
- 📦 PWA (offline, installierbar)
- 🧠 Gewichtet wiederholte Wörter + Eselsbrücken
- 👥 Lokales User‑Management (Registrierung, Login, Passwort‑Reset)
- 📊 Statistikansichten (Liste/Grafik)
- 🧪 Umfassende Tests (Vitest)
- 🔒 Docker-Deployment mit HTTPS

## Schnellstart

```bash
npm install
npm run dev
```

Öffne anschließend die URL aus der Vite-Ausgabe.

## Skripte

```bash
# Build
npm run build

# Vorschau des Builds
npm run preview

# Tests
npm test
npm run test:watch
npm run test:coverage
```

## Docker (HTTPS)

Lokale Tests laufen mit Docker; nach Änderungen immer mit `--build` neu bauen:

```bash
npm run docker:up
```

(entspricht `docker-compose down --remove-orphans && docker-compose up -d --build`)

- App-URL: https://localhost:60443
- Persistentes Volume: `artikel_data` (Containerpfad `/var/lib/derdiedas`)
- Hinweis: Chrome blockiert Port 6000 → Host-Port 60443 verwenden.
- Hinweis: Selbstsigniertes Zertifikat → einmalig Browser-Warnung akzeptieren.

### MySQL / Wörter-API

Die App lädt Wörter bevorzugt aus der **API** (`/api/words`). Dafür läuft der Service `derdiedas-api` (siehe [server/](server/README.md)) und benötigt eine **MySQL-Instanz** (z. B. dein bestehender Container `mahlzeit-db`).

- **Datenbank:** `derdiedas` (wird beim ersten Start angelegt, falls der User berechtigt ist).
- **Seed:** Ist die Tabelle `nouns` **leer**, wird sie einmalig aus [german-nouns](https://github.com/gambolputty/german-nouns) (CSV) befüllt. Beim Aufsetzen an einem anderen Ort (leere DB) passiert das erneut.
- Umgebung (z. B. in `.env` oder docker-compose): `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`. Wenn MySQL im gleichen Docker-Netz läuft: `MYSQL_HOST=mahlzeit-db`.

## Architektur

- UI: [src/App.vue](src/App.vue)
- Trainer-Logik: [src/core](src/core)
- PWA: [public/manifest.webmanifest](public/manifest.webmanifest), [public/sw.js](public/sw.js)
- Daten: [public/data](public/data)

## Konfiguration

- Wortliste: `public/data/woerter.md`
- Eselsbrücken: `public/data/eselsbruecken.md`

## Lizenz

MIT

## Anforderungen (verschoben)

Der ursprüngliche Text wurde nach [Anforderungen.md](Anforderungen.md) verschoben.

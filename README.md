# Artikeltrainer (Vue + PWA)

Web-App zum Lernen deutscher Artikel (`der`, `die`, `das`) mit Vue-Oberfläche, Offline-Funktion und Tests.

## Features

- Vue 3 UI (Vite)
- Zufällige Wörter aus Markdown-Datei
- Gewichtete Wiederholung bei falschen Antworten
- 30 Wörter in einer Hintergrund-Queue
- Eselsbrücken ab 5 Fehlern pro Wort
- Beispielquelle: Wiktionary (einheitlich)
- Quellen-Antworten werden lokal gecacht
- User-Management lokal auf dem Gerät (Registrierung, Login, Passwort-Reset per E-Mail + Code)
- Lernstände und Statistiken sind user-spezifisch getrennt
- Statistikansicht als Liste oder Grafik umschaltbar
- Statistik:
	- pro Artikel
	- pro Tag
	- pro Wort-Endung
- Installierbare PWA mit Service Worker
- Viele Tests (Unit + Component + PWA-Dateien) mit Vitest

## Projektstruktur

- `Anforderung.md` – Originalanforderung
- `index.html` – Vite-Host
- `src/App.vue` – Vue-Oberfläche
- `src/main.js` – Vue-Bootstrap
- `src/styles.css` – UI-Design
- `src/core/*.js` – Trainer-Logik als testbare Module
- `src/core/sources.js` – automatische Quellenauswahl + Cache
- `src/**/*.test.js` – Test-Suite
- `src/pwa/*.test.js` – PWA-spezifische Tests
- `public/sw.js` – Offline-Cache
- `public/manifest.webmanifest` – PWA-Manifest
- `public/data/*.md` – Wort-, Eselsbrücken- und Quellen-Daten
- `Dockerfile` – HTTPS-Container auf Port 6000
- `docker-compose.yml` – Start via Compose
- `docker/nginx.conf` – TLS + Static Hosting

## Entwicklung

1. Abhängigkeiten installieren: `npm install`
2. Dev-Server starten: `npm run dev`
3. Build erstellen: `npm run build`
4. Build lokal prüfen: `npm run preview`

## Tests

- Alle Tests: `npm test`
- Watch-Modus: `npm run test:watch`
- Coverage: `npm run test:coverage`

## Docker (HTTPS)

- Build + Start (immer mit Build): `docker-compose down --remove-orphans && docker-compose up -d --build`
- Alternative per npm-Script: `npm run docker:up`
- App-URL: `https://localhost:60443`
- Persistentes Volume: `artikel_data` (Containerpfad `/var/lib/derdiedas`)
- Hinweis: Chromium/Chrome blockiert Port `6000` als `ERR_UNSAFE_PORT`, daher Host-Port `60443`.
- Hinweis: selbstsigniertes Zertifikat (Browser-Warnung beim ersten Aufruf ist normal)

## Datenspeicherung

- Keine Datenbank.
- Lernstatistiken werden lokal im Browser gespeichert (`localStorage`).
- Alte, zuvor gemeinsam gespeicherte Statistik wird einmalig zurückgesetzt.
- Wort- und Eselsbrücken-Stammdaten liegen als `.md` im Repository (`public/data`).

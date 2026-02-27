# Anforderung

Originaltext vom Auftrag:

"ok, hier entsteht ein App/PWA-Webseite, um deutsche Artikel zu lernen. Es sollen immer zufällige Wärter  angezeigt werden, die falsch genannte Artikel sollen gemerkt werden und je öffter dieser fals gewesen war, desto öffter wird es vorgeschlagen. Zu den 5 mal falsch genannten Artikel sollen \"Eselsbrücken\" angelegt werden. Die Seite soll PWA-Fäig sein, das heißt es soll im Hintegrund immer 30 Wörter parat zu testen haben, Wenn die Verbindung weg ist. Es wird ein Wort nach dem anderen eingeblendet und 3 Artikel als auswahlbuttons vorgeschlagen. Statistik pro Artikel und pro Tag, pro Wort-Endung soll mitgeführt werden. Die Online-Quellen für Artikel, Beispielsätzen und Eslesbrücken suche bitte selbst aus mit kostenlose oder Tagesbegrenzte Api. einer davon ist zum Beispiel dwds, keine Datenbank, wir arbeiten mit git und .MD-Dateien. Erzeuge das Projekt, übernehme disen Tesx zu Anforderung.md und lege los. Ich erlaube dir im Projekt alles anzulegen"

## Umgesetzte Ziele

- PWA-fähige Lern-App (offlinefähig mit Service Worker)
- Zufällige Wörter mit gewichteter Wiederholung bei Fehlern
- 30 Wörter im Hintergrund als Test-Queue
- 3 Auswahlbuttons: `der`, `die`, `das`
- Statistik pro Artikel, Tag und Wort-Endung
- Eselsbrücken ab 5 Fehlern pro Wort
- Datengrundlage über Markdown-Dateien statt Datenbank

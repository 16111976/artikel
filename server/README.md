# DerDieDas API (MySQL + Seed)

- Stellt **Wörter** unter `GET /api/words?limit=200` bereit.
- **MySQL:** Datenbank `derdiedas`, Tabelle `nouns` (lemma, article, ending, base_example, mnemonic, freq_dwds).
- **Seed:** Wenn die Tabelle beim Start **leer** ist, wird sie einmalig aus [german-nouns](https://github.com/gambolputty/german-nouns) (CSV, CC BY-SA 4.0) befüllt. Bei neuem Aufsetzen (leere DB) passiert das erneut.

## Umgebung

| Variable | Bedeutung | Default |
|----------|-----------|--------|
| `MYSQL_HOST` | MySQL-Host (z. B. `mahlzeit-db` oder `host.docker.internal`) | `host.docker.internal` |
| `MYSQL_PORT` | MySQL-Port | `3306` |
| `MYSQL_USER` | MySQL-User (für Seed muss DB angelegt werden können, z. B. `root`) | `root` |
| `MYSQL_PASSWORD` | MySQL-Passwort | `root` |
| `MYSQL_DATABASE` | Datenbankname | `derdiedas` |

## Manuelle DB-Anlage (optional)

Falls du die DB schon vorher anlegen willst (gleicher MySQL-Container wie z. B. mahlzeit):

```sql
CREATE DATABASE IF NOT EXISTS derdiedas
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

Das Backend legt die DB und Tabelle bei Bedarf selbst an.

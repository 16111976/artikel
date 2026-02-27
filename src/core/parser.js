export function parseMarkdownTable(markdown) {
  if (!markdown) return [];

  const lines = markdown
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|") && line.endsWith("|"));

  if (lines.length < 2) return [];

  const headers = lines[0]
    .slice(1, -1)
    .split("|")
    .map((item) => item.trim());

  return lines
    .slice(2)
    .map((line) =>
      line
        .slice(1, -1)
        .split("|")
        .map((item) => item.trim())
    )
    .filter((cells) => cells.length === headers.length)
    .map((cells) => Object.fromEntries(headers.map((key, idx) => [key, cells[idx]])));
}

export function detectEnding(word) {
  const lower = String(word || "").toLowerCase();
  const endings = ["ung", "heit", "keit", "schaft", "tion", "chen", "lein", "ment", "tum", "nis"];
  const found = endings.find((ending) => lower.endsWith(ending));
  return found ? `-${found}` : "(frei)";
}

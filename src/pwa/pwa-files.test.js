import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../../");

describe("PWA Dateien", () => {
  it("manifest enthält app-konfiguration", () => {
    const manifestPath = path.join(root, "public/manifest.webmanifest");
    const data = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    expect(data.display).toBe("standalone");
    expect(Array.isArray(data.icons)).toBe(true);
    expect(data.icons.length).toBeGreaterThanOrEqual(2);
  });

  it("service worker enthält cache-strategien", () => {
    const swPath = path.join(root, "public/sw.js");
    const text = fs.readFileSync(swPath, "utf8");
    expect(text).toContain("cacheFirst");
    expect(text).toContain("networkFirstRuntime");
    expect(text).toContain("CACHE_NAME");
  });
});

import { describe, expect, it, vi } from "vitest";
import { registerPwa } from "./registerPwa";

describe("registerPwa", () => {
  it("registriert service worker falls verfügbar", async () => {
    const nav = { serviceWorker: { register: vi.fn(() => Promise.resolve()) } };
    const ok = await registerPwa(nav);
    expect(ok).toBe(true);
    expect(nav.serviceWorker.register).toHaveBeenCalledWith("/sw.js");
  });

  it("liefert false ohne service worker", async () => {
    const ok = await registerPwa({});
    expect(ok).toBe(false);
  });
});

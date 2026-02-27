import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App.vue";

const wordsMd = `
| Wort | Artikel | Endung | Beispielsatz |
|---|---|---|---|
| Baum | der | -aum | Der Baum steht im Garten. |
| Sonne | die | -e | Die Sonne scheint. |
`;

const mnMd = `
| Wort | Eselsbruecke |
|---|---|
| Sonne | Merksatz Sonne |
`;

describe("App.vue", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
    localStorage.clear();
    localStorage.setItem("derdiedas.session.v1", JSON.stringify({ id: "u1", name: "Tester", email: "t@example.com" }));
    global.fetch = vi.fn((url) => {
      if (String(url).includes("woerter.md")) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve(wordsMd) });
      }
      if (String(url).includes("eselsbruecken.md")) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve(mnMd) });
      }
      return Promise.resolve({ ok: false, text: () => Promise.resolve("") });
    });

    Object.defineProperty(global.navigator, "serviceWorker", {
      configurable: true,
      value: { register: vi.fn(() => Promise.resolve()) }
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rendert titel", async () => {
    const wrapper = mount(App);
    await flushPromises();
    expect(wrapper.text()).toContain("DerDieDas");
  });

  it("zeigt wort nach laden", async () => {
    const wrapper = mount(App);
    await flushPromises();
    expect(wrapper.find("#wordDisplay").text()).not.toContain("Keine Wörter");
  });

  it("gibt feedback bei richtiger antwort", async () => {
    const wrapper = mount(App);
    await flushPromises();
    const word = wrapper.find("#wordDisplay").text().trim();
    const expectedArticle = word === "Sonne" ? "die" : "der";
    await wrapper.findAll(".choices button").find((b) => b.text() === expectedArticle).trigger("click");
    expect(wrapper.text()).toContain("Richtig");
  });

  it("wechselt automatisch zum nächsten wort", async () => {
    const wrapper = mount(App);
    await flushPromises();
    const firstWord = wrapper.find("#wordDisplay").text();
    await wrapper.findAll(".choices button")[0].trigger("click");
    await vi.advanceTimersByTimeAsync(2200);
    await flushPromises();
    const secondWord = wrapper.find("#wordDisplay").text();
    expect(secondWord).not.toBe(firstWord);
  });

  it("zeigt keinen next-button", async () => {
    const wrapper = mount(App);
    await flushPromises();
    expect(wrapper.find(".next").exists()).toBe(false);
  });
});

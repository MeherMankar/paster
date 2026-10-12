import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { exportLocal, getLocalPastes, getPrefs, importLocal } from "../local";

const values = new Map<string, string>();
const storage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => values.set(key, value),
  removeItem: (key: string) => values.delete(key),
};

beforeEach(() => {
  values.clear();
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("window", { dispatchEvent: vi.fn() });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("local data rename compatibility", () => {
  it("moves saved pastes and preferences to the paster storage keys", () => {
    const pastes = [{ id: "AbCd1234", lang: "text", created: Date.now(), expires: null, burn: false, encrypted: false }];
    values.set("pastr:pastes", JSON.stringify(pastes));
    values.set("pastr:prefs", JSON.stringify({ wrap: true }));

    expect(getLocalPastes()).toEqual(pastes);
    expect(getPrefs().wrap).toBe(true);
    expect(values.get("paster:pastes")).toBe(JSON.stringify(pastes));
    expect(values.get("paster:prefs")).toBe(JSON.stringify({ wrap: true }));
    expect(values.has("pastr:pastes")).toBe(false);
    expect(values.has("pastr:prefs")).toBe(false);
  });

  it("exports the new app name and still imports previous exports", () => {
    expect(JSON.parse(exportLocal()).app).toBe("paster");
    expect(importLocal(JSON.stringify({ app: "pastr", pastes: [] }))).toBe(0);
  });
});

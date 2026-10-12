import { describe, expect, it } from "vitest";
import { table } from "../../../cli/paster.mjs";

const strip = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");
const widths = (s: string) => new Set(strip(s).trimEnd().split("\n").map((l) => [...l].length));

describe("cli table", () => {
  const head = ["id", "title", "url"];
  const rows = [
    ["AbCd1234", "a very long title that goes on and on", "https://x.y/AbCd1234"],
    ["ZyXw9876", "", "https://x.y/ZyXw9876"],
  ];
  it("pads every line to the same width when it fits", () => {
    const t = table(head, rows, [], 1, 200);
    expect(widths(t).size).toBe(1);
    expect(strip(t)).toContain("│ AbCd1234 │ a very long title that goes on and on │ https://x.y/AbCd1234 │");
  });
  it("shrinks the chosen column first to fit the window", () => {
    const t = table(head, rows, [], 1, 50);
    expect([...widths(t)]).toEqual([50]);
    expect(strip(t)).toContain("│ a very long… │ https://x.y/AbCd1234 │");
  });
});

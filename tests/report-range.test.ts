import { describe, expect, it } from "vitest";
import { parseRange } from "@/lib/report-range";

describe("parseRange", () => {
  const today = new Date(2026, 9, 29, 15, 0);

  it("defaults to today", () => {
    const r = parseRange({}, today);
    expect(r.fromLabel).toBe("2026-10-29");
    expect(r.toLabel).toBe("2026-10-29");
    expect(r.to.getTime() - r.from.getTime()).toBe(24 * 3600 * 1000);
  });

  it("is inclusive of the end date and ignores bad input", () => {
    const r = parseRange({ from: "2026-10-01", to: "2026-10-03", floor: "f1" }, today);
    expect(r.to.getDate()).toBe(4);
    expect(r.floorId).toBe("f1");
    expect(parseRange({ from: "nonsense" }, today).fromLabel).toBe("2026-10-29");
    expect(parseRange({ from: "2026-10-05", to: "2026-10-01" }, today).toLabel).toBe("2026-10-05");
  });
});

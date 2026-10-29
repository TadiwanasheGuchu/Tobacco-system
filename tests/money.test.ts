import { describe, expect, it } from "vitest";
import { formatPricePerKg } from "@/lib/money";

describe("formatPricePerKg", () => {
  it("keeps 2 to 4 decimals", () => {
    expect(formatPricePerKg("3.4000")).toBe("US$3.40");
    expect(formatPricePerKg("3.4250")).toBe("US$3.425");
    expect(formatPricePerKg("3.4255")).toBe("US$3.4255");
  });
});

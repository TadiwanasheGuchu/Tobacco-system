import { describe, expect, it } from "vitest";
import { toCsv } from "@/lib/csv";

describe("toCsv", () => {
  it("quotes, escapes and neutralises formulas", () => {
    const csv = toCsv(["a", "b"], [["x,y", 'say "hi"'], ["=SUM(A1)", "-12.50"], [null, 3]]);
    expect(csv).toBe('﻿a,b\r\n"x,y","say ""hi"""\r\n\'=SUM(A1),-12.50\r\n,3\r\n');
  });
});

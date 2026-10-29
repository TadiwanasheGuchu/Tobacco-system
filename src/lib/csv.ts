/** Builds a CSV document that opens cleanly in Excel. */
export function toCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [header, ...rows].map((row) => row.map(cell).join(","));
  // BOM so Excel reads UTF-8 names correctly; CRLF line endings for Excel too.
  return "﻿" + lines.join("\r\n") + "\r\n";
}

function cell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  // Stop spreadsheet formula injection from names typed into the system.
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

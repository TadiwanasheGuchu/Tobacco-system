import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export interface ReportRange {
  from: Date;
  /** Exclusive. */
  to: Date;
  fromLabel: string;
  toLabel: string;
  floorId: string | null;
}

/** Parses ?from=YYYY-MM-DD&to=YYYY-MM-DD (inclusive, server local time). Defaults to today. */
export function parseRange(params: { from?: unknown; to?: unknown; floor?: unknown }, today = new Date()): ReportRange {
  const todayLabel = localDateLabel(today);
  const fromLabel = isoDate.safeParse(params.from).data ?? todayLabel;
  let toLabel = isoDate.safeParse(params.to).data ?? fromLabel;
  if (toLabel < fromLabel) toLabel = fromLabel;
  const from = new Date(`${fromLabel}T00:00:00`);
  const to = new Date(`${toLabel}T00:00:00`);
  to.setDate(to.getDate() + 1);
  const floorId = typeof params.floor === "string" && params.floor ? params.floor : null;
  return { from, to, fromLabel, toLabel, floorId };
}

export function localDateLabel(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

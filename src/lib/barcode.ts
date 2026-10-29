import "server-only";
import bwipjs from "bwip-js/node";

/** Code 128 barcode as an SVG string, readable by standard handheld scanners. */
export function code128Svg(text: string): string {
  return bwipjs.toSVG({ bcid: "code128", text, scale: 3, height: 14, includetext: true, textxalign: "center" });
}

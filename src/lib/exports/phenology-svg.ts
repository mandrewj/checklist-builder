/**
 * Server-side phenology bar chart, shared by the maps export and the DOCX
 * manuscript builder. Mirrors the on-screen PhenologyStrip but at print
 * dimensions and with all colors / fonts inlined.
 */

import { viridis } from "@/lib/insectid/viridis";
import type { TaxonRow } from "@/lib/db/schema";

const W = 900;
const H = 320;
const PAD_LEFT = 60;
const PAD_RIGHT = 30;
const PAD_TOP = 70;
const PAD_BOTTOM = 60;

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export interface PhenologySvgParams {
  taxon: Pick<TaxonRow, "scientificName" | "authority">;
  /** Length-12 array, January at index 0. */
  counts: ReadonlyArray<number>;
  yearRange?: { min: number; max: number };
}

const escapeXml = (s: string) =>
  s.replace(/[<>&'"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!,
  );

export function buildPhenologySvg({
  taxon,
  counts,
  yearRange,
}: PhenologySvgParams): string {
  if (counts.length !== 12) {
    throw new Error(`buildPhenologySvg expects 12 counts; got ${counts.length}`);
  }
  const max = Math.max(...counts, 1);
  const total = counts.reduce((a, b) => a + b, 0);
  const chartW = W - PAD_LEFT - PAD_RIGHT;
  const chartH = H - PAD_TOP - PAD_BOTTOM;
  const barSlot = chartW / 12;
  const barW = barSlot * 0.7;

  const bars = counts
    .map((c, i) => {
      const t = c === 0 ? 0 : c / max;
      const h = Math.max(2, t * chartH);
      const x = PAD_LEFT + i * barSlot + (barSlot - barW) / 2;
      const y = PAD_TOP + chartH - h;
      const fill = c === 0 ? "#F1F3F5" : viridis(t);
      const monthLabel = MONTH_LABELS[i];
      const countLabel = c > 0
        ? `<text x="${x + barW / 2}" y="${y - 4}" font-size="11" fill="#5f6360" text-anchor="middle">${c}</text>`
        : "";
      return [
        `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="${fill}"><title>${monthLabel} · ${c} record${c === 1 ? "" : "s"}</title></rect>`,
        countLabel,
        `<text x="${(x + barW / 2).toFixed(1)}" y="${(PAD_TOP + chartH + 16).toFixed(1)}" font-size="12" fill="#5f6360" text-anchor="middle">${monthLabel}</text>`,
      ].join("");
    })
    .join("");

  // Y-axis ticks: 0 → max, 4 evenly spaced lines.
  const ticks = [0, 0.25, 0.5, 0.75, 1.0].map((t) => {
    const y = PAD_TOP + chartH - t * chartH;
    const v = Math.round(t * max);
    return [
      `<line x1="${PAD_LEFT}" x2="${W - PAD_RIGHT}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#E5E7EB" stroke-width="0.5"/>`,
      `<text x="${PAD_LEFT - 6}" y="${(y + 4).toFixed(1)}" font-size="11" fill="#5f6360" text-anchor="end">${v}</text>`,
    ].join("");
  }).join("");

  const subtitleBits = [
    `${total.toLocaleString()} record${total === 1 ? "" : "s"}`,
    yearRange ? `${yearRange.min}–${yearRange.max}` : null,
  ].filter(Boolean).join(" · ");

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Lato, Helvetica, Arial, sans-serif">`,
    `<title>${escapeXml(`${taxon.scientificName} — phenology`)}</title>`,
    `<rect width="100%" height="100%" fill="#FFFFFF"/>`,
    `<text x="${PAD_LEFT}" y="28" font-size="18" font-weight="700" fill="#0A3F95"><tspan font-style="italic">${escapeXml(taxon.scientificName)}</tspan> <tspan fill="#5f6360" font-weight="400">${escapeXml(taxon.authority ?? "")}</tspan></text>`,
    `<text x="${PAD_LEFT}" y="50" font-size="12" fill="#5f6360">Records by month · ${escapeXml(subtitleBits)}</text>`,
    `<g>${ticks}</g>`,
    `<g>${bars}</g>`,
    `</svg>`,
  ].join("");
}

export const PHENOLOGY_SVG_DIMENSIONS = { w: W, h: H };

/**
 * Bucket a list of ISO date strings (YYYY-MM-DD) into month counts.
 * Server-side equivalent of bucketByMonth in phenology-strip.tsx — duplicated
 * so this module is server-safe.
 */
export function bucketByMonth(dates: ReadonlyArray<string | null>): number[] {
  const out = Array(12).fill(0) as number[];
  for (const d of dates) {
    if (!d) continue;
    const month = Number(d.slice(5, 7));
    if (month >= 1 && month <= 12) out[month - 1] += 1;
  }
  return out;
}

export function dateRangeOf(
  dates: ReadonlyArray<string | null>,
): { min: number; max: number } | undefined {
  let min = Infinity;
  let max = -Infinity;
  for (const d of dates) {
    if (!d) continue;
    const y = Number(d.slice(0, 4));
    if (!Number.isFinite(y)) continue;
    if (y < min) min = y;
    if (y > max) max = y;
  }
  return Number.isFinite(min) && Number.isFinite(max)
    ? { min, max }
    : undefined;
}

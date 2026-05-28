import { cn } from "@/lib/utils";
import { viridis } from "@/lib/insectid/viridis";

const MONTH_LABELS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export interface PhenologyStripProps {
  /** Counts per month (1-indexed). Missing months treated as 0. */
  counts: ReadonlyArray<number>;
  /** Optional aggregate range so the strip can render meta. */
  yearRange?: { min: number; max: number };
  size?: "sm" | "md";
  className?: string;
}

/**
 * Per-species phenology: 12 vertical bars, one per month, height + viridis
 * tone scaled to the maximum monthly count across the dataset.
 *
 * Reads counts: a length-12 array where index 0 is January.
 */
export function PhenologyStrip({
  counts,
  yearRange,
  size = "md",
  className,
}: PhenologyStripProps) {
  if (counts.length !== 12) {
    throw new Error(`PhenologyStrip expects 12 counts; got ${counts.length}`);
  }
  const max = Math.max(...counts, 1);
  const total = counts.reduce((a, b) => a + b, 0);
  const heightPx = size === "sm" ? 32 : 56;
  const barW = size === "sm" ? 12 : 18;
  const gap = size === "sm" ? 2 : 4;
  const fullW = barW * 12 + gap * 11;

  return (
    <figure
      className={cn("flex flex-col gap-2", className)}
      role="img"
      aria-label={`Monthly activity — ${total} record${total === 1 ? "" : "s"} across ${counts.filter((c) => c > 0).length} months`}
    >
      <div className="sr-only">
        <p>
          Phenology distribution{" "}
          {yearRange
            ? `${yearRange.min}–${yearRange.max}`
            : "across all years"}
          : {total} total records.
        </p>
        <ul>
          {counts.map((c, i) => (
            <li key={i}>
              {MONTH_NAMES[i]}: {c} record{c === 1 ? "" : "s"}
            </li>
          ))}
        </ul>
      </div>

      <svg
        width={fullW}
        height={heightPx + 14}
        viewBox={`0 0 ${fullW} ${heightPx + 14}`}
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
        className="overflow-visible"
      >
        {counts.map((c, i) => {
          const t = c === 0 ? 0 : c / max;
          const h = Math.max(2, Math.round(t * heightPx));
          const x = i * (barW + gap);
          const y = heightPx - h;
          const fill =
            c === 0 ? "var(--color-surface-2)" : viridis(t);
          return (
            <g key={i}>
              <title>{`${MONTH_NAMES[i]} · ${c} record${c === 1 ? "" : "s"}`}</title>
              <rect
                x={x}
                y={y}
                width={barW}
                height={h}
                rx={2}
                fill={fill}
              />
              <text
                x={x + barW / 2}
                y={heightPx + 11}
                textAnchor="middle"
                fontSize="9"
                fill="var(--color-text-400)"
                fontFamily="var(--font-sans)"
              >
                {MONTH_LABELS[i]}
              </text>
            </g>
          );
        })}
      </svg>

      <figcaption className="text-[11px] text-text-400">
        Records by month · {total.toLocaleString()} total
        {yearRange && ` · ${yearRange.min}–${yearRange.max}`}
      </figcaption>
    </figure>
  );
}

/**
 * Bucket a list of ISO date strings (YYYY-MM-DD) into month counts (length 12,
 * 0-indexed). Records with no date are skipped.
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

/** Compute the year range from a list of ISO date strings. */
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

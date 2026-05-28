import { cn } from "@/lib/utils";

const TONES = {
  gbif:   { bg: "bg-blue-50",    fg: "text-blue-700",    border: "border-blue-200" },
  inat:   { bg: "bg-success-50", fg: "text-success-700", border: "border-success-600/30" },
  manual: { bg: "bg-surface-2",  fg: "text-text-600",    border: "border-surface-3" },
  cite:   { bg: "bg-cyan-50",    fg: "text-cyan-600",    border: "border-cyan-400/40" },
  merged: { bg: "bg-surface-0",  fg: "text-text-500",    border: "border-surface-3" },
} as const;

const LABELS = {
  gbif: "GBIF",
  inat: "iNat",
  manual: "Manual",
  cite: "Cite",
  merged: "Merged",
} as const;

export type SourceKind = keyof typeof TONES;

export interface SourceChipProps {
  source: SourceKind;
  className?: string;
}

export function SourceChip({ source, className }: SourceChipProps) {
  const t = TONES[source];
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-full border px-1.5 text-[10px] font-bold uppercase tracking-[0.06em]",
        t.bg,
        t.fg,
        t.border,
        className,
      )}
    >
      {LABELS[source]}
    </span>
  );
}

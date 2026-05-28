import { Check, CircleDashed, X } from "lucide-react";
import { cn } from "@/lib/utils";

type InclusionState = "include" | "exclude" | "undecided";

const STYLES: Record<
  InclusionState,
  { bg: string; fg: string; icon: typeof Check; label: string }
> = {
  include: {
    bg: "bg-success-50",
    fg: "text-success-700",
    icon: Check,
    label: "Included",
  },
  exclude: {
    bg: "bg-surface-2",
    fg: "text-text-500",
    icon: X,
    label: "Excluded",
  },
  undecided: {
    bg: "bg-warning-50",
    fg: "text-warning-700",
    icon: CircleDashed,
    label: "Undecided",
  },
};

export interface InclusionBadgeProps {
  state: InclusionState;
  className?: string;
}

export function InclusionBadge({ state, className }: InclusionBadgeProps) {
  const s = STYLES[state];
  const Icon = s.icon;
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded-full px-2 text-[11px] font-bold",
        s.bg,
        s.fg,
        className,
      )}
    >
      <Icon className="size-3" aria-hidden />
      {s.label}
    </span>
  );
}

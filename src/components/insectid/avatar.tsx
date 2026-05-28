import { cn } from "@/lib/utils";

// Okabe-Ito tones used as background swatches. The skyblue/yellow tones get
// dark text; everything else uses white. These are the project's categorical
// palette (`globals.css` `--color-ok-*`).
const TONES = [
  { bg: "bg-ok-orange",     fg: "text-white" },
  { bg: "bg-ok-skyblue",    fg: "text-text-700" },
  { bg: "bg-ok-green",      fg: "text-white" },
  { bg: "bg-ok-yellow",     fg: "text-text-700" },
  { bg: "bg-ok-blue",       fg: "text-white" },
  { bg: "bg-ok-vermillion", fg: "text-white" },
  { bg: "bg-ok-purple",     fg: "text-white" },
] as const;

// Deterministic hash of the initials → tone index. Same initials always get
// the same tone across screens.
function toneFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return TONES[h % TONES.length];
}

const SIZES = {
  xs: "size-5 text-[10px]",
  sm: "size-6 text-[11px]",
  md: "size-8 text-xs",
  lg: "size-10 text-sm",
} as const;

export interface AvatarProps {
  initials: string;
  size?: keyof typeof SIZES;
  title?: string;
  ring?: boolean;
  className?: string;
}

export function Avatar({
  initials,
  size = "md",
  title,
  ring,
  className,
}: AvatarProps) {
  const initialsTrim = initials.slice(0, 2).toUpperCase();
  const tone = toneFor(initialsTrim);
  return (
    <span
      aria-label={title}
      title={title}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-bold tracking-[0.02em] select-none",
        SIZES[size],
        tone.bg,
        tone.fg,
        ring && "ring-2 ring-surface-0",
        className,
      )}
    >
      {initialsTrim}
    </span>
  );
}

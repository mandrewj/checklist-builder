import { Avatar, type AvatarProps } from "./avatar";
import { cn } from "@/lib/utils";

export interface AvatarStackProps {
  list: ReadonlyArray<Pick<AvatarProps, "initials" | "title">>;
  max?: number;
  size?: AvatarProps["size"];
  className?: string;
}

export function AvatarStack({
  list,
  max = 4,
  size = "sm",
  className,
}: AvatarStackProps) {
  const shown = list.slice(0, max);
  const overflow = list.length - shown.length;
  return (
    <div
      className={cn("flex items-center", className)}
      aria-label={`${list.length} member${list.length === 1 ? "" : "s"}`}
    >
      {shown.map((m, i) => (
        <Avatar
          key={`${m.initials}-${i}`}
          initials={m.initials}
          title={m.title}
          size={size}
          ring
          className={i > 0 ? "-ml-1.5" : undefined}
        />
      ))}
      {overflow > 0 && (
        <span
          aria-label={`+${overflow} more`}
          className={cn(
            "-ml-1.5 inline-flex shrink-0 items-center justify-center rounded-full bg-surface-2 font-bold tracking-[0.02em] text-text-500 ring-2 ring-surface-0",
            size === "lg" ? "size-10 text-sm"
              : size === "md" ? "size-8 text-xs"
              : size === "xs" ? "size-5 text-[10px]"
              : "size-6 text-[11px]",
          )}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}

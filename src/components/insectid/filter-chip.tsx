"use client";

import { useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export interface FilterChipProps {
  label: string;
  count?: number;
  /** Search param key + value this chip toggles. `null` value clears. */
  param: string;
  value: string | null;
  active: boolean;
  className?: string;
}

export function FilterChip({
  label,
  count,
  param,
  value,
  active,
  className,
}: FilterChipProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = new URLSearchParams(searchParams.toString());
    if (value === null || active) {
      next.delete(param);
    } else {
      next.set(param, value);
    }
    const qs = next.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={active}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs font-bold transition-colors",
        active
          ? "border-blue-600 bg-blue-50 text-blue-800"
          : "border-surface-3 bg-surface-0 text-text-500 hover:border-blue-200 hover:text-text-700",
        pending && "opacity-60",
        className,
      )}
    >
      <span>{label}</span>
      {typeof count === "number" && (
        <span
          className={cn(
            "inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold",
            active ? "bg-blue-600 text-white" : "bg-surface-2 text-text-500",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

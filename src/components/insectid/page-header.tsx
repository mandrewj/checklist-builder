import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-3 border-b border-surface-3 px-8 py-7",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          <h1 className="rule text-2xl font-black">{title}</h1>
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
      {description && (
        <p className="max-w-3xl text-sm text-text-500">{description}</p>
      )}
    </header>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Download,
  FilePlus2,
  GitMerge,
  LayoutDashboard,
  List,
  Settings,
  Table,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: typeof Activity;
  badge?: number;
  badgeTone?: "warning" | "info";
}

export interface ProjectSidebarProps {
  projectId: string;
  openConflictsCount?: number;
  manualCount?: number;
}

export function ProjectSidebar({
  projectId,
  openConflictsCount = 0,
  manualCount = 0,
}: ProjectSidebarProps) {
  const pathname = usePathname();
  const base = `/projects/${projectId}`;

  const items: NavItem[] = [
    { href: `${base}`, label: "Overview", icon: LayoutDashboard },
    { href: `${base}/checklist`, label: "Checklist", icon: List },
    { href: `${base}/records`, label: "Records", icon: Table },
    {
      href: `${base}/conflicts`,
      label: "Conflicts",
      icon: GitMerge,
      badge: openConflictsCount,
      badgeTone: "warning",
    },
    {
      href: `${base}/manual`,
      label: "Manual entries",
      icon: FilePlus2,
      badge: manualCount,
      badgeTone: "info",
    },
    { href: `${base}/activity`, label: "Activity", icon: Activity },
    { href: `${base}/members`, label: "Members", icon: Users },
    { href: `${base}/exports`, label: "Exports", icon: Download },
    { href: `${base}/settings`, label: "Settings", icon: Settings },
  ];

  const isActive = (href: string) =>
    href === base ? pathname === base : pathname?.startsWith(href);

  return (
    <nav
      aria-label="Project navigation"
      className="flex h-full w-56 shrink-0 flex-col gap-1 border-r border-surface-3 bg-surface-1 px-3 py-5"
    >
      <span className="px-3 pb-3 text-[10px] font-bold uppercase tracking-[0.12em] text-text-400">
        Project
      </span>
      <ul className="flex flex-col gap-0.5">
        {items.map(({ href, label, icon: Icon, badge, badgeTone }) => {
          const active = isActive(href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "border-r-2 border-blue-600 bg-blue-50 text-blue-800"
                    : "text-text-500 hover:bg-surface-2 hover:text-text-700",
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                <span className="flex-1">{label}</span>
                {badge && badge > 0 ? (
                  <span
                    className={cn(
                      "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold",
                      badgeTone === "warning"
                        ? "bg-warning-50 text-warning-700"
                        : "bg-blue-50 text-blue-700",
                    )}
                  >
                    {badge}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

import type { ReactNode } from "react";

export interface AppShellProps {
  topBar?: ReactNode;
  sidebar?: ReactNode;
  banner?: ReactNode;
  children: ReactNode;
}

/**
 * The signed-in workspace shell. The layout is a fixed top bar, a fixed
 * left sidebar, and a scrollable main slot. Both the sidebar and the top bar
 * render in the same RSC pass as the route content — there is no client
 * hydration boundary at this layer.
 */
export function AppShell({ topBar, sidebar, banner, children }: AppShellProps) {
  return (
    <div className="flex h-screen min-h-0 w-full flex-col bg-surface-1">
      {topBar}
      {banner}
      <div className="flex min-h-0 flex-1">
        {sidebar}
        <main className="flex-1 overflow-y-auto bg-surface-0 nice-scroll">
          {children}
        </main>
      </div>
    </div>
  );
}

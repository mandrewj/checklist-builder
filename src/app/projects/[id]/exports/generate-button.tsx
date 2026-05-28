"use client";

import { useState } from "react";
import { generateExport } from "@/lib/actions/exports";
import { cn } from "@/lib/utils";

type Format = "json" | "csv" | "maps" | "docx" | "dwc";

const CLIENT_TIMEOUT_MS = 120_000;

export function GenerateButton({
  projectId,
  format,
  label,
  disabled,
  className,
}: {
  projectId: string;
  format: Format;
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  // Plain useState (NOT useTransition): the busy flag is ours to manage and
  // we reset it inside `finally` whether the action resolves, rejects, or
  // we hit the client-side timeout. useTransition's `pending` state can get
  // stuck if the server action never returns — which has bitten us before.
  // Page-state updates happen via the action's `revalidatePath` — we do NOT
  // also call `router.refresh()` because doing both races the action's RSC
  // stream and triggers "An unexpected response was received from the server".
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setError(null);
    setBusy(true);

    // Client-side timeout — if the server action genuinely hangs (DB stall,
    // network blip, etc.), give the user back control after 120 s with a
    // clear error and a clickable button. The server-side action keeps
    // running in the background and the user can safely retry.
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      setBusy(false);
      setError(
        `Server didn't respond in ${CLIENT_TIMEOUT_MS / 1000}s. The action may still be running in the background; try clicking again.`,
      );
    }, CLIENT_TIMEOUT_MS);

    try {
      const res = await generateExport(projectId, format);
      if (timedOut) return;
      if (!res.ok) setError(res.error);
      // Success path: revalidatePath inside the action already streams the
      // updated /exports route back to us — the artifact list refreshes
      // automatically. Calling router.refresh() here would race that stream.
    } catch (err) {
      if (!timedOut) {
        setError(err instanceof Error ? err.message : "request failed");
      }
    } finally {
      clearTimeout(timeoutId);
      if (!timedOut) setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={go}
        disabled={disabled || busy}
        className={cn(
          "inline-flex items-center justify-center rounded-md bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-card transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
      >
        {busy ? "Generating…" : label}
      </button>
      {error && (
        <span
          className="break-words text-[11px] text-danger-600"
          role="alert"
        >
          {error}
        </span>
      )}
    </div>
  );
}

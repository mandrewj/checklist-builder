/**
 * Derive a user's display name + initials from Clerk data, preferring the
 * person's actual name over their email. Shared by the Clerk webhook and the
 * seed:adopt script so both produce identical values.
 */

export interface ClerkUserish {
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  email_addresses?: ReadonlyArray<{ email_address?: string | null }> | null;
  external_accounts?: ReadonlyArray<{
    first_name?: string | null;
    last_name?: string | null;
  }> | null;
}

export interface Identity {
  email: string;
  displayName: string;
  initials: string;
  /** True when we resolved a real name (not just the email fallback) — lets
   *  the webhook avoid downgrading an existing good name to an email. */
  hasRealName: boolean;
}

/**
 * Initials from a display name: first letter of the first and last token.
 * "Andrew Johnston" → "AJ"; "Tenebrio" → "TE"; "" → "?".
 */
export function deriveInitials(name: string): string {
  const tokens = name.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return "?";
  if (tokens.length === 1) return tokens[0].slice(0, 2).toUpperCase();
  const first = tokens[0][0] ?? "";
  const last = tokens[tokens.length - 1][0] ?? "";
  return (first + last).toUpperCase();
}

function firstNonEmpty(...vals: Array<string | null | undefined>): string {
  for (const v of vals) {
    const t = v?.trim();
    if (t) return t;
  }
  return "";
}

export function resolveIdentity(u: ClerkUserish): Identity {
  const email =
    firstNonEmpty(u.email_addresses?.[0]?.email_address) || "unknown@local";

  // Prefer top-level Clerk name; fall back to the linked OAuth account's name
  // (Google sometimes populates only there); then username.
  const ext = u.external_accounts?.[0];
  const first = firstNonEmpty(u.first_name, ext?.first_name);
  const last = firstNonEmpty(u.last_name, ext?.last_name);
  const fullName = [first, last].filter(Boolean).join(" ");
  const username = firstNonEmpty(u.username);

  const realName = fullName || username;
  if (realName) {
    return {
      email,
      displayName: realName,
      initials: deriveInitials(realName),
      hasRealName: true,
    };
  }

  // No name anywhere — last resort, derive a readable name from the email
  // local part (e.g. "m.andrew.johnston" → "M Andrew Johnston").
  const local = email.split("@")[0] ?? email;
  const pretty = local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
  const displayName = pretty || email;
  return {
    email,
    displayName,
    initials: deriveInitials(displayName),
    hasRealName: false,
  };
}

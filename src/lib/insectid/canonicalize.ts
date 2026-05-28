/**
 * Split a scientific name into canonical + authority.
 *
 * Canonical = the binomial/trinomial/uninomial without authorship.
 *   "Anthicus cervinus LaFerté-Sénectère, 1849" → "Anthicus cervinus"
 *   "Notoxus murinipennis (J.E.LeConte, 1824)"  → "Notoxus murinipennis"
 *   "Alobates pennsylvanicus (DeGeer, 1775)"    → "Alobates pennsylvanicus"
 *   "Diaperis maculata maculata"                → "Diaperis maculata maculata"
 *   "Tenebrionidae"                             → "Tenebrionidae"
 *
 * Heuristic: a canonical name is the initial run of words where:
 *   - word #1 is capitalized (genus or family)
 *   - subsequent words are entirely lowercase + dashes (epithets)
 *   - the connector tokens "subsp.", "var.", "f.", "ssp." are also allowed
 *     as part of the canonical (so trinomials with connectors survive)
 *
 * Anything after that prefix is treated as authority. Works for the vast
 * majority of well-formed names. Malformed inputs survive — the whole string
 * is returned as the canonical.
 */

const EPITHET = /^[a-zëïöüáéíóúýñç-]+$/i; // lowercase-only epithets (no caps)
const SUBSPECIES_CONNECTOR = /^(subsp\.|var\.|ssp\.|f\.|forma|subvar\.)$/i;

export interface CanonicalName {
  canonical: string;
  authority: string | null;
}

export function canonicalize(raw: string): CanonicalName {
  const input = raw.trim();
  if (!input) return { canonical: "", authority: null };

  const tokens = input.split(/\s+/);
  if (tokens.length === 0) return { canonical: input, authority: null };

  // First token must look like a capitalized name fragment.
  const first = tokens[0];
  if (!/^[A-Z]/.test(first)) {
    // Doesn't look like a scientific name at all — return as-is.
    return { canonical: input, authority: null };
  }

  const kept: string[] = [first];
  for (let i = 1; i < tokens.length; i++) {
    const t = tokens[i];
    // Subspecies / variety connectors keep the canonical going.
    if (SUBSPECIES_CONNECTOR.test(t)) {
      kept.push(t);
      continue;
    }
    // Pure-lowercase epithet (cervinus, niger, pensylvanicus).
    if (/^[a-z]/.test(t) && EPITHET.test(t.replace(/[,;]+$/, ""))) {
      kept.push(t);
      continue;
    }
    break;
  }

  const canonical = kept.join(" ");
  const remainder = input.slice(canonical.length).trim();
  return { canonical, authority: remainder || null };
}

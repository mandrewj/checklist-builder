/**
 * Live smoke test for resolveTaxonIds. Hits GBIF + iNat for real.
 * Expects network access; ~10 s on a normal connection.
 */

import { resolveTaxonIds } from "../src/lib/sources/taxon-resolver";

async function check(
  label: string,
  fn: () => Promise<unknown>,
  expect: (v: unknown) => boolean,
) {
  const v = await fn();
  const ok = expect(v);
  console.log(`${ok ? "✓" : "✗"} ${label}: ${JSON.stringify(v)}`);
  if (!ok) process.exit(1);
}

async function main() {
  // Alobates pennsylvanicus — known GBIF 4734451, iNat 127344.
  await check(
    "Alobates pennsylvanicus — both IDs missing → resolves both",
    () => resolveTaxonIds({ scientificName: "Alobates pennsylvanicus" }),
    (v) =>
      typeof (v as { gbifKey?: number }).gbifKey === "number" &&
      typeof (v as { inatId?: number }).inatId === "number",
  );

  // Only iNat known: should fill in GBIF.
  await check(
    "Alobates pennsylvanicus — only inatId given → fills gbifKey",
    () =>
      resolveTaxonIds({
        scientificName: "Alobates pennsylvanicus",
        inatId: 127344,
      }),
    (v) => {
      const r = v as { gbifKey?: number; inatId?: number };
      return r.inatId === 127344 && typeof r.gbifKey === "number";
    },
  );

  // Both already known: should be a no-op (no fetch).
  await check(
    "Both IDs already set → no change",
    () =>
      resolveTaxonIds({
        scientificName: "Alobates pennsylvanicus",
        gbifKey: 4734451,
        inatId: 127344,
      }),
    (v) => {
      const r = v as { gbifKey?: number; inatId?: number };
      return r.gbifKey === 4734451 && r.inatId === 127344;
    },
  );

  // Authorship in name should still resolve (canonicalize strips it).
  await check(
    "GBIF-style name with authorship → still resolves",
    () =>
      resolveTaxonIds({
        scientificName: "Alobates pennsylvanicus (DeGeer, 1775)",
      }),
    (v) =>
      typeof (v as { gbifKey?: number }).gbifKey === "number" &&
      typeof (v as { inatId?: number }).inatId === "number",
  );

  // Made-up name should resolve to nothing (and not throw).
  await check(
    "Nonexistent name → returns no IDs",
    () => resolveTaxonIds({ scientificName: "Notarealtaxon notreal" }),
    (v) => {
      const r = v as { gbifKey?: number; inatId?: number };
      return r.gbifKey === undefined && r.inatId === undefined;
    },
  );

  console.log("\n[smoke] taxon resolver ok");
}

main().catch((err) => {
  console.error("[smoke] failed:", err);
  process.exit(1);
});

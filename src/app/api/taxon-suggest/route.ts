import { NextResponse } from "next/server";
import { gbifTaxonAutocomplete } from "@/lib/sources/gbif";
import { inatTaxonAutocomplete } from "@/lib/sources/inat";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/taxon-suggest?q=tenebrionidae&source=gbif|inat|both
 *
 * Cached at the edge for 24 h (s-maxage=86400). Used by the project wizard.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const source = (url.searchParams.get("source") ?? "both").toLowerCase();
  if (!q) {
    return NextResponse.json(
      { gbif: [], inat: [] },
      { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400" } },
    );
  }

  const tasks: Array<Promise<unknown>> = [];
  if (source === "gbif" || source === "both")
    tasks.push(gbifTaxonAutocomplete(q));
  else tasks.push(Promise.resolve([]));
  if (source === "inat" || source === "both")
    tasks.push(inatTaxonAutocomplete(q));
  else tasks.push(Promise.resolve([]));

  const [gbif, inat] = await Promise.all(tasks);
  return NextResponse.json(
    { gbif, inat },
    { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400" } },
  );
}

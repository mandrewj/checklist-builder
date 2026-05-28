/**
 * SVG → PNG rasterizer for export figures.
 *
 * Uses @resvg/resvg-js with explicitly-loaded Lato font files rather than
 * sharp/librsvg, which relies on the host's fontconfig. On Vercel's
 * serverless runtime no fonts are installed, so librsvg renders every glyph
 * as a .notdef box (tofu). resvg loads the bundled TTFs directly, so text
 * renders the same as on screen regardless of environment.
 */

import path from "node:path";
import { Resvg } from "@resvg/resvg-js";

const FONT_DIR = path.resolve(process.cwd(), "public", "fonts");
const FONT_FILES = [
  "Lato-Regular.ttf",
  "Lato-Bold.ttf",
  "Lato-Italic.ttf",
  "Lato-BoldItalic.ttf",
].map((f) => path.join(FONT_DIR, f));

/**
 * Rasterize an SVG string to a PNG buffer at the given output width (px).
 * Height scales to preserve the SVG's aspect ratio.
 */
export function rasterizeSvg(svg: string, widthPx: number): Buffer {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: widthPx },
    font: {
      fontFiles: FONT_FILES,
      loadSystemFonts: false,
      defaultFontFamily: "Lato",
    },
    background: "white",
  });
  return Buffer.from(resvg.render().asPng());
}

/**
 * Rasterize many SVGs with bounded concurrency. resvg is synchronous and
 * CPU-bound, so concurrency mostly helps overlap with other async work; the
 * cap keeps memory in check on larger projects.
 */
export async function rasterizeAllInParallel(
  jobs: ReadonlyArray<{ id: string; svg: string }>,
  widthPx: number,
  concurrency = 4,
): Promise<Map<string, Buffer>> {
  const out = new Map<string, Buffer>();
  let cursor = 0;
  async function worker() {
    while (cursor < jobs.length) {
      const i = cursor++;
      const job = jobs[i];
      out.set(job.id, rasterizeSvg(job.svg, widthPx));
      // Yield so we don't monopolize the event loop on big batches.
      await Promise.resolve();
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, jobs.length) }, worker),
  );
  return out;
}

/**
 * Five-stop viridis ramp + a smooth lerp between stops. Implemented inline
 * so the component doesn't pull in d3-scale-chromatic.
 *
 * Stops chosen to match d3-scale-chromatic's `interpolateViridis` at
 * t = 0, 0.25, 0.5, 0.75, 1.0.
 */
const STOPS: Array<[number, number, number]> = [
  [68, 1, 84],     // #440154
  [59, 82, 139],   // #3b528b
  [33, 145, 140],  // #21918c
  [94, 201, 98],   // #5ec962
  [253, 231, 37],  // #fde725
];

function lerpChannel(a: number, b: number, t: number) {
  return Math.round(a + (b - a) * t);
}

function rgbToHex(r: number, g: number, b: number) {
  return (
    "#" +
    [r, g, b]
      .map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0"))
      .join("")
  );
}

/** t ∈ [0, 1] → hex color along the viridis ramp. */
export function viridis(t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  const scaled = clamped * (STOPS.length - 1);
  const i = Math.min(Math.floor(scaled), STOPS.length - 2);
  const local = scaled - i;
  const a = STOPS[i];
  const b = STOPS[i + 1];
  return rgbToHex(
    lerpChannel(a[0], b[0], local),
    lerpChannel(a[1], b[1], local),
    lerpChannel(a[2], b[2], local),
  );
}

/** Build evenly-spaced legend swatches for the ramp (low → high). */
export function viridisLegendStops(n = 5): Array<{ t: number; color: string }> {
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    return { t, color: viridis(t) };
  });
}

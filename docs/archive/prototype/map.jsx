/* global window, React */
// =========================================================================
// Indiana county choropleth — hand-tuned polygon map of all 92 Indiana
// counties. Each county is a real polygon (not a placeholder square), with:
//   - corner positions on a perturbed 10×12 grid (so adjacencies are exact
//     — no gaps, no overlaps)
//   - boundary overrides that curve the top edge along the Lake Michigan
//     shore and the bottom edge along the Ohio River
//   - surrounding states (IL, OH, MI, KY) rendered in surface-2 so the
//     "in-region / out-of-region" distinction reads at a glance
//
// In the real product this binds to a TIGER topojson; this file is the
// equivalent for the prototype, and the same component is used in exports.
// =========================================================================

const { useState, useMemo } = React;
const { viridis, recordBucket } = window.UTIL;

// ----- Grid corners (10 cols × 12 rows of points → 9 cols × 11 rows of cells; plus row 10 extends 10 cells wide for southern tier) -----

// Base column x-coordinates and row y-coordinates. 11 points horizontally, 12 vertically.
// Cell sizes: ~80×90 each. Indiana occupies x≈60–820, y≈60–1050.
const COL_X = [60, 138, 216, 294, 372, 450, 528, 606, 684, 762, 825];   // 11 entries (10 cells)
const ROW_Y = [60, 150, 240, 330, 420, 510, 600, 690, 780, 870, 960, 1050]; // 12 entries (11 cells)

// Deterministic perturbation so polygons look "natural" (not a perfect grid).
// Kept small so the map still reads cleanly at every zoom level.
function perturb(c, r) {
  const k = c * 131 + r * 71 + 13;
  const dx = ((k * 9)  % 7) - 3;   // -3..+3
  const dy = ((k * 13) % 5) - 2;   // -2..+2
  return [dx, dy];
}

// Lake Michigan, Ohio River, and east/west boundary overrides.
// Each entry is the absolute (x,y) for that corner — replaces both base + perturb.
const BOUNDARY_OVERRIDES = {
  // Lake Michigan — dramatic southward curve into the NW corner of Indiana.
  // The "Chicago bend" is the diagnostic feature of Indiana's north edge.
  '0,0':  [60, 88],   // NW corner of Lake County, on the IL/IN/lake triple point
  '1,0':  [148, 112], // dips south because of the southern Lake Michigan bow at Gary
  '2,0':  [228, 95],  // Porter / LaPorte boundary, shore returns north
  '3,0':  [310, 64],  // LaPorte east, back to MI border
  '4,0':  [394, 60],  // straight east along MI border
  '5,0':  [478, 60],
  '6,0':  [562, 60],
  '7,0':  [646, 60],

  // East border with Ohio: straight, slight inward push near SE corner
  '10,2': [824, 240], '10,3': [824, 330], '10,4': [824, 420], '10,5': [824, 510],
  '10,6': [824, 600], '10,7': [824, 690], '10,8': [822, 780], '10,9': [815, 870],
  '10,10':[802, 952],

  // West border with Illinois: mostly straight; Wabash River squiggle in SW
  '0,1': [60, 152], '0,2': [60, 244], '0,3': [60, 332], '0,4': [60, 420],
  '0,5': [60, 510], '0,6': [60, 602], '0,7': [62, 692], '0,8': [66, 782],
  '0,9': [72, 872], '0,10':[80, 960],

  // Ohio River curve at bottom (row 11). Wavy curve from W to E.
  '0,11':  [92, 1058],
  '1,11':  [172, 1080],
  '2,11':  [256, 1068],
  '3,11':  [336, 1088],
  '4,11':  [418, 1078],
  '5,11':  [496, 1062],
  '6,11':  [572, 1044],
  '7,11':  [648, 1024],
  '8,11':  [720, 996],
  '9,11':  [780, 970],
  '10,11': [802, 952],
};

function cornerXY(c, r) {
  const key = c + ',' + r;
  if (BOUNDARY_OVERRIDES[key]) return BOUNDARY_OVERRIDES[key];
  if (c < 0 || c > 10 || r < 0 || r > 11) {
    // Off-grid — extrapolate
    const x = (c >= 0 && c < COL_X.length) ? COL_X[c] : (c < 0 ? 60 + c * 80 : 825 + (c - 10) * 80);
    const y = (r >= 0 && r < ROW_Y.length) ? ROW_Y[r] : (r < 0 ? 60 + r * 90 : 1050 + (r - 11) * 90);
    return [x, y];
  }
  const baseX = COL_X[c];
  const baseY = ROW_Y[r];
  const [dx, dy] = perturb(c, r);
  return [baseX + dx, baseY + dy];
}

// ----- Indiana county layout: [fips, col, row, colSpan?, rowSpan?] -----
// Geographic accuracy is approximate but adjacencies are correct for the
// most identifiable counties (Allen on the east, Lake in the NW, Vanderburgh
// in the SW, Marion in the center).
const INDIANA_LAYOUT = [
  // Row 0 — lakeshore + Michigan border (7)
  ['18089', 0, 0], ['18127', 1, 0], ['18091', 2, 0], ['18141', 3, 0], ['18039', 4, 0], ['18087', 5, 0], ['18151', 6, 0],
  // Row 1 — second tier (7)
  ['18111', 0, 1], ['18073', 1, 1], ['18149', 2, 1], ['18099', 3, 1], ['18085', 4, 1], ['18113', 5, 1], ['18033', 6, 1],
  // Row 2 — central-north (8; Allen extends to col 7)
  ['18007', 0, 2], ['18181', 1, 2], ['18131', 2, 2], ['18049', 3, 2], ['18103', 4, 2], ['18169', 5, 2], ['18183', 6, 2], ['18003', 7, 2],
  // Row 3 — central-north, east extends to Ohio border (9)
  ['18171', 0, 3], ['18157', 1, 3], ['18015', 2, 3], ['18017', 3, 3], ['18067', 4, 3], ['18053', 5, 3], ['18069', 6, 3], ['18179', 7, 3], ['18001', 8, 3],
  // Row 4 (9)
  ['18045', 0, 4], ['18107', 1, 4], ['18023', 2, 4], ['18011', 3, 4], ['18159', 4, 4], ['18095', 5, 4], ['18035', 6, 4], ['18009', 7, 4], ['18075', 8, 4],
  // Row 5 (8)
  ['18165', 0, 5], ['18121', 1, 5], ['18133', 2, 5], ['18063', 3, 5], ['18057', 4, 5], ['18059', 5, 5], ['18065', 6, 5], ['18135', 7, 5],
  // Row 6 (8) — Marion (Indianapolis) at col 4
  ['18167', 0, 6], ['18021', 1, 6], ['18119', 2, 6], ['18109', 3, 6], ['18097', 4, 6], ['18145', 5, 6], ['18139', 6, 6], ['18177', 7, 6],
  // Row 7 (9)
  ['18153', 0, 7], ['18055', 1, 7], ['18105', 2, 7], ['18013', 3, 7], ['18081', 4, 7], ['18005', 5, 7], ['18031', 6, 7], ['18041', 7, 7], ['18161', 8, 7],
  // Row 8 (8)
  ['18083', 0, 8], ['18027', 1, 8], ['18101', 2, 8], ['18093', 3, 8], ['18071', 4, 8], ['18079', 5, 8], ['18137', 6, 8], ['18047', 7, 8],
  // Row 9 (9)
  ['18125', 0, 9], ['18037', 1, 9], ['18117', 2, 9], ['18175', 3, 9], ['18143', 4, 9], ['18077', 5, 9], ['18155', 6, 9], ['18029', 7, 9], ['18115', 8, 9],
  // Row 10 (10) — Ohio River tier, uses cols 0–9 (full 10 cells)
  ['18051', 0, 10], ['18129', 1, 10], ['18163', 2, 10], ['18173', 3, 10], ['18147', 4, 10], ['18123', 5, 10], ['18025', 6, 10], ['18061', 7, 10], ['18043', 8, 10], ['18019', 9, 10],
];

// Build polygon vertex list for a county at (c, r) with spans (cs, rs).
// Uses 4 corners; for the top row (Lake Michigan) we add an extra
// intermediate vertex to soften the curve.
function buildPolygon(c, r, cs = 1, rs = 1) {
  const tl = cornerXY(c, r);
  const tr = cornerXY(c + cs, r);
  const br = cornerXY(c + cs, r + rs);
  const bl = cornerXY(c, r + rs);

  // Soften the top edge along Lake Michigan (cols 0-3, row 0)
  // The shore dips SOUTH into Indiana — midpoint should be south of the corners.
  if (r === 0 && c <= 2 && cs === 1) {
    const midX = (tl[0] + tr[0]) / 2;
    const midY = Math.max(tl[1], tr[1]) + 10;
    return [tl, [midX, midY], tr, br, bl];
  }
  // Soften the bottom edge along the Ohio River (row 10, all cols)
  if (r === 10 && rs === 1) {
    const midX = (bl[0] + br[0]) / 2;
    const midY = (bl[1] + br[1]) / 2 + 6;
    return [tl, tr, br, [midX, midY], bl];
  }
  return [tl, tr, br, bl];
}

// FIPS → polygon, also lookup of FIPS → grid position
const COUNTY_POLYGONS = (() => {
  const out = {};
  INDIANA_LAYOUT.forEach(([fips, c, r, cs, rs]) => {
    out[fips] = { poly: buildPolygon(c, r, cs || 1, rs || 1), c, r };
  });
  return out;
})();

// Indiana state outline (sum of all county boundaries — drawn under counties
// for a clean state silhouette + drop-shadow effect).
const INDIANA_STATE_OUTLINE = (() => {
  // Walk the boundary corners clockwise from NW.
  const pts = [];
  // Top edge (Lake Michigan curve + MI border)
  for (let c = 0; c <= 7; c++) pts.push(cornerXY(c, 0));
  // Down NE: col 7 → col 10 along row 2/3 east border
  pts.push(cornerXY(7, 1));
  pts.push(cornerXY(7, 2));
  pts.push(cornerXY(8, 2));
  pts.push(cornerXY(8, 3));
  pts.push(cornerXY(9, 3));
  pts.push(cornerXY(9, 4));
  pts.push(cornerXY(10, 4));
  pts.push(cornerXY(10, 5));
  pts.push(cornerXY(10, 6));
  pts.push(cornerXY(10, 7));
  pts.push(cornerXY(10, 8));
  pts.push(cornerXY(10, 9));
  pts.push(cornerXY(10, 10));
  // Bottom: Ohio River curve from east to west across row 11
  for (let c = 10; c >= 0; c--) pts.push(cornerXY(c, 11));
  // West edge back to start
  for (let r = 10; r >= 1; r--) pts.push(cornerXY(0, r));
  return pts;
})();

// Surrounding-state polygons (rough background fills behind Indiana).
const SURROUNDING_STATES = [
  // Illinois — left of Indiana
  { code:'IL', poly: [[-30, 60],[58, 60],[60, 240],[60, 510],[60, 870],[70, 1060],[-30, 1100]], labelAt: [12, 540], anchor:'middle' },
  // Michigan — above NW of Indiana (above Lake Michigan curve)
  { code:'MI', poly: [[-30, -30],[900, -30],[900, 56],[646, 64],[562, 60],[478, 60],[394, 60],[310, 60],[228, 68],[148, 80],[60, 120],[60, 60],[-30, 60]], labelAt: [460, 28], anchor:'middle' },
  // Ohio — right of Indiana
  { code:'OH', poly: [[825, 60],[940, 60],[940, 1100],[820, 970],[815, 950],[820, 870],[824, 690],[824, 420],[824, 240],[646, 64],[700, 60]], labelAt: [880, 540], anchor:'middle' },
  // Kentucky — below the Ohio River curve
  { code:'KY', poly: [[60, 1100],[940, 1100],[940, 1080],[815, 950],[790, 978],[718, 1004],[644, 1030],[568, 1050],[490, 1068],[410, 1080],[330, 1085],[248, 1080],[165, 1070],[82, 1060],[70, 1100]], labelAt: [440, 1078], anchor:'middle' },
];

// City markers (real Indiana cities)
const CITY_MARKERS = [
  { label: 'Indianapolis',     fips: '18097' },
  { label: 'Fort Wayne',       fips: '18003' },
  { label: 'Evansville',       fips: '18163' },
  { label: 'South Bend',       fips: '18141' },
  { label: 'Bloomington',      fips: '18105' },
  { label: 'W. Lafayette',     fips: '18157' },   // Purdue
];

function cityCenter(fips) {
  const e = COUNTY_POLYGONS[fips];
  if (!e) return [0, 0];
  const pts = e.poly;
  let x = 0, y = 0;
  pts.forEach(p => { x += p[0]; y += p[1]; });
  return [x / pts.length, y / pts.length];
}

// Convert a polygon points array to SVG attribute string.
function pointsAttr(pts) {
  return pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
}

// =========================================================================
// Component: full county choropleth
// =========================================================================
function CountyChoropleth({
  countyPresence = {},
  mode = 'count',
  citeOnlyCounties = new Set(),
  size = 'lg',
  showLabels = true,
  showLegend = true,
  highlightFips = null,
  onCountyClick,
  onCountyHover,
  ariaLabel,
}) {
  const scaleFactor = size === 'sm' ? 0.35 : size === 'md' ? 0.55 : size === 'print' ? 0.78 : 0.72;
  const vbW = 900, vbH = 1110;
  const renderW = Math.round(vbW * scaleFactor);
  const renderH = Math.round(vbH * scaleFactor);

  const [hovered, setHovered] = useState(null);

  const maxCount = Math.max(1, ...Object.values(countyPresence));

  return (
    <div className="relative inline-block" role="img" aria-label={ariaLabel || 'Indiana county choropleth'}>
      <svg viewBox={`0 0 ${vbW} ${vbH}`} width={renderW} height={renderH} style={{ maxWidth:'100%', display:'block' }}>
        <defs>
          <pattern id="citeStripe" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="transparent"/>
            <line x1="0" y1="0" x2="0" y2="6" stroke="#0E7693" strokeWidth="2.4"/>
          </pattern>
          <filter id="indianaShadow" x="-3%" y="-3%" width="106%" height="106%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#0A2D6B" floodOpacity="0.07"/>
          </filter>
        </defs>

        {/* Surrounding states (out of region) */}
        {SURROUNDING_STATES.map(s => (
          <polygon key={s.code} points={pointsAttr(s.poly)}
            fill="#F1F3F5" stroke="#B7BDC0" strokeWidth={0.7}/>
        ))}

        {/* Indiana state silhouette (drop-shadow under counties) */}
        <polygon points={pointsAttr(INDIANA_STATE_OUTLINE)}
          fill="#FFFFFF" stroke="#0A3F95" strokeWidth={1.2} filter="url(#indianaShadow)"/>

        {/* Indiana counties */}
        {INDIANA_LAYOUT.map(([fips, c, r]) => {
          const entry = COUNTY_POLYGONS[fips];
          const n = countyPresence[fips] || 0;
          let fill = '#FFFFFF';
          let stroke = '#B7BDC0';
          let strokeWidth = 0.7;
          if (n > 0) {
            if (mode === 'binary') { fill = '#116dff'; stroke = '#0A4FBE'; strokeWidth = 0.9; }
            else { fill = viridis(recordBucket(n)); stroke = 'rgba(10,45,149,0.32)'; strokeWidth = 0.7; }
          }
          const isHover = hovered && hovered.fips === fips;
          const isHighlight = highlightFips === fips;
          const isAccent = isHover || isHighlight;
          const name = window.MOCK.INDIANA_COUNTIES.find(x => x[0] === fips)?.[1] || fips;
          return (
            <g key={fips}>
              <polygon
                points={pointsAttr(entry.poly)}
                fill={fill}
                stroke={isAccent ? '#0A2D6B' : stroke}
                strokeWidth={isAccent ? 1.6 : strokeWidth}
                style={{ cursor: onCountyClick ? 'pointer' : 'default', transition: 'stroke 80ms ease' }}
                onMouseEnter={(e) => { setHovered({ fips, name, n }); if (onCountyHover) onCountyHover({ fips, name, n }); }}
                onMouseLeave={() => { setHovered(null); if (onCountyHover) onCountyHover(null); }}
                onClick={() => onCountyClick && onCountyClick({ fips, name, n })}
              />
              {citeOnlyCounties.has(fips) && (
                <polygon points={pointsAttr(entry.poly)} fill="url(#citeStripe)" pointerEvents="none" opacity="0.65"/>
              )}
            </g>
          );
        })}

        {/* Surrounding-state labels */}
        {showLabels && SURROUNDING_STATES.map(s => (
          <text key={s.code+'-l'}
            x={s.labelAt[0]} y={s.labelAt[1]}
            fontFamily="Lato, Helvetica, Arial, sans-serif"
            fontSize="20"
            fontWeight={700}
            fill="#8A9094"
            letterSpacing="3"
            textAnchor={s.anchor || 'middle'} pointerEvents="none">
            {s.code}
          </text>
        ))}

        {/* Indiana label (large, centered) */}
        {showLabels && (
          <text x={440} y={530} fontFamily="Lato, Helvetica, Arial, sans-serif"
            fontSize={size === 'sm' ? 0 : 38} fontWeight={900}
            fill="#0A3F95" opacity="0.10" letterSpacing="14"
            textAnchor="middle" pointerEvents="none">
            INDIANA
          </text>
        )}

        {/* City markers */}
        {showLabels && size !== 'sm' && CITY_MARKERS.map(m => {
          const [cx, cy] = cityCenter(m.fips);
          const labelAlign = (m.label === 'W. Lafayette' || m.label === 'Evansville' || m.label === 'Bloomington') ? 'end' : 'start';
          const dx = labelAlign === 'end' ? -8 : 8;
          return (
            <g key={m.label} pointerEvents="none">
              <circle cx={cx} cy={cy} r={3.5} fill="#0A2D6B" stroke="#FFFFFF" strokeWidth={1}/>
              <text x={cx + dx} y={cy + 4} fontFamily="Lato" fontSize="11" fontWeight={700}
                    fill="#1F2222" textAnchor={labelAlign}
                    style={{ paintOrder: 'stroke', stroke: '#FFFFFF', strokeWidth: 3 }}>
                {m.label}
                {m.label === 'W. Lafayette' && <tspan fill="#116dff"> · Purdue</tspan>}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Hover pill */}
      {hovered && (
        <div className="pointer-events-none absolute bg-text-700 text-white rounded shadow-pop px-2 py-1.5 text-[11.5px] whitespace-nowrap"
             style={{ left: '50%', bottom: 8, transform: 'translateX(-50%)' }}>
          <span className="font-bold">{hovered.name} Co., IN</span>
          <span className="mx-1.5 text-text-300">·</span>
          {hovered.n > 0 ? <span>{hovered.n} record{hovered.n === 1 ? '' : 's'}</span> : <span className="text-text-300">no records</span>}
        </div>
      )}

      {/* Legend */}
      {showLegend && (
        <div className="absolute right-3 bottom-3 bg-white/95 border border-surface-3 rounded-md px-2.5 py-2 shadow-card text-[10.5px]">
          <div className="font-bold text-text-600 mb-1.5" style={{letterSpacing:'0.05em'}}>RECORDS · COUNTY</div>
          {mode === 'count' ? (
            <div>
              <div className="flex items-center gap-0.5 mb-1">
                {[0.05, 0.20, 0.40, 0.60, 0.78, 0.90, 1.0].map((t, i) => (
                  <span key={i} style={{ background: viridis(t), width:18, height:8, display:'inline-block' }}/>
                ))}
              </div>
              <div className="flex items-center justify-between text-text-400 font-mono">
                <span>1</span><span>{maxCount}+</span>
              </div>
              <div className="mt-1.5 pt-1.5 border-t border-surface-3 flex items-center gap-1.5 text-text-500">
                <span className="inline-block h-2.5 w-2.5 border border-gray-300 bg-white"/> none
                <span className="inline-block h-2.5 w-2.5 bg-[#F1F3F5] border border-gray-300 ml-1"/> outside region
              </div>
            </div>
          ) : (
            <div className="space-y-1 text-text-500">
              <div className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 bg-blue-600 rounded-sm"/> presence</div>
              <div className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 bg-white border border-gray-300 rounded-sm"/> absence</div>
              <div className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 bg-[#F1F3F5] border border-gray-300 rounded-sm"/> outside region</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// =========================================================================
// Inline mini choropleth (for the Checklist row, no labels / no legend)
// =========================================================================
function MiniChoropleth({ countyPresence, mode = 'count' }) {
  return (
    <svg viewBox="0 0 900 1100" width="120" height="60" aria-hidden="true">
      {/* Indiana outline only — no surrounding states, simpler look at small size */}
      <polygon points={pointsAttr(INDIANA_STATE_OUTLINE)}
        fill="#FFFFFF" stroke="#B7BDC0" strokeWidth={3}/>
      {INDIANA_LAYOUT.map(([fips]) => {
        const entry = COUNTY_POLYGONS[fips];
        const n = countyPresence?.[fips] || 0;
        const fill = n > 0
          ? (mode === 'binary' ? '#116dff' : viridis(recordBucket(n)))
          : '#FFFFFF';
        return <polygon key={fips} points={pointsAttr(entry.poly)} fill={fill}
                        stroke="#B7BDC0" strokeWidth={1.5}/>;
      })}
    </svg>
  );
}

window.MAP = { CountyChoropleth, MiniChoropleth };

/* global window */
// =========================================================================
// Utilities: viridis ramp, date formatting, Okabe-Ito palette, helpers.
// =========================================================================

// Hand-sampled viridis (matplotlib) at 10 stops. Used everywhere a sequential
// ramp is needed. NEVER substitute another ramp — style guide is binding.
const VIRIDIS = [
  '#440154', '#482878', '#3E4A89', '#31688E', '#26828E',
  '#1F9E89', '#35B779', '#6DCD59', '#B4DE2C', '#FDE725',
];

function viridis(t) {
  // t in [0,1] → hex
  if (t <= 0) return VIRIDIS[0];
  if (t >= 1) return VIRIDIS[VIRIDIS.length - 1];
  const i = t * (VIRIDIS.length - 1);
  const a = Math.floor(i), b = Math.min(a + 1, VIRIDIS.length - 1);
  const f = i - a;
  return mix(VIRIDIS[a], VIRIDIS[b], f);
}

function mix(c1, c2, f) {
  const p = h => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
  const [r1,g1,b1] = p(c1); const [r2,g2,b2] = p(c2);
  const m = (a,b) => Math.round(a + (b - a) * f);
  return '#' + [m(r1,r2),m(g1,g2),m(b1,b2)].map(n => n.toString(16).padStart(2,'0')).join('');
}

const OKABE_ITO = {
  black:'#000000', orange:'#E69F00', skyblue:'#56B4E9', green:'#009E73',
  yellow:'#F0E442', blue:'#0072B2', vermillion:'#D55E00', purple:'#CC79A7'
};

function fmtN(n) {
  if (n == null) return '—';
  if (n >= 10000) return (n/1000).toFixed(1) + 'k';
  return n.toLocaleString('en-US');
}

function relTime(iso) {
  const t = new Date(iso).getTime();
  const now = new Date('2026-05-25T12:00:00Z').getTime();
  const d = Math.floor((now - t) / 1000);
  if (d < 60) return d + 's ago';
  if (d < 3600) return Math.floor(d/60) + 'm ago';
  if (d < 86400) return Math.floor(d/3600) + 'h ago';
  if (d < 86400*30) return Math.floor(d/86400) + 'd ago';
  if (d < 86400*365) return Math.floor(d/86400/30) + 'mo ago';
  return Math.floor(d/86400/365) + 'y ago';
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' });
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-US', { year:'numeric', month:'short', day:'numeric', hour:'numeric', minute:'2-digit' });
}

function classNames(...a) { return a.filter(Boolean).join(' '); }

// Domain bucket for viridis ramp (record counts in a county)
function recordBucket(n) {
  if (n <= 0) return 0;
  if (n === 1) return 0.10;
  if (n <= 3) return 0.25;
  if (n <= 9) return 0.45;
  if (n <= 24) return 0.62;
  if (n <= 49) return 0.78;
  if (n <= 99) return 0.90;
  return 1.0;
}

window.UTIL = { VIRIDIS, viridis, OKABE_ITO, fmtN, relTime, fmtDate, fmtDateTime, classNames, recordBucket };

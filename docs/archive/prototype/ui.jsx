/* global window, React */
// =========================================================================
// UI primitives: Button, Card, Badge, Toggle, Sheet, Modal, Toaster,
// SourceChip, Avatar, DataTable shell, FilterChip, KbdHint.
// All match the InsectID style guide.
// =========================================================================

const { useState, useEffect, useRef, useMemo, useCallback, createContext, useContext } = React;
const { classNames } = window.UTIL;

// -------- Button --------------------------------------------------------
function Button({ variant = 'primary', size = 'md', className = '', icon, children, ...rest }) {
  const sizes = {
    sm: 'h-8 px-3 text-[13px]',
    md: 'h-9 px-3.5 text-sm',
    lg: 'h-10 px-4 text-sm',
  };
  const variants = {
    primary:   'bg-blue-600 text-white hover:bg-blue-700 border border-blue-600',
    secondary: 'bg-white text-text-600 hover:bg-surface-1 border border-surface-3',
    ghost:     'bg-transparent text-text-600 hover:bg-surface-2 border border-transparent',
    danger:    'bg-white text-danger-600 hover:bg-danger-50 border border-surface-3',
    link:      'bg-transparent text-blue-600 hover:underline border border-transparent px-0',
  };
  return (
    <button {...rest}
      className={classNames(
        'inline-flex items-center gap-1.5 rounded-md font-medium transition-colors whitespace-nowrap',
        sizes[size], variants[variant], className
      )}>
      {icon ? <span className="-ml-0.5">{icon}</span> : null}
      {children}
    </button>
  );
}

// -------- Card ----------------------------------------------------------
function Card({ accent = false, className = '', children, ...rest }) {
  return (
    <div {...rest}
      className={classNames(
        'bg-white border border-surface-3 rounded-lg shadow-card relative overflow-hidden',
        accent && 'before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:bg-blue-600',
        className
      )}>
      {children}
    </div>
  );
}

// -------- Badge ---------------------------------------------------------
function Badge({ tone = 'neutral', size = 'sm', children, className = '', icon }) {
  const tones = {
    neutral:  'bg-surface-2 text-text-500 border-surface-3',
    blue:     'bg-blue-50 text-blue-800 border-blue-100',
    cyan:     'bg-[#E6F6FB] text-cyan-600 border-[#CFEBF3]',
    success:  'bg-success-50 text-success-700 border-[#CEEDD7]',
    warning:  'bg-warning-50 text-warning-700 border-[#FCE2B0]',
    danger:   'bg-danger-50 text-danger-700 border-[#F5C2BD]',
    outline:  'bg-white text-text-500 border-surface-3',
    dark:     'bg-text-700 text-white border-text-700',
  };
  const sizes = { xs: 'text-[10px] px-1.5 py-px', sm:'text-[11px] px-2 py-0.5', md:'text-xs px-2.5 py-1' };
  return (
    <span className={classNames(
      'inline-flex items-center gap-1 rounded-full border font-medium whitespace-nowrap',
      tones[tone], sizes[size], className
    )}>
      {icon ? <span className="-ml-0.5">{icon}</span> : null}
      {children}
    </span>
  );
}

// Inclusion state badge
function InclusionBadge({ state }) {
  if (state === 'include')   return <Badge tone="success" icon={<window.Icons.Check size={11} stroke={2.4}/>}>Included</Badge>;
  if (state === 'exclude')   return <Badge tone="neutral" icon={<window.Icons.X size={11} stroke={2.4}/>}>Excluded</Badge>;
  return <Badge tone="warning">Undecided</Badge>;
}

// Source attribution chip
function SourceChip({ source, size = 'sm' }) {
  const map = {
    gbif: { label: 'GBIF',  tone:'blue',    title:'Global Biodiversity Information Facility' },
    inat: { label: 'iNat',  tone:'success', title:'iNaturalist' },
    manual:{label: 'Manual',tone:'neutral', title:'Manually added' },
    cite: { label: 'Cite',  tone:'cyan',    title:'Cite-only record' },
    merged:{label:'Merged', tone:'outline', title:'Merged taxon (resolved conflict)' },
  };
  const m = map[source] || map.manual;
  return (
    <Badge tone={m.tone} size={size} className="font-mono tracking-tight" >
      <span title={m.title}>{m.label}</span>
    </Badge>
  );
}

// -------- Avatar --------------------------------------------------------
const AVATAR_COLORS = {
  MP: '#0A3F95', JL: '#0E7693', AR: '#D55E00', DC: '#009E73', RO: '#CC79A7'
};
function Avatar({ initials, size = 24, ring = false, title }) {
  const bg = AVATAR_COLORS[initials] || '#5f6360';
  return (
    <span title={title}
      style={{ width:size, height:size, background:bg, fontSize: size * 0.42 }}
      className={classNames(
        'inline-flex items-center justify-center rounded-full text-white font-bold no-select',
        ring && 'ring-2 ring-white'
      )}>
      {initials}
    </span>
  );
}
function AvatarStack({ list, max = 4, size = 22 }) {
  const shown = list.slice(0, max);
  const more = list.length - shown.length;
  return (
    <div className="flex items-center" style={{ paddingLeft: 6 }}>
      {shown.map((m, i) => (
        <span key={i} style={{ marginLeft: -6 }} className="rounded-full ring-2 ring-white inline-block">
          <Avatar initials={m.initials || m} size={size} title={m.name} />
        </span>
      ))}
      {more > 0 && (
        <span style={{ marginLeft: -6, width:size, height:size, fontSize: size*0.4 }}
              className="rounded-full ring-2 ring-white bg-surface-2 text-text-500 font-bold inline-flex items-center justify-center">
          +{more}
        </span>
      )}
    </div>
  );
}

// -------- Eyebrow -------------------------------------------------------
function Eyebrow({ children, className = '' }) {
  return <div className={classNames('eyebrow', className)}>{children}</div>;
}

// -------- Section heading with blue rule --------------------------------
function H2({ children, className = '' }) {
  return <h2 className={classNames('text-[20px] font-bold text-blue-800 rule mb-3', className)}>{children}</h2>;
}
function H3({ children, className = '' }) {
  return <h3 className={classNames('text-[16px] font-bold text-blue-800 rule-sm mb-2', className)}>{children}</h3>;
}

// -------- Filter chip ---------------------------------------------------
function FilterChip({ active, count, onClick, children }) {
  return (
    <button onClick={onClick}
      className={classNames(
        'h-7 px-2.5 rounded-full border text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap',
        active
          ? 'bg-blue-600 text-white border-blue-600'
          : 'bg-white text-text-600 border-surface-3 hover:bg-blue-50 hover:border-blue-100'
      )}>
      {children}
      {count != null && (
        <span className={classNames(
          'inline-block min-w-[18px] text-[10px] rounded-full px-1 py-px font-mono',
          active ? 'bg-blue-700 text-blue-100' : 'bg-surface-2 text-text-500'
        )}>{count}</span>
      )}
    </button>
  );
}

// -------- Toggle (segmented) --------------------------------------------
function Segmented({ value, onChange, options }) {
  return (
    <div className="inline-flex bg-surface-2 border border-surface-3 rounded-md p-0.5">
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className={classNames(
            'h-7 px-2.5 text-[12px] font-medium rounded',
            value === o.value
              ? 'bg-white shadow-sm text-blue-800'
              : 'text-text-500 hover:text-text-600'
          )}>{o.label}</button>
      ))}
    </div>
  );
}

// -------- Sheet (drawer) ------------------------------------------------
function Sheet({ open, onClose, title, subtitle, children, width = 520, footer }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-text-700/30 fade-in" onClick={onClose}/>
      <div className="absolute right-0 top-0 h-full bg-white border-l border-surface-3 shadow-pop sheet-enter flex flex-col"
           style={{ width }}>
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-surface-3">
          <div>
            <h3 className="text-[16px] font-bold text-blue-800 leading-tight">{title}</h3>
            {subtitle && <p className="text-[12.5px] text-text-500 mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-text-500 hover:text-text-700 -mt-1 -mr-1 p-1" aria-label="Close">
            <window.Icons.X size={18}/>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto nice-scroll px-5 py-4">{children}</div>
        {footer && <div className="border-t border-surface-3 px-5 py-3 flex items-center justify-end gap-2 bg-surface-1">{footer}</div>}
      </div>
    </div>
  );
}

// -------- Modal ---------------------------------------------------------
function Modal({ open, onClose, title, children, footer, width = 520 }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-text-700/40 fade-in" onClick={onClose}/>
      <div className="absolute inset-0 flex items-center justify-center p-6">
        <div className="bg-white border border-surface-3 rounded-lg shadow-pop w-full max-w-full fade-in" style={{ maxWidth: width }}>
          <div className="px-5 pt-5 pb-3">
            <h3 className="text-[18px] font-bold text-blue-800">{title}</h3>
          </div>
          <div className="px-5 pb-4 text-[14px] text-text-600">{children}</div>
          {footer && <div className="border-t border-surface-3 px-5 py-3 flex items-center justify-end gap-2 bg-surface-1 rounded-b-lg">{footer}</div>}
        </div>
      </div>
    </div>
  );
}

// -------- Toast / Toaster ----------------------------------------------
const ToastCtx = createContext(null);
function ToastProvider({ children }) {
  const [list, setList] = useState([]);
  const push = useCallback((t) => {
    const id = Math.random().toString(36).slice(2, 9);
    setList(prev => [...prev, { id, ...t }]);
    setTimeout(() => setList(prev => prev.filter(x => x.id !== id)), t.duration || 4200);
  }, []);
  const dismiss = (id) => setList(prev => prev.filter(x => x.id !== id));
  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 items-end max-w-sm">
        {list.map(t => (
          <div key={t.id} className="bg-white border border-surface-3 rounded-lg shadow-pop px-3.5 py-3 min-w-[280px] flex items-start gap-3 fade-in">
            {t.tone === 'success' && <span className="mt-0.5 h-5 w-5 rounded-full bg-success-50 text-success-700 inline-flex items-center justify-center"><window.Icons.Check size={12} stroke={2.5}/></span>}
            {t.tone === 'info' && <span className="mt-0.5 h-5 w-5 rounded-full bg-blue-50 text-blue-600 inline-flex items-center justify-center"><window.Icons.Sparkles size={12}/></span>}
            {t.tone === 'warning' && <span className="mt-0.5 h-5 w-5 rounded-full bg-warning-50 text-warning-700 inline-flex items-center justify-center"><window.Icons.Flag size={12}/></span>}
            <div className="flex-1">
              <div className="text-[13.5px] font-semibold text-text-700 leading-tight">{t.title}</div>
              {t.message && <div className="text-[12.5px] text-text-500 mt-0.5 leading-snug">{t.message}</div>}
              {t.onUndo && (
                <button onClick={() => { t.onUndo(); dismiss(t.id); }}
                        className="text-[12px] text-blue-600 font-semibold mt-1.5 hover:underline">Undo</button>
              )}
            </div>
            <button onClick={() => dismiss(t.id)} className="text-text-300 hover:text-text-500 -mt-0.5 -mr-1"><window.Icons.X size={14}/></button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
function useToast() { return useContext(ToastCtx); }

// -------- TextField -----------------------------------------------------
function TextField({ label, hint, error, leftIcon, rightSlot, className='', ...rest }) {
  return (
    <label className={classNames('block', className)}>
      {label && <div className="text-[12.5px] font-semibold text-text-600 mb-1.5">{label}</div>}
      <div className={classNames(
        'flex items-center bg-white border rounded-md h-9 px-2.5 gap-2 transition-colors',
        error ? 'border-danger-600' : 'border-surface-3 focus-within:border-blue-600 focus-within:ringed'
      )}>
        {leftIcon && <span className="text-text-300">{leftIcon}</span>}
        <input {...rest} className="flex-1 bg-transparent outline-none text-[13.5px] placeholder:text-text-300"/>
        {rightSlot}
      </div>
      {hint && !error && <div className="text-[12px] text-text-400 mt-1">{hint}</div>}
      {error && <div className="text-[12px] text-danger-600 mt-1">{error}</div>}
    </label>
  );
}

function TextArea({ label, hint, error, className='', ...rest }) {
  return (
    <label className={classNames('block', className)}>
      {label && <div className="text-[12.5px] font-semibold text-text-600 mb-1.5">{label}</div>}
      <textarea {...rest}
        className={classNames(
          'w-full bg-white border rounded-md px-2.5 py-2 outline-none text-[13.5px] placeholder:text-text-300 resize-none',
          error ? 'border-danger-600' : 'border-surface-3 focus:border-blue-600'
        )}/>
      {hint && !error && <div className="text-[12px] text-text-400 mt-1">{hint}</div>}
      {error && <div className="text-[12px] text-danger-600 mt-1">{error}</div>}
    </label>
  );
}

// -------- Checkbox / radio ---------------------------------------------
function Checkbox({ checked, onChange, label, sub, disabled }) {
  return (
    <label className={classNames('flex items-start gap-2.5 cursor-pointer', disabled && 'opacity-50 cursor-not-allowed')}>
      <span onClick={() => !disabled && onChange && onChange(!checked)}
        className={classNames(
        'mt-0.5 inline-flex items-center justify-center h-4 w-4 rounded border transition-colors flex-shrink-0',
         checked ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-surface-3 hover:border-blue-300')}>
         {checked && <window.Icons.Check size={11} stroke={3}/>}
      </span>
      <span>
        <span className="text-[13.5px] text-text-600 block">{label}</span>
        {sub && <span className="text-[12px] text-text-400 block mt-0.5">{sub}</span>}
      </span>
    </label>
  );
}

function Radio({ checked, onChange, label, sub, disabled }) {
  return (
    <label className={classNames('flex items-start gap-2.5 cursor-pointer', disabled && 'opacity-50')}>
      <span onClick={() => !disabled && onChange && onChange(true)}
        className={classNames(
        'mt-0.5 inline-flex items-center justify-center h-4 w-4 rounded-full border-2 transition-colors flex-shrink-0',
         checked ? 'border-blue-600' : 'border-surface-3 hover:border-blue-300')}>
         {checked && <span className="h-2 w-2 bg-blue-600 rounded-full"/>}
      </span>
      <span>
        <span className="text-[13.5px] text-text-600 block">{label}</span>
        {sub && <span className="text-[12px] text-text-400 block mt-0.5">{sub}</span>}
      </span>
    </label>
  );
}

// -------- Strip (sparkline-style county-presence) -----------------------
// Given a record-count-per-county map, render a 26-cell viridis strip
// showing the distribution of counts. Acts like a sparkline summary.
function PresenceStrip({ countyPresence, n = 32 }) {
  const counts = Object.values(countyPresence || {});
  if (counts.length === 0) {
    return <span className="text-[11px] text-text-300">—</span>;
  }
  // Build a sorted descending series and downsample to n cells
  const sorted = counts.slice().sort((a, b) => b - a);
  const max = sorted[0] || 1;
  const cells = [];
  for (let i = 0; i < n; i++) {
    const idx = Math.floor((i / n) * sorted.length);
    const v = sorted[idx] || 0;
    cells.push(v / max);
  }
  return (
    <span className="inline-flex gap-px items-end" title={`${counts.length} counties · max ${max} records`}>
      {cells.map((t, i) => (
        <span key={i} className="strip-cell rounded-[1px]"
              style={{ background: t === 0 ? '#E5E7EB' : window.UTIL.viridis(t), height: 3 + Math.round(t * 11), width: 4 }}/>
      ))}
    </span>
  );
}

// -------- Loader bar ----------------------------------------------------
function ProgressBar({ value, max = 100, height = 6 }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="w-full bg-surface-2 rounded-full overflow-hidden" style={{ height }}>
      <div className="bg-blue-600 h-full rounded-full transition-all duration-300" style={{ width: pct + '%' }}/>
    </div>
  );
}

// -------- Tooltip-ish hover label (lightweight; uses title) -------------
// (using native title attributes elsewhere; full popper not needed for prototype)

// -------- Data table shell ---------------------------------------------
// Lightweight: accepts columns + rows, supports selection + sort + density.
function DataTable({ columns, rows, getRowId, selected, onSelectionChange, density = 'comfortable', onRowClick }) {
  const isSelectable = !!onSelectionChange;
  const allChecked = isSelectable && selected && selected.size === rows.length && rows.length > 0;
  const indeterminate = isSelectable && selected && selected.size > 0 && selected.size < rows.length;
  const padY = density === 'compact' ? 'py-2' : 'py-2.5';

  const toggle = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    onSelectionChange(next);
  };
  const toggleAll = () => {
    if (allChecked) onSelectionChange(new Set());
    else onSelectionChange(new Set(rows.map(getRowId)));
  };

  return (
    <div className="bg-white border border-surface-3 rounded-lg shadow-card overflow-hidden">
      <div className="overflow-x-auto nice-scroll">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-surface-3 bg-surface-1 text-left text-[11.5px] uppercase tracking-[0.08em] text-gray-500">
              {isSelectable && (
                <th className="w-9 pl-4 pr-1">
                  <CheckboxRaw checked={allChecked} indeterminate={indeterminate} onChange={toggleAll} />
                </th>
              )}
              {columns.map(c => (
                <th key={c.key} className={classNames('px-3 py-2.5 font-bold', c.headerClass, c.align==='right' && 'text-right', c.align==='center' && 'text-center')}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const id = getRowId(r);
              const isSelected = selected && selected.has(id);
              return (
                <tr key={id}
                    onClick={onRowClick ? () => onRowClick(r) : undefined}
                    className={classNames(
                      'border-b border-surface-3 last:border-b-0 transition-colors',
                      isSelected ? 'bg-blue-50/50' : 'hover:bg-surface-1',
                      onRowClick && 'cursor-pointer'
                    )}>
                  {isSelectable && (
                    <td className="w-9 pl-4 pr-1" onClick={(e) => e.stopPropagation()}>
                      <CheckboxRaw checked={isSelected} onChange={() => toggle(id)} />
                    </td>
                  )}
                  {columns.map(c => (
                    <td key={c.key} className={classNames('px-3', padY, c.align==='right' && 'text-right', c.align==='center' && 'text-center', c.cellClass)}>
                      {c.render ? c.render(r) : r[c.key]}
                    </td>
                  ))}
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={columns.length + (isSelectable ? 1 : 0)} className="text-center text-text-400 py-10 text-[13px]">No rows.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CheckboxRaw({ checked, indeterminate, onChange }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = !!indeterminate; }, [indeterminate]);
  return (
    <span onClick={onChange}
      className={classNames(
      'inline-flex items-center justify-center h-4 w-4 rounded border cursor-pointer transition-colors',
       checked || indeterminate ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-surface-3 hover:border-blue-300')}>
       {checked && !indeterminate && <window.Icons.Check size={11} stroke={3}/>}
       {indeterminate && <span className="h-0.5 w-2 bg-white"/>}
    </span>
  );
}

// -------- Bulk action bar (appears above table on selection) ------------
function BulkActionBar({ count, onClear, children }) {
  if (!count) return null;
  return (
    <div className="flex items-center gap-2 bg-blue-800 text-white rounded-md px-3 py-2 text-[12.5px] fade-in shadow-card">
      <span className="font-bold tabular-nums">{count}</span>
      <span className="text-blue-100">selected</span>
      <div className="h-4 w-px bg-blue-700 mx-1"/>
      <div className="flex items-center gap-1">{children}</div>
      <div className="flex-1"/>
      <button onClick={onClear} className="text-blue-100 hover:text-white inline-flex items-center gap-1"><window.Icons.X size={12}/> Clear</button>
    </div>
  );
}

// -------- KbdHint -------------------------------------------------------
function KbdHint({ k, label }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-text-500">
      <kbd>{k}</kbd> {label}
    </span>
  );
}

// -------- Tooltip pill (used on map hover) ------------------------------
function HoverPill({ x, y, children }) {
  return (
    <div className="pointer-events-none absolute z-30 bg-text-700 text-white text-[12px] px-2 py-1.5 rounded shadow-pop fade-in whitespace-nowrap"
         style={{ left: x + 12, top: y + 12 }}>{children}</div>
  );
}

// -------- Empty state ---------------------------------------------------
function EmptyState({ icon, title, body, action }) {
  return (
    <div className="text-center py-12 px-4">
      {icon && <div className="mx-auto mb-3 h-10 w-10 rounded-full bg-surface-2 text-text-400 inline-flex items-center justify-center">{icon}</div>}
      <div className="font-bold text-[15px] text-blue-800">{title}</div>
      {body && <div className="text-[13px] text-text-500 mt-1 max-w-md mx-auto">{body}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

window.UI = {
  Button, Card, Badge, InclusionBadge, SourceChip, Avatar, AvatarStack, Eyebrow, H2, H3,
  FilterChip, Segmented, Sheet, Modal, ToastProvider, useToast,
  TextField, TextArea, Checkbox, Radio, PresenceStrip, ProgressBar,
  DataTable, CheckboxRaw, BulkActionBar, KbdHint, HoverPill, EmptyState,
};

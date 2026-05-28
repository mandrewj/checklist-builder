/* global window, React */
// =========================================================================
// Icons — minimal stroke icons. Hand-drawn SVG kept simple (squares,
// circles, short lines only). Stroke 1.5px, currentColor.
// =========================================================================
const { createElement: h } = React;

function Icon({ d, size = 16, stroke = 1.5, fill = 'none', className = '' }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill={fill} stroke="currentColor"
         strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {d}
    </svg>
  );
}

const Icons = {
  Plus:        (p) => <Icon {...p} d={<><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>} />,
  Check:       (p) => <Icon {...p} d={<polyline points="4 12 10 18 20 6"/>} />,
  X:           (p) => <Icon {...p} d={<><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></>} />,
  Search:      (p) => <Icon {...p} d={<><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/></>} />,
  ChevronDown: (p) => <Icon {...p} d={<polyline points="6 9 12 15 18 9"/>} />,
  ChevronRight:(p) => <Icon {...p} d={<polyline points="9 6 15 12 9 18"/>} />,
  ChevronLeft: (p) => <Icon {...p} d={<polyline points="15 6 9 12 15 18"/>} />,
  ArrowRight:  (p) => <Icon {...p} d={<><line x1="4" y1="12" x2="20" y2="12"/><polyline points="14 6 20 12 14 18"/></>} />,
  External:    (p) => <Icon {...p} d={<><path d="M14 4h6v6"/><line x1="20" y1="4" x2="11" y2="13"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></>} />,
  Flag:        (p) => <Icon {...p} d={<><path d="M5 21V4"/><path d="M5 4h12l-2 4 2 4H5"/></>} />,
  Bug:         (p) => <Icon {...p} d={<><ellipse cx="12" cy="13" rx="5" ry="6"/><line x1="12" y1="7" x2="12" y2="19"/><line x1="7" y1="13" x2="3" y2="13"/><line x1="17" y1="13" x2="21" y2="13"/><line x1="7" y1="9"  x2="4" y2="6"/><line x1="17" y1="9" x2="20" y2="6"/><line x1="7" y1="17" x2="4" y2="20"/><line x1="17" y1="17" x2="20" y2="20"/></>} />,
  Lock:        (p) => <Icon {...p} d={<><rect x="5" y="11" width="14" height="9" rx="1.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></>} />,
  Unlock:      (p) => <Icon {...p} d={<><rect x="5" y="11" width="14" height="9" rx="1.5"/><path d="M8 11V8a4 4 0 0 1 7-2.5"/></>} />,
  Download:    (p) => <Icon {...p} d={<><path d="M12 4v12"/><polyline points="6 11 12 17 18 11"/><line x1="5" y1="20" x2="19" y2="20"/></>} />,
  Filter:      (p) => <Icon {...p} d={<polygon points="4 5 20 5 14 12 14 19 10 17 10 12"/>} />,
  Columns:     (p) => <Icon {...p} d={<><rect x="4" y="4" width="16" height="16" rx="1.5"/><line x1="10" y1="4" x2="10" y2="20"/><line x1="16" y1="4" x2="16" y2="20"/></>} />,
  Sort:        (p) => <Icon {...p} d={<><path d="M7 4v16"/><polyline points="4 17 7 20 10 17"/><path d="M17 20V4"/><polyline points="14 7 17 4 20 7"/></>} />,
  Map:         (p) => <Icon {...p} d={<><polygon points="3 7 9 4 15 7 21 4 21 17 15 20 9 17 3 20"/><line x1="9" y1="4" x2="9" y2="17"/><line x1="15" y1="7" x2="15" y2="20"/></>} />,
  List:        (p) => <Icon {...p} d={<><line x1="8" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="20" y2="12"/><line x1="8" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="0.7" fill="currentColor"/><circle cx="4" cy="12" r="0.7" fill="currentColor"/><circle cx="4" cy="18" r="0.7" fill="currentColor"/></>} />,
  Home:        (p) => <Icon {...p} d={<><path d="M4 11l8-7 8 7"/><path d="M6 10v9h12v-9"/></>} />,
  Users:       (p) => <Icon {...p} d={<><circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M15 20c0-2.4 1.5-4.5 4-5.5"/></>} />,
  Activity:    (p) => <Icon {...p} d={<polyline points="3 12 7 12 10 4 14 20 17 12 21 12"/>} />,
  Settings:    (p) => <Icon {...p} d={<><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.8a7 7 0 0 0-2.1-1.2L14 3h-4l-.5 2.5a7 7 0 0 0-2.1 1.2L5 5.9 3 9.3l2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-.8a7 7 0 0 0 2.1 1.2L10 21h4l.5-2.5a7 7 0 0 0 2.1-1.2l2.3.8 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z"/></>} />,
  Conflict:    (p) => <Icon {...p} d={<><path d="M12 3v3"/><path d="M12 11v6"/><circle cx="12" cy="20" r="1.2" fill="currentColor"/><polygon points="2 21 12 3 22 21"/></>} />,
  Pencil:      (p) => <Icon {...p} d={<><path d="M4 20h4l10-10-4-4L4 16z"/><line x1="14" y1="6" x2="18" y2="10"/></>} />,
  Quote:       (p) => <Icon {...p} d={<><path d="M7 7h4v4H8c0 2 .8 3 2 3v2c-2.5 0-4-1.7-4-4z"/><path d="M14 7h4v4h-3c0 2 .8 3 2 3v2c-2.5 0-4-1.7-4-4z"/></>} />,
  Layers:      (p) => <Icon {...p} d={<><polygon points="12 3 21 8 12 13 3 8"/><polyline points="3 13 12 18 21 13"/></>} />,
  Comment:     (p) => <Icon {...p} d={<path d="M4 5h16v11H9l-5 4z"/>} />,
  Question:    (p) => <Icon {...p} d={<><circle cx="12" cy="12" r="9"/><path d="M10 9a2 2 0 1 1 3 2c-.7.4-1 1-1 2"/><circle cx="12" cy="17" r="0.7" fill="currentColor"/></>} />,
  ArrowUpDown: (p) => <Icon {...p} d={<><polyline points="7 8 11 4 15 8"/><line x1="11" y1="4" x2="11" y2="20"/><polyline points="9 16 13 20 17 16"/><line x1="13" y1="20" x2="13" y2="4"/></>} />,
  Camera:      (p) => <Icon {...p} d={<><rect x="3" y="7" width="18" height="13" rx="1.5"/><circle cx="12" cy="13.5" r="3.5"/><path d="M9 7l1.5-2h3L15 7"/></>} />,
  Sparkles:    (p) => <Icon {...p} d={<><path d="M12 4l1.5 4 4 1.5-4 1.5L12 15l-1.5-4-4-1.5 4-1.5z"/><path d="M19 14l.7 1.8L21.5 16.5l-1.8.7L19 19l-.7-1.8L16.5 16.5l1.8-.7z"/></>} />,
  Snapshot:    (p) => <Icon {...p} d={<><rect x="3" y="6" width="18" height="13" rx="1.5"/><circle cx="12" cy="12.5" r="3"/><line x1="7" y1="3" x2="17" y2="3"/></>} />,
  Doc:         (p) => <Icon {...p} d={<><path d="M14 3H6v18h12V7z"/><polyline points="14 3 14 7 18 7"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></>} />,
  Table:       (p) => <Icon {...p} d={<><rect x="3" y="5" width="18" height="14" rx="1.5"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="11" y1="5" x2="11" y2="19"/></>} />,
  Logo:        (p) => <Icon {...p} d={<><circle cx="12" cy="12" r="9" fill="#116dff" stroke="#116dff"/><circle cx="12" cy="12" r="5" fill="white" stroke="white"/><circle cx="12" cy="12" r="2.2" fill="#0A3F95" stroke="#0A3F95"/></>} />,
};

window.Icons = Icons;

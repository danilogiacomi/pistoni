// Piccoli helper DOM.
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function fmtTime(sec) {
  sec = Math.max(0, Math.round(sec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function fmtMinutes(sec) {
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}

export function segmented(options, value, onChange, cls = '') {
  const wrap = h('div', { class: 'seg ' + cls, role: 'radiogroup' });
  const render = (val) => {
    wrap.innerHTML = '';
    options.forEach(([v, label]) => {
      wrap.append(h('button', {
        class: 'seg-btn' + (String(v) === String(val) ? ' active' : ''),
        role: 'radio',
        'aria-checked': String(String(v) === String(val)),
        onclick: () => { render(v); onChange(v); },
      }, label));
    });
  };
  render(value);
  return wrap;
}

export function select(options, value, onChange, attrs = {}) {
  const el = h('select', { class: 'select', ...attrs, onchange: (e) => onChange(e.target.value) },
    options.map(([v, label]) => h('option', { value: v, selected: String(v) === String(value) }, label)));
  return el;
}

/** Disegno dei 3 pistoni */
export function valvesGraphic(valves, size = 'md') {
  return h('div', { class: `valves valves-${size}`, 'aria-label': valves.length ? `Pistoni ${valves.join(' ')}` : 'Nessun pistone (aperto)' },
    [1, 2, 3].map((n) => h('div', { class: 'valve' + (valves.includes(n) ? ' down' : '') }, h('span', {}, n))));
}

export function toast(msg) {
  const t = h('div', { class: 'toast' }, msg);
  document.body.append(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2200);
}

export const ICONS = {
  home: '<svg viewBox="0 0 24 24"><path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
  notes: '<svg viewBox="0 0 24 24"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg>',
  valves: '<svg viewBox="0 0 24 24"><rect x="3" y="7" width="4" height="13" rx="2"/><rect x="10" y="4" width="4" height="16" rx="2"/><rect x="17" y="7" width="4" height="13" rx="2"/></svg>',
  tuner: '<svg viewBox="0 0 24 24"><path d="M4 18a9 9 0 1 1 16 0"/><path d="M12 18l4-7"/></svg>',
  metro: '<svg viewBox="0 0 24 24"><path d="M9 3h6l4 18H5z"/><path d="M12 16 17 6"/></svg>',
  more: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M7 4.5v15l13-7.5z"/></svg>',
  stop: '<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
  mic: '<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
  speaker: '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/></svg>',
};

export function icon(name, cls = '') {
  const s = h('span', { class: 'icon ' + cls, 'aria-hidden': 'true' });
  s.innerHTML = ICONS[name];
  return s;
}

const API = (function() {
  if (typeof window !== 'undefined' && window.__API_BASE__) return window.__API_BASE__;
  if (typeof window !== 'undefined' && window.location && window.location && window.location.port === '5173') return 'http://localhost:8000';
  return '';
})();
const TK = 'asmr_token';
const TT = 'asmr_theme';
const TA = 'asmr_accent';
const $ = id => document.getElementById(id);
const qs = (s, p) => (p || document).querySelector(s);
const debounce = (fn, ms=400) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

const ICO = {
  heart: '<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M7 12s-4.5-2.8-4.5-6A2.5 2.5 0 0 1 7 3.5a2.5 2.5 0 0 1 4.5 2.5C11.5 9.2 7 12 7 12z"/></svg>',
  heartO: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 12s-4.5-2.8-4.5-6A2.5 2.5 0 0 1 7 3.5a2.5 2.5 0 0 1 4.5 2.5C11.5 9.2 7 12 7 12z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>',
  eye: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 6s2-3.5 5-3.5S11 6 11 6 9 9.5 6 9.5 1 6 1 6z" stroke="currentColor" stroke-width="1.2"/><circle cx="6" cy="6" r="1" fill="currentColor"/></svg>',
  video: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="1" y="2.5" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.2"/><path d="M8 5l3-1.5v5L8 6.5" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>',
  audio: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1.5 4v4M3.5 2.5v7M5.5 3.5v5M7.5 4v4M9.5 4.5v3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
  play: '<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M3 2l9 5-9 5V2z"/></svg>',
  clock: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.4"/><path d="M8 4.5v3.5l2.5 2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  gear: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="2.2" stroke="currentColor" stroke-width="1.4"/><path d="M8 2v1.3M8 12.7V14M2 8h1.3M12.7 8H14M3.5 3.5l.9.9M11.6 11.6l.9.9M3.5 12.5l.9-.9M11.6 4.4l.9-.9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
  save: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 2h7l2 2v8H3V2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M5 2v3h4V2M5 8.5h5V12H5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>',
  moon: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M12 8.5A5 5 0 0 1 5.5 2a5 5 0 1 0 6.5 6.5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>',
  sun: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="3" stroke="currentColor" stroke-width="1.3"/><path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.8 2.8l1 1M10.2 10.2l1 1M2.8 11.2l1-1M10.2 3.8l1-1" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
  folder: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 4a1 1 0 0 1 1-1h2.5l1 1H11a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>',
  hourglass: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 2h8M3 12h8M4.5 2c0 2.5 2.5 3.5 2.5 5s-2.5 2.5-2.5 5M9.5 2c0 2.5-2.5 3.5-2.5 5s2.5 2.5 2.5 5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  film: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="2" width="10" height="10" rx="1" stroke="currentColor" stroke-width="1.3"/><path d="M2 5h10M2 9h10M5 2v10M9 2v10" stroke="currentColor" stroke-width="1.3"/></svg>',
  chat: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H6l-3 2v-2H3a1 1 0 0 1-1-1V4z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>',
  headphones: '<svg width="48" height="48" viewBox="0 0 48 48" fill="none"><path d="M10 28v-4a14 14 0 0 1 28 0v4" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><rect x="6" y="28" width="8" height="12" rx="3" stroke="currentColor" stroke-width="2.5"/><rect x="34" y="28" width="8" height="12" rx="3" stroke="currentColor" stroke-width="2.5"/></svg>',
  trash: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 4h8M5.5 4V2.5h3V4M4 4l.5 8h5L10 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  user: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="4.5" r="2.3" stroke="currentColor" stroke-width="1.3"/><path d="M2.5 12c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
  globe: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.3"/><path d="M1.5 7h11M7 1.5c1.5 2 1.5 9 0 11M7 1.5c-1.5 2-1.5 9 0 11" stroke="currentColor" stroke-width="1.3"/></svg>',
  lock: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="2.5" y="5.5" width="7" height="5" rx="1" stroke="currentColor" stroke-width="1.2"/><path d="M4 5.5V4a2 2 0 0 1 4 0v1.5" stroke="currentColor" stroke-width="1.2"/></svg>',
  refresh: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7a5 5 0 0 1 8.5-3.5L12 5M12 2v3h-3M12 7a5 5 0 0 1-8.5 3.5L2 9M2 12V9h3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  key: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="4.5" cy="4.5" r="2.5" stroke="currentColor" stroke-width="1.3"/><path d="M6.5 6.5L12 12M10 10l1.5-1.5M8.5 8.5L10 10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
  palette: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1.5a5.5 5.5 0 0 0 0 11c.8 0 1-.5 1-1s-.3-.8-.3-1.2c0-.5.4-.8 1-.8h1.3a2.5 2.5 0 0 0 2.5-2.5c0-3-2.5-5.5-5.5-5.5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><circle cx="4.5" cy="5" r=".7" fill="currentColor"/><circle cx="7" cy="3.5" r=".7" fill="currentColor"/><circle cx="9.5" cy="5" r=".7" fill="currentColor"/></svg>',
  tag: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2h4l6 6-4 4-6-6V2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><circle cx="4.5" cy="4.5" r=".8" fill="currentColor"/></svg>',
  upload: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 9V2M7 2L4 5M7 2l3 3M2 9v2.5a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  check: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 7l3 3 5-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  cross: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  doc: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 2h6l2 2v8H3V2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M5 6h4M5 8h4M5 10h3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
  pause: '<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="3" y="2" width="3" height="10" rx="1"/><rect x="8" y="2" width="3" height="10" rx="1"/></svg>',
  back: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 4L6 8l4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  box: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1.5L2 4v6l5 2.5L12 10V4L7 1.5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M2 4l5 2.5L12 4M7 6.5v6" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>',
  plus: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 3v8M3 7h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  pencil: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 12l.5-3L9 2.5l2.5 2.5L5 12H2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M9 2.5L11.5 5" stroke="currentColor" stroke-width="1.3"/></svg>',
  ban: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.3"/><path d="M3.5 3.5l7 7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
  calendar: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="1.5" y="2.5" width="9" height="8" rx="1" stroke="currentColor" stroke-width="1.2"/><path d="M1.5 5h9M4 1.5v2M8 1.5v2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
  sparkles: '<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M7 2l.9 2.8L10.5 6l-2.6.9L7 9.5l-.9-2.6L3.5 6l2.6-1.2L7 2z"/><circle cx="11" cy="3" r=".8"/><circle cx="3" cy="10.5" r=".6"/></svg>',
  books: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 3h2.5v9H2zM4.5 3H7v9H4.5zM8 3.5l2.5.5L9 12.5l-2.5-.5L8 3.5z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>',
  chart: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 12V7M5.5 12V4M9 12V8.5M12 12V6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
  flag: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 2v10M3 3h7l-1.5 2.5L10 8H3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  users: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="5" cy="5" r="1.8" stroke="currentColor" stroke-width="1.2"/><path d="M1.8 12c0-1.8 1.4-3 3.2-3s3.2 1.2 3.2 3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><circle cx="10" cy="5.5" r="1.4" stroke="currentColor" stroke-width="1.2"/><path d="M8.2 11c.3-1.2 1.2-2 2.4-2s2.1.8 2.4 2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
  volume: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 5.5v3h2l2.5 2v-7L4 5.5H2z" fill="currentColor"/><path d="M9 5.5a2.5 2.5 0 0 1 0 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
  mute: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 5.5v3h2l2.5 2v-7L4 5.5H2z" fill="currentColor"/><path d="M9.5 5.5l3 3M12.5 5.5l-3 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
  repeat: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 5.5a3.5 3.5 0 0 1 3.5-3.5h2M8.5 2l2 2-2 2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M11 8.5a3.5 3.5 0 0 1-3.5 3.5h-2M5.5 12l-2-2 2-2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  repeatOne: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 5.5a3.5 3.5 0 0 1 3.5-3.5h2M8.5 2l2 2-2 2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M11 8.5a3.5 3.5 0 0 1-3.5 3.5h-2M5.5 12l-2-2 2-2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><text x="7" y="8.5" font-size="4" fill="currentColor" text-anchor="middle" font-family="sans-serif" font-weight="700">1</text></svg>',
  shuffle: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 4h2l6 6h2M11 8l2 2-2 2M2 10h2l2-2M8 6l2-2h2M11 2l2 2-2 2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  fullscreen: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 5V2h3M12 5V2H9M2 9v3h3M12 9v3H9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  trendUp: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 10l3-3 2 2 5-5M9 4h3v3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  trophy: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M4 2h6v3a3 3 0 0 1-6 0V2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M4 3H2.5v1A2 2 0 0 0 4 6M10 3h1.5v1A2 2 0 0 1 10 6M5.5 8.5h3M5 11h4M7 8.5V11" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  folders: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 4a1 1 0 0 1 1-1h2.5l1 1H11a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M4 2.5h2.5l1 1" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  unlock: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="3" y="6.5" width="8" height="5.5" rx="1" stroke="currentColor" stroke-width="1.3"/><path d="M5 6.5V4.5a2.5 2.5 0 0 1 4.5-1.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
  plug: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 2v3M9 2v3M4 5h6v2a3 3 0 0 1-6 0V5z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 10v2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
  warning: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2L12.5 12H1.5L7 2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M7 6v3M7 10.5v.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
  keyboard: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1.5" y="3.5" width="11" height="7" rx="1" stroke="currentColor" stroke-width="1.3"/><path d="M3.5 6h1M6 6h1M8.5 6h1M3.5 8h7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
  rewind: '<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M7 4L3 7l4 3V4z"/><path d="M12 4L8 7l4 3V4z"/></svg>',
  fastForward: '<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M2 4l4 3-4 3V4z"/><path d="M7 4l4 3-4 3V4z"/></svg>',
  star: '<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M7 1.5l1.6 3.6 3.9.3-3 2.6.9 3.8L7 9.9 3.6 11.8l.9-3.8-3-2.6 3.9-.3z"/></svg>',
  starO: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1.5l1.6 3.6 3.9.3-3 2.6.9 3.8L7 9.9 3.6 11.8l.9-3.8-3-2.6 3.9-.3z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>',
  listPlus: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 4h7M2 7h5M2 10h5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="10.5" cy="9.5" r="2.2" stroke="currentColor" stroke-width="1.3"/><path d="M10.5 8v3M9 9.5h3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
  spinner: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" style="animation:spin 1s linear infinite"><circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.4" opacity=".3"/><path d="M12.5 7a5.5 5.5 0 0 0-5.5-5.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
  file: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 2h6l2 2v8H3V2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M9 2v2h2" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>',
};

// ─── Theme ───
function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function initTheme() {
  const saved = localStorage.getItem(TT);
  const t = saved || getSystemTheme();
  const a = localStorage.getItem(TA) || 'purple';
  document.documentElement.setAttribute('data-theme', t);
  document.documentElement.setAttribute('data-accent', a);
  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', e => {
    if (!localStorage.getItem(TT)) {
      applyTheme(e.matches ? 'light' : 'dark', false);
    }
  });
}

function applyTheme(t, animate = true) {
  if (animate) {
    document.documentElement.classList.add('theme-transitioning');
  }
  document.documentElement.setAttribute('data-theme', t);
  if (animate) {
    // Remove transitioning class after animation completes
    setTimeout(() => {
      document.documentElement.classList.remove('theme-transitioning');
    }, 450);
  }
}

function setTheme(t) {
  localStorage.setItem(TT, t);
  applyTheme(t);
  updateUI();
}

function toggleTheme() {
  const cur = localStorage.getItem(TT) || getSystemTheme();
  // If using system default, clear it so we lock to the toggled value
  const next = cur === 'dark' ? 'light' : 'dark';
  localStorage.setItem(TT, next);
  applyTheme(next);
  updateUI();
}

function setAccent(a) {
  localStorage.setItem(TA, a);
  document.documentElement.setAttribute('data-accent', a);
  updateUI();
}
initTheme();

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const t = e.target;
  if (t && t.getAttribute && t.getAttribute('role') === 'button' && t.tagName !== 'BUTTON') {
    e.preventDefault();
    t.click();
  }
});

function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
function dur(s) { if(!s||s<=0) return ''; const m=Math.floor(s/60),s2=Math.floor(s%60); return `${m}:${String(s2).padStart(2,'0')}`; }
const _nfBytes = typeof Intl !== 'undefined' && Intl.NumberFormat
  ? new Intl.NumberFormat(navigator.language || 'zh-CN', { maximumFractionDigits: 1 })
  : null;
function fs(b) {
  if(!b) return '';
  if(b<1024) return `${b} B`;
  if(b<1048576) return `${_nfBytes?_nfBytes.format(b/1024):(b/1024).toFixed(0)} KB`;
  return `${_nfBytes?_nfBytes.format(b/1048576):(b/1048576).toFixed(1)} MB`;
}
const _rtf = typeof Intl !== 'undefined' && Intl.RelativeTimeFormat
  ? new Intl.RelativeTimeFormat(navigator.language || 'zh-CN', { numeric: 'auto' })
  : null;
function dt(d) {
  if(!d) return '';
  const t=new Date(d),n=new Date(),diff=n-t;
  if(diff<6e4) return _rtf?_rtf.format(0,'second'):'刚刚';
  if(diff<36e5) return _rtf?_rtf.format(-Math.floor(diff/6e4),'minute'):`${Math.floor(diff/6e4)}分钟前`;
  if(diff<864e5) return _rtf?_rtf.format(-Math.floor(diff/36e5),'hour'):`${Math.floor(diff/36e5)}小时前`;
  if(diff<6048e5 && _rtf) return _rtf.format(-Math.floor(diff/864e5),'day');
  return `${t.getFullYear()}/${t.getMonth()+1}/${t.getDate()}`;
}
function fdp(s) { if(!s||s<=0) return '0 分钟'; const h=Math.floor(s/3600),m=Math.floor((s%3600)/60); if(h>0) return `${h} 小时 ${m} 分钟`; return `${m} 分钟`; }
function formatViews(n) { if(n>=10000) return (n/10000).toFixed(1)+'w'; if(n>=1000) return (n/1000).toFixed(1)+'k'; return n||0; }

let state = { view:'home', postId:null, cat:null, sort:'latest', search:'', page:1, user:null, params:{}, currentSessionId:null };
let _deferredPrompt = null;

function toast(msg, t='info') {
  // Remove existing toasts to prevent stacking overlap
  const existing = document.querySelectorAll('.toast');
  existing.forEach((el, i) => { if(i >= 2) el.classList.add('toast-out'); });
  const el = document.createElement('div'); el.className = `toast ${t}`;
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.innerHTML = `${msg}<button class="toast-close" aria-label="关闭">${ICO.cross}</button>`;
  document.body.appendChild(el);
  const close = () => { el.classList.add('toast-out'); setTimeout(() => el.remove(), 300); };
  el.querySelector('.toast-close').onclick = close;
  const timer = setTimeout(close, 3500);
  el.onmouseenter = () => clearTimeout(timer);
}

function getToken() { return localStorage.getItem(TK); }

async function api(path, opts={}) {
  const h = { ...opts.headers }; const token = getToken();
  if (token) h['Authorization'] = `Bearer ${token}`;
  if (!(opts.body instanceof FormData)) h['Content-Type'] = 'application/json';
  try {
    const r = await fetch(`${API}${path}`, { ...opts, headers: h });
    if (r.status === 401 && !['/api/login','/api/register','/api/me'].includes(path)) {
      localStorage.removeItem(TK); state.user = null; updateUI();
      toast(`${ICO.ban} 登录已过期，请重新登录`, 'error');
      if (state.view !== 'home') navigate('home'); showLogin(); return null;
    }
    if (r.status === 403) { toast('没有权限执行此操作', 'error'); return null; }
    if (r.status === 404) { return null; }
    if (r.status >= 500) { toast('服务器异常，请稍后重试', 'error'); return null; }
    const ct = r.headers.get('content-type') || '';
    if (!ct.includes('application/json')) { toast('响应格式异常', 'error'); return null; }
    return await r.json();
  } catch { toast('网络错误，请检查连接', 'error'); return null; }
}

// ─── Auth ───
function checkAuth() {
  const t = getToken();
  if (t) {
    api('/api/me').then(u => {
      if (u) { state.user = u; }
      else { localStorage.removeItem(TK); state.user = null; }
      updateUI();
    });
  } else {
    updateUI();
  }
}

function showLogin() {
  if (qs('.auth-modal')) return;
  const o = document.createElement('div'); o.className = 'auth-modal';
  let mode = 'login';
  const brand = '<svg width="26" height="26" viewBox="0 0 26 26" fill="none"><path d="M4 13a9 9 0 0 1 18 0M4 13a9 9 0 0 0-1 4.5A2.5 2.5 0 0 0 5.5 22a2 2 0 0 0 2-2v-5a2 2 0 0 0-2-2H4M22 13a9 9 0 0 1 1 4.5A2.5 2.5 0 0 1 20.5 22a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h1.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 16v-2M16 16v-2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  const render = () => {
    o.innerHTML = `<div class="auth-box">
      <div class="auth-brand">${brand}</div>
      <h2>${mode==='login'?'欢迎回来':'创建账号'}</h2>
      <p class="sub">${mode==='login'?'登录即可播放视频':'注册一个账号开始探索'}</p>
      <div class="auth-field">
        <span class="auth-ico">${ICO.user}</span>
        <input id="au" placeholder="用户名" autocomplete="username">
      </div>
      <div class="auth-field">
        <span class="auth-ico">${ICO.lock}</span>
        <input id="ap" type="password" placeholder="${mode==='login'?'密码':'至少8位，含字母和数字'}" autocomplete="${mode==='login'?'current-password':'new-password'}" onkeydown="if(event.key==='Enter') document.querySelector('.auth-submit').click()">
      </div>
      <button class="btn btn-primary auth-submit" onclick="submitAuth('${mode}')">${mode==='login'?'登录':'注册'}</button>
      <div class="auth-toggle">${mode==='login'?'还没有账号？':'已有账号？'} <a onclick="mode=mode==='login'?'register':'login';render()">${mode==='login'?'立即注册':'去登录'}</a></div>
      <div class="auth-hint">Murmur · 私人 ASMR 音视频空间</div>
    </div>`;
  };
  render(); document.body.appendChild(o);
  o.addEventListener('click', e => { if (e.target === o) o.remove(); });
  setTimeout(() => $('au')?.focus(), 200);
}

async function submitAuth(mode) {
  const u = $('au')?.value.trim(), p = $('ap')?.value;
  if (!u||!p) { toast('请填写完整', 'error'); return; }
  if (mode==='register' && p.length<8) { toast('密码至少8位，需含字母和数字', 'error'); return; }
  if (mode==='register' && (!/[a-zA-Z]/.test(p) || !/\d/.test(p))) { toast('密码必须包含字母和数字', 'error'); return; }
  const r = await api(`/api/${mode}`, { method:'POST', body: JSON.stringify({username:u,password:p}) });
  if (r?.token) {
    localStorage.setItem(TK, r.token); state.user = r.user; updateUI();
    qs('.auth-modal')?.remove();
    toast(`${mode==='login'?'登录成功':'注册成功'}`, 'success');
    if (state.view === 'post') renderPost();
  } else toast(r?.detail || '操作失败', 'error');
}

function resetTheme() {
  localStorage.removeItem(TT);
  applyTheme(getSystemTheme());
  updateUI();
  toast('已跟随系统主题', 'info');
}

function logout() {
  localStorage.removeItem(TK); state.user = null; updateUI();
  navigate('home'); toast('已退出', 'info');
}

function updateUI() {
  const nav = qs('header nav'); if (!nav) return;
  const saved = localStorage.getItem(TT);
  const effective = saved || getSystemTheme();
  const isStaff = state.user && (state.user.role === 'admin' || state.user.role === 'creator');
  const themeIcon = effective==='dark'
    ? `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="3" stroke="currentColor" stroke-width="1.4"/><path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3 3l1 1M12 12l1 1M3 13l1-1M12 4l1-1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`
    : `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M13 9.5A5 5 0 0 1 6.5 3a5 5 0 1 0 6.5 6.5z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
  const installBtn = `<button class="btn btn-ghost install-btn${_deferredPrompt?' visible':''}" id="install-btn" onclick="promptInstall()" title="安装应用"><svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M7.5 2v7M7.5 9L4.5 6M7.5 9l3-3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M2.5 10v2a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg><span>安装</span></button>`;
  if (state.user) {
    nav.innerHTML = `<span style="color:var(--text2);font-size:.85rem;font-weight:500">${esc(state.user.username)}</span>
      <button class="btn btn-ghost" onclick="navigate('history')" title="历史"><svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" stroke-width="1.4"/><path d="M7.5 4v3.5l2 2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg><span>历史</span></button>
      <button class="btn btn-ghost" onclick="navigate('favorites')" title="收藏"><svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M7.5 12.5S2.5 9 2.5 5.5A2.5 2.5 0 0 1 7.5 4a2.5 2.5 0 0 1 5 1.5C12.5 9 7.5 12.5 7.5 12.5z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg><span>收藏</span></button>
      ${isStaff ? `<button class="btn btn-ghost" onclick="navigate('upload')" title="上传"><svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M7.5 10V3M7.5 3L4.5 6M7.5 3l3 3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M2.5 9v2.5a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg><span>上传</span></button>` : ''}
      ${isStaff ? `<button class="btn btn-ghost" onclick="navigate('admin')" title="管理"><svg width="15" height="15" viewBox="0 0 15 15" fill="none"><rect x="2" y="2" width="11" height="11" rx="1.5" stroke="currentColor" stroke-width="1.4"/><path d="M5 5.5h5M5 8h3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg><span>管理</span></button>` : ''}
      ${installBtn}
      <button class="btn btn-icon btn-ghost" onclick="toggleTheme()" title="${effective==='dark'?'切换到白天':'切换到黑夜'}" aria-label="${effective==='dark'?'切换到白天':'切换到黑夜'}">${themeIcon}</button>
      <button class="btn btn-icon btn-ghost" onclick="navigate('settings')" title="设置" aria-label="设置"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="2.2" stroke="currentColor" stroke-width="1.4"/><path d="M8 2v1.2M8 12.8V14M2 8h1.2M12.8 8H14M3.5 3.5l.9.9M11.6 11.6l.9.9M3.5 12.5l.9-.9M11.6 4.4l.9-.9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg></button>
      <button class="btn btn-ghost" onclick="logout()" style="color:var(--text3)" title="退出"><svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M6 2.5H3.5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1H6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M9 4.5l3 3-3 3M12 7.5H6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`;
  } else {
    nav.innerHTML = `${installBtn}
      <button class="btn btn-icon btn-ghost" onclick="toggleTheme()" title="${effective==='dark'?'切换到白天':'切换到黑夜'}" aria-label="${effective==='dark'?'切换到白天':'切换到黑夜'}">${themeIcon}</button>
      <button class="btn btn-primary" onclick="showLogin()" style="padding:6px 14px;font-size:.8rem">登录</button>`;
  }
  // Show/hide sidebar upload based on role
  const sbUpload = qs('.sb-nav-upload');
  if (sbUpload) sbUpload.style.display = isStaff ? '' : 'none';
  // Update sidebar footer
  const sbFoot = $('sidebar-foot');
  if (sbFoot) {
    if (state.user) {
      const roleText = state.user.role === 'admin' ? '管理员' : state.user.role === 'creator' ? '创作者' : '用户';
      const initial = (state.user.username || '?').charAt(0).toUpperCase();
      sbFoot.innerHTML = `<div class="sb-user">
        <div class="sb-user-avatar">${esc(initial)}</div>
        <div class="sb-user-info">
          <div class="sb-user-name">${esc(state.user.username)}</div>
          <div class="sb-user-role">${roleText}</div>
        </div>
        <button class="sb-user-logout" onclick="logout()" title="退出" aria-label="退出"><svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M6 2.5H3.5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1H6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M9 4.5l3 3-3 3M12 7.5H6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      </div>`;
    } else {
      sbFoot.innerHTML = `<button class="sb-login-btn" onclick="showLogin()">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 2.5H3.5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1H6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M9 4.5l3 3-3 3M12 7.5H6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span>登录 / 注册</span>
      </button>`;
    }
  }
}


// ─── Navigation ───
function navigate(view, data) {
  closeSidebar();
  state.view = view||'home';
  state.params = {};
  if (typeof data === 'object' && data !== null) {
    state.params = { ...data };
    if (data.postId !== undefined) state.postId = data.postId;
  } else if (data !== undefined) {
    state.postId = data;
  }
  const c = $('content'); if (!c) return;
  c.innerHTML = '<div class="loading"><div class="spinner"><span></span><span></span><span></span><span></span><span></span></div></div>';
  if (view==='upload') renderUpload();
  else if (view==='edit') renderEdit();
  else if (view==='post') renderPost();
  else if (view==='settings') renderSettings();
  else if (view==='admin') renderAdmin();
  else if (view==='admin-dashboard') renderAdminDashboard();
  else if (view==='admin-users') renderAdminUsers();
  else if (view==='admin-settings') renderAdminSettings();
  else if (view==='admin-reports') renderAdminReports();
  else if (view==='admin-transcode') renderAdminTranscode();
  else if (view==='favorites') renderFavorites();
  else if (view==='history') renderHistory();
  else if (view==='tag-posts') renderTagPosts();
  else if (view==='playlists') renderPlaylists();
  else if (view==='playlist-detail') renderPlaylistDetail();
  else renderHome();
  window.scrollTo({top:0,behavior:'smooth'});
  updateBottomNav(view||'home');
}

function updateBottomNav(view) {
  document.querySelectorAll('.bn-item').forEach(item => {
    const nav = item.dataset.nav;
    let active = false;
    if (nav === 'home' && (view === 'home' || view === 'tag-posts')) active = true;
    else if (nav === 'search' && view === 'home' && state.search) active = true;
    else if (nav === 'upload' && (view === 'upload' || view === 'edit')) active = true;
    else if (nav === 'favorites' && (view === 'favorites' || view === 'playlists' || view === 'playlist-detail')) active = true;
    else if (nav === 'profile' && (view === 'settings' || view?.startsWith('admin'))) active = true;
    item.classList.toggle('active', active);
  });
  // Sync sidebar nav
  document.querySelectorAll('.sb-nav-item').forEach(item => {
    const nav = item.dataset.nav;
    let active = false;
    if (nav === 'home' && (view === 'home' || view === 'tag-posts' || view === 'post')) active = true;
    else if (nav === 'history' && view === 'history') active = true;
    else if (nav === 'favorites' && (view === 'favorites' || view === 'playlists' || view === 'playlist-detail')) active = true;
    else if (nav === 'upload' && (view === 'upload' || view === 'edit')) active = true;
    else if (nav === 'settings' && (view === 'settings' || view?.startsWith('admin'))) active = true;
    item.classList.toggle('active', active);
  });
}

// ─── Sidebar ───
async function loadCats() {
  const cats = await api('/api/categories')||[];
  const list = $('cat-list'); if(!list) return;
  let html = `<button class="cat-item ${!state.cat?'active':''}" data-cat=""><span class="cat-emoji">${ICO.globe}</span><span class="cat-name">全部</span><span class="count">${cats.reduce((a,c)=>a+c.post_count,0)}</span></button>`;
  for(const c of cats)
    html += `<button class="cat-item ${state.cat===c.id?'active':''}" data-cat="${c.id}"><span class="cat-emoji">${c.icon}</span><span class="cat-name">${esc(c.name)}</span><span class="count">${c.post_count}</span></button>`;
  list.innerHTML = html;
  list.querySelectorAll('.cat-item').forEach(b => b.addEventListener('click',()=>{
    state.cat = b.dataset.cat ? parseInt(b.dataset.cat) : null; state.page = 1;
    list.querySelectorAll('.cat-item').forEach(x => x.classList.toggle('active', x===b));
    navigate('home');
    closeSidebar();
  }));

  const sidebar = $('sidebar');
  if (sidebar && state.user) {
    let plSection = sidebar.querySelector('.playlist-section');
    if (!plSection) {
      plSection = document.createElement('div');
      plSection.className = 'sidebar-section playlist-section';
      sidebar.appendChild(plSection);
    }
    plSection.innerHTML = `<h3>我的歌单</h3>
      <div class="cat-list">
        <button class="cat-item" onclick="navigate('playlists')"><span class="cat-emoji"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M2 5h12M5 2v12" stroke="currentColor" stroke-width="1.3"/></svg></span><span class="cat-name">全部歌单</span></button>
      </div>`;
  }
}

// ─── Home ───
const __searchDebounce = debounce(v => {
  const val = v.trim();
  if (val === (state.search || '') ) return;
  state.search = val; state.page = 1; navigate('home');
}, 500);

async function renderHome() {
  const c = $('content'); let catName = '全部';
  const cats = await api('/api/categories')||[];
  if (state.cat) {
    const f = cats.find(x=>x.id===state.cat);
    if(f) catName = f.name;
  }
  const isFiltered = state.cat || state.search;

  // Quick access items (only when logged in)
  const quickAccess = state.user ? `
    <div class="quick-access">
      <button class="qa-item" onclick="navigate('favorites')">
        <span class="qa-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 21s-7-4.5-9.5-9C1 9 3 5 7 5c2 0 3.5 1 5 3 1.5-2 3-3 5-3 4 0 6 4 4.5 7C19 16.5 12 21 12 21z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
        <span class="qa-label">收藏</span>
      </button>
      <button class="qa-item" onclick="navigate('history')">
        <span class="qa-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M12 7v5l3 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
        <span class="qa-label">历史</span>
      </button>
      <button class="qa-item" onclick="navigate('playlists')">
        <span class="qa-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M3 6h13M3 12h13M3 18h9M17 12l4 2-4 2v-4z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
        <span class="qa-label">歌单</span>
      </button>
      <button class="qa-item qa-upload" onclick="navigate('upload')">
        <span class="qa-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></span>
        <span class="qa-label">上传</span>
      </button>
    </div>` : '';

  // Category pills (horizontal scroll)
  const catPills = `<div class="cat-pills" id="cat-pills">
    <button class="cat-pill ${!state.cat?'active':''}" onclick="state.cat=null;state.page=1;navigate('home')">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5"/><path d="M2.5 8h11M8 2c1.5 1.8 2.3 3.8 2.3 6s-.8 4.2-2.3 6c-1.5-1.8-2.3-3.8-2.3-6s.8-4.2 2.3-6z" stroke="currentColor" stroke-width="1.5"/></svg>
      全部
    </button>
    ${cats.map(cat => `<button class="cat-pill ${state.cat===cat.id?'active':''}" onclick="state.cat=${cat.id};state.page=1;navigate('home')">${cat.icon} ${esc(cat.name)}</button>`).join('')}
  </div>`;

  c.innerHTML = `
  ${!isFiltered ? `<div id="hero-carousel" class="hero-carousel"><div class="hero-loading"><div class="spinner"><span></span><span></span><span></span><span></span><span></span></div></div></div>` : ''}
  ${quickAccess}
  <div class="home-search">
    <div class="search-bar">
      <svg class="search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.6"/><path d="M11 11l3 3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
      <input id="si" placeholder="搜索音频、视频..." value="${esc(state.search)}" oninput="__searchDebounce(this.value)" onkeydown="if(event.key==='Enter'){state.search=this.value;state.page=1;navigate('home')}">
      <button onclick="state.search=$('si').value;state.page=1;navigate('home')" aria-label="搜索"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.6"/><path d="M11 11l3 3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>
    </div>
  </div>
  ${catPills}
  <div class="home-section-head">
    <h2>${state.search ? `搜索 "${esc(state.search)}"` : catName}</h2>
    <div class="sort-tabs">
      <button class="sort-tab ${state.sort==='latest'?'active':''}" onclick="state.sort='latest';state.page=1;navigate('home')">最新</button>
      <button class="sort-tab ${state.sort==='popular'?'active':''}" onclick="state.sort='popular';state.page=1;navigate('home')">最多播放</button>
    </div>
  </div>
  <div id="posts"><div class="skeleton-grid">${'<div class="skel-card"><div class="skel-cover skel-shimmer"></div><div class="skel-info"><div class="skel-line w80 skel-shimmer"></div><div class="skel-line w40 skel-shimmer"></div></div></div>'.repeat(6)}</div></div>`;

  if (!isFiltered) {
    loadHeroCarousel();
  }
  await loadPosts();
}

async function loadPosts() {
  const con = $('posts'); if(!con) return;
  let url = `/api/posts?page=${state.page}&sort=${state.sort}`;
  if(state.cat) url+=`&category_id=${state.cat}`;
  if(state.search) url+=`&search=${encodeURIComponent(state.search)}`;
  const data = await api(url);
  if(!data||!data.items||!data.items.length) {
    con.innerHTML = '<div class="empty"><div class="icon"><svg width="48" height="48" viewBox="0 0 48 48" fill="none" opacity=".3"><path d="M10 28v-4a14 14 0 0 1 28 0v4" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><rect x="6" y="28" width="8" height="12" rx="3" stroke="currentColor" stroke-width="2.5"/><rect x="34" y="28" width="8" height="12" rx="3" stroke="currentColor" stroke-width="2.5"/></svg></div><p>还没有内容</p></div>'; return; }
  const grid = document.createElement('div'); grid.className = 'grid';
  for(const p of data.items) {
    const isV = p.file_type==='video', cv = p.cover_image?`${API}/${p.cover_image}`:'';
    const card = document.createElement('div'); card.className = 'card';
    card.style.animationDelay = `${grid.children.length * 0.05}s`;
    card.setAttribute('role', 'button'); card.setAttribute('tabindex', '0');
    card.onclick = () => { if(isV&&!state.user){showLogin();return;} navigate('post',p.id); };
    const rp = getResumePos(p.id);
    const isFav = p.is_favorited || false;
    const favCount = p.favorite_count || 0;
    card.innerHTML = `<div class="cover">
      ${cv?`<img src="${cv}" alt="${esc(p.title)}" loading="lazy">`:`<span class="cover-placeholder">${isV?'<svg width="28" height="28" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="14" height="14" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M17 9l5-3v12l-5-3" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>':'<svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M4 9v6M8 5v14M12 7v10M16 9v6M20 10v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>'}</span>`}
      <div class="overlay" onclick="event.stopPropagation();playInMiniPlayer({id:${p.id},title:'${esc(p.title)}',file_type:'${p.file_type}',category:${p.category?`{icon:'${p.category.icon}',name:'${esc(p.category.name)}'}`:'null'}})"><div class="play"><svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path d="M6 4l11 6-11 6V4z"/></svg></div></div>
      <div class="badge-type">${isV?'<svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path d="M3 3l10 5-10 5V3z"/></svg> 视频':'<svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M5 3v10l8-5-8-5z" fill="currentColor"/></svg> 音频'}</div>
      ${p.featured?'<div class="badge-featured">'+ICO.sparkles+' 精选</div>':''}
      ${p.duration>0?`<div class="dur">${dur(p.duration)}</div>`:''}
      ${rp?`<div class="resume-badge"><svg width="8" height="8" viewBox="0 0 12 12" fill="currentColor"><path d="M3 2l7 4-7 4V2z"/></svg> ${dur(rp.currentTime)}</div>`:''}
      <button class="fav-btn-card ${isFav?'active':''}" onclick="event.stopPropagation();toggleCardFavorite(this,${p.id})" title="收藏" aria-label="${isFav?'取消收藏':'收藏'}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="${isFav?'currentColor':'none'}" stroke="currentColor" stroke-width="1.8"><path d="M12 21s-7-4.5-9.5-9C1 9 3 5 7 5c2 0 3.5 1 5 3 1.5-2 3-3 5-3 4 0 6 4 4.5 7C19 16.5 12 21 12 21z"/></svg>
      </button>
    </div><div class="info">
      <h3>${esc(p.title)}</h3>
      <div class="meta">
        <span><svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" stroke-width="1.3"/><circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.3"/></svg> ${formatViews(p.views)}</span>
        <span><svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M8 14s-5-3-6.5-6C0 6 1.5 3 4 3c1.5 0 2.5.8 4 2 1.5-1.2 2.5-2 4-2 2.5 0 4 3 2.5 5C13 11 8 14 8 14z" stroke="currentColor" stroke-width="1.3"/></svg> ${favCount}</span>
        <span><svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M2 4h12v8H6l-3 2v-2H2V4z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg> ${p.comment_count||0}</span>
      </div>
      <div class="card-tags">
        ${p.category?`<span class="tag">${p.category.icon} ${esc(p.category.name)}</span>`:''}
        ${(p.tags||[]).slice(0,2).map(t=>`<button class="tag tag-btn" onclick="event.stopPropagation();navigate('tag-posts',{tagId:${t.id}})" aria-label="查看标签 ${esc(t.name)}">#${esc(t.name)}</button>`).join('')}
        <button class="queue-add-btn" onclick="event.stopPropagation();addToQueue({id:${p.id},title:'${esc(p.title)}',file_type:'${p.file_type}',duration:${p.duration||0}})" aria-label="添加到播放队列"><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 2v8M2 6h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button>
      </div>
    </div>`;
    grid.appendChild(card);
  }
  con.innerHTML = ''; con.appendChild(grid);
  if(data.total_pages>1) {
    const pg = document.createElement('div'); pg.className = 'pagination';
    let pgHtml = '';
    if(data.page>1) pgHtml += `<button class="btn btn-secondary" onclick="state.page=${data.page-1};loadPosts();window.scrollTo({top:0,behavior:'smooth'})">${ICO.back} 上一页</button>`;
    // Page number buttons
    const maxBtns = 5;
    let start = Math.max(1, data.page - 2);
    let end = Math.min(data.total_pages, start + maxBtns - 1);
    if (end - start < maxBtns - 1) start = Math.max(1, end - maxBtns + 1);
    if (start > 1) pgHtml += `<button class="pill" onclick="state.page=1;loadPosts();window.scrollTo({top:0,behavior:'smooth'})">1</button>`;
    if (start > 2) pgHtml += `<span class="pagination-ellipsis">…</span>`;
    for (let i = start; i <= end; i++) {
      pgHtml += `<button class="pill ${i===data.page?'active':''}" onclick="state.page=${i};loadPosts();window.scrollTo({top:0,behavior:'smooth'})">${i}</button>`;
    }
    if (end < data.total_pages - 1) pgHtml += `<span class="pagination-ellipsis">…</span>`;
    if (end < data.total_pages) pgHtml += `<button class="pill" onclick="state.page=${data.total_pages};loadPosts();window.scrollTo({top:0,behavior:'smooth'})">${data.total_pages}</button>`;
    if(data.page<data.total_pages) pgHtml += `<button class="btn btn-secondary" onclick="state.page=${data.page+1};loadPosts();window.scrollTo({top:0,behavior:'smooth'})">下一页 ${ICO.fastForward}</button>`;
    pg.innerHTML = pgHtml;
    con.appendChild(pg);
  }
  const rssLink = document.createElement('div');
  rssLink.className = 'rss-link';
  rssLink.innerHTML = `<a href="${API}/api/rss.xml" target="_blank"><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 4c6 0 10 4 10 10M2 8c4 0 6 2 6 6M3 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg> RSS 订阅</a>`;
  con.appendChild(rssLink);
}

// ─── Custom Audio Player ───
function atoggle(id) {
  const a = document.getElementById(`ael-${id}`);
  if (!a) return;
  if (a.paused) a.play(); else a.pause();
}
function aupdateUI(id) {
  const a = document.getElementById(`ael-${id}`);
  if (!a) return;
  const playing = !a.paused;
  const bigBtn = document.getElementById(`apb-${id}`);
  const smallBtn = document.getElementById(`aps-${id}`);
  const overlay = document.getElementById(`apo-${id}`);
  const visual = document.querySelector(`.audio-visual`);
  if (bigBtn) bigBtn.innerHTML = playing ? ICO.pause : ICO.play;
  if (smallBtn) smallBtn.innerHTML = playing ? ICO.pause : ICO.play;
  if (overlay) overlay.style.display = playing ? 'none' : 'flex';
  if (visual) visual.classList.toggle('paused', !playing);
  if (a.duration) {
    const pct = (a.currentTime / a.duration) * 100;
    const fill = document.getElementById(`apf-${id}`);
    if (fill) fill.style.width = `${pct}%`;
    const cur = document.getElementById(`acur-${id}`);
    if (cur) cur.textContent = dur(a.currentTime);
  }
}
function aseek(e, id) {
  const a = document.getElementById(`ael-${id}`);
  if (!a || !a.duration) return;
  const rect = e.currentTarget.getBoundingClientRect();
  a.currentTime = ((e.clientX - rect.left) / rect.width) * a.duration;
}
function avolume(e, id) {
  const a = document.getElementById(`ael-${id}`);
  if (!a) return;
  a.volume = parseFloat(e.target.value);
  localStorage.setItem('asmr_volume', a.volume);
}
function amute(id) {
  const a = document.getElementById(`ael-${id}`);
  if (!a) return;
  a.muted = !a.muted;
  localStorage.setItem('asmr_muted', a.muted ? '1' : '0');
  const btn = document.getElementById(`avb-${id}`);
  if (btn) btn.innerHTML = a.muted ? ICO.mute : ICO.volume;
}
function aspeed(id) {
  const a = document.getElementById(`ael-${id}`);
  if (!a) return;
  const speeds = [1, 1.25, 1.5, 2, 0.5];
  const idx = speeds.indexOf(a.playbackRate);
  a.playbackRate = speeds[(idx + 1) % speeds.length];
  localStorage.setItem('asmr_speed', a.playbackRate);
  const el = document.getElementById(`aspd-${id}`);
  if (el) el.textContent = `${a.playbackRate}x`;
}

// ─── Custom Video Player ───
function vtoggle(id) {
  const v = document.getElementById(`vel-${id}`);
  if (!v) return;
  if (v.paused) v.play(); else v.pause();
}
function vupdateUI(id) {
  const v = document.getElementById(`vel-${id}`);
  if (!v) return;
  const playing = !v.paused;
  const centerBtn = document.getElementById(`vcp-${id}`);
  const smallBtn = document.getElementById(`vpb-${id}`);
  if (centerBtn) centerBtn.innerHTML = playing ? ICO.pause : ICO.play;
  if (smallBtn) smallBtn.innerHTML = playing ? ICO.pause : ICO.play;
  if (v.duration) {
    const pct = (v.currentTime / v.duration) * 100;
    const fill = document.getElementById(`vpf-${id}`);
    if (fill) fill.style.width = `${pct}%`;
    const cur = document.getElementById(`vcur-${id}`);
    const durEl = document.getElementById(`vdur-${id}`);
    if (cur) cur.textContent = dur(v.currentTime);
    if (durEl) durEl.textContent = dur(v.duration);
  }
  const overlay = document.getElementById(`vcp-${id}`);
  if (overlay) overlay.style.display = playing ? 'none' : 'flex';
}
function vseek(e, id) {
  const v = document.getElementById(`vel-${id}`);
  if (!v || !v.duration) return;
  const rect = e.currentTarget.getBoundingClientRect();
  v.currentTime = ((e.clientX - rect.left) / rect.width) * v.duration;
}
function vvolume(e, id) {
  const v = document.getElementById(`vel-${id}`);
  if (!v) return;
  v.volume = parseFloat(e.target.value);
  localStorage.setItem('asmr_volume', v.volume);
}
function vmute(id) {
  const v = document.getElementById(`vel-${id}`);
  if (!v) return;
  v.muted = !v.muted;
  localStorage.setItem('asmr_muted', v.muted ? '1' : '0');
  const btn = document.getElementById(`vvb-${id}`);
  if (btn) btn.innerHTML = v.muted ? ICO.mute : ICO.volume;
}
function vspeed(id) {
  const v = document.getElementById(`vel-${id}`);
  if (!v) return;
  const speeds = [1, 1.25, 1.5, 2, 0.5];
  const idx = speeds.indexOf(v.playbackRate);
  v.playbackRate = speeds[(idx + 1) % speeds.length];
  localStorage.setItem('asmr_speed', v.playbackRate);
}
function vfs(id) {
  const v = document.getElementById(`vel-${id}`);
  if (!v) return;
  if (document.fullscreenElement) document.exitFullscreen();
  else v.parentElement.requestFullscreen();
}
function vshow(id) {
  const overlay = document.getElementById(`vov-${id}`);
  if (!overlay) return;
  overlay.classList.add('visible');
  clearTimeout(overlay._hideTimer);
  overlay._hideTimer = setTimeout(() => {
    const v = document.getElementById(`vel-${id}`);
    if (v && !v.paused) overlay.classList.remove('visible');
  }, 3000);
}

// ─── Post Detail ───
let _postPollTimer = null;
async function renderPost() {
  const con = $('content'); con.innerHTML = '<div class="loading"><div class="spinner"><span></span><span></span><span></span><span></span><span></span></div></div>';
  const p = await api(`/api/posts/${state.postId}`);
  if(!p) { con.innerHTML='<div class="empty"><p>找不到了</p><button class="btn btn-primary" onclick="navigate()">返回</button></div>'; return; }
  const isV = p.file_type==='video';
  if(isV && !state.user) {
    con.innerHTML = `<button class="back" onclick="navigate()">${ICO.back} 返回</button>
      <div class="detail"><div class="info status-state">
        <div class="status-icon">${ICO.lock}</div>
        <h1>观看视频需要登录</h1>
        <p class="status-msg">登录后即可播放所有视频内容</p>
        <button class="btn btn-primary" onclick="showLogin()">去登录</button>
      </div></div>`;
    return;
  }
  // PRD-018: Transcode status handling
  if (p.status === 'processing') {
    const isAdmin = state.user && state.user.role === 'admin';
    con.innerHTML = `<button class="back" onclick="navigate()">${ICO.back} 返回</button>
      <div class="detail"><div class="info status-state">
        <div class="status-icon">${ICO.hourglass}</div>
        <h1>${esc(p.title)}</h1>
        <p class="status-msg">转码处理中，请稍后刷新查看…</p>
        <div class="status-actions">
          <button class="btn btn-primary" onclick="renderPost()">${ICO.refresh} 刷新状态</button>
          ${isAdmin?`<button class="btn btn-secondary" onclick="navigate('admin-transcode')">查看转码队列</button>`:''}
        </div>
      </div></div>`;
    if (_postPollTimer) clearInterval(_postPollTimer);
    _postPollTimer = setInterval(async () => {
      if (state.view !== 'post' || state.postId !== p.id) { clearInterval(_postPollTimer); _postPollTimer = null; return; }
      const pp = await api(`/api/posts/${p.id}`);
      if (pp && pp.status !== 'processing') {
        clearInterval(_postPollTimer); _postPollTimer = null;
        renderPost();
      }
    }, 5000);
    return;
  }
  if (p.status === 'failed') {
    const isAdmin = state.user && state.user.role === 'admin';
    const isOwner = state.user && p.user && p.user.id === state.user.id;
    const canRetry = isAdmin || isOwner;
    con.innerHTML = `<button class="back" onclick="navigate()">${ICO.back} 返回</button>
      <div class="detail"><div class="info status-state">
        <div class="status-icon">${ICO.cross}</div>
        <h1>${esc(p.title)}</h1>
        <p class="status-msg-error">转码失败，内容无法播放</p>
        <div class="status-actions">
          ${canRetry?`<button class="btn btn-primary" onclick="retryTranscode(${p.id})">${ICO.refresh} 重试转码</button>`:''}
          ${isAdmin?`<button class="btn btn-secondary" onclick="navigate('admin-transcode')">转码队列</button>`:''}
        </div>
      </div></div>`;
    return;
  }
  const pid = state.postId;
  const src = `${API}/${p.file_path}`, cover = p.cover_image?`${API}/${p.cover_image}`:'';
  const catText = p.category ? `${p.category.icon} ${esc(p.category.name)}` : '';

  let playerHTML = '';
  const hasSubs = p.subtitle_count > 0;
  if (isV) {
    playerHTML = `<div class="video-player-wrap" id="vpw-${pid}" role="button" tabindex="0" onmousemove="vshow('${pid}')" onclick="vtoggle('${pid}')" aria-label="播放/暂停">
      <video id="vel-${pid}" src="${esc(src)}" preload="metadata" poster="${esc(cover)}"></video>
      <div class="video-controls-overlay" id="vov-${pid}">
        <div class="video-center-play" id="vcp-${pid}" role="button" tabindex="0" onclick="event.stopPropagation();vtoggle('${pid}')" aria-label="播放/暂停">${ICO.play}</div>
        <div class="video-bottom-bar">
          <div class="video-progress-wrap" role="slider" tabindex="0" onclick="event.stopPropagation();vseek(event,'${pid}')" aria-label="播放进度">
            <div class="video-progress-fill" id="vpf-${pid}" style="width:0%">
              <div class="video-progress-thumb"></div>
            </div>
          </div>
          <div class="video-time-row">
            <span id="vcur-${pid}">0:00</span>
            <span id="vdur-${pid}">0:00</span>
          </div>
          <div class="video-btn-row">
            <button class="video-play-btn" id="vpb-${pid}" onclick="event.stopPropagation();vtoggle('${pid}')" aria-label="播放/暂停">${ICO.play}</button>
            <div class="video-volume-wrap">
              <button class="video-btn" id="vvb-${pid}" onclick="event.stopPropagation();vmute('${pid}')" aria-label="静音">${ICO.volume}</button>
              <input type="range" class="video-volume-slider" id="vvs-${pid}" min="0" max="1" step="0.05" value="1" oninput="event.stopPropagation();vvolume(event,'${pid}')">
            </div>
            ${hasSubs ? `<button class="video-btn" id="vcc-${pid}" onclick="event.stopPropagation();toggleSubtitle('${pid}',true)" title="字幕" aria-label="字幕">CC</button>` : ''}
            <span class="timer-indicator" role="button" tabindex="0" style="margin-right:2px" onclick="event.stopPropagation();showTimer('${pid}')" aria-label="定时关闭">${ICO.clock} 0:00</span>
            <button class="video-btn" onclick="event.stopPropagation();showTimer('${pid}')" aria-label="定时关闭">${ICO.clock}</button>
            <button class="video-btn" id="vpm-${pid}" onclick="event.stopPropagation();cyclePlayMode('${pid}')" title="播放模式" aria-label="播放模式">${ICO.repeat}</button>
            <button class="video-btn video-fullscreen-btn" onclick="event.stopPropagation();vfs('${pid}')" aria-label="全屏">${ICO.fullscreen}</button>
          </div>
        </div>
      </div>
    </div>`;
  } else {
    playerHTML = `<div class="audio-player-card">
      <div class="audio-visual" role="button" tabindex="0" onclick="atoggle('${pid}')" aria-label="播放/暂停">
        <div class="audio-play-overlay" id="apo-${pid}">
          <button class="audio-play-btn-big" id="apb-${pid}" aria-label="播放/暂停">${ICO.play}</button>
        </div>
        <div class="audio-info-overlay">
          <div class="audio-info-title">${esc(p.title)}</div>
          <div class="audio-info-sub">${catText} · ${dur(p.duration)}</div>
        </div>
      </div>
      <div class="audio-controls">
        <div class="audio-progress-wrap" role="slider" tabindex="0" onclick="aseek(event,'${pid}')" aria-label="播放进度">
          <div class="audio-progress-fill" id="apf-${pid}" style="width:0%">
            <div class="audio-progress-thumb"></div>
          </div>
        </div>
        <div class="audio-time-row">
          <span id="acur-${pid}">0:00</span>
          <span id="adur-${pid}">${dur(p.duration)}</span>
        </div>
        <div class="audio-btn-row">
          <button class="audio-play-btn-small" id="aps-${pid}" onclick="event.stopPropagation();atoggle('${pid}')" aria-label="播放/暂停">${ICO.play}</button>
          <span id="aspd-${pid}" role="button" tabindex="0" class="speed-label" onclick="aspeed('${pid}')" aria-label="播放速度">1x</span>
          ${hasSubs ? `<button class="audio-btn" id="acc-${pid}" onclick="toggleSubtitle('${pid}',false)" title="字幕" aria-label="字幕">CC</button>` : ''}
          <span class="timer-indicator" role="button" tabindex="0" onclick="showTimer('${pid}')" aria-label="定时关闭">${ICO.clock} 0:00</span>
          <button class="audio-btn" onclick="showTimer('${pid}')" aria-label="定时关闭">${ICO.clock}</button>
          <button class="audio-btn" id="apm-${pid}" onclick="cyclePlayMode('${pid}')" title="播放模式" aria-label="播放模式">${ICO.repeat}</button>
          <div class="audio-volume-wrap">
            <button class="audio-btn" id="avb-${pid}" onclick="amute('${pid}')" aria-label="静音">${ICO.volume}</button>
            <input type="range" class="audio-volume-slider" id="avs-${pid}" min="0" max="1" step="0.05" value="1" oninput="avolume(event,'${pid}')">
          </div>
        </div>
      </div>
      <audio id="ael-${pid}" src="${esc(src)}" preload="metadata" style="display:none"></audio>
    </div>`;
  }

  let serverResume = null;
  if(state.user){
    const r = await api(`/api/posts/${pid}/resume`);
    if(r && r.position > 0 && r.duration > 0 && r.position / r.duration < 0.95){
      serverResume = { currentTime: r.position, duration: r.duration };
    }
  }
  const localResume = getResumePos(pid);
  const resume = serverResume || localResume;

  const isAdmin = state.user && state.user.role === 'admin';
  const isOwner = state.user && p.user && p.user.id === state.user.id;
  const canEdit = isAdmin || isOwner;
  const favCount = p.favorite_count || 0;
  const isFav = p.is_favorited || false;
  const commentCount = p.comment_count || 0;

  let html = `<button class="back" onclick="navigate()">${ICO.back} 返回</button>
    <div id="queue-bar" class="queue-bar"></div>
    <div class="detail">${playerHTML}
      <div class="info">
        <div class="detail-title-row">
          <h1>${esc(p.title)}</h1>
          ${p.featured?`<span class="featured-badge">${ICO.star} 精选</span>`:''}
        </div>
        <div class="meta-chips">
          ${p.category?`<span class="meta-chip">${p.category.icon} ${esc(p.category.name)}</span>`:''}
          ${p.duration>0?`<span class="meta-chip">${ICO.clock} ${dur(p.duration)}</span>`:''}
          ${p.file_size?`<span class="meta-chip">${ICO.file} ${fs(p.file_size)}</span>`:''}
          <span class="meta-chip">${ICO.eye} ${formatViews(p.views)}</span>
          <span class="meta-chip">${ICO.heart} ${favCount}</span>
          <span class="meta-chip">${ICO.chat} ${commentCount}</span>
          <span class="meta-chip">${ICO.calendar} ${dt(p.created_at)}</span>
          ${p.user?`<span class="meta-chip">${ICO.user} ${esc(p.user.username)}</span>`:''}
        </div>
        ${p.tags && p.tags.length ? `<div class="detail-tags">
          ${p.tags.map(t=>`<button class="tag" onclick="navigate('tag-posts',{tagId:${t.id}})" aria-label="查看标签 ${esc(t.name)}">#${esc(t.name)}</button>`).join('')}
        </div>` : ''}
        ${p.description?`<div class="desc">${esc(p.description)}</div>`:''}
        <div class="detail-actions">
          <button class="btn ${isFav?'btn-primary':'btn-secondary'}" id="fav-btn" onclick="toggleFavorite(${pid})">
            ${isFav?ICO.heart:ICO.heartO}
            <span>${isFav?'已收藏':'收藏'}</span> <span id="fav-count">${favCount}</span>
          </button>
          <button class="btn btn-secondary" onclick="addToQueue({id:${pid},title:'${esc(p.title)}',file_type:'${p.file_type}',duration:${p.duration||0}})">
            ${ICO.plus}
            加入队列
          </button>
          ${state.user?`<button class="btn btn-secondary" onclick="showAddToPlaylist(${pid})">
            ${ICO.listPlus}
            加到歌单
          </button>`:''}
          ${state.user?`<button class="btn btn-secondary" onclick="showReportDialog('post',${pid})">
            ${ICO.flag}
            举报
          </button>`:''}
          ${isAdmin?`<button class="btn ${p.featured?'btn-primary':'btn-secondary'}" id="feat-btn" onclick="toggleFeatured(${pid},${p.featured})">
            ${p.featured?ICO.star:ICO.starO}
            ${p.featured?'已精选':'加精'}
          </button>`:''}
          ${canEdit?`<button class="btn btn-secondary" onclick="navigate('edit',${pid})">
            ${ICO.pencil}
            编辑
          </button>`:''}
          ${canEdit?`<button class="btn btn-secondary btn-danger" onclick="deletePost(${pid})">
            ${ICO.trash}
            删除
          </button>`:''}
        </div>
        <div id="post-stats" class="post-stats"></div>
      </div>
    </div>
    <div id="related-section" class="related-section" style="display:none">
      <div class="section-head">
        ${ICO.upload}
        <h2>相关推荐</h2>
      </div>
      <div id="related-scroll" class="related-scroll"></div>
    </div>
    <div id="comments-section" class="comments-section">
      <div class="section-head">
        ${ICO.chat}
        <h2>评论</h2>
        <span class="section-count">${commentCount}</span>
      </div>
      ${state.user ? `<div class="comment-editor">
        <textarea id="comment-input" placeholder="写下你的评论..." ></textarea>
        <div class="comment-editor-bar">
          <button class="btn btn-primary" onclick="submitComment(${pid})">
            ${ICO.check}
            发布评论
          </button>
        </div>
      </div>` : `<div class="comment-login-hint">
        <p>登录后可以发表评论</p>
        <button class="btn btn-primary" onclick="showLogin()">去登录</button>
      </div>`}
      <div id="comments-list" class="comments-list"><div class="loading"><div class="spinner"><span></span><span></span><span></span><span></span><span></span></div></div></div>
    </div>`;
  con.innerHTML = html;
  updateQueueBar();
  setupMediaSession(p, cover);

  // Bind audio/video events
  let heartbeatTimer = null;
  let lastHeartbeat = 0;
  function sendHeartbeat(pos, dur) {
    if(!state.user) return;
    const now = Date.now();
    if(now - lastHeartbeat < 3000) return;
    lastHeartbeat = now;
    api(`/api/posts/${pid}/heartbeat`, {
      method:'POST',
      body: JSON.stringify({position: pos, duration: dur})
    });
    if (state.currentSessionId) updatePlaySession(pid, Math.floor(pos||0));
  }
  function startHeartbeat(getPos, getDur) {
    if(heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => {
      const pos = getPos(), dur = getDur();
      if(pos && dur){
        sendHeartbeat(pos, dur);
      }
    }, 10000);
  }
  function stopHeartbeat() {
    if(heartbeatTimer){ clearInterval(heartbeatTimer); heartbeatTimer = null; }
  }

  function showResumeOverlay(startPlay) {
    if(!resume) return;
    const overlay = document.createElement('div');
    overlay.className = 'resume-overlay';
    overlay.innerHTML = `<div class="resume-box">
      <div class="resume-title">继续播放</div>
      <div class="resume-sub">上次看到 ${dur(resume.currentTime)}</div>
      <div class="status-actions" style="margin-top:12px">
        <button class="btn btn-secondary" id="resume-cancel">从头开始</button>
        <button class="btn btn-primary" id="resume-btn">${ICO.play} 继续播放</button>
      </div>
      <div class="resume-countdown" id="resume-cd">3 秒后自动播放…</div>
    </div>`;
    const playerWrap = isV ? $(`vpw-${pid}`) : qs('.audio-player-card');
    if(playerWrap){
      playerWrap.style.position = 'relative';
      playerWrap.appendChild(overlay);
    } else {
      document.body.appendChild(overlay);
    }
    let count = 3;
    const cdEl = $('resume-cd');
    const timer = setInterval(() => {
      count--;
      if(cdEl) cdEl.textContent = `${count} 秒后自动播放…`;
      if(count <= 0){
        clearInterval(timer);
        overlay.remove();
        startPlay();
      }
    }, 1000);
    $('resume-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      clearInterval(timer);
      overlay.remove();
      startPlay();
    });
    $('resume-cancel')?.addEventListener('click', (e) => {
      e.stopPropagation();
      clearInterval(timer);
      overlay.remove();
    });
  }

  if (isV) {
    const v = document.getElementById(`vel-${pid}`);
    if (v) {
      applySavedMediaSettings(v, pid, true);
      let resumed = false;
      v.addEventListener('timeupdate', () => {
        vupdateUI(pid);
        savePosition(pid, v.currentTime, v.duration);
      });
      v.addEventListener('loadedmetadata', () => {
        vupdateUI(pid);
        if (resume && v.duration && serverResume) {
          showResumeOverlay(() => {
            v.currentTime = Math.min(resume.currentTime, v.duration - 5);
            v.play();
          });
        } else if (resume && v.duration) {
          v.currentTime = Math.min(resume.currentTime, v.duration - 5);
        }
      });
      v.addEventListener('play', () => {
        vupdateUI(pid);
        startHeartbeat(()=>v.currentTime, ()=>v.duration);
        updateMediaSessionState(true);
        if (!state.currentSessionId) startPlaySession(pid);
      });
      v.addEventListener('pause', () => {
        vupdateUI(pid);
        stopHeartbeat();
        sendHeartbeat(v.currentTime, v.duration);
        updateMediaSessionState(false);
        if (state.currentSessionId) endPlaySession(pid, Math.floor(v.currentTime||0), Math.floor(v.duration||0));
      });
      v.addEventListener('ended', () => {
        vupdateUI(pid);
        stopHeartbeat();
        clearPosition(pid);
        if (state.currentSessionId) endPlaySession(pid, Math.floor(v.currentTime||0), Math.floor(v.duration||0));
        handlePlaybackEnded(pid, v);
      });
    }
    const vov = document.getElementById(`vov-${pid}`);
    if (vov) { vov.classList.add('visible'); setTimeout(() => { if (v && !v.paused) vov.classList.remove('visible'); }, 3000); }
    attachVideoGestures(pid);
  } else {
    const a = document.getElementById(`ael-${pid}`);
    if (a) {
      applySavedMediaSettings(a, pid, false);
      a.addEventListener('timeupdate', () => {
        aupdateUI(pid);
        savePosition(pid, a.currentTime, a.duration);
      });
      a.addEventListener('loadedmetadata', () => {
        aupdateUI(pid);
        if (resume && a.duration && serverResume) {
          showResumeOverlay(() => {
            a.currentTime = Math.min(resume.currentTime, a.duration - 5);
            a.play();
          });
        } else if (resume && a.duration) {
          a.currentTime = Math.min(resume.currentTime, a.duration - 5);
        }
      });
      a.addEventListener('play', () => {
        aupdateUI(pid);
        startHeartbeat(()=>a.currentTime, ()=>a.duration);
        updateMediaSessionState(true);
        if (!state.currentSessionId) startPlaySession(pid);
      });
      a.addEventListener('pause', () => {
        aupdateUI(pid);
        stopHeartbeat();
        sendHeartbeat(a.currentTime, a.duration);
        updateMediaSessionState(false);
        if (state.currentSessionId) endPlaySession(pid, Math.floor(a.currentTime||0), Math.floor(a.duration||0));
      });
      a.addEventListener('ended', () => {
        aupdateUI(pid);
        stopHeartbeat();
        clearPosition(pid);
        if (state.currentSessionId) endPlaySession(pid, Math.floor(a.currentTime||0), Math.floor(a.duration||0));
        handlePlaybackEnded(pid, a);
      });
      const apo = document.getElementById(`apo-${pid}`);
      if (apo) apo.style.display = 'flex';
    }
  }

  if (hasSubs) {
    loadAndSetupSubtitles(pid, isV);
  }
  loadRelated(pid);
  loadComments(pid);
  loadPostStats(pid);
}

async function loadPostStats(postId) {
  const el = $('post-stats');
  if (!el) return;
  const data = await api(`/api/posts/${postId}/stats`) || {};
  const parts = [];
  if (data.total_play_time || data.total_play_seconds) {
    parts.push(`${ICO.clock} 总播放时长 ${fdp(data.total_play_time || data.total_play_seconds)}`);
  }
  if (data.avg_completion !== undefined || data.completion_rate !== undefined) {
    const rate = data.avg_completion !== undefined ? data.avg_completion : data.completion_rate;
    const pct = (rate > 1 ? rate : rate * 100).toFixed(1);
    parts.push(`${ICO.chart} 平均完播率 ${pct}%`);
  }
  if (data.play_count !== undefined) parts.push(`${ICO.play} 播放次数 ${data.play_count}`);
  if (data.session_count !== undefined) parts.push(`播放会话 ${data.session_count}`);
  el.innerHTML = parts.length ? parts.join(' · ') : '';
}
async function loadAndSetupSubtitles(pid, isVideo) {
  const subs = await api(`/api/posts/${pid}/subtitles`) || [];
  if (!subs.length) return;
  const media = document.getElementById(isVideo ? `vel-${pid}` : `ael-${pid}`);
  if (!media) return;
  subs.forEach((s, i) => {
    const track = document.createElement('track');
    track.kind = 'subtitles';
    track.label = s.language || `字幕 ${i+1}`;
    track.srclang = s.language || 'zh';
    track.src = `${API}${s.file_path || s.url || ''}`;
    media.appendChild(track);
  });
  const ccBtn = document.getElementById(isVideo ? `vcc-${pid}` : `acc-${pid}`);
  if (ccBtn) {
    ccBtn.style.opacity = '0.5';
    ccBtn.dataset.on = '0';
  }
}
function toggleSubtitle(id, isV) {
  const m = document.getElementById(isV ? `vel-${id}` : `ael-${id}`);
  const btn = document.getElementById(isV ? `vcc-${id}` : `acc-${id}`);
  if (!m) return;
  const isOn = btn?.dataset.on === '1';
  const newState = !isOn;
  for (let i = 0; i < m.textTracks.length; i++) {
    m.textTracks[i].mode = newState ? 'showing' : 'hidden';
  }
  if (btn) {
    btn.dataset.on = newState ? '1' : '0';
    btn.style.opacity = newState ? '1' : '0.5';
    btn.style.color = newState ? 'var(--accent)' : '';
  }
}

// ─── Upload ───
let _file = null, _cover = null, _subtitle = null, _selCat = null, _tagSuggestions = [];

async function renderUpload() {
  if(!state.user) { showLogin(); return; }
  const cats = await api('/api/categories')||[];
  const con = $('content');
  con.innerHTML = `<button class="back" onclick="navigate()">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 4L6 8l4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
      返回
    </button>
    <div class="page-header">
      <div>
        <h1>上传新内容</h1>
        <div class="sub">支持音频和视频文件，分享你的 ASMR 作品</div>
      </div>
    </div>
    <div class="upload-steps">
      <div class="upload-step active" id="step-1"><span class="upload-step-num">1</span>选择文件</div>
      <div class="upload-step-line"></div>
      <div class="upload-step" id="step-2"><span class="upload-step-num">2</span>填写信息</div>
      <div class="upload-step-line"></div>
      <div class="upload-step" id="step-3"><span class="upload-step-num">3</span>上传发布</div>
    </div>
    <div class="upload-form">
      <div class="drop" id="drop">
        <div class="icon">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style="margin:0 auto;display:block">
            <rect x="6" y="10" width="36" height="28" rx="4" stroke="var(--accent)" stroke-width="2" opacity=".4"/>
            <path d="M24 30V18M24 18l-5 5M24 18l5 5" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity=".6"/>
            <path d="M8 32l8-6 6 4 8-8 10 8" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity=".3"/>
          </svg>
        </div>
        <p>点击选择文件或拖拽到此处</p>
        <div class="hint">支持 MP3 · WAV · FLAC · OGG · AAC · MP4 · WebM · MOV</div>
      </div>
      <input type="file" id="fi" accept=".mp3,.wav,.flac,.ogg,.aac,.m4a,.mp4,.webm,.mov,.mkv" onchange="hf(event)">
      <div id="ds" style="display:none">
        <div class="form-group">
          <label>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 3.5h8M7 3v8M5 11h4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
            标题
          </label>
          <input id="title" placeholder="给你的 ASMR 取个名字..." maxlength="100">
        </div>
        <div class="form-group">
          <label>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 3.5h9M2.5 7h9M2.5 10.5h6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
            描述
          </label>
          <textarea id="desc" placeholder="简单描述一下这个内容..." maxlength="500"></textarea>
        </div>
        <div class="form-group">
          <label>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 4.5l5-2.5 5 2.5v5l-5 2.5L2 9.5v-5z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M2 4.5l5 2.5 5-2.5M7 7v5.5" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>
            分类
          </label>
          <div class="cat-picker" id="cat-picker">${cats.map(c=>`<div class="cat-option" role="button" tabindex="0" data-id="${c.id}" onclick="selectCat(${c.id})"><div class="cg-icon">${c.icon}</div>${esc(c.name)}</div>`).join('')}</div>
        </div>
        <div class="form-group">
          <label>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 3.5h3l1.5 2H12v6H2v-8z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>
            标签（逗号分隔）
          </label>
          <div class="tag-input-wrap">
            <input id="tags" placeholder="例如：助眠, 雨声, 放松" oninput="onTagInput(this)" onblur="setTimeout(()=>{const s=$('tag-suggest');if(s)s.style.display='none'},200)" autocomplete="off">
            <div id="tag-suggest" class="tag-suggest"></div>
          </div>
          <div class="form-hint">多个标签用英文或中文逗号分隔</div>
        </div>
        <div class="form-group">
          <label>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1.5" y="2.5" width="11" height="9" rx="1.5" stroke="currentColor" stroke-width="1.4"/><path d="M4 5.5l3 2 3-2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
            封面图片（可选）
          </label>
          <button class="btn btn-secondary" onclick="$('ci').click()">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1.5" y="2.5" width="11" height="9" rx="1.5" stroke="currentColor" stroke-width="1.4"/><circle cx="5" cy="6" r="1" fill="currentColor"/><path d="M2 9l3-2 3 2 4-3" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>
            选择封面
          </button>
          <input type="file" id="ci" accept="image/*" onchange="hc(event)" style="display:none">
          <div id="cp" style="display:none;margin-top:10px">
            <div class="file-preview">
              <img id="cpi">
              <div class="file-preview-info"><strong>封面图片</strong><span id="cp-name"></span></div>
              <button class="file-preview-remove" onclick="removeCover()" aria-label="移除封面">
                ${ICO.cross}
              </button>
            </div>
          </div>
        </div>
        <div class="form-group">
          <label>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="2.5" width="10" height="9" rx="1" stroke="currentColor" stroke-width="1.4"/><path d="M4 6h6M4 8.5h4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
            字幕文件（可选 · .srt/.vtt）
          </label>
          <button class="btn btn-secondary" onclick="$('si').click()">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 2.5h5l3 3v6H3v-9z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M8 2.5v3h3" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>
            选择字幕
          </button>
          <input type="file" id="si" accept=".srt,.vtt" onchange="hs(event)" style="display:none">
          <div id="sp" style="display:none;margin-top:10px">
            <div class="file-preview">
              <div class="file-preview-icon">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M5 3h7l3 3v11H5V3z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M12 3v3h3" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M7 11h6M7 13.5h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
              </div>
              <div class="file-preview-info"><strong id="sp-name"></strong><span id="sp-size"></span></div>
              <button class="file-preview-remove" onclick="removeSubtitle()" aria-label="移除字幕">${ICO.cross}</button>
            </div>
          </div>
        </div>
        <div id="upload-progress" style="display:none;margin-bottom:16px">
          <div class="upload-progress-wrap">
            <div class="upload-progress-head">
              <span id="up-status" class="upload-status">
                ${ICO.spinner}
                上传中…
              </span>
              <span id="up-percent" class="upload-percent">0%</span>
            </div>
            <div class="upload-progress-bar">
              <div id="up-bar" class="upload-progress-fill"></div>
            </div>
          </div>
        </div>
        <div class="form-actions">
          <button class="btn btn-secondary" onclick="navigate()">取消</button>
          <button class="btn btn-primary" onclick="submitUpload()">
            ${ICO.upload}
            上传发布
          </button>
        </div>
      </div>
    </div>`;
  const drop = $('drop'); drop.onclick = () => $('fi').click();
  drop.addEventListener('dragover',e=>{e.preventDefault();drop.classList.add('active')});
  drop.addEventListener('dragleave',()=>drop.classList.remove('active'));
  drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('active');if(e.dataTransfer.files.length){$('fi').files=e.dataTransfer.files;hf({target:{files:e.dataTransfer.files}})}});
}

function removeCover() {
  _cover = null;
  const cp = $('cp'); if(cp) cp.style.display = 'none';
  $('ci').value = '';
}
function removeSubtitle() {
  _subtitle = null;
  const sp = $('sp'); if(sp) sp.style.display = 'none';
  $('si').value = '';
}

function selectCat(id) {
  _selCat = id;
  document.querySelectorAll('.cat-option').forEach(el=>el.classList.toggle('selected',parseInt(el.dataset.id)===id));
}

function hf(e) {
  const f = e.target.files?.[0]; if(!f) return;
  _file = f; _selCat = null;
  const isV = f.type.startsWith('video/');
  const drop = $('drop');
  drop.classList.add('has-file');
  drop.innerHTML = `<div class="file-preview">
    <div class="file-preview-icon">
      ${isV
        ? `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="14" height="14" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M17 9l4-2v10l-4-2" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`
        : `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M9 18V6l10-2v12" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="6" cy="18" r="2.5" stroke="currentColor" stroke-width="1.6"/><circle cx="16" cy="16" r="2.5" stroke="currentColor" stroke-width="1.6"/></svg>`
      }
    </div>
    <div class="file-preview-info">
      <strong>${esc(f.name)}</strong>
      <span>${isV?'视频':'音频'} · ${fs(f.size)}</span>
    </div>
    <button class="file-preview-remove" onclick="event.stopPropagation();resetFile()" aria-label="重新选择">
      ${ICO.cross}
    </button>
  </div>`;
  $('ds').style.display = 'block';
  // Update step indicator
  const s1 = $('step-1'), s2 = $('step-2');
  if(s1) { s1.classList.remove('active'); s1.classList.add('done'); }
  if(s2) s2.classList.add('active');
  // Auto-select first category
  const firstCat = qs('.cat-option');
  if(firstCat) { _selCat = parseInt(firstCat.dataset.id); firstCat.classList.add('selected'); }
}

function resetFile() {
  _file = null;
  const drop = $('drop');
  drop.classList.remove('has-file');
  drop.innerHTML = `<div class="icon">
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style="margin:0 auto;display:block">
        <rect x="6" y="10" width="36" height="28" rx="4" stroke="var(--accent)" stroke-width="2" opacity=".4"/>
        <path d="M24 30V18M24 18l-5 5M24 18l5 5" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity=".6"/>
        <path d="M8 32l8-6 6 4 8-8 10 8" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity=".3"/>
      </svg>
    </div>
    <p>点击选择文件或拖拽到此处</p>
    <div class="hint">支持 MP3 · WAV · FLAC · OGG · AAC · MP4 · WebM · MOV</div>`;
  $('ds').style.display = 'none';
  $('fi').value = '';
  const s1 = $('step-1'), s2 = $('step-2');
  if(s1) { s1.classList.add('active'); s1.classList.remove('done'); }
  if(s2) s2.classList.remove('active');
}

function hc(e) {
  const f = e.target.files?.[0]; if(!f) return;
  _cover = f; const r = new FileReader();
  r.onload = e => {
    $('cp').style.display='block';
    $('cpi').src=e.target.result;
    const cn = $('cp-name'); if(cn) cn.textContent = f.name;
  };
  r.readAsDataURL(f);
}
function hs(e) {
  const f = e.target.files?.[0]; if(!f) return;
  _subtitle = f;
  const sp = $('sp');
  if(sp){
    sp.style.display='block';
    const sn = $('sp-name'); if(sn) sn.textContent = f.name;
    const ss = $('sp-size'); if(ss) ss.textContent = fs(f.size);
  }
}

function submitUpload() {
  const title = $('title')?.value.trim();
  if(!title) { toast('请输入标题', 'error'); return; }
  if(!_file) { toast('请选择文件', 'error'); return; }
  if(!_selCat) { toast('请选择分类', 'error'); return; }
  const tagStr = ($('tags')?.value||'').trim();
  const tagList = tagStr ? tagStr.split(/[,，]/).map(t=>t.trim()).filter(t=>t) : [];
  const fd = new FormData();
  fd.append('title', title);
  fd.append('description', ($('desc')?.value||'').trim());
  fd.append('category_id', _selCat);
  if (tagList.length) fd.append('tags', JSON.stringify(tagList));
  fd.append('file', _file);
  if(_cover) fd.append('cover', _cover);
  const btn = qs('.btn-primary');
  const up = $('upload-progress');
  const upBar = $('up-bar');
  const upPercent = $('up-percent');
  const upStatus = $('up-status');
  if(btn){btn.disabled=true;btn.innerHTML=ICO.spinner+'上传中…'}
  if(up){up.style.display='block';}
  if(upBar) upBar.style.width='0%';
  if(upPercent) upPercent.textContent='0%';
  if(upStatus) upStatus.innerHTML=ICO.spinner+'上传中…';
  // Update step indicator
  const s2 = $('step-2'), s3 = $('step-3');
  if(s2) { s2.classList.remove('active'); s2.classList.add('done'); }
  if(s3) s3.classList.add('active');
  let lastUpdate = 0;
  const maxRetries = 3;
  let retryCount = 0;
  function doUpload() {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API}/api/posts`);
    const token = getToken();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      const now = Date.now();
      if (now - lastUpdate < 200) return;
      lastUpdate = now;
      const pct = Math.round((e.loaded / e.total) * 100);
      if(upBar) upBar.style.width = `${pct}%`;
      if(upPercent) upPercent.textContent = `${pct}%`;
    };
    xhr.onload = () => {
      if (xhr.status === 401) {
        localStorage.removeItem(TK); state.user = null; updateUI();
        toast(`${ICO.ban} 登录已过期，请重新登录`, 'error');
        if (state.view !== 'home') navigate('home'); showLogin();
        resetBtn(); return;
      }
      let r = null;
      try { r = JSON.parse(xhr.responseText); } catch {}
      if (xhr.status >= 200 && xhr.status < 300 && r?.id) {
        resetBtn();
        toast('上传成功！', 'success');
        if (_subtitle) {
          uploadSubtitleAfterCreate(r.id);
        } else {
          navigate('post', r.id);
        }
      } else {
        handleError(r);
      }
    };
    xhr.onerror = () => handleError(null);
    xhr.send(fd);
  }
  function handleError(r) {
    if (retryCount < maxRetries) {
      retryCount++;
      if(upStatus) upStatus.textContent = `上传失败，重试中 (${retryCount}/${maxRetries})…`;
      setTimeout(doUpload, 1000);
    } else {
      resetBtn();
      toast(r?.detail || '上传失败', 'error');
      // Reset step indicator
      const s2 = $('step-2'), s3 = $('step-3');
      if(s2) { s2.classList.add('active'); s2.classList.remove('done'); }
      if(s3) s3.classList.remove('active');
    }
  }
  function resetBtn() {
    if(btn){btn.disabled=false;btn.innerHTML=ICO.upload+'上传发布'}
    if(up){setTimeout(()=>{up.style.display='none';}, 1000);}
  }
  function uploadSubtitleAfterCreate(postId) {
    const sfd = new FormData();
    sfd.append('file', _subtitle);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API}/api/posts/${postId}/subtitles`);
    const token = getToken();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.onload = () => {
      navigate('post', postId);
    };
    xhr.onerror = () => { navigate('post', postId); };
    xhr.send(sfd);
  }
  doUpload();
}

let _editCover = null, _editSubtitle = null;

async function renderEdit() {
  if(!state.user){showLogin();return;}
  const pid = state.postId;
  const p = await api(`/api/posts/${pid}`);
  if(!p){navigate('home');return;}
  const isAdmin = state.user.role === 'admin';
  const isOwner = p.user && p.user.id === state.user.id;
  if(!isAdmin && !isOwner){navigate('home');toast(`${ICO.ban} 无权限编辑`,'error');return;}
  _editCover = null;
  _editSubtitle = null;
  _selCat = p.category_id || null;
  const cats = await api('/api/categories')||[];
  const con = $('content');
  const cover = p.cover_image?`${API}/${p.cover_image}`:'';
  const isV = p.file_type === 'video';
  con.innerHTML = `<button class="back" onclick="navigate('post',${pid})">${ICO.back} 返回</button>
    <div class="page-header">
      <div>
        <h1>编辑内容</h1>
        <div class="sub">修改标题、描述、分类或封面</div>
      </div>
    </div>
    <div class="upload-form">
      <div id="ds">
        <div class="form-group">
          <label>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 3.5h8M7 3v8M5 11h4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
            标题
          </label>
          <input id="etitle" value="${esc(p.title)}" placeholder="给你的 ASMR 取个名字..." maxlength="100">
        </div>
        <div class="form-group">
          <label>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 3.5h9M2.5 7h9M2.5 10.5h6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
            描述
          </label>
          <textarea id="edesc" placeholder="简单描述一下这个内容..." maxlength="500">${esc(p.description||'')}</textarea>
        </div>
        <div class="form-group">
          <label>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 4.5l5-2.5 5 2.5v5l-5 2.5L2 9.5v-5z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M2 4.5l5 2.5 5-2.5M7 7v5.5" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>
            分类
          </label>
          <div class="cat-picker" id="ecat-picker">${cats.map(c=>`<div class="cat-option ${_selCat===c.id?'selected':''}" role="button" tabindex="0" data-id="${c.id}" onclick="selectEditCat(${c.id})"><div class="cg-icon">${c.icon}</div>${esc(c.name)}</div>`).join('')}</div>
        </div>
        <div class="form-group">
          <label>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 3.5h3l1.5 2H12v6H2v-8z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>
            标签（逗号分隔）
          </label>
          <div class="tag-input-wrap">
            <input id="etags" value="${esc((p.tags||[]).map(t=>t.name).join(', '))}" placeholder="例如：助眠, 雨声, 放松" oninput="onTagInput(this,'etag-suggest')" onblur="setTimeout(()=>{const s=$('etag-suggest');if(s)s.style.display='none'},200)" autocomplete="off">
            <div id="etag-suggest" class="tag-suggest"></div>
          </div>
          <div class="form-hint">多个标签用英文或中文逗号分隔</div>
        </div>
        <div class="form-group">
          <label>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1.5" y="2.5" width="11" height="9" rx="1.5" stroke="currentColor" stroke-width="1.4"/><path d="M4 5.5l3 2 3-2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
            封面图片${cover?'':'（可选，不更换则留空）'}
          </label>
          ${cover?`<div><img id="e-cover-img" src="${cover}" class="cover-preview-img"></div>`:''}
          <button class="btn btn-secondary" onclick="$('eci').click()">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1.5" y="2.5" width="11" height="9" rx="1.5" stroke="currentColor" stroke-width="1.4"/><circle cx="5" cy="6" r="1" fill="currentColor"/><path d="M2 9l3-2 3 2 4-3" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>
            ${cover?'更换封面':'选择封面'}
          </button>
          <input type="file" id="eci" accept="image/*" onchange="hec(event)" style="display:none">
          <div id="ecp" style="display:none;margin-top:10px">
            <div class="file-preview">
              <img id="ecpi">
              <div class="file-preview-info"><strong>新封面</strong><span id="ecp-name"></span></div>
              <button class="file-preview-remove" onclick="removeEditCover()" aria-label="移除">${ICO.cross}</button>
            </div>
          </div>
          ${isV?`<div class="form-inline-row">
            <input id="cover-time" type="number" min="0" step="0.1" placeholder="时间点（秒）" class="form-input">
            <button class="btn btn-secondary" onclick="genCoverFrame(${pid})">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1.5" y="3" width="8" height="8" rx="1" stroke="currentColor" stroke-width="1.4"/><path d="M9.5 6l3-1.5v5L9.5 8" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>
              生成封面
            </button>
          </div>`:''}
        </div>
        <div class="form-group">
          <label>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="2.5" width="10" height="9" rx="1" stroke="currentColor" stroke-width="1.4"/><path d="M4 6h6M4 8.5h4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
            字幕管理
          </label>
          <div id="sub-list"><div class="loading"><div class="spinner"><span></span><span></span><span></span><span></span><span></span></div></div></div>
          <div class="form-inline-row" style="margin-top:8px">
            <button class="btn btn-secondary" onclick="$('esi').click()">
              ${ICO.upload}
              上传字幕
            </button>
            <input type="file" id="esi" accept=".srt,.vtt" onchange="hes(event)" style="display:none">
            <span id="esn" class="form-hint" style="margin-top:0"></span>
          </div>
        </div>
        <div class="form-actions">
          <button class="btn btn-secondary" onclick="navigate('post',${pid})">取消</button>
          <button class="btn btn-primary" onclick="submitEdit(${pid})">
            ${ICO.check}
            保存修改
          </button>
        </div>
      </div>
    </div>`;
  loadSubtitles(pid);
}

function selectEditCat(id) {
  _selCat = id;
  document.querySelectorAll('#ecat-picker .cat-option').forEach(el=>el.classList.toggle('selected',parseInt(el.dataset.id)===id));
}

function removeEditCover() {
  _editCover = null;
  const ecp = $('ecp'); if(ecp) ecp.style.display = 'none';
  $('eci').value = '';
}

function hec(e) {
  const f = e.target.files?.[0]; if(!f) return;
  _editCover = f; const r = new FileReader();
  r.onload = e => {
    $('ecp').style.display='block';
    $('ecpi').src=e.target.result;
    const en = $('ecp-name'); if(en) en.textContent = f.name;
  };
  r.readAsDataURL(f);
}
function hes(e) {
  const f = e.target.files?.[0]; if(!f) return;
  _editSubtitle = f;
  const esn = $('esn'); if(esn) esn.innerHTML = `${esc(f.name)} <span class="text3">· ${fs(f.size)}</span>`;
  uploadEditSubtitle();
}
async function loadSubtitles(pid) {
  const list = $('sub-list'); if(!list) return;
  const subs = await api(`/api/posts/${pid}/subtitles`) || [];
  if(!subs.length){
    list.innerHTML = '<div class="sub-empty">暂无字幕</div>';
    return;
  }
  list.innerHTML = subs.map(s => `
    <div class="sub-list-item">
      <span class="sub-info">${ICO.chat} ${esc(s.language || '字幕')} · ${esc(s.filename || '')}</span>
      <button class="btn btn-ghost btn-icon" onclick="deleteSubtitle(${s.id},${pid})" title="删除" aria-label="删除字幕">${ICO.trash}</button>
    </div>
  `).join('');
}
async function uploadEditSubtitle() {
  if(!_editSubtitle || !state.postId) return;
  const pid = state.postId;
  const fd = new FormData();
  fd.append('file', _editSubtitle);
  const r = await api(`/api/posts/${pid}/subtitles`, { method:'POST', body:fd });
  if(r?.id || r?.ok) {
    toast('字幕上传成功', 'success');
    _editSubtitle = null;
    const esn = $('esn'); if(esn) esn.textContent = '';
    loadSubtitles(pid);
  } else {
    toast(r?.detail || '上传失败', 'error');
  }
}
async function deleteSubtitle(id, pid) {
  if(!confirm('确定删除这个字幕吗？')) return;
  const r = await api(`/api/subtitles/${id}`, { method:'DELETE' });
  if(r?.ok) {
    toast('已删除', 'success');
    loadSubtitles(pid);
  } else {
    toast(r?.detail || '删除失败', 'error');
  }
}
async function genCoverFrame(pid) {
  const t = parseFloat($('cover-time')?.value);
  if(isNaN(t) || t < 0) { toast('请输入有效的时间点（秒）', 'error'); return; }
  const btn = event?.target;
  if(btn){btn.disabled=true;btn.innerHTML=ICO.hourglass+' 生成中…'}
  const r = await api(`/api/posts/${pid}/cover-frame?time=${t}`, { method:'POST' });
  if(btn){btn.disabled=false;btn.textContent='生成封面'}
  if(r?.ok) {
    toast('封面已生成', 'success');
    const img = $('e-cover-img');
    if(img){
      const ts = Date.now();
      const src = img.src.split('?')[0];
      img.src = `${src}?t=${ts}`;
    }
  } else {
    toast(r?.detail || '生成失败', 'error');
  }
}

async function submitEdit(id) {
  const title = $('etitle')?.value.trim();
  if(!title) { toast('请输入标题', 'error'); return; }
  if(!_selCat) { toast('请选择分类', 'error'); return; }
  const tagStr = ($('etags')?.value||'').trim();
  const tagList = tagStr ? tagStr.split(/[,，]/).map(t=>t.trim()).filter(t=>t) : [];
  const fd = new FormData();
  fd.append('title', title);
  fd.append('description', ($('edesc')?.value||'').trim());
  fd.append('category_id', _selCat);
  if (tagList.length) fd.append('tags', JSON.stringify(tagList));
  if(_editCover) fd.append('cover', _editCover);
  const btn = qs('.btn-primary'); if(btn){btn.disabled=true;btn.innerHTML=ICO.spinner+'保存中…'}
  const r = await api(`/api/posts/${id}`, { method:'PUT', body:fd });
  if(btn){btn.disabled=false;btn.innerHTML=ICO.check+'保存修改'}
  if(r?.ok) { toast('保存成功！', 'success'); navigate('post', id); }
  else toast(r?.detail||'保存失败','error');
}

// ─── Settings ───
function renderSettings() {
  if(!state.user) { showLogin(); return; }
  const savedTheme = localStorage.getItem(TT);
  $('content').innerHTML = `<button class="back" onclick="navigate()">${ICO.back} 返回</button>
    <div class="page-header"><h1>${ICO.gear} 设置</h1></div>
    <div class="settings-card">
      <h2>${ICO.user} 账号信息</h2>
      <div class="form-group"><label>用户名</label><input value="${esc(state.user.username)}" disabled class="form-input" style="opacity:.6"></div>
      <hr class="settings-divider">
      <h2>${ICO.key} 修改密码</h2>
      <div class="form-group"><label>原密码</label><input type="password" id="op" placeholder="输入当前密码" autocomplete="current-password" class="form-input"></div>
      <div class="form-group"><label>新密码</label><input type="password" id="np" placeholder="输入新密码（至少8位，含字母和数字）" autocomplete="new-password" class="form-input"></div>
      <div class="form-group"><label>确认新密码</label><input type="password" id="cp2" placeholder="再次输入新密码" autocomplete="new-password" class="form-input"></div>
      <div class="form-actions" style="border:none;padding:0;margin-top:8px"><button class="btn btn-primary" onclick="changePw()">${ICO.save} 保存修改</button></div>
      <hr class="settings-divider">
      <h2>${ICO.palette} 主题设置</h2>
      <div class="form-group"><label>界面主题</label>
        <div class="selector-group">
          <button class="btn ${!savedTheme?'btn-primary':'btn-secondary'}" onclick="resetTheme()">${ICO.refresh} 跟随系统</button>
          <button class="btn ${savedTheme==='dark'?'btn-primary':'btn-secondary'}" onclick="setTheme('dark')">${ICO.moon} 黑夜</button>
          <button class="btn ${savedTheme==='light'?'btn-primary':'btn-secondary'}" onclick="setTheme('light')">${ICO.sun} 白天</button>
        </div>
        <div class="selector-hint">当前：${!savedTheme ? '跟随系统 ('+getSystemTheme()+')' : savedTheme==='dark'?'黑夜':'白天'}</div>
      </div>
      <div class="form-group"><label>强调色</label>
        <div class="selector-group">
          <button class="btn ${(localStorage.getItem(TA)||'purple')==='purple'?'btn-primary':'btn-secondary'} accent-btn" style="--accent-color:#a78bfa" onclick="setAccent('purple')">紫色</button>
          <button class="btn ${localStorage.getItem(TA)==='blue'?'btn-primary':'btn-secondary'} accent-btn" style="--accent-color:#3b82f6" onclick="setAccent('blue')">蓝色</button>
          <button class="btn ${localStorage.getItem(TA)==='green'?'btn-primary':'btn-secondary'} accent-btn" style="--accent-color:#10b981" onclick="setAccent('green')">绿色</button>
          <button class="btn ${localStorage.getItem(TA)==='warm'?'btn-primary':'btn-secondary'} accent-btn" style="--accent-color:#f97316" onclick="setAccent('warm')">暖橙</button>
        </div>
      </div>
      <hr class="settings-divider">
      <h2>${ICO.box} 数据导出</h2>
      <div class="form-group">
        <p class="form-hint" style="margin:0 0 8px">导出你的所有数据（收藏、历史、歌单等）为 ZIP 文件</p>
        <button class="btn btn-secondary" onclick="exportMyData()">${ICO.box} 导出我的数据</button>
      </div>
    </div>`;
}


async function changePw() {
  const op=$('op')?.value, np=$('np')?.value, cp=$('cp2')?.value;
  if(!op||!np||!cp){toast('请填写完整','error');return;}
  if(np!==cp){toast('两次新密码不一致','error');return;}
  if(np.length<8){toast('新密码至少8位，需含字母和数字','error');return;}
  if(!/[a-zA-Z]/.test(np)||!/\d/.test(np)){toast('密码必须包含字母和数字','error');return;}
  const r = await api('/api/change-password',{method:'POST',body:JSON.stringify({old_password:op,new_password:np})});
  if(r?.ok){toast('密码修改成功','success');$('op').value='';$('np').value='';$('cp2').value='';}
  else toast(r?.detail||'修改失败','error');
}

async function exportMyData() {
  const token = getToken();
  const r = await fetch(`${API}/api/me/export`, { headers: { Authorization: `Bearer ${token}` }});
  if (!r.ok) { toast('导出失败', 'error'); return; }
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `murmur-export-${Date.now()}.zip`;
  a.click();
  URL.revokeObjectURL(url);
  toast('数据已导出', 'success');
}

let _favCat = null, _favSort = 'time', _favSearch = '', _favPage = 1;

async function renderFavorites() {
  if(!state.user){showLogin();return;}
  const cats = await api('/api/categories')||[];
  const con = $('content');
  con.innerHTML = `<button class="back" onclick="navigate()">${ICO.back} 返回</button>
    <div class="page-header">
      <div><h1>${ICO.heartO} 我的收藏</h1><div class="sub">你收藏的所有内容</div></div>
    </div>
    <div class="search-bar">
      <svg class="search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.6"/><path d="M11 11l3 3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
      <input id="fav-si" placeholder="搜索收藏..." value="${esc(_favSearch)}" onkeydown="if(event.key==='Enter'){_favSearch=this.value;_favPage=1;renderFavorites()}">
      <button onclick="_favSearch=$('fav-si').value;_favPage=1;renderFavorites()" aria-label="搜索"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.6"/><path d="M11 11l3 3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>
    </div>
    <div class="fav-toolbar">
      <div class="fav-cats">
        <button class="pill ${!_favCat?'active':''}" onclick="_favCat=null;_favPage=1;renderFavorites()">全部</button>
        ${cats.map(c=>`<button class="pill ${_favCat===c.id?'active':''}" onclick="_favCat=${c.id};_favPage=1;renderFavorites()">${c.icon} ${c.name}</button>`).join('')}
      </div>
      <div class="fav-sort">
        <button class="pill ${_favSort==='time'?'active':''}" onclick="_favSort='time';_favPage=1;renderFavorites()">最近收藏</button>
        <button class="pill ${_favSort==='latest'?'active':''}" onclick="_favSort='latest';_favPage=1;renderFavorites()">最新发布</button>
        <button class="pill ${_favSort==='popular'?'active':''}" onclick="_favSort='popular';_favPage=1;renderFavorites()">最热</button>
      </div>
    </div>
    <div id="fav-posts"><div class="loading"><div class="spinner"><span></span><span></span><span></span><span></span><span></span></div></div></div>`;
  await loadFavPosts();
}

async function loadFavPosts() {
  const con = $('fav-posts'); if(!con) return;
  let url = `/api/me/favorites?page=${_favPage}&sort=${_favSort}`;
  if(_favCat) url+=`&category_id=${_favCat}`;
  if(_favSearch) url+=`&search=${encodeURIComponent(_favSearch)}`;
  const data = await api(url);
  if(!data||!data.items||!data.items.length) {
    con.innerHTML = '<div class="empty"><div class="icon"><svg width="48" height="48" viewBox="0 0 48 48" fill="none"><path d="M24 40s-14-9-14-19A7.5 7.5 0 0 1 24 12a7.5 7.5 0 0 1 14 9C38 31 24 40 24 40z" stroke="currentColor" stroke-width="2" stroke-linejoin="round" opacity=".3"/></svg></div><p>还没有收藏内容</p></div>'; return; }
  const grid = document.createElement('div'); grid.className = 'grid';
  for(const p of data.items) {
    const post = p.post || p;
    const isV = post.file_type==='video', cv = post.cover_image?`${API}/${post.cover_image}`:'';
    const card = document.createElement('div'); card.className = 'card';
    card.style.animationDelay = `${grid.children.length * 0.05}s`;
    card.setAttribute('role', 'button'); card.setAttribute('tabindex', '0');
    card.onclick = () => { if(isV&&!state.user){showLogin();return;} navigate('post',post.id); };
    const favCount = post.favorite_count || 0;
    card.innerHTML = `<div class="cover">
      ${cv?`<img src="${cv}" alt="${esc(post.title)}" loading="lazy">`:`<span class="cover-placeholder">${isV?'<svg width="28" height="28" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="14" height="14" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M17 9l5-3v12l-5-3" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>':'<svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M4 9v6M8 5v14M12 7v10M16 9v6M20 10v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>'}</span>`}
      <div class="overlay" onclick="event.stopPropagation();playInMiniPlayer({id:${post.id},title:'${esc(post.title)}',file_type:'${post.file_type}',category:${post.category?`{icon:'${post.category.icon}',name:'${esc(post.category.name)}'}`:'null'}})"><div class="play"><svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path d="M6 4l11 6-11 6V4z"/></svg></div></div>
      <div class="badge-type">${isV?'<svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path d="M3 3l10 5-10 5V3z"/></svg> 视频':'<svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M5 3v10l8-5-8-5z" fill="currentColor"/></svg> 音频'}</div>
      ${post.duration>0?`<div class="dur">${dur(post.duration)}</div>`:''}
      <button class="fav-btn-card active" onclick="event.stopPropagation();toggleCardFavorite(this,${post.id})" title="取消收藏" aria-label="取消收藏"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.8"><path d="M12 21s-7-4.5-9.5-9C1 9 3 5 7 5c2 0 3.5 1 5 3 1.5-2 3-3 5-3 4 0 6 4 4.5 7C19 16.5 12 21 12 21z"/></svg></button>
    </div><div class="info">
      <h3>${esc(post.title)}</h3>
      <div class="meta">
        <span><svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" stroke-width="1.3"/><circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.3"/></svg> ${formatViews(post.views)}</span>
        <span><svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M8 14s-5-3-6.5-6C0 6 1.5 3 4 3c1.5 0 2.5.8 4 2 1.5-1.2 2.5-2 4-2 2.5 0 4 3 2.5 5C13 11 8 14 8 14z" stroke="currentColor" stroke-width="1.3"/></svg> ${favCount}</span>
        <span><svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M2 4h12v8H6l-3 2v-2H2V4z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg> ${post.comment_count||0}</span>
      </div>
      <div class="card-tags">
        ${post.category?`<span class="tag">${post.category.icon} ${esc(post.category.name)}</span>`:''}
        ${(post.tags||[]).slice(0,2).map(t=>`<button class="tag tag-btn" onclick="event.stopPropagation();navigate('tag-posts',{tagId:${t.id}})" aria-label="查看标签 ${esc(t.name)}">#${esc(t.name)}</button>`).join('')}
        <button class="queue-add-btn" onclick="event.stopPropagation();addToQueue({id:${post.id},title:'${esc(post.title)}',file_type:'${post.file_type}',duration:${post.duration||0}})" aria-label="添加到播放队列"><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 2v8M2 6h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button>
      </div>
    </div>`;
    grid.appendChild(card);
  }
  con.innerHTML = ''; con.appendChild(grid);
  if(data.total_pages>1) {
    const pg = document.createElement('div'); pg.className = 'pagination';
    if(data.page>1) pg.innerHTML+=`<button class="btn btn-secondary" onclick="_favPage=${data.page-1};loadFavPosts()">上一页</button>`;
    if(data.page<data.total_pages) pg.innerHTML+=`<button class="btn btn-secondary" onclick="_favPage=${data.page+1};loadFavPosts()">下一页</button>`;
    con.appendChild(pg);
  }
}

let _histCat = null, _histPage = 1;

async function renderHistory() {
  if(!state.user){showLogin();return;}
  const cats = await api('/api/categories')||[];
  const con = $('content');
  con.innerHTML = `<button class="back" onclick="navigate()">${ICO.back} 返回</button>
    <div class="page-header">
      <div><h1>${ICO.clock} 播放历史</h1><div class="sub">你看过的所有内容</div></div>
      <button class="btn btn-secondary btn-danger" onclick="clearAllHistory()">${ICO.trash} 清空全部</button>
    </div>
    <div class="fav-toolbar">
      <div class="fav-cats">
        <button class="pill ${!_histCat?'active':''}" onclick="_histCat=null;_histPage=1;renderHistory()">全部</button>
        ${cats.map(c=>`<button class="pill ${_histCat===c.id?'active':''}" onclick="_histCat=${c.id};_histPage=1;renderHistory()">${c.icon} ${c.name}</button>`).join('')}
      </div>
    </div>
    <div id="hist-list"><div class="loading"><div class="spinner"><span></span><span></span><span></span><span></span><span></span></div></div></div>`;
  await loadHistory();
}

async function loadHistory() {
  const con = $('hist-list'); if(!con) return;
  let url = `/api/me/history?page=${_histPage}`;
  if(_histCat) url+=`&category_id=${_histCat}`;
  const data = await api(url);
  if(!data||!data.items||!data.items.length) {
    con.innerHTML = '<div class="empty"><div class="icon"><svg width="48" height="48" viewBox="0 0 48 48" fill="none" opacity=".3"><circle cx="24" cy="24" r="18" stroke="currentColor" stroke-width="2.5"/><path d="M24 14v10l7 7" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div><p>还没有播放历史</p></div>'; return;
  }
  let html = '<div class="hist-list">';
  for(const h of data.items) {
    const post = h.post || h;
    const isV = post.file_type==='video';
    const cv = post.cover_image?`${API}/${post.cover_image}`:'';
    const pos = h.position || 0;
    const dur2 = h.duration || post.duration || 0;
    const pct = dur2 > 0 ? Math.min(100, (pos/dur2)*100) : 0;
    html += `<div class="hist-card" role="button" tabindex="0" onclick="playFromHistory(${post.id})">
      <div class="hist-cover">
        ${cv?`<img src="${cv}" alt="${esc(post.title)}" loading="lazy">`:`<span class="cover-placeholder">${isV?'<svg width="28" height="28" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="14" height="14" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M17 9l5-3v12l-5-3" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>':'<svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M4 9v6M8 5v14M12 7v10M16 9v6M20 10v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>'}</span>`}
        <div class="hist-badge">${isV?'<svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path d="M3 3l10 5-10 5V3z"/></svg> 视频':'<svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M5 3v10l8-5-8-5z" fill="currentColor"/></svg> 音频'}</div>
        <div class="hist-progress"><div class="hist-progress-fill" style="width:${pct}%"></div></div>
      </div>
      <div class="hist-info">
        <h3>${esc(post.title)}</h3>
        <div class="hist-meta">
          ${post.category?`<span class="tag">${post.category.icon} ${esc(post.category.name)}</span>`:''}
          <span class="hist-time">${dur(pos)} / ${dur(dur2)}</span>
        </div>
        <div class="hist-bottom">
          <span class="hist-date">${dt(h.played_at)}</span>
          <button class="btn btn-ghost btn-icon hist-del" onclick="event.stopPropagation();deleteHistoryItem(${h.id})" title="删除" aria-label="删除历史记录"><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 5h10M6 5V3h4v2M5 5l1 9h4l1-9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        </div>
      </div>
    </div>`;
  }
  html += '</div>';
  if(data.total_pages>1) {
    html += `<div class="pagination">`;
    if(data.page>1) html += `<button class="btn btn-secondary" onclick="_histPage=${data.page-1};loadHistory()">上一页</button>`;
    if(data.page<data.total_pages) html += `<button class="btn btn-secondary" onclick="_histPage=${data.page+1};loadHistory()">下一页</button>`;
    html += '</div>';
  }
  con.innerHTML = html;
}

async function playFromHistory(id) {
  navigate('post', id);
}

async function deleteHistoryItem(id) {
  if(!confirm('确定删除这条历史记录吗？')) return;
  const r = await api(`/api/me/history/${id}`,{method:'DELETE'});
  if(r?.ok){toast('已删除','success');loadHistory();}
  else toast(r?.detail||'删除失败','error');
}

async function clearAllHistory() {
  if(!confirm('确定清空所有播放历史吗？此操作不可撤销。')) return;
  const r = await api('/api/me/history',{method:'DELETE'});
  if(r?.ok){toast('已清空历史','success');renderHistory();}
  else toast(r?.detail||'操作失败','error');
}

// ─── Admin ───
let _adminCat = null;

function adminTabs(active) {
  if(!state.user || state.user.role !== 'admin') return '';
  const tabs = [
    {key:'dashboard', icon:ICO.chart, label:'数据看板', view:'admin-dashboard'},
    {key:'content',   icon:ICO.box, label:'内容管理', view:'admin'},
    {key:'transcode', icon:ICO.film, label:'转码队列', view:'admin-transcode'},
    {key:'reports',   icon:ICO.flag, label:'举报队列', view:'admin-reports'},
    {key:'users',     icon:ICO.users, label:'用户管理', view:'admin-users'},
    {key:'settings',  icon:ICO.gear, label:'系统设置', view:'admin-settings'},
  ];
  return `<div class="admin-tabs">${tabs.map(t=>`<button class="admin-tab ${active===t.key?'active':''}" onclick="navigate('${t.view}')">${t.icon} ${t.label}</button>`).join('')}</div>`;
}

function showManualAddForm() {
  if (qs('.manual-add-modal')) return;
  api('/api/categories').then(cats => {
    const o = document.createElement('div'); o.className = 'auth-modal manual-add-modal';
    o.innerHTML = `<div class="auth-box" style="max-width:540px">
      <h2>${ICO.plus} 手动添加内容</h2>
      <p style="font-size:.8rem;color:var(--text3);margin-bottom:16px">
        适用于已直接上传到 R2/S3 的大文件，跳过服务器上传和转码
      </p>
      <div class="input-group"><label>标题 *</label>
        <input id="ma-title" class="form-input" placeholder="内容标题"></div>
      <div class="input-group"><label>描述</label>
        <textarea id="ma-desc" class="form-input" style="min-height:60px" placeholder="内容描述（可选）"></textarea></div>
      <div class="input-group"><label>分类 *</label>
        <select id="ma-category" class="form-select">
          ${cats.map(c=>`<option value="${c.id}">${c.icon} ${c.name}</option>`).join('')}
        </select></div>
      <div class="input-group"><label>标签（逗号分隔）</label>
        <input id="ma-tags" class="form-input" placeholder="如: 白噪音, 自然, 雨声"></div>
      <div class="input-group"><label>文件类型 *</label>
        <select id="ma-type" class="form-select">
          <option value="audio">音频</option>
          <option value="video">视频</option>
        </select></div>
      <div class="input-group"><label>R2 文件路径 *</label>
        <div style="display:flex;gap:6px">
          <input id="ma-key" class="form-input" style="flex:1" placeholder="如: audio/myfile.mp3">
          <button type="button" class="btn btn-secondary" onclick="showStorageBrowser('file')" style="white-space:nowrap">浏览</button>
        </div></div>
      <div class="input-group"><label>封面路径（可选）</label>
        <div style="display:flex;gap:6px">
          <input id="ma-cover" class="form-input" style="flex:1" placeholder="如: covers/thumb.jpg">
          <button type="button" class="btn btn-secondary" onclick="showStorageBrowser('cover')" style="white-space:nowrap">浏览</button>
        </div></div>
      <div class="input-group" style="display:flex;gap:8px">
        <div style="flex:1"><label>时长（秒，可选）</label>
          <input id="ma-duration" class="form-input" type="number" min="0" step="1" placeholder="0"></div>
        <div style="flex:1"><label>文件大小（字节，可选）</label>
          <input id="ma-size" class="form-input" type="number" min="0" step="1" placeholder="0"></div>
      </div>
      <div class="auth-actions">
        <button class="btn btn-secondary" onclick="this.closest('.auth-modal').remove()">取消</button>
        <button class="btn btn-primary" onclick="submitManualAdd()">保存</button>
      </div>
    </div>`;
    document.body.appendChild(o);
  });
}

async function submitManualAdd() {
  const btn = qs('.manual-add-modal .btn-primary');
  if (btn) { btn.disabled = true; btn.innerHTML = ICO.hourglass+' 保存中…'; }
  try {
    const data = new FormData();
    data.append('title', $('ma-title').value.trim());
    data.append('description', $('ma-desc').value.trim());
    data.append('category_id', $('ma-category').value);
    data.append('tags', $('ma-tags').value.trim());
    data.append('file_type', $('ma-type').value);
    data.append('r2_key', $('ma-key').value.trim());
    data.append('cover_key', $('ma-cover').value.trim());
    data.append('duration', parseFloat($('ma-duration').value) || 0);
    data.append('file_size', parseInt($('ma-size').value) || 0);
    if (!data.get('title')) { toast('请输入标题', 'error'); if(btn){btn.disabled=false;btn.textContent='保存'} return; }
    if (!data.get('r2_key')) { toast('请选择或输入 R2 文件路径', 'error'); if(btn){btn.disabled=false;btn.textContent='保存'} return; }
    const r = await api('/api/admin/posts/manual', { method: 'POST', body: data });
    if (r?.id) {
      toast('内容已添加！', 'success');
      qs('.manual-add-modal')?.remove();
      renderAdmin();
    } else {
      toast(r?.detail || '添加失败', 'error');
    }
  } catch (e) {
    toast('添加失败: ' + (e.message || e), 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '保存'; }
  }
}

/* ─── R2 File Browser ─── */
let _sbPrefix = '';
let _sbTarget = 'file';  // 'file' or 'cover'

function showStorageBrowser(target) {
  if (qs('.storage-browser-modal')) return;
  _sbPrefix = '';
  _sbTarget = target;
  renderStorageBrowser();
}

function formatSize(bytes) {
  if (!bytes || bytes === 0) return '—';
  const u = ['B','KB','MB','GB','TB'];
  let i = 0;
  let s = bytes;
  while (s >= 1024 && i < u.length - 1) { s /= 1024; i++; }
  return s.toFixed(1) + ' ' + u[i];
}

async function renderStorageBrowser() {
  let container = qs('.storage-browser-modal');
  const loading = '<div class="loading"><div class="spinner"><span></span><span></span><span></span><span></span><span></span></div></div>';
  if (!container) {
    const o = document.createElement('div'); o.className = 'auth-modal storage-browser-modal';
    o.innerHTML = `<div class="auth-box" style="max-width:700px;min-height:400px">
      <h2>浏览 R2 文件</h2>
      <div id="sb-breadcrumb" style="font-size:.82rem;margin-bottom:10px;color:var(--text3)"></div>
      <div id="sb-content" style="max-height:400px;overflow-y:auto">${loading}</div>
      <div class="auth-actions" style="margin-top:12px">
        <button class="btn btn-secondary" onclick="this.closest('.auth-modal').remove()">取消</button>
      </div>
    </div>`;
    document.body.appendChild(o);
    container = o;
  }
  $('sb-content').innerHTML = loading;
  try {
    const data = await api(`/api/admin/storage/list?prefix=${encodeURIComponent(_sbPrefix)}&max_keys=200`);
    renderSbContent(data);
  } catch (e) {
    $('sb-content').innerHTML = `<div style="padding:20px;text-align:center;color:var(--text3)">加载失败: ${e.message || e}</div>`;
  }
}

function renderSbContent(data) {
  const isFileTarget = _sbTarget === 'file';
  const extFilter = isFileTarget ? null : ['.jpg','.jpeg','.png','.gif','.webp'];

  // Breadcrumb
  const parts = _sbPrefix ? _sbPrefix.replace(/\/$/, '').split('/') : [];
  let bcHtml = '<a href="#" onclick="event.preventDefault();navigateSb(\'\')">'+ICO.box+' 根目录</a>';
  let cum = '';
  for (const p of parts) {
    cum += p + '/';
    bcHtml += ` / <a href="#" onclick="event.preventDefault();navigateSb('${cum}')">${p}</a>`;
  }
  $('sb-breadcrumb').innerHTML = bcHtml;

  let html = '';
  // Directories
  for (const d of (data.dirs || [])) {
    const name = d.replace(_sbPrefix, '').replace(/\/$/, '');
    html += `<div class="sb-item sb-dir" onclick="navigateSb('${d}')">
      <span style="margin-right:8px;display:inline-flex;align-items:center">${ICO.folder}</span>
      <span>${name}/</span>
    </div>`;
  }
  // Files
  const files = (data.files || []).filter(f => {
    if (extFilter) {
      const ext = f.key.toLowerCase().slice(f.key.lastIndexOf('.'));
      return extFilter.includes(ext);
    }
    return true;
  });
  for (const f of files) {
    const name = f.key.replace(_sbPrefix, '');
    const icon = isFileTarget ? (f.key.match(/\.(mp4|webm|mov|mkv)$/i) ? ICO.film : ICO.audio) : '';
    html += `<div class="sb-item sb-file" onclick="selectSbFile('${f.key.replace(/'/g, "\\'")}')">
      <span style="font-size:1rem;margin-right:8px">${icon}</span>
      <span style="flex:1">${name}</span>
      <span style="font-size:.78rem;color:var(--text3);margin-left:8px">${formatSize(f.size)}</span>
    </div>`;
  }
  if (!html) {
    html = '<div style="padding:30px;text-align:center;color:var(--text3)">'+ICO.doc+' 这个目录是空的</div>';
  }
  $('sb-content').innerHTML = html;
}

function navigateSb(prefix) {
  _sbPrefix = prefix;
  renderStorageBrowser();
}

function selectSbFile(key) {
  const inputId = _sbTarget === 'cover' ? 'ma-cover' : 'ma-key';
  const el = $(inputId);
  if (el) el.value = key;
  // Auto-detect file type from extension
  if (_sbTarget === 'file') {
    const typeSel = $('ma-type');
    if (typeSel) {
      const ext = key.toLowerCase().slice(key.lastIndexOf('.'));
      if (['.mp3','.wav','.flac','.m4a','.aac','.ogg'].includes(ext)) typeSel.value = 'audio';
      else if (['.mp4','.webm','.mov','.mkv'].includes(ext)) typeSel.value = 'video';
    }
  }
  // Close browser
  qs('.storage-browser-modal')?.remove();
  toast('已选择: ' + key.split('/').pop(), 'success');
}

async function renderAdmin() {
  if(!state.user){showLogin();return;}
  const isAdmin = state.user.role === 'admin';
  const isCreator = state.user.role === 'creator';
  if(!isAdmin && !isCreator){navigate('home');toast(`${ICO.ban} 无权限访问`,'error');return;}
  const con = $('content');
  con.innerHTML = `<button class="back" onclick="navigate()">${ICO.back} 返回</button>
    <div class="admin-hero">
      <h1>内容管理</h1>
      <div class="sub">${isAdmin?'管理所有上传的音频和视频':'管理我上传的内容'}</div>
    </div>
    ${adminTabs('content')}`;

  const cats = await api('/api/categories')||[];

  if(isAdmin){
    const stats = await api('/api/posts?page_size=1')||{};
    const total = stats.total||0;
    con.innerHTML += `<div class="kpi-grid" style="margin-bottom:18px">
      <div class="kpi-card">
        <div class="kpi-icon">${ICO.books}</div>
        <div class="kpi-label">全部内容</div>
        <div class="kpi-value">${total}</div>
      </div>
      ${cats.map(c=>`<div class="kpi-card">
        <div class="kpi-icon">${c.icon}</div>
        <div class="kpi-label">${esc(c.name)}</div>
        <div class="kpi-value" style="font-size:1.3rem">${c.post_count}</div>
      </div>`).join('')}
    </div>`;
  }

  con.innerHTML += `<div class="filter-chips">
    <button class="chip ${!_adminCat?'active':''}" onclick="_adminCat=null;renderAdmin()">全部</button>
    ${cats.map(c=>`<button class="chip ${_adminCat===c.id?'active':''}" onclick="_adminCat=${c.id};renderAdmin()">${c.icon} ${c.name}</button>`).join('')}
  </div>`;

  con.innerHTML += `<div class="admin-actions">
    ${isAdmin?`<button class="btn btn-primary" onclick="showManualAddForm()">${ICO.plus} 手动添加</button>`:''}
    <a href="${window.location.pathname}#upload" class="btn btn-secondary">${ICO.upload} 上传</a>
  </div>`;
  con.innerHTML += `<div id="admin-list"><div class="loading"><div class="spinner"><span></span><span></span><span></span><span></span><span></span></div></div></div>`;
  
  let url = `/api/posts?page_size=100&sort=latest`;
  if(_adminCat) url += `&category_id=${_adminCat}`;
  const data = await api(url);
  const list = $('admin-list');
  if(!data||!data.items||!data.items.length){
    list.innerHTML='<div class="empty-state"><div class="icon">'+ICO.box+'</div><p>还没有内容</p></div>';
  } else {
    let items = data.items;
    if(isCreator){
      items = items.filter(p => p.user && p.user.id === state.user.id);
    }
    if(!items.length){
      list.innerHTML='<div class="empty-state"><div class="icon">'+ICO.box+'</div><p>还没有内容</p></div>';
    } else {
      let html = '';
      for(const p of items){
        const isV = p.file_type==='video';
        const canEdit = isAdmin || (p.user && p.user.id === state.user.id);
        const statusBadge = p.status === 'processing' ? '<span class="badge badge-processing">'+ICO.hourglass+' 转码中</span>'
                          : p.status === 'failed' ? '<span class="badge badge-failed">转码失败</span>'
                          : '<span class="badge badge-ready">'+ICO.check+' 就绪</span>';
        html += `<div class="admin-row">
          <div class="row-icon">${isV?ICO.film:ICO.audio}</div>
          <div class="row-main">
            <div class="row-title">${esc(p.title)}</div>
            <div class="row-meta">
              <span>${p.category?p.category.icon+' '+esc(p.category.name):'—'}</span>
              <span>${ICO.eye} ${p.views||0}</span>
              <span>${ICO.heart} ${p.favorite_count||0}</span>
              <span>${ICO.calendar} ${(p.created_at||'').slice(0,10)}</span>
              ${statusBadge}
            </div>
          </div>
          <div class="row-actions">
            ${canEdit?`<button class="btn btn-secondary" onclick="editPost(${p.id})" style="padding:6px 12px;font-size:.8rem">${ICO.pencil}</button>`:''}
            ${canEdit?`<button class="btn btn-secondary" onclick="deletePost(${p.id})" style="padding:6px 12px;font-size:.8rem">${ICO.trash}</button>`:''}
          </div>
        </div>`;
      }
      list.innerHTML = html;
    }
  }
  
  if(isAdmin){
    con.innerHTML += `<div class="section-head"><h2>分类管理</h2></div>
      <div id="cat-mgr"><div class="loading"><div class="spinner"><span></span><span></span><span></span><span></span><span></span></div></div></div>`;
    
    const cats2 = await api('/api/categories')||[];
    let ch = `<div class="cat-grid">`;
    for(const c of cats2){
      ch += `<div class="admin-row" style="padding:10px 14px;margin-bottom:0">
        <span class="row-icon">${c.icon}</span>
        <div class="row-main">
          <div class="row-title">${esc(c.name)}</div>
          <div class="row-meta">${c.post_count} 个内容</div>
        </div>
        <div class="row-actions">
          <button class="btn btn-secondary" onclick="editCat(${c.id},'${esc(c.name)}','${c.icon}')" style="padding:5px 10px;font-size:.78rem">${ICO.pencil}</button>
          <button class="btn btn-secondary" onclick="deleteCat(${c.id})" style="padding:5px 10px;font-size:.78rem" ${c.post_count>0?'disabled':''}>${ICO.trash}</button>
        </div>
      </div>`;
    }
    ch += `</div>`;
    ch += `<div class="admin-card">
      <h2>${ICO.plus} 添加新分类</h2>
      <div class="admin-actions" style="margin-bottom:0">
        <input id="new-cat-icon" value="" class="form-input" style="width:60px;text-align:center;font-size:1.1rem;flex:0 0 auto" placeholder="图标">
        <input id="new-cat-name" placeholder="分类名称" class="form-input" style="min-width:120px">
        <button class="btn btn-primary" onclick="addCat()" style="flex:0 0 auto">添加</button>
      </div>
    </div>`;
    $('cat-mgr').innerHTML = ch;
  }
}

async function deleteItem(id) {
  if(!confirm('确定要删除这条内容吗？')) return;
  const r = await api(`/api/posts/${id}`,{method:'DELETE'});
  if(r?.ok){toast('已删除','success');renderAdmin();}
  else toast(r?.detail||'删除失败','error');
}

async function deletePost(id) {
  if(!confirm('确定要删除这条内容吗？')) return;
  const r = await api(`/api/posts/${id}`,{method:'DELETE'});
  if(r?.ok){toast('已删除','success');navigate('home');}
  else toast(r?.detail||'删除失败','error');
}

async function toggleFavorite(id) {
  if(!state.user){showLogin();return;}
  const btn = $('fav-btn');
  const countEl = $('fav-count');
  const wasFav = btn?.classList.contains('btn-primary');
  const newCount = wasFav ? (parseInt(countEl?.textContent||0)-1) : (parseInt(countEl?.textContent||0)+1);
  if(btn){
    btn.classList.toggle('btn-primary', !wasFav);
    btn.classList.toggle('btn-secondary', wasFav);
    btn.innerHTML = (!wasFav?ICO.heart:ICO.heartO) + `<span>${!wasFav?'已收藏':'收藏'}</span> <span id="fav-count">${Math.max(0,newCount)}</span>`;
  }
  const r = await api(`/api/posts/${id}/favorite`,{method:'POST'});
  if(r?.favorited !== undefined){
    if(btn){
      btn.classList.toggle('btn-primary', r.favorited);
      btn.classList.toggle('btn-secondary', !r.favorited);
      btn.innerHTML = (r.favorited?ICO.heart:ICO.heartO) + `<span>${r.favorited?'已收藏':'收藏'}</span> <span id="fav-count">${r.count||0}</span>`;
    }
  }
}

async function toggleCardFavorite(btn, id) {
  if(!state.user){showLogin();return;}
  const wasFav = btn.classList.contains('active');
  btn.classList.toggle('active', !wasFav);
  const svg = btn.querySelector('svg');
  if(svg) svg.setAttribute('fill', !wasFav ? 'currentColor' : 'none');
  const card = btn.closest('.card');
  const metaSpans = card?.querySelectorAll('.meta span');
  const favSpan = metaSpans?.[1]; // second span is favorites
  if(favSpan){
    const cur = parseInt(favSpan.textContent.replace(/[^0-9]/g,''))||0;
    favSpan.innerHTML = favSpan.innerHTML.replace(/\d+/, Math.max(0, wasFav?cur-1:cur+1));
  }
  const r = await api(`/api/posts/${id}/favorite`,{method:'POST'});
  if(r?.favorited !== undefined){
    btn.classList.toggle('active', r.favorited);
    if(svg) svg.setAttribute('fill', r.favorited ? 'currentColor' : 'none');
    if(favSpan){
      favSpan.innerHTML = favSpan.innerHTML.replace(/\d+/, r.count||0);
    }
  }
}

// ─── Mini Player (Global Audio) ───
let miniPlayer = {
  audio: null,
  currentPost: null,
  queue: [],
  queueIndex: -1,
  isPlaying: false,
};

function initMiniPlayer() {
  miniPlayer.audio = $('global-audio');
  if(!miniPlayer.audio) return;
  const mp = $('mini-player');
  const playBtn = $('mini-play');
  const prevBtn = $('mini-prev');
  const nextBtn = $('mini-next');
  const expandBtn = $('mini-expand');
  const progressTrack = $('mini-progress-track');

  miniPlayer.audio.addEventListener('play', () => {
    miniPlayer.isPlaying = true;
    updateMiniPlayIcon();
  });
  miniPlayer.audio.addEventListener('pause', () => {
    miniPlayer.isPlaying = false;
    updateMiniPlayIcon();
  });
  miniPlayer.audio.addEventListener('ended', () => {
    playNextInQueue();
  });
  miniPlayer.audio.addEventListener('timeupdate', () => {
    updateMiniProgress();
  });
  miniPlayer.audio.addEventListener('loadedmetadata', () => {
    updateMiniProgress();
  });

  playBtn?.addEventListener('click', toggleMiniPlay);
  prevBtn?.addEventListener('click', playPrevInQueue);
  nextBtn?.addEventListener('click', playNextInQueue);
  expandBtn?.addEventListener('click', () => {
    if(miniPlayer.currentPost) navigate('post', miniPlayer.currentPost.id);
  });
  progressTrack?.addEventListener('click', e => {
    if(!miniPlayer.audio.duration) return;
    const rect = progressTrack.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    miniPlayer.audio.currentTime = pct * miniPlayer.audio.duration;
  });

  // Info click navigates to post
  $('mini-player-info')?.addEventListener('click', () => {
    if(miniPlayer.currentPost) navigate('post', miniPlayer.currentPost.id);
  });
}

async function playInMiniPlayer(post) {
  if(!miniPlayer.audio) initMiniPlayer();
  if(!miniPlayer.audio) return;

  // Fetch full post data if we only have partial info
  let postData = post;
  if(!post.file_path) {
    postData = await api(`/api/posts/${post.id}`);
    if(!postData) return;
  }

  const isV = postData.file_type === 'video';
  if(isV && !state.user) { showLogin(); return; }

  miniPlayer.currentPost = postData;
  miniPlayer.audio.src = `${API}/${postData.file_path}`;
  miniPlayer.audio.play().catch(() => {});

  const mp = $('mini-player');
  if(mp) mp.hidden = false;

  // Update UI
  const titleEl = $('mini-player-title');
  const metaEl = $('mini-player-meta');
  const coverEl = $('mini-player-cover');
  if(titleEl) titleEl.textContent = postData.title;
  if(metaEl) metaEl.textContent = postData.category ? `${postData.category.icon} ${postData.category.name}` : (isV ? '视频' : '音频');
  if(coverEl) {
    if(postData.cover_image) {
      coverEl.innerHTML = `<img src="${API}/${postData.cover_image}" alt="">`;
    } else {
      coverEl.innerHTML = isV ? ICO.film : ICO.audio;
    }
  }
  updateMiniPlayIcon();

  // Record play
  if(state.user) {
    api(`/api/posts/${postData.id}/play`, { method: 'POST' }).catch(()=>{});
  }
}

function toggleMiniPlay() {
  if(!miniPlayer.audio || !miniPlayer.currentPost) return;
  if(miniPlayer.audio.paused) {
    miniPlayer.audio.play().catch(()=>{});
  } else {
    miniPlayer.audio.pause();
  }
}

function updateMiniPlayIcon() {
  const btn = $('mini-play');
  if(!btn) return;
  if(miniPlayer.isPlaying) {
    btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M5 3h4v14H5V3zm6 0h4v14h-4V3z"/></svg>`;
  } else {
    btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M5 3l12 7-12 7V3z"/></svg>`;
  }
}

function updateMiniProgress() {
  const fill = $('mini-progress-fill');
  const timeEl = $('mini-time');
  const cur = miniPlayer.audio.currentTime || 0;
  const dur = miniPlayer.audio.duration || 0;
  if(fill) fill.style.width = dur > 0 ? `${(cur/dur*100)}%` : '0%';
  if(timeEl) timeEl.textContent = `${dur2(cur)} / ${dur2(dur)}`;
}

function dur2(s) {
  if(!s || isNaN(s)) return '0:00';
  const m = Math.floor(s/60), sec = Math.floor(s%60);
  return `${m}:${sec.toString().padStart(2,'0')}`;
}

function setMiniQueue(items, startIndex = 0) {
  miniPlayer.queue = items;
  miniPlayer.queueIndex = startIndex;
}

function playNextInQueue() {
  if(miniPlayer.queue.length === 0) return;
  miniPlayer.queueIndex = (miniPlayer.queueIndex + 1) % miniPlayer.queue.length;
  playInMiniPlayer(miniPlayer.queue[miniPlayer.queueIndex]);
}

function playPrevInQueue() {
  if(miniPlayer.queue.length === 0) return;
  miniPlayer.queueIndex = (miniPlayer.queueIndex - 1 + miniPlayer.queue.length) % miniPlayer.queue.length;
  playInMiniPlayer(miniPlayer.queue[miniPlayer.queueIndex]);
}

async function addCat() {
  const name = $('new-cat-name')?.value.trim();
  const icon = $('new-cat-icon')?.value.trim();
  if(!name){toast('请输入分类名称','error');return;}
  const r = await api('/api/categories',{method:'POST',body:JSON.stringify({name,icon})});
  if(r?.id){toast('分类已添加','success');renderAdmin();}
  else toast(r?.detail||'添加失败','error');
}

let _editCatId = null;
function editCat(id, name, icon) {
  _editCatId = id;
  $('new-cat-name').value = name;
  $('new-cat-icon').value = icon;
  // Change add button to save button
  const actions = document.querySelector('#cat-mgr .btn-primary');
  if(actions) {
    actions.innerHTML = ICO.save+' 保存';
    actions.onclick = saveCat;
  }
}

async function saveCat() {
  if(!_editCatId) return;
  const name = $('new-cat-name')?.value.trim();
  const icon = $('new-cat-icon')?.value.trim();
  if(!name){toast('请输入分类名称','error');return;}
  const r = await api(`/api/categories/${_editCatId}`,{method:'PUT',body:JSON.stringify({name,icon})});
  if(r?.id){toast('分类已更新','success');_editCatId=null;renderAdmin();}
  else toast(r?.detail||'更新失败','error');
}

async function deleteCat(id) {
  if(!confirm('确定删除这个分类吗？')) return;
  const r = await api(`/api/categories/${id}`,{method:'DELETE'});
  if(r?.ok){toast('分类已删除','success');renderAdmin();}
  else toast(r?.detail||'删除失败','error');
}

// ─── Admin Dashboard (PRD-006) ───
let _dashRange = '7d';
let _dashMetric = 'new_posts';
let _dashDays = 30;

async function renderAdminDashboard() {
  if(!state.user || state.user.role !== 'admin'){navigate('home');toast(`${ICO.ban} 无权限`,'error');return;}
  const con = $('content');
  con.innerHTML = `<button class="back" onclick="navigate()">${ICO.back} 返回</button>
    <div class="admin-hero">
      <h1>${ICO.chart} 数据看板</h1>
      <div class="sub">站点运营数据总览 · 实时掌握平台动态</div>
      <div class="hero-stats" id="hero-stats"><span>载入中…</span></div>
    </div>
    ${adminTabs('dashboard')}
    <div id="dash-kpi"><div class="loading"><div class="spinner"><span></span><span></span><span></span><span></span><span></span></div></div></div>
    <div class="section-head">
      <h2>${ICO.trendUp} 趋势分析</h2>
      <div class="admin-filter-bar" style="margin:0">
        <select id="dash-metric" class="form-select" onchange="_dashMetric=this.value;loadDashChart()">
          <option value="new_posts">新增内容</option>
          <option value="new_users">新增用户</option>
          <option value="dau">DAU</option>
        </select>
        <select id="dash-days" class="form-select" onchange="_dashDays=parseInt(this.value);loadDashChart()">
          <option value="7">7天</option>
          <option value="30" selected>30天</option>
          <option value="90">90天</option>
        </select>
      </div>
    </div>
    <div id="dash-chart" class="chart-card"><div class="loading"><div class="spinner"><span></span><span></span><span></span><span></span><span></span></div></div></div>
    <div class="dash-grid">
      <div>
        <div class="section-head"><h2>${ICO.trophy} 热门内容 Top10</h2></div>
        <div id="dash-top" class="top-list"><div class="loading"><div class="spinner"><span></span><span></span><span></span><span></span><span></span></div></div></div>
      </div>
      <div>
        <div class="section-head"><h2>${ICO.folders} 分类分布</h2></div>
        <div id="dash-cat" class="admin-card"><div class="loading"><div class="spinner"><span></span><span></span><span></span><span></span><span></span></div></div></div>
      </div>
    </div>
    <div class="dash-grid">
      <div>
        <div class="section-head"><h2>${ICO.chart} 完播率 Top10</h2></div>
        <div id="dash-top-completion" class="top-list"><div class="loading"><div class="spinner"><span></span><span></span><span></span><span></span><span></span></div></div></div>
      </div>
      <div>
        <div class="section-head"><h2>${ICO.clock} 播放时长趋势</h2></div>
        <div id="dash-play-trend" class="chart-card"><div class="loading"><div class="spinner"><span></span><span></span><span></span><span></span><span></span></div></div></div>
      </div>
    </div>`;
  loadDashKpi();
  loadDashChart();
  loadDashTop();
  loadDashCat();
  loadDashTopCompletion();
  loadDashPlayTrend();
}

async function loadDashKpi() {
  const data = await api(`/api/admin/stats?range=${_dashRange}`)||{};
  // Update hero stats
  const heroEl = $('hero-stats');
  if (heroEl) {
    heroEl.innerHTML = `
      <span>${ICO.user} 总用户 <b>${data.total_users||0}</b></span>
      <span>${ICO.books} 总内容 <b>${data.total_posts||0}</b></span>
      <span>${ICO.play} 总播放 <b>${data.total_views||0}</b></span>
      <span>${ICO.users} 今日 DAU <b>${data.dau||0}</b></span>
    `;
  }
  const cards = [
    {label:'DAU',     value:data.dau||0,         icon:ICO.users},
    {label:'新增用户', value:data.new_users||0,   icon:ICO.sparkles},
    {label:'新增内容', value:data.new_posts||0,   icon:ICO.box},
    {label:'总用户',   value:data.total_users||0, icon:ICO.user},
    {label:'总内容',   value:data.total_posts||0, icon:ICO.books},
    {label:'总播放',   value:data.total_views||0, icon:ICO.play},
  ];
  $('dash-kpi').innerHTML = `<div class="kpi-grid">${cards.map(c=>`
    <div class="kpi-card">
      <div class="kpi-icon">${c.icon}</div>
      <div class="kpi-label">${c.label}</div>
      <div class="kpi-value">${c.value}</div>
    </div>`).join('')}</div>`;
}

async function loadDashChart() {
  const m = $('dash-metric'); if(m) m.value = _dashMetric;
  const d = $('dash-days'); if(d) d.value = String(_dashDays);
  const el = $('dash-chart');
  const data = await api(`/api/admin/stats/timeseries?metric=${_dashMetric}&days=${_dashDays}`)||{};
  const series = data.series||[];
  if(!series.length){el.innerHTML='<div class="empty-state"><div class="icon">'+ICO.doc+'</div><p>暂无数据</p></div>';return;}
  const max = Math.max(1, ...series.map(s=>s.value));
  const w = 100, h = 120;
  const points = series.map((s,i)=>`${(i/(series.length-1||1))*w},${h-(s.value/max)*h}`).join(' ');
  const total = series.reduce((a,s)=>a+s.value,0);
  el.innerHTML = `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width:100%;height:160px;display:block">
    <polyline points="${points}" fill="none" stroke="var(--accent)" stroke-width="0.8" stroke-linejoin="round" stroke-linecap="round"/>
  </svg>
  <div class="chart-footer">
    <span>${series[0].date}</span>
    <span>${series[series.length-1].date}</span>
  </div>
  <div class="chart-summary">峰值 ${max} · 合计 ${total}</div>`;
}

async function loadDashTop() {
  const data = await api('/api/admin/stats/top-posts?metric=views&limit=10')||{};
  const items = data.items||[];
  const el = $('dash-top');
  if(!items.length){el.innerHTML='<div class="empty-state"><div class="icon">'+ICO.doc+'</div><p>暂无内容</p></div>';return;}
  el.innerHTML = items.map((p,i)=>`
    <div class="top-item">
      <span class="rank ${i<3?'top3':''}">${i+1}</span>
      <div class="info">
        <div class="title">${esc(p.title)}</div>
        <div class="meta">
          <span>${p.category?p.category.icon+' '+esc(p.category.name):'—'}</span>
          <span>${ICO.eye} ${p.views}</span>
          <span>${ICO.heart} ${p.favorite_count}</span>
        </div>
      </div>
    </div>`).join('');
}

async function loadDashCat() {
  const data = await api('/api/admin/stats/category-distribution')||{};
  const items = data.items||[];
  const el = $('dash-cat');
  if(!items.length){el.innerHTML='<div class="empty-state"><div class="icon">'+ICO.doc+'</div><p>暂无分类</p></div>';return;}
  const total = Math.max(1, items.reduce((a,c)=>a+c.post_count,0));
  el.innerHTML = items.map(c=>`
    <div class="dist-row">
      <div class="dist-label">
        <span>${c.icon} ${esc(c.name)}</span>
        <span style="color:var(--text3)">${c.post_count} 个 · ${ICO.eye} ${c.view_sum}</span>
      </div>
      <div class="dist-bar"><div class="dist-fill" style="width:${(c.post_count/total)*100}%"></div></div>
    </div>`).join('');
}

async function loadDashTopCompletion() {
  const data = await api('/api/admin/stats/top-completion')||{};
  const items = data.items||[];
  const el = $('dash-top-completion');
  if(!items.length){el.innerHTML='<div class="empty-state"><div class="icon">'+ICO.doc+'</div><p>暂无数据</p></div>';return;}
  el.innerHTML = items.map((p,i)=>{
    const rate = p.avg_completion !== undefined ? p.avg_completion : (p.completion_rate !== undefined ? p.completion_rate : 0);
    const pct = (rate > 1 ? rate : rate * 100).toFixed(1);
    return `<div class="top-item">
      <span class="rank ${i<3?'top3':''}">${i+1}</span>
      <div class="info">
        <div class="title">${esc(p.title)}</div>
        <div class="meta">
          <span>${ICO.chart} ${pct}%</span>
          <span>${ICO.play} ${p.play_count||0}</span>
        </div>
      </div>
    </div>`;
  }).join('');
}

async function loadDashPlayTrend() {
  const el = $('dash-play-trend');
  if (!el) return;
  const data = await api('/api/admin/stats/play-time-trend')||{};
  const series = data.series||data.items||[];
  if(!series.length){el.innerHTML='<div class="empty-state"><div class="icon">'+ICO.doc+'</div><p>暂无数据</p></div>';return;}
  const max = Math.max(1, ...series.map(s=>(s.value||s.play_time||s.seconds||0)));
  const w = 100, h = 120;
  const points = series.map((s,i)=>`${(i/(series.length-1||1))*w},${h-((s.value||s.play_time||s.seconds||0)/max)*h}`).join(' ');
  const total = series.reduce((a,s)=>a+(s.value||s.play_time||s.seconds||0),0);
  el.innerHTML = `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width:100%;height:140px;display:block">
    <polyline points="${points}" fill="none" stroke="var(--accent)" stroke-width="0.8" stroke-linejoin="round" stroke-linecap="round"/>
  </svg>
  <div class="chart-footer">
    <span>${series[0].date||''}</span>
    <span>${series[series.length-1].date||''}</span>
  </div>
  <div class="chart-summary">总播放时长 ${fdp(total)}</div>`;
}

// ─── Admin Users (PRD-005) ───
let _userPage = 1;
let _userFilter = {search:'',role:'',status:''};

async function renderAdminUsers() {
  if(!state.user || state.user.role !== 'admin'){navigate('home');toast(`${ICO.ban} 无权限`,'error');return;}
  const con = $('content');
  con.innerHTML = `<button class="back" onclick="navigate()">${ICO.back} 返回</button>
    <div class="admin-hero">
      <h1>${ICO.users} 用户管理</h1>
      <div class="sub">管理用户角色与状态 · 控制平台访问权限</div>
    </div>
    ${adminTabs('users')}
    <div class="admin-filter-bar">
      <input id="user-search" class="form-input" placeholder="搜索用户名" value="${esc(_userFilter.search)}" onkeyup="if(event.key==='Enter'){_userFilter.search=this.value;_userPage=1;loadUserList()}">
      <select id="user-role" class="form-select" onchange="_userFilter.role=this.value;_userPage=1;loadUserList()">
        <option value="">全部角色</option>
        <option value="admin">管理员</option>
        <option value="creator">创作者</option>
        <option value="user">普通用户</option>
      </select>
      <select id="user-status" class="form-select" onchange="_userFilter.status=this.value;_userPage=1;loadUserList()">
        <option value="">全部状态</option>
        <option value="active">正常</option>
        <option value="banned">封禁</option>
      </select>
    </div>
    <div id="user-list"><div class="loading"><div class="spinner"><span></span><span></span><span></span><span></span><span></span></div></div></div>`;
  if(_userFilter.role) $('user-role').value = _userFilter.role;
  if(_userFilter.status) $('user-status').value = _userFilter.status;
  loadUserList();
}

async function loadUserList() {
  const params = new URLSearchParams({page:_userPage});
  if(_userFilter.search) params.set('search', _userFilter.search);
  if(_userFilter.role) params.set('role', _userFilter.role);
  if(_userFilter.status) params.set('status', _userFilter.status);
  const data = await api(`/api/admin/users?${params}`)||{};
  const el = $('user-list');
  const users = data.items||[];
  if(!users.length){el.innerHTML='<div class="empty-state"><div class="icon">'+ICO.user+'</div><p>没有用户</p></div>';return;}
  el.innerHTML = users.map(u=>{
    const roleBadge = u.role==='admin' ? '<span class="badge badge-admin">A 管理员</span>'
                    : u.role==='creator' ? '<span class="badge badge-creator">'+ICO.palette+' 创作者</span>'
                    : '<span class="badge badge-user">'+ICO.user+' 普通用户</span>';
    const statusBadge = u.status==='banned' ? '<span class="badge badge-banned">'+ICO.ban+' 封禁</span>' : '<span class="badge badge-active">'+ICO.check+' 正常</span>';
    return `<div class="admin-row">
      <div class="user-avatar">${u.role==='admin'?'A':u.role==='creator'?ICO.palette:ICO.user}</div>
      <div class="row-main">
        <div class="row-title">${esc(u.username)} ${u.id===state.user.id?'<span style="font-size:.7rem;color:var(--text3)">（你）</span>':''}</div>
        <div class="row-meta">
          ${roleBadge}
          ${statusBadge}
          <span>${ICO.box} ${u.post_count} 个内容</span>
          <span>${ICO.calendar} ${u.last_login_at?dt(u.last_login_at)+'登录':'未登录'}</span>
        </div>
      </div>
      <div class="row-actions">
        <select class="form-select" onchange="changeUserRole(${u.id},this.value)" style="width:auto;padding:5px 8px;font-size:.75rem" ${u.id===state.user.id?'disabled':''}>
          <option value="user" ${u.role==='user'?'selected':''}>普通</option>
          <option value="creator" ${u.role==='creator'?'selected':''}>创作者</option>
          <option value="admin" ${u.role==='admin'?'selected':''}>管理员</option>
        </select>
        <button class="btn btn-secondary" onclick="toggleUserStatus(${u.id},'${u.status}')" title="${u.status==='banned'?'解封':'封禁'}" aria-label="${u.status==='banned'?'解封用户':'封禁用户'}" ${u.id===state.user.id?'disabled':''} style="padding:6px 10px;font-size:.8rem">${u.status==='banned'?ICO.unlock:ICO.ban}</button>
        <button class="btn btn-secondary" onclick="resetUserPwd(${u.id})" title="重置密码" aria-label="重置密码" style="padding:6px 10px;font-size:.8rem">${ICO.key}</button>
      </div>
    </div>`;
  }).join('') + `
    <div class="pagination">
      <button class="btn btn-secondary" onclick="_userPage--;loadUserList()" ${_userPage<=1?'disabled':''}>上一页</button>
      <span class="pagination-info">第 ${data.page} / ${data.total_pages} 页 · 共 ${data.total} 用户</span>
      <button class="btn btn-secondary" onclick="_userPage++;loadUserList()" ${_userPage>=data.total_pages?'disabled':''}>下一页</button>
    </div>`;
}

async function changeUserRole(uid, role) {
  const r = await api(`/api/admin/users/${uid}/role`,{method:'PUT',body:JSON.stringify({role})});
  if(r?.ok){toast(`角色已更新为 ${role}`,'success');loadUserList();}
  else toast(r?.detail||'更新失败','error');
}

async function toggleUserStatus(uid, cur) {
  const next = cur==='banned'?'active':'banned';
  if(!confirm(`确定${next==='banned'?'封禁':'解封'}该用户吗？`)) return;
  const r = await api(`/api/admin/users/${uid}/status`,{method:'PUT',body:JSON.stringify({status:next})});
  if(r?.ok){toast(`已${next==='banned'?'封禁':'解封'}`,'success');loadUserList();}
  else toast(r?.detail||'操作失败','error');
}

async function resetUserPwd(uid) {
  if(!confirm('确定重置该用户密码吗？将生成新密码并返回。')) return;
  const r = await api(`/api/admin/users/${uid}/reset-password`,{method:'POST'});
  if(r?.ok){prompt('新密码（请复制并告知用户）：', r.new_password);}
  else toast(r?.detail||'重置失败','error');
}

// ─── Admin Settings (PRD-007) ───
async function renderAdminSettings() {
  if(!state.user || state.user.role !== 'admin'){navigate('home');toast(`${ICO.ban} 无权限`,'error');return;}
  const con = $('content');
  con.innerHTML = `<button class="back" onclick="navigate()">${ICO.back} 返回</button>
    <div class="admin-hero">
      <h1>${ICO.gear} 系统设置</h1>
      <div class="sub">站点配置 · 修改后即时生效</div>
    </div>
    ${adminTabs('settings')}
    <div id="settings-form"><div class="loading"><div class="spinner"><span></span><span></span><span></span><span></span><span></span></div></div></div>`;
  const s = await api('/api/admin/settings')||{};
  $('settings-form').innerHTML = `
    <div class="form-section">
      <h2>${ICO.globe} 站点信息</h2>
      <label class="form-label"><span>站点名称</span>
        <input id="set-site_name" class="form-input" value="${esc(s.site_name||'')}"></label>
      <label class="form-label"><span>站点描述</span>
        <input id="set-site_description" class="form-input" value="${esc(s.site_description||'')}"></label>
      <label class="form-label" style="margin-bottom:0"><span>页脚文字</span>
        <input id="set-footer_text" class="form-input" value="${esc(s.footer_text||'')}"></label>
    </div>
    <div class="form-section">
      <h2>${ICO.lock} 注册与权限</h2>
      <label class="form-checkbox-label">
        <input type="checkbox" id="set-registration_enabled" ${s.registration_enabled==='true'?'checked':''}>
        <span>允许新用户注册</span>
      </label>
      <label class="form-label" style="margin-bottom:0"><span>新用户默认角色</span>
        <select id="set-default_user_role" class="form-select">
          <option value="user" ${s.default_user_role==='user'?'selected':''}>普通用户（只能浏览播放）</option>
          <option value="creator" ${s.default_user_role==='creator'?'selected':''}>创作者（可上传内容）</option>
        </select></label>
    </div>
    <div class="form-section">
      <h2>${ICO.box} 上传限制</h2>
      <label class="form-label"><span>单文件最大上传（MB）</span>
        <input id="set-max_upload_size_mb" class="form-input" type="number" min="1" max="10240" value="${esc(s.max_upload_size_mb||'500')}"></label>
      <div class="form-hint" style="background:var(--bg3);border-radius:var(--rs);padding:10px 12px;margin-top:4px">
        <div>视频格式: ${esc(s.allowed_video_exts||'')}</div>
        <div>音频格式: ${esc(s.allowed_audio_exts||'')}</div>
      </div>
    </div>
    <div class="form-section">
      <h2>${ICO.save} 存储设置</h2>
      <label class="form-label"><span>存储后端</span>
        <select id="set-storage_backend" class="form-select" onchange="updateStorageFormVisibility()">
          <option value="local" ${s.storage_backend==='local'?'selected':''}>本地存储（默认）</option>
          <option value="s3" ${s.storage_backend==='s3'?'selected':''}>S3 兼容存储</option>
        </select></label>
      <div id="s3-config-section" style="${s.storage_backend==='s3'?'':'display:none'}">
        <label class="form-label"><span>存储服务提供商</span>
          <select id="set-storage_provider" class="form-select" onchange="updateStorageProviderHint()">
            <option value="aws" ${s.storage_provider==='aws'?'selected':''}>AWS S3</option>
            <option value="aliyun" ${s.storage_provider==='aliyun'?'selected':''}>阿里云 OSS</option>
            <option value="cloudflare" ${s.storage_provider==='cloudflare'?'selected':''}>Cloudflare R2</option>
            <option value="minio" ${s.storage_provider==='minio'?'selected':''}>MinIO</option>
            <option value="custom" ${s.storage_provider==='custom'||!s.storage_provider?'selected':''}>自定义 S3 兼容</option>
          </select></label>
        <label class="form-label"><span>Region（区域）</span>
          <input id="set-s3_region" class="form-input" value="${esc(s.s3_region||'')}" placeholder="us-east-1 / oss-cn-hangzhou 等">
          <div id="storage-region-hint" class="form-hint"></div></label>
        <label class="form-label"><span>Endpoint（端点，MinIO/自定义必填）</span>
          <input id="set-s3_endpoint" class="form-input" value="${esc(s.s3_endpoint||'')}" placeholder="http://minio:9000"></label>
        <label class="form-label"><span>Bucket（存储桶）</span>
          <input id="set-s3_bucket" class="form-input" value="${esc(s.s3_bucket||'')}"></label>
        <label class="form-label"><span>Access Key</span>
          <input id="set-s3_access_key" class="form-input" value="${esc(s.s3_access_key||'')}"></label>
        <label class="form-label"><span>Secret Key</span>
          <input id="set-s3_secret_key" class="form-input" type="password" value="${esc(s.s3_secret_key||'')}" autocomplete="off"></label>
        <div style="display:flex;gap:8px;margin-bottom:12px">
          <button type="button" class="btn btn-secondary" onclick="testStorageConnection()" style="flex:1">${ICO.plug} 测试连接</button>
          <button type="button" class="btn btn-secondary" onclick="migrateStorage()" style="flex:1">${ICO.upload} 迁移本地文件到 S3</button>
        </div>
        <div id="storage-test-result" class="storage-result">点击「测试连接」验证配置</div>
      </div>
    </div>
    ${s._secret_key_is_default==='true'?'<div style="background:#fef3c7;border:1px solid #fbbf24;border-radius:var(--rs);padding:12px 16px;margin-bottom:16px;font-size:.8rem;color:#92400e;display:flex;align-items:flex-start;gap:8px"><span style="flex-shrink:0">'+ICO.warning+'</span><span>安全提示：当前使用默认 SECRET_KEY，请通过环境变量 <code>MURMUR_SECRET_KEY</code> 修改后再部署到生产环境</span></div>':''}
    <button class="btn btn-primary auth-submit" onclick="saveSettings()">${ICO.save} 保存设置</button>`;
  updateStorageProviderHint();
}

async function saveSettings() {
  const data = {
    site_name: $('set-site_name').value,
    site_description: $('set-site_description').value,
    footer_text: $('set-footer_text').value,
    registration_enabled: $('set-registration_enabled').checked?'true':'false',
    default_user_role: $('set-default_user_role').value,
    max_upload_size_mb: $('set-max_upload_size_mb').value,
    storage_backend: $('set-storage_backend').value,
    storage_provider: $('set-storage_provider').value,
    s3_endpoint: $('set-s3_endpoint').value,
    s3_bucket: $('set-s3_bucket').value,
    s3_access_key: $('set-s3_access_key').value,
    s3_secret_key: $('set-s3_secret_key').value,
    s3_region: $('set-s3_region').value,
  };
  const r = await api('/api/admin/settings',{method:'PUT',body:JSON.stringify(data)});
  if(r?.ok){toast('设置已保存','success');renderAdminSettings();}
  else toast(r?.detail||'保存失败','error');
}

function updateStorageFormVisibility() {
  const be = $('set-storage_backend')?.value || 'local';
  const sec = $('s3-config-section');
  if(sec) sec.style.display = (be === 's3') ? 'block' : 'none';
  updateStorageProviderHint();
}

function updateStorageProviderHint() {
  const prov = $('set-storage_provider')?.value || 'custom';
  const hint = $('storage-region-hint');
  if(!hint) return;
  const hintMap = {
    aws: '如 us-east-1, us-west-2, ap-northeast-1',
    aliyun: '如 oss-cn-hangzhou, oss-cn-beijing, oss-cn-shenzhen',
    cloudflare: '填写 Cloudflare Account ID（在 R2 概览页右上角可复制）',
    minio: 'MinIO 通常不需要 Region，留空即可',
    custom: '服务支持 region 则填写，否则留空',
  };
  hint.textContent = hintMap[prov] || '';
}

async function testStorageConnection() {
  const box = $('storage-test-result');
  if(box) box.textContent = '正在测试…';
  const r = await api('/api/admin/storage/test', {method:'POST'});
  if(!box) return;
  if(r?.ok){
    const d = r.details || {};
    box.style.color = 'var(--success,#10b981)';
    box.textContent = `连接成功（${d.provider||d.backend||'s3'}）bucket=${d.bucket||''}  region=${d.region||''}  对象采样=${d.object_count_sample??'N/A'}`;
  } else {
    box.style.color = 'var(--danger,#ef4444)';
    box.textContent = `连接失败：${r?.error||'未知错误'}`;
  }
}

async function migrateStorage() {
  if(!confirm('确定要将本地媒体文件迁移到 S3 吗？已有文件会被覆盖。')) return;
  const r = await api('/api/admin/storage/migrate', {method:'POST'});
  if(r?.migrated !== undefined){
    toast(`迁移完成：成功 ${r.migrated} 个，失败 ${r.failed} 个`, r.failed > 0 ? 'warning' : 'success');
  } else {
    toast(r?.detail||'迁移失败','error');
  }
}

// ─── Sleep Timer ───
let _timer = { active: false, remaining: 0, total: 0, id: null, interval: null };

function showTimer(id) {
  if ($('tp-bg')) return;
  const bg = document.createElement('div'); bg.id = 'tp-bg'; bg.className = 'timer-bg';
  bg.onclick = () => bg.remove();
  bg.innerHTML = `<div class="timer-sheet" onclick="event.stopPropagation()">
    <h3>${ICO.clock} 定时关闭</h3>
    <div class="sub">播放结束后自动停止</div>
    ${_timer.active ? `<div style="margin-bottom:16px;text-align:center"><span class="timer-active-label">${ICO.clock} 剩余 ${dur(_timer.remaining)}</span></div>` : ''}
    <div class="timer-grid">
      <div class="timer-opt" role="button" tabindex="0" onclick="setTimer('${id}',900);$('tp-bg').remove()">15分钟</div>
      <div class="timer-opt" role="button" tabindex="0" onclick="setTimer('${id}',1800);$('tp-bg').remove()">30分钟</div>
      <div class="timer-opt" role="button" tabindex="0" onclick="setTimer('${id}',2700);$('tp-bg').remove()">45分钟</div>
      <div class="timer-opt" role="button" tabindex="0" onclick="setTimer('${id}',3600);$('tp-bg').remove()">60分钟</div>
      <div class="timer-opt" role="button" tabindex="0" onclick="setTimer('${id}',0);$('tp-bg').remove()">播完为止</div>
      <div class="timer-opt" role="button" tabindex="0" onclick="setTimer('${id}',-1);$('tp-bg').remove()">取消</div>
    </div>
  </div>`;
  document.body.appendChild(bg);
}

function setTimer(id, seconds) {
  if (_timer.interval) { clearInterval(_timer.interval); _timer.interval = null; }
  if (seconds < 0) {
    _timer.active = false; _timer.id = null;
    updateTimerBtn(); return;
  }
  _timer.active = true;
  _timer.remaining = seconds > 0 ? seconds : 99999;
  _timer.total = _timer.remaining;
  _timer.id = id;
  _timer.interval = setInterval(() => {
    if (_timer.remaining > 0) {
      _timer.remaining--;
      if (_timer.remaining <= 0) {
        clearInterval(_timer.interval); _timer.interval = null; _timer.active = false;
        const a = $(`ael-${id}`), v = $(`vel-${id}`);
        if (a) a.pause(); if (v) v.pause();
        updateTimerBtn();
        toast(`${ICO.clock} 定时播放已结束`, 'info');
      }
      updateTimerBtn();
    }
  }, 1000);
  updateTimerBtn();
}

function updateTimerBtn() {
  document.querySelectorAll('.timer-indicator').forEach(el => {
    if (_timer.active && _timer.remaining > 0) {
      el.innerHTML = `${ICO.clock} ${dur(_timer.remaining)}`;
      el.style.display = 'inline-flex';
    } else el.style.display = 'none';
  });
}

// ─── Playback Position ───
const PP_KEY = 'murmur_pp';
function getPositions() {
  try { return JSON.parse(localStorage.getItem(PP_KEY) || '{}'); } catch { return {}; }
}
function savePosition(id, ct, dur) {
  if (!ct || !dur || dur < 10) return;
  const p = getPositions(); p[id] = { currentTime: ct, duration: dur, updatedAt: Date.now() };
  const keys = Object.keys(p);
  if (keys.length > 50) {
    keys.sort((a, b) => p[b].updatedAt - p[a].updatedAt).slice(50).forEach(k => delete p[k]);
  }
  localStorage.setItem(PP_KEY, JSON.stringify(p));
}
function clearPosition(id) {
  const p = getPositions(); delete p[id]; localStorage.setItem(PP_KEY, JSON.stringify(p));
}
function getResumePos(id) {
  const p = getPositions()[id];
  if (!p || p.currentTime < 15 || (p.duration > 0 && p.currentTime / p.duration > 0.95)) {
    if (p) clearPosition(id);
    return null;
  }
  return p;
}

// ─── Play Queue ───
const Q_KEY = 'murmur_queue';
let _playQueue = [];
function loadQueue() {
  try { _playQueue = JSON.parse(localStorage.getItem(Q_KEY) || '[]'); } catch { _playQueue = []; }
}
function saveQueue() { localStorage.setItem(Q_KEY, JSON.stringify(_playQueue)); }
function addToQueue(item) {
  if (_playQueue.some(q => q.id === item.id)) return;
  _playQueue.push(item); saveQueue(); updateQueueBar();
  toast(`${ICO.plus} 已加入播放队列`, 'info');
}
function removeFromQueue(id) {
  _playQueue = _playQueue.filter(q => q.id !== id);
  saveQueue(); updateQueueBar();
}
function playNext() {
  document.querySelector('.queue-item.active')?.classList.remove('active');
  if (!_playQueue.length) return;
  const next = _playQueue.shift(); saveQueue();
  navigate('post', next.id); updateQueueBar();
}
function updateQueueBar() {
  const bar = $('queue-bar');
  if (!bar) return;
  bar.innerHTML = _playQueue.length
    ? _playQueue.map(q => `<div class="queue-item" role="button" tabindex="0" onclick="rmFromQ(${q.id})" aria-label="从队列移除 ${esc(q.title)}">${q.file_type==='video'?ICO.film:ICO.audio} ${esc(q.title)}</div>`).join('')
    : '<span style="color:var(--text3);font-size:.75rem">队列为空</span>';
  if (state.postId) {
    const active = bar.querySelector(`[onclick*="${state.postId}"]`);
    if (active) active.classList.add('active');
  }
}
function rmFromQ(id) { removeFromQueue(id); }

// ═══════════════════════════════════════
// ─── V1.3 Features (PRD-008 ~ PRD-012) ───
// ═══════════════════════════════════════

// ─── PRD-008 Tags ───
let _tagPage = 1;

async function onTagInput(input, suggestId) {
  const sid = suggestId || 'tag-suggest';
  const box = $(sid);
  if (!box) return;
  const val = input.value;
  const parts = val.split(/[,，]/);
  const last = parts[parts.length - 1].trim();
  if (!last) { box.style.display = 'none'; return; }
  const data = await api(`/api/tags?q=${encodeURIComponent(last)}&limit=5&sort=hot`);
  const tags = data || [];
  if (!tags.length) { box.style.display = 'none'; return; }
  box.innerHTML = tags.map(t => `<div style="padding:8px 12px;cursor:pointer;font-size:.85rem" onmousedown="pickTag('${input.id}','${sid}','${esc(t.name)}')">#${esc(t.name)} <span style="color:var(--text3);font-size:.75rem">${t.use_count}</span></div>`).join('');
  box.style.display = 'block';
}

function pickTag(inputId, suggestId, name) {
  const input = $(inputId);
  if (!input) return;
  const val = input.value;
  const parts = val.split(/[,，]/);
  parts[parts.length - 1] = ' ' + name + ', ';
  input.value = parts.join(',').replace(/,\s*,/g, ',').replace(/^,\s*/, '').trim();
  input.focus();
  const box = $(suggestId);
  if (box) box.style.display = 'none';
}

async function renderTagPosts() {
  const tagId = state.params.tagId;
  if (!tagId) { navigate('home'); return; }
  const con = $('content');
  con.innerHTML = `<button class="back" onclick="navigate()">${ICO.back} 返回</button>
    <div id="tag-header"><div class="loading"><div class="spinner"><span></span><span></span><span></span><span></span><span></span></div></div></div>
    <div id="tag-posts"><div class="loading"><div class="spinner"><span></span><span></span><span></span><span></span><span></span></div></div></div>`;
  _tagPage = 1;
  await loadTagPosts(tagId);
}

async function loadTagPosts(tagId) {
  const data = await api(`/api/tags/${tagId}/posts?page=${_tagPage}&sort=latest`);
  const header = $('tag-header');
  const list = $('tag-posts');
  if (!data || !data.tag) {
    if (list) list.innerHTML = '<div class="empty"><p>标签不存在</p><button class="btn btn-primary" onclick="navigate()">返回</button></div>';
    return;
  }
  if (header) {
    header.innerHTML = `<div class="page-header">
      <div><h1>#${esc(data.tag.name)}</h1><div class="sub">${data.tag.use_count || 0} 个内容</div></div>
    </div>
    <div class="sort-tabs">
      <button class="sort-tab active">最新</button>
    </div>`;
  }
  const items = data.items || [];
  if (!items.length) {
    if (list) list.innerHTML = '<div class="empty"><div class="icon">'+ICO.tag+'</div><p>该标签下暂无内容</p></div>';
    return;
  }
  const grid = document.createElement('div'); grid.className = 'grid';
  for(const p of items) {
    const isV = p.file_type==='video', cv = p.cover_image?`${API}/${p.cover_image}`:'';
    const card = document.createElement('div'); card.className = 'card';
    card.setAttribute('role', 'button'); card.setAttribute('tabindex', '0');
    card.onclick = () => { if(isV&&!state.user){showLogin();return;} navigate('post',p.id); };
    const rp = getResumePos(p.id);
    const isFav = p.is_favorited || false;
    const favCount = p.favorite_count || 0;
    card.innerHTML = `<div class="cover">
      ${cv?`<img src="${cv}" alt="${esc(p.title)}" loading="lazy">`:`<span style="font-size:2.2rem;opacity:.25">${isV?ICO.film:ICO.audio}</span>`}
      <div class="overlay"><div class="play">${ICO.play}</div></div>
      <div class="badge">${isV?'视频':'音频'}</div>
      ${p.featured?'<div class="badge" style="right:auto;left:8px;top:8px;background:var(--accent)">'+ICO.sparkles+' 精选</div>':''}
      ${p.duration>0?`<div class="dur">${dur(p.duration)}</div>`:''}
      ${rp?`<div class="resume-badge">${ICO.play} ${dur(rp.currentTime)}</div>`:''}
      <button class="fav-btn-card ${isFav?'active':''}" onclick="event.stopPropagation();toggleCardFavorite(this,${p.id})" title="收藏" aria-label="${isFav?'取消收藏':'收藏'}">
        ${isFav?ICO.heart:ICO.heartO}
      </button>
    </div><div class="info">
      <h3>${esc(p.title)}</h3>
      <div class="meta"><span>${ICO.eye} ${p.views}</span><span>${ICO.heart} ${favCount}</span><span>${ICO.chat} ${p.comment_count||0}</span></div>
      <div style="display:flex;gap:6px;align-items:center;margin-top:4px;flex-wrap:wrap">
        ${p.category?`<div class="tag">${p.category.icon} ${esc(p.category.name)}</div>`:''}
        ${(p.tags||[]).slice(0,3).map(t=>`<button class="tag" style="cursor:pointer" onclick="event.stopPropagation();navigate('tag-posts',{tagId:${t.id}})" aria-label="查看标签 ${esc(t.name)}">#${esc(t.name)}</button>`).join('')}
        <button class="queue-add-btn" onclick="event.stopPropagation();addToQueue({id:${p.id},title:'${esc(p.title)}',file_type:'${p.file_type}',duration:${p.duration||0}})" aria-label="添加到播放队列">＋</button>
      </div>
    </div>`;
    grid.appendChild(card);
  }
  if (list) {
    list.innerHTML = ''; list.appendChild(grid);
    if(data.total_pages>1) {
      const pg = document.createElement('div'); pg.style.cssText='display:flex;justify-content:center;gap:8px;margin-top:24px';
      if(data.page>1) pg.innerHTML+=`<button class="btn btn-secondary" onclick="_tagPage=${data.page-1};loadTagPosts(${tagId})">上一页</button>`;
      if(data.page<data.total_pages) pg.innerHTML+=`<button class="btn btn-secondary" onclick="_tagPage=${data.page+1};loadTagPosts(${tagId})">下一页</button>`;
      list.appendChild(pg);
    }
  }
}

// ─── PRD-009 Playlists ───
let _plTab = 'mine';
let _plPage = 1;

async function renderPlaylists() {
  if (!state.user) { showLogin(); return; }
  const con = $('content');
  con.innerHTML = `<button class="back" onclick="navigate()">${ICO.back} 返回</button>
    <div class="page-header">
      <div><h1>歌单</h1><div class="sub">收集你喜欢的声音</div></div>
      <button class="btn btn-primary" onclick="showCreatePlaylist()">${ICO.plus} 新建歌单</button>
    </div>
    <div class="fav-toolbar">
      <div class="fav-cats">
        <button class="pill ${_plTab==='mine'?'active':''}" onclick="_plTab='mine';_plPage=1;renderPlaylists()">我的歌单</button>
        <button class="pill ${_plTab==='discover'?'active':''}" onclick="_plTab='discover';_plPage=1;renderPlaylists()">发现公开</button>
      </div>
    </div>
    <div id="playlist-list"><div class="loading"><div class="spinner"><span></span><span></span><span></span><span></span><span></span></div></div></div>`;
  await loadPlaylistList();
}

async function loadPlaylistList() {
  const list = $('playlist-list');
  if (!list) return;
  let url = `/api/playlists?page=${_plPage}`;
  if (_plTab === 'mine') url += '&mine=1';
  const data = await api(url);
  const items = data?.items || [];
  if (!items.length) {
    list.innerHTML = `<div class="empty"><div class="icon"><svg width="48" height="48" viewBox="0 0 48 48" fill="none" opacity=".3"><path d="M10 28v-4a14 14 0 0 1 28 0v4" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><rect x="6" y="28" width="8" height="12" rx="3" stroke="currentColor" stroke-width="2.5"/><rect x="34" y="28" width="8" height="12" rx="3" stroke="currentColor" stroke-width="2.5"/></svg></div><p>${_plTab==='mine'?'还没有创建歌单':'暂无公开歌单'}</p></div>`;
    return;
  }
  const grid = document.createElement('div');
  grid.className = 'grid';
  for (const pl of items) {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.cursor = 'pointer';
    card.style.animationDelay = `${grid.children.length * 0.05}s`;
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.onclick = () => navigate('playlist-detail', { playlistId: pl.id });
    const isMine = pl.user && state.user && pl.user.id === state.user.id;
    card.innerHTML = `<div class="cover playlist-cover">
      <span class="cover-placeholder"><svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M4 9v6M8 5v14M12 7v10M16 9v6M20 10v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></span>
      <div class="overlay"><div class="play"><svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path d="M6 4l11 6-11 6V4z"/></svg></div></div>
      <div class="badge-type">${pl.is_public?'<svg width="10" height="10" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.3"/><path d="M2 8h12M8 2c1.5 1.5 2.5 3.5 2.5 6S9.5 12.5 8 14c-1.5-1.5-2.5-3.5-2.5-6S6.5 3.5 8 2z" stroke="currentColor" stroke-width="1.3"/></svg> 公开':'<svg width="10" height="10" viewBox="0 0 16 16" fill="none"><rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M5 7V5a3 3 0 0 1 6 0v2" stroke="currentColor" stroke-width="1.3"/></svg> 私密'}</div>
    </div><div class="info">
      <h3>${esc(pl.title)}</h3>
      <div class="meta">
        <span><svg width="10" height="10" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M2 6h12" stroke="currentColor" stroke-width="1.3"/></svg> ${pl.item_count || 0} 首</span>
        ${pl.user?`<span><svg width="10" height="10" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5.5" r="2.5" stroke="currentColor" stroke-width="1.3"/><path d="M3 14c0-2.5 2.5-4 5-4s5 1.5 5 4" stroke="currentColor" stroke-width="1.3"/></svg> ${esc(pl.user.username)}</span>`:''}
      </div>
      ${pl.description?`<div class="card-desc">${esc(pl.description)}</div>`:''}
      ${isMine ? `<div class="card-actions">
        <button class="btn btn-ghost btn-icon" onclick="event.stopPropagation();editPlaylist(${pl.id},'${esc(pl.title)}','${esc(pl.description||'')}',${pl.is_public})" title="编辑" aria-label="编辑歌单"><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M11 2l3 3-8 8H3v-3l8-8z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg></button>
        <button class="btn btn-ghost btn-icon hist-del" onclick="event.stopPropagation();deletePlaylist(${pl.id})" title="删除" aria-label="删除歌单"><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 5h10M6 5V3h4v2M5 5l1 9h4l1-9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      </div>` : ''}
    </div>`;
    grid.appendChild(card);
  }
  list.innerHTML = ''; list.appendChild(grid);
  if (data.total_pages > 1) {
    const pg = document.createElement('div'); pg.className = 'pagination';
    if(data.page>1) pg.innerHTML+=`<button class="btn btn-secondary" onclick="_plPage=${data.page-1};loadPlaylistList()">上一页</button>`;
    if(data.page<data.total_pages) pg.innerHTML+=`<button class="btn btn-secondary" onclick="_plPage=${data.page+1};loadPlaylistList()">下一页</button>`;
    list.appendChild(pg);
  }
}

function showCreatePlaylist() {
  if (qs('.pl-modal')) return;
  const o = document.createElement('div'); o.className = 'auth-modal'; o.classList.add('pl-modal');
  o.innerHTML = `<div class="auth-box">
    <h2>新建歌单</h2>
    <div class="input-group"><label>歌单名称</label><input id="pl-title" placeholder="给歌单取个名字..."></div>
    <div class="input-group"><label>描述（可选）</label><textarea id="pl-desc" placeholder="简单描述一下..." style="min-height:80px"></textarea></div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
      <input type="checkbox" id="pl-public" checked>
      <label for="pl-public" style="font-size:.85rem;cursor:pointer">公开歌单（其他人可以看到）</label>
    </div>
    <div class="auth-actions">
      <button class="btn btn-secondary" onclick="this.closest('.auth-modal').remove()">取消</button>
      <button class="btn btn-primary" onclick="createPlaylist()">创建</button>
    </div>
  </div>`;
  document.body.appendChild(o);
  setTimeout(() => $('pl-title')?.focus(), 100);
}

async function createPlaylist() {
  const title = $('pl-title')?.value.trim();
  if (!title) { toast('请输入歌单名称', 'error'); return; }
  const description = $('pl-desc')?.value.trim() || '';
  const is_public = $('pl-public')?.checked || false;
  const r = await api('/api/playlists', {
    method: 'POST',
    body: JSON.stringify({ title, description, is_public })
  });
  if (r?.id) {
    toast('歌单创建成功', 'success');
    qs('.pl-modal')?.remove();
    loadPlaylistList();
  } else {
    toast(r?.detail || '创建失败', 'error');
  }
}

function editPlaylist(id, title, desc, isPublic) {
  if (qs('.pl-modal')) return;
  const o = document.createElement('div'); o.className = 'auth-modal'; o.classList.add('pl-modal');
  o.innerHTML = `<div class="auth-box">
    <h2>${ICO.pencil} 编辑歌单</h2>
    <div class="input-group"><label>歌单名称</label><input id="epl-title" value="${esc(title)}"></div>
    <div class="input-group"><label>描述（可选）</label><textarea id="epl-desc" style="min-height:80px">${esc(desc)}</textarea></div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
      <input type="checkbox" id="epl-public" ${isPublic?'checked':''}>
      <label for="epl-public" style="font-size:.85rem;cursor:pointer">公开歌单</label>
    </div>
    <div class="auth-actions">
      <button class="btn btn-secondary" onclick="this.closest('.auth-modal').remove()">取消</button>
      <button class="btn btn-primary" onclick="savePlaylistEdit(${id})">保存</button>
    </div>
  </div>`;
  document.body.appendChild(o);
}

async function savePlaylistEdit(id) {
  const title = $('epl-title')?.value.trim();
  if (!title) { toast('请输入歌单名称', 'error'); return; }
  const description = $('epl-desc')?.value.trim() || '';
  const is_public = $('epl-public')?.checked || false;
  const r = await api(`/api/playlists/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ title, description, is_public })
  });
  if (r?.ok) {
    toast('保存成功', 'success');
    qs('.pl-modal')?.remove();
    if (state.view === 'playlists') loadPlaylistList();
    else if (state.view === 'playlist-detail') renderPlaylistDetail();
  } else {
    toast(r?.detail || '保存失败', 'error');
  }
}

async function deletePlaylist(id) {
  if (!confirm('确定删除这个歌单吗？歌单内的内容不会被删除。')) return;
  const r = await api(`/api/playlists/${id}`, { method: 'DELETE' });
  if (r?.ok) {
    toast('已删除', 'success');
    if (state.view === 'playlists') loadPlaylistList();
    else navigate('playlists');
  } else {
    toast(r?.detail || '删除失败', 'error');
  }
}

async function renderPlaylistDetail() {
  const plId = state.params.playlistId;
  if (!plId) { navigate('playlists'); return; }
  const con = $('content');
  con.innerHTML = `<button class="back" onclick="navigate('playlists')">${ICO.back} 返回</button>
    <div id="pl-detail-header"><div class="loading"><div class="spinner"><span></span><span></span><span></span><span></span><span></span></div></div></div>
    <div id="pl-items"><div class="loading"><div class="spinner"><span></span><span></span><span></span><span></span><span></span></div></div></div>`;
  const pl = await api(`/api/playlists/${plId}`);
  if (!pl) {
    con.innerHTML = '<div class="empty"><p>歌单不存在</p><button class="btn btn-primary" onclick="navigate(\'playlists\')">返回</button></div>';
    return;
  }
  const isMine = pl.user && state.user && pl.user.id === state.user.id;
  const header = $('pl-detail-header');
  if (header) {
    header.innerHTML = `<div class="page-header">
      <div class="pl-detail-header">
        <div class="pl-cover">
          <span class="pl-cover-ico">${ICO.audio}</span>
        </div>
        <div>
          <h1 style="margin:0">${esc(pl.title)} ${pl.is_public?'<span class="pl-badge">'+ICO.globe+' 公开</span>':'<span class="pl-badge">'+ICO.lock+' 私密</span>'}</h1>
          <div class="pl-meta sub">${pl.user?ICO.user+' '+esc(pl.user.username)+' · ':''}${pl.item_count || 0} 首内容</div>
          ${pl.description?`<div class="pl-desc">${esc(pl.description)}</div>`:''}
          <div class="pl-actions">
            <button class="btn btn-primary" onclick="playPlaylistAll(${plId})">${ICO.play} 播放全部</button>
            ${isMine?`<button class="btn btn-secondary" onclick="editPlaylist(${pl.id},'${esc(pl.title)}','${esc(pl.description||'')}',${pl.is_public})">${ICO.pencil} 编辑</button>`:''}
            ${isMine?`<button class="btn btn-secondary" style="color:#f87171" onclick="deletePlaylist(${pl.id})">${ICO.trash} 删除</button>`:''}
          </div>
        </div>
      </div>
    </div>`;
  }
  const items = pl.items || [];
  const list = $('pl-items');
  if (list) {
    if (!items.length) {
      list.innerHTML = '<div class="empty"><div class="icon">'+ICO.audio+'</div><p>歌单还是空的</p></div>';
    } else {
      let html = '<div class="pl-list">';
      items.forEach((item, idx) => {
        const post = item.post || item;
        if (!post) return;
        const isV = post.file_type === 'video';
        const cv = post.cover_image ? `${API}/${post.cover_image}` : '';
        html += `<div class="pl-item" role="button" tabindex="0" onclick="navigate('post',${post.id})" aria-label="查看 ${esc(post.title)}">
          <div class="pl-idx">${idx + 1}</div>
          <div class="pl-thumb">
            ${cv?`<img src="${cv}" alt="${esc(post.title)}">`:`<div class="pl-thumb-empty">${isV?ICO.film:ICO.audio}</div>`}
          </div>
          <div class="pl-info">
            <div class="pl-title">${esc(post.title)}</div>
            <div class="pl-item-meta">
              ${post.category?post.category.icon+' '+esc(post.category.name)+' · ':''}${dur(post.duration)}
            </div>
          </div>
          ${isMine?`<button class="btn btn-ghost btn-icon pl-remove" onclick="event.stopPropagation();removeFromPlaylist(${plId},${post.id})" title="从歌单移除" aria-label="从歌单移除">${ICO.cross}</button>`:''}
        </div>`;
      });
      html += '</div>';
      list.innerHTML = html;
    }
  }
}

async function playPlaylistAll(plId) {
  const pl = await api(`/api/playlists/${plId}`);
  const items = pl?.items || [];
  if (!items.length) { toast('歌单是空的', 'error'); return; }
  _playQueue = [];
  items.forEach(item => {
    const post = item.post || item;
    if (post) _playQueue.push({ id: post.id, title: post.title, file_type: post.file_type, duration: post.duration || 0 });
  });
  saveQueue();
  if (_playQueue.length) {
    const first = _playQueue.shift();
    saveQueue();
    navigate('post', first.id);
    toast(`${ICO.play} 开始播放歌单（共 ${_playQueue.length + 1} 首）`, 'info');
  }
}

async function removeFromPlaylist(plId, postId) {
  if (!confirm('确定从歌单中移除吗？')) return;
  const r = await api(`/api/playlists/${plId}/items/${postId}`, { method: 'DELETE' });
  if (r?.ok) {
    toast('已移除', 'success');
    renderPlaylistDetail();
  } else {
    toast(r?.detail || '操作失败', 'error');
  }
}

function showAddToPlaylist(postId) {
  if (!state.user) { showLogin(); return; }
  if (qs('.atp-modal')) return;
  const o = document.createElement('div'); o.className = 'auth-modal'; o.classList.add('atp-modal');
  o.innerHTML = `<div class="auth-box">
    <h2>添加到歌单</h2>
    <div id="atp-list" style="max-height:300px;overflow-y:auto;margin-bottom:12px"><div class="loading"><div class="spinner"><span></span><span></span><span></span><span></span><span></span></div></div></div>
    <div class="auth-actions">
      <button class="btn btn-secondary" onclick="this.closest('.auth-modal').remove()">取消</button>
      <button class="btn btn-ghost" onclick="showCreatePlaylistFromAtp()">${ICO.plus} 新建歌单</button>
    </div>
  </div>`;
  document.body.appendChild(o);
  loadMyPlaylistsForAdd(postId);
}

async function loadMyPlaylistsForAdd(postId) {
  const list = $('atp-list');
  if (!list) return;
  const data = await api('/api/playlists?mine=1&page_size=100');
  const items = data?.items || [];
  if (!items.length) {
    list.innerHTML = '<div class="empty" style="padding:20px"><p>还没有歌单</p></div>';
    return;
  }
  list.innerHTML = items.map(pl => `
    <div role="button" tabindex="0" style="display:flex;align-items:center;gap:10px;padding:10px;border-bottom:1px solid var(--border);cursor:pointer" onclick="addToPlaylist(${pl.id},${postId})" aria-label="添加到歌单 ${esc(pl.title)}">
      <span>${ICO.audio}</span>
      <div style="flex:1">
        <div style="font-weight:500;font-size:.9rem">${esc(pl.title)}</div>
        <div style="font-size:.75rem;color:var(--text3)">${pl.item_count || 0} 首</div>
      </div>
      <span style="color:var(--accent)">＋</span>
    </div>
  `).join('');
}

function showCreatePlaylistFromAtp() {
  qs('.atp-modal')?.remove();
  showCreatePlaylist();
}

async function addToPlaylist(plId, postId) {
  const r = await api(`/api/playlists/${plId}/items/${postId}`, { method: 'POST' });
  if (r?.ok) {
    toast('已添加到歌单', 'success');
    qs('.atp-modal')?.remove();
  } else {
    toast(r?.detail || '添加失败', 'error');
  }
}

// ─── PRD-010 Related ───
async function loadRelated(postId) {
  const section = $('related-section');
  const scroll = $('related-scroll');
  if (!section || !scroll) return;
  const data = await api(`/api/posts/${postId}/related?limit=6`);
  const items = data?.items || [];
  if (!items.length) return;
  section.style.display = 'block';
  scroll.innerHTML = items.map(p => {
    const isV = p.file_type==='video', cv = p.cover_image?`${API}/${p.cover_image}`:'';
    return `<div class="card related-card" role="button" tabindex="0" onclick="navigate('post',${p.id})">
      <div class="cover">
        ${cv?`<img src="${cv}" alt="${esc(p.title)}" loading="lazy">`:`<span class="cover-placeholder">${isV?'<svg width="28" height="28" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="14" height="14" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M17 9l5-3v12l-5-3" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>':'<svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M4 9v6M8 5v14M12 7v10M16 9v6M20 10v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>'}</span>`}
        <div class="overlay"><div class="play"><svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path d="M6 4l11 6-11 6V4z"/></svg></div></div>
        <div class="badge">${isV?'视频':'音频'}</div>
        ${p.duration>0?`<div class="dur">${dur(p.duration)}</div>`:''}
      </div><div class="info">
        <h3>${esc(p.title)}</h3>
        <div class="meta"><span>${ICO.eye} ${formatViews(p.views)}</span></div>
      </div>
    </div>`;
  }).join('');
}

// ─── PRD-011 Featured ───
async function loadHeroCarousel() {
  const container = $('hero-carousel');
  if (!container) return;
  let data = await api('/api/posts/featured?limit=8');
  let items = data?.items || [];
  // Fallback to popular posts if no featured
  if (!items.length) {
    data = await api('/api/posts?page=1&sort=popular&per_page=8');
    items = data?.items || [];
  }
  if (!items.length) { container.style.display = 'none'; return; }

  const slides = items.slice(0, 6);
  let currentSlide = 0;
  let carouselTimer = null;

  container.innerHTML = `
    <div class="hero-track" id="hero-track">
      ${slides.map((p, i) => {
        const isV = p.file_type === 'video';
        const cv = p.cover_image ? `${API}/${p.cover_image}` : '';
        return `<div class="hero-slide ${i===0?'active':''}" data-index="${i}" onclick="if(${isV}&&!state.user){showLogin();return;} navigate('post',${p.id})">
          ${cv ? `<img src="${cv}" alt="${esc(p.title)}" loading="${i===0?'eager':'lazy'}">` : `<div class="hero-slide-placeholder">${isV?'<svg width="3rem" height="3rem" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="14" height="14" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M17 9l5-3v12l-5-3" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>':'<svg width="3rem" height="3rem" viewBox="0 0 24 24" fill="none"><path d="M4 9v6M8 5v14M12 7v10M16 9v6M20 10v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>'}</div>`}
          <div class="hero-slide-overlay"></div>
          <div class="hero-slide-content">
            <div class="hero-slide-badge">${isV?ICO.video+' 视频':ICO.audio+' 音频'} · ${p.category ? esc(p.category.name) : '精选'}</div>
            <h2 class="hero-slide-title">${esc(p.title)}</h2>
            <p class="hero-slide-meta">${ICO.eye} ${p.views} 次播放 · ${ICO.heart} ${p.favorite_count||0} 收藏</p>
            <button class="hero-slide-play" onclick="event.stopPropagation();if(${isV}&&!state.user){showLogin();return;} navigate('post',${p.id})" aria-label="播放">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor"><path d="M6 4l11 6-11 6V4z"/></svg>
              立即播放
            </button>
          </div>
        </div>`;
      }).join('')}
    </div>
    <div class="hero-dots">
      ${slides.map((_, i) => `<button class="hero-dot ${i===0?'active':''}" data-index="${i}" aria-label="第 ${i+1} 张"></button>`).join('')}
    </div>
    <button class="hero-arrow hero-prev" aria-label="上一张"><svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M12 4l-6 6 6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
    <button class="hero-arrow hero-next" aria-label="下一张"><svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M8 4l6 6-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`;

  const track = $('hero-track');
  const dots = container.querySelectorAll('.hero-dot');
  const slidesEls = container.querySelectorAll('.hero-slide');

  function goTo(idx) {
    currentSlide = (idx + slides.length) % slides.length;
    slidesEls.forEach((s, i) => s.classList.toggle('active', i === currentSlide));
    dots.forEach((d, i) => d.classList.toggle('active', i === currentSlide));
  }

  function startAuto() {
    carouselTimer = setInterval(() => goTo(currentSlide + 1), 5000);
  }
  function stopAuto() { if (carouselTimer) { clearInterval(carouselTimer); carouselTimer = null; } }

  dots.forEach(d => d.addEventListener('click', e => { e.stopPropagation(); goTo(parseInt(d.dataset.index)); stopAuto(); startAuto(); }));
  container.querySelector('.hero-prev').addEventListener('click', e => { e.stopPropagation(); goTo(currentSlide - 1); stopAuto(); startAuto(); });
  container.querySelector('.hero-next').addEventListener('click', e => { e.stopPropagation(); goTo(currentSlide + 1); stopAuto(); startAuto(); });
  container.addEventListener('mouseenter', stopAuto);
  container.addEventListener('mouseleave', startAuto);
  startAuto();
}

async function toggleFeatured(postId, current) {
  const btn = $('feat-btn');
  const r = await api(`/api/admin/posts/${postId}/featured`, {
    method: 'PUT',
    body: JSON.stringify({ featured: !current })
  });
  if (r?.ok) {
    toast(`${!current ? '已设为精选' : '已取消精选'}`, 'success');
    renderPost();
  } else {
    toast(r?.detail || '操作失败', 'error');
  }
}

async function toggleAdminFeatured(postId, current) {
  const r = await api(`/api/admin/posts/${postId}/featured`, {
    method: 'PUT',
    body: JSON.stringify({ featured: !current })
  });
  if (r?.ok) {
    toast(`${!current ? '已设为精选' : '已取消精选'}`, 'success');
    renderAdmin();
  } else {
    toast(r?.detail || '操作失败', 'error');
  }
}

// ─── PRD-020 Reports ───
function showReportDialog(targetType, targetId) {
  if (!state.user) { showLogin(); return; }
  if (qs('.report-modal')) return;
  const o = document.createElement('div'); o.className = 'auth-modal report-modal';
  o.innerHTML = `<div class="auth-box">
    <h2>${ICO.flag} 举报</h2>
    <p class="sub">请描述举报理由，管理员将尽快处理</p>
    <div class="input-group"><label>举报理由</label>
      <textarea id="report-reason" placeholder="请输入举报理由..." style="width:100%;min-height:100px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--rs);padding:10px 12px;color:var(--text);font-size:.85rem;resize:vertical;font-family:inherit"></textarea>
    </div>
    <div class="auth-actions">
      <button class="btn btn-secondary" onclick="this.closest('.auth-modal').remove()">取消</button>
      <button class="btn btn-primary" onclick="submitReport('${targetType}',${targetId})">提交举报</button>
    </div>
  </div>`;
  document.body.appendChild(o);
  setTimeout(() => $('report-reason')?.focus(), 100);
}

async function submitReport(targetType, targetId) {
  const reason = $('report-reason')?.value.trim();
  if (!reason) { toast('请输入举报理由', 'error'); return; }
  const btn = qs('.report-modal .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = '提交中…'; }
  const r = await api('/api/reports', {
    method: 'POST',
    body: JSON.stringify({ target_type: targetType, target_id: targetId, reason })
  });
  if (r?.id || r?.ok) {
    toast('举报已提交，管理员将尽快处理', 'success');
    qs('.report-modal')?.remove();
  } else {
    if (btn) { btn.disabled = false; btn.textContent = '提交举报'; }
    toast(r?.detail || '举报失败', 'error');
  }
}

async function renderAdminReports() {
  if (!state.user || state.user.role !== 'admin') { navigate('home'); toast(`${ICO.ban} 无权限`, 'error'); return; }
  const con = $('content');
  con.innerHTML = `<button class="back" onclick="navigate()">${ICO.back} 返回</button>
    <div class="admin-hero">
      <h1>${ICO.flag} 举报队列</h1>
      <div class="sub">处理用户举报内容 · 维护社区健康</div>
    </div>
    ${adminTabs('reports')}
    <div id="reports-list"><div class="loading"><div class="spinner"><span></span><span></span><span></span><span></span><span></span></div></div></div>`;
  const data = await api('/api/admin/reports?status=pending') || {};
  const items = data.items || data || [];
  const list = $('reports-list');
  if (!Array.isArray(items) || !items.length) {
    list.innerHTML = '<div class="empty-state"><div class="icon">'+ICO.check+'</div><p>暂无待处理举报</p></div>';
    return;
  }
  list.innerHTML = items.map(r => {
    const targetType = r.target_type === 'post' ? ICO.doc+' 内容' : ICO.chat+' 评论';
    const summary = r.target_title || r.target_content || r.target_summary || `#${r.target_id}`;
    const reporter = r.reporter?.username || r.reporter_name || '匿名';
    return `<div class="report-item">
      <div class="report-meta">
        <span class="badge badge-user">${targetType}</span>
        <span>${ICO.user} ${esc(reporter)}</span>
        <span>${ICO.calendar} ${dt(r.created_at)}</span>
      </div>
      <div class="report-title">${esc(summary)}</div>
      <div class="report-reason">${ICO.chat} ${esc(r.reason || '未提供理由')}</div>
      <div class="report-actions">
        <button class="btn btn-secondary" style="color:#f87171;padding:6px 10px;font-size:.8rem" onclick="handleReport(${r.id},'delete_content')">${ICO.trash} 删除内容</button>
        <button class="btn btn-secondary" style="color:#f59e0b;padding:6px 10px;font-size:.8rem" onclick="handleReport(${r.id},'ban_user')">${ICO.ban} 封禁用户</button>
        <button class="btn btn-ghost" style="padding:6px 10px;font-size:.8rem" onclick="handleReport(${r.id},'none')">${ICO.cross} 驳回</button>
      </div>
    </div>`;
  }).join('');
}

async function handleReport(reportId, action) {
  const status = action === 'none' ? 'dismissed' : 'resolved';
  const actionText = action === 'delete_content' ? '删除内容' : action === 'ban_user' ? '封禁用户' : '驳回';
  if (!confirm(`确定执行「${actionText}」操作吗？`)) return;
  const r = await api(`/api/admin/reports/${reportId}`, {
    method: 'PUT',
    body: JSON.stringify({ status, action })
  });
  if (r?.ok) {
    toast(`已${actionText}`, 'success');
    renderAdminReports();
  } else {
    toast(r?.detail || '操作失败', 'error');
  }
}

// ─── PRD-018 Transcode ───
let _transcodePollTimer = null;

async function retryTranscode(postId) {
  if (!confirm('确定重试转码吗？')) return;
  const r = await api(`/api/admin/transcode/${postId}/retry`, { method: 'POST' });
  if (r?.ok) {
    toast('已提交重试', 'success');
    if (state.view === 'post') renderPost();
    else if (state.view === 'admin-transcode') renderAdminTranscode();
  } else {
    toast(r?.detail || '重试失败', 'error');
  }
}

async function renderAdminTranscode() {
  if (!state.user || state.user.role !== 'admin') { navigate('home'); toast(`${ICO.ban} 无权限`, 'error'); return; }
  const con = $('content');
  con.innerHTML = `<button class="back" onclick="navigate()">${ICO.back} 返回</button>
    <div class="admin-hero">
      <h1>转码队列</h1>
      <div class="sub">监控转码任务状态 · 自动重试机制保障</div>
    </div>
    ${adminTabs('transcode')}
    <div id="transcode-status"><div class="loading"><div class="spinner"><span></span><span></span><span></span><span></span><span></span></div></div></div>
    <div class="section-head"><h2>任务列表</h2></div>
    <div id="transcode-list"><div class="loading"><div class="spinner"><span></span><span></span><span></span><span></span><span></span></div></div></div>`;
  loadTranscodeStatus();
  loadTranscodeList();
  if (_transcodePollTimer) clearInterval(_transcodePollTimer);
  _transcodePollTimer = setInterval(() => {
    if (state.view !== 'admin-transcode') { clearInterval(_transcodePollTimer); _transcodePollTimer = null; return; }
    loadTranscodeStatus();
    loadTranscodeList();
  }, 10000);
}

async function loadTranscodeStatus() {
  const el = $('transcode-status');
  if (!el) return;
  const data = await api('/api/admin/transcode/status') || {};
  const processing = data.processing || 0;
  const failed = data.failed || 0;
  const done = data.done || data.ready || 0;
  el.innerHTML = `<div class="kpi-grid" style="margin-bottom:18px">
    <div class="kpi-card kpi-warn"><div class="kpi-value">${processing}</div><div class="kpi-label">${ICO.hourglass} 处理中</div></div>
    <div class="kpi-card kpi-danger"><div class="kpi-value">${failed}</div><div class="kpi-label">失败</div></div>
    <div class="kpi-card kpi-ok"><div class="kpi-value">${done}</div><div class="kpi-label">已完成</div></div>
  </div>`;
}

async function loadTranscodeList() {
  const el = $('transcode-list');
  if (!el) return;
  const data = await api('/api/admin/transcode/list') || {};
  const items = data.items || data || [];
  if (!Array.isArray(items) || !items.length) {
    el.innerHTML = '<div class="empty-state"><div class="icon">'+ICO.film+'</div><p>暂无转码任务</p></div>';
    return;
  }
  el.innerHTML = items.map(p => {
    const status = p.status || p.transcode_status || 'unknown';
    const badgeClass = status === 'processing' ? 'badge-processing' : status === 'failed' ? 'badge-failed' : 'badge-ready';
    const statusText = status === 'processing' ? ICO.hourglass+' 处理中' : status === 'failed' ? '失败' : status === 'ready' || status === 'done' ? '已完成' : status;
    return `<div class="admin-row">
      <div class="row-icon">${p.file_type === 'video' ? ICO.film : ICO.audio}</div>
      <div class="row-main">
        <div class="row-title">${esc(p.title)}</div>
        <div class="row-meta">
          <span class="badge ${badgeClass}">${statusText}</span>
          ${p.duration > 0 ? `<span>${ICO.clock} ${dur(p.duration)}</span>` : ''}
          <span>${ICO.box} ${fs(p.file_size)}</span>
          <span>${ICO.eye} ${p.views || 0}</span>
        </div>
      </div>
      <div class="row-actions">
        ${status === 'failed' ? `<button class="btn btn-ghost" style="padding:6px 10px;font-size:.8rem" onclick="retryTranscode(${p.id})">${ICO.refresh} 重试</button>` : ''}
        <button class="btn btn-ghost" style="padding:6px 10px;font-size:.8rem" onclick="navigate('post',${p.id})">${ICO.eye} 查看</button>
      </div>
    </div>`;
  }).join('');
}

// ─── PRD-021 Play Session ───
async function startPlaySession(postId) {
  if (!state.user) return null;
  const r = await api(`/api/posts/${postId}/play-session`, {
    method: 'POST',
    body: JSON.stringify({ action: 'start' })
  });
  if (r?.session_id) {
    state.currentSessionId = r.session_id;
    return r.session_id;
  }
  return null;
}

async function updatePlaySession(postId, playedSeconds) {
  if (!state.user || !state.currentSessionId) return;
  await api(`/api/posts/${postId}/play-session`, {
    method: 'POST',
    body: JSON.stringify({ action: 'update', session_id: state.currentSessionId, played_seconds: playedSeconds })
  });
}

async function endPlaySession(postId, playedSeconds, duration) {
  if (!state.user || !state.currentSessionId) return;
  await api(`/api/posts/${postId}/play-session`, {
    method: 'POST',
    body: JSON.stringify({ action: 'end', session_id: state.currentSessionId, played_seconds: playedSeconds, duration })
  });
  state.currentSessionId = null;
}

window.addEventListener('beforeunload', () => {
  if (state.currentSessionId && state.postId) {
    const m = document.querySelector('audio, video');
    if (m) {
      const ct = Math.floor(m.currentTime || 0);
      const d = Math.floor(m.duration || 0);
      navigator.sendBeacon && navigator.sendBeacon(`${API}/api/posts/${state.postId}/play-session`,
        new Blob([JSON.stringify({ action: 'end', session_id: state.currentSessionId, played_seconds: ct, duration: d })], { type: 'application/json' }));
    }
  }
});

// ─── PRD-012 Comments ───
let _commentPage = 1;

async function loadComments(postId) {
  const list = $('comments-list');
  if (!list) return;
  _commentPage = 1;
  const data = await api(`/api/posts/${postId}/comments?page=${_commentPage}`);
  renderCommentList(data, postId);
}

function renderCommentList(data, postId) {
  const list = $('comments-list');
  if (!list) return;
  const items = data?.items || [];
  if (!items.length) {
    list.innerHTML = '<div style="text-align:center;color:var(--text3);padding:20px;font-size:.85rem">暂无评论，来发表第一条吧~</div>';
    return;
  }
  let html = items.map(c => {
    const canDelete = state.user && (state.user.role === 'admin' || (c.user && c.user.id === state.user.id));
    const canReport = !!state.user;
    const isAdminComment = c.user?.role==='admin';
    return `<div class="cmt">
      <div class="cmt-avatar ${isAdminComment?'cmt-avatar-admin':''}">${esc((c.user?.username||'匿')[0])}</div>
      <div class="cmt-body">
        <div class="cmt-head">
          <div class="cmt-user">
            <span class="cmt-name">${esc(c.user?.username || '匿名')}</span>
            ${isAdminComment?'<span class="cmt-badge-admin">管理员</span>':''}
          </div>
          <span class="cmt-time">${dt(c.created_at)}</span>
        </div>
        <div class="cmt-text">${esc(c.content)}</div>
        ${(canDelete||canReport) ? `<div class="cmt-actions">
          ${canReport?`<button class="cmt-action" onclick="showReportDialog('comment',${c.id})">${ICO.flag} 举报</button>`:''}
          ${canDelete?`<button class="cmt-action cmt-action-danger" onclick="deleteComment(${c.id},${postId})">${ICO.trash} 删除</button>`:''}
        </div>` : ''}
      </div>
    </div>`;
  }).join('');
  if (data.total_pages > 1) {
    html += `<div class="cmt-pager">
      <button class="btn btn-secondary" onclick="_commentPage--;loadMoreComments(${postId})" ${_commentPage<=1?'disabled':''}>上一页</button>
      <span>第 ${data.page} / ${data.total_pages} 页</span>
      <button class="btn btn-secondary" onclick="_commentPage++;loadMoreComments(${postId})" ${_commentPage>=data.total_pages?'disabled':''}>下一页</button>
    </div>`;
  }
  list.innerHTML = html;
}

async function loadMoreComments(postId) {
  const data = await api(`/api/posts/${postId}/comments?page=${_commentPage}`);
  renderCommentList(data, postId);
}

async function submitComment(postId) {
  if (!state.user) { showLogin(); return; }
  const input = $('comment-input');
  const content = input?.value.trim();
  if (!content) { toast('请输入评论内容', 'error'); return; }
  const r = await api(`/api/posts/${postId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ content })
  });
  if (r?.id) {
    toast('评论成功', 'success');
    if (input) input.value = '';
    loadComments(postId);
  } else {
    toast(r?.detail || '评论失败', 'error');
  }
}

async function deleteComment(commentId, postId) {
  if (!confirm('确定删除这条评论吗？')) return;
  const r = await api(`/api/comments/${commentId}`, { method: 'DELETE' });
  if (r?.ok) {
    toast('已删除', 'success');
    loadComments(postId);
  } else {
    toast(r?.detail || '删除失败', 'error');
  }
}

// ═══════════════════════════════════════
// ─── PRD-013 Player Enhancements ───
// ═══════════════════════════════════════
const PM_KEY = 'asmr_playmode';
const PM_VOL = 'asmr_volume';
const PM_MUTED = 'asmr_muted';
const PM_SPEED = 'asmr_speed';
const PM_ORDER = ['list', 'single', 'random'];
const PM_ICON = { list: ICO.repeat, single: ICO.repeatOne, random: ICO.shuffle };
const PM_LABEL = { list: '列表循环', single: '单曲循环', random: '随机播放' };

function getPlayMode() { return localStorage.getItem(PM_KEY) || 'list'; }
function getPlayModeIcon() { return PM_ICON[getPlayMode()] || ICO.repeat; }

function cyclePlayMode(pid) {
  const cur = getPlayMode();
  const next = PM_ORDER[(PM_ORDER.indexOf(cur) + 1) % PM_ORDER.length];
  localStorage.setItem(PM_KEY, next);
  const btn = document.getElementById(`apm-${pid}`) || document.getElementById(`vpm-${pid}`);
  if (btn) { btn.textContent = PM_ICON[next]; btn.title = PM_LABEL[next]; }
  toast(`${PM_ICON[next]} ${PM_LABEL[next]}`, 'info');
}

function applySavedMediaSettings(media, pid, isVideo) {
  const savedVol = parseFloat(localStorage.getItem(PM_VOL));
  if (!isNaN(savedVol) && savedVol >= 0 && savedVol <= 1) {
    media.volume = savedVol;
    const slider = document.getElementById(isVideo ? `vvs-${pid}` : `avs-${pid}`);
    if (slider) slider.value = savedVol;
  }
  const savedMuted = localStorage.getItem(PM_MUTED) === '1';
  media.muted = savedMuted;
  const muteBtn = document.getElementById(isVideo ? `vvb-${pid}` : `avb-${pid}`);
  if (muteBtn) muteBtn.innerHTML = savedMuted ? ICO.mute : ICO.volume;
  const savedSpeed = parseFloat(localStorage.getItem(PM_SPEED));
  if (!isNaN(savedSpeed) && savedSpeed > 0) {
    media.playbackRate = savedSpeed;
    if (!isVideo) {
      const sp = document.getElementById(`aspd-${pid}`);
      if (sp) sp.textContent = `${savedSpeed}x`;
    }
  }
  const pmBtn = document.getElementById(isVideo ? `vpm-${pid}` : `apm-${pid}`);
  if (pmBtn) { pmBtn.textContent = getPlayModeIcon(); pmBtn.title = PM_LABEL[getPlayMode()]; }
}

function handlePlaybackEnded(pid, media) {
  const mode = getPlayMode();
  if (mode === 'single') {
    media.currentTime = 0;
    media.play().catch(() => {});
    return;
  }
  if (mode === 'random') {
    playRandomRelated(pid);
    return;
  }
  playNext();
}

async function playRandomRelated(pid) {
  const data = await api(`/api/posts/${pid}/related?limit=10`);
  const items = data?.items || [];
  if (!items.length) { playNext(); return; }
  const pick = items[Math.floor(Math.random() * items.length)];
  toast(`${ICO.shuffle} 随机播放：${pick.title}`, 'info');
  navigate('post', pick.id);
}

// ─── Media Session API ───
function setupMediaSession(p, cover) {
  if (!('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: p.title || 'Murmur',
      artist: p.user?.username || 'Murmur',
      album: p.category?.name || 'ASMR',
      artwork: cover ? [{ src: cover, sizes: '512x512', type: 'image/jpeg' }] : []
    });
    navigator.mediaSession.setActionHandler('play', () => {
      const m = document.querySelector('audio, video'); if (m) m.play();
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      const m = document.querySelector('audio, video'); if (m) m.pause();
    });
    navigator.mediaSession.setActionHandler('seekbackward', () => {
      const m = document.querySelector('audio, video');
      if (m) m.currentTime = Math.max(0, m.currentTime - 5);
    });
    navigator.mediaSession.setActionHandler('seekforward', () => {
      const m = document.querySelector('audio, video');
      if (m) m.currentTime = Math.min(m.duration || 0, m.currentTime + 5);
    });
  } catch (e) {}
}

function updateMediaSessionState(playing) {
  if ('mediaSession' in navigator) {
    try { navigator.mediaSession.playbackState = playing ? 'playing' : 'paused'; } catch (e) {}
  }
}

// ─── Keyboard Shortcuts ───
function handleKeydown(e) {
  const el = document.activeElement;
  if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
  if (e.key === '?' || (e.shiftKey && e.key === '/')) {
    e.preventDefault(); toggleHelpOverlay(); return;
  }
  if (e.key === 'Escape') {
    const help = $('help-overlay');
    if (help) { help.remove(); return; }
    return;
  }
  const m = document.querySelector('audio, video');
  if (!m) return;
  switch (e.key) {
    case ' ':
      e.preventDefault();
      if (m.paused) m.play().catch(() => {}); else m.pause();
      break;
    case 'ArrowLeft':
      e.preventDefault();
      m.currentTime = Math.max(0, m.currentTime - (e.shiftKey ? 30 : 5));
      break;
    case 'ArrowRight':
      e.preventDefault();
      if (m.duration) m.currentTime = Math.min(m.duration, m.currentTime + (e.shiftKey ? 30 : 5));
      break;
    case 'ArrowUp':
      e.preventDefault();
      m.volume = Math.min(1, Math.round((m.volume + 0.1) * 100) / 100);
      localStorage.setItem(PM_VOL, m.volume);
      if (m.muted) { m.muted = false; localStorage.setItem(PM_MUTED, '0'); updateMuteBtnVisual(m); }
      break;
    case 'ArrowDown':
      e.preventDefault();
      m.volume = Math.max(0, Math.round((m.volume - 0.1) * 100) / 100);
      localStorage.setItem(PM_VOL, m.volume);
      break;
    case 'm': case 'M':
      e.preventDefault();
      m.muted = !m.muted;
      localStorage.setItem(PM_MUTED, m.muted ? '1' : '0');
      updateMuteBtnVisual(m);
      break;
    case 'f': case 'F':
      e.preventDefault();
      if (m.tagName === 'VIDEO') {
        if (document.fullscreenElement) document.exitFullscreen();
        else m.parentElement?.requestFullscreen?.();
      }
      break;
    case '1': case '2': case '3': case '4': case '5': {
      e.preventDefault();
      const speeds = [1, 1.25, 1.5, 2, 0.5];
      const idx = parseInt(e.key) - 1;
      m.playbackRate = speeds[idx];
      localStorage.setItem(PM_SPEED, speeds[idx]);
      const pid = (m.id || '').split('-').slice(1).join('-');
      const sp = document.getElementById(`aspd-${pid}`);
      if (sp) sp.textContent = `${speeds[idx]}x`;
      toast(`倍速 ${speeds[idx]}x`, 'info');
      break;
    }
  }
}

function updateMuteBtnVisual(m) {
  const pid = (m.id || '').split('-').slice(1).join('-');
  const btn = document.getElementById(`avb-${pid}`) || document.getElementById(`vvb-${pid}`);
  if (btn) btn.innerHTML = m.muted ? ICO.mute : ICO.volume;
}

function toggleHelpOverlay() {
  const existing = $('help-overlay');
  if (existing) { existing.remove(); return; }
  const o = document.createElement('div');
  o.id = 'help-overlay';
  o.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:9999;backdrop-filter:blur(2px)';
  o.onclick = (e) => { if (e.target === o) o.remove(); };
  const kbd = 'display:inline-block;padding:2px 8px;background:var(--bg3);border:1px solid var(--border);border-radius:4px;font-size:.75rem;font-family:monospace;min-width:24px;text-align:center';
  const row = 'display:flex;justify-content:space-between;align-items:center;gap:12px;padding:6px 0;border-bottom:1px solid var(--border)';
  o.innerHTML = `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--rs);padding:24px;max-width:440px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,.4)">
    <h2 style="margin:0 0 16px;font-size:1.1rem">${ICO.keyboard} 键盘快捷键</h2>
    <div style="font-size:.85rem">
      <div style="${row}"><span>播放 / 暂停</span><span style="${kbd}">Space</span></div>
      <div style="${row}"><span>快退 / 快进 5 秒</span><span><span style="${kbd}">←</span> / <span style="${kbd}">→</span></span></div>
      <div style="${row}"><span>快退 / 快进 30 秒</span><span><span style="${kbd}">Shift</span> + <span style="${kbd}">←/→</span></span></div>
      <div style="${row}"><span>音量增 / 减</span><span><span style="${kbd}">↑</span> / <span style="${kbd}">↓</span></span></div>
      <div style="${row}"><span>静音切换</span><span style="${kbd}">M</span></div>
      <div style="${row}"><span>全屏（视频）</span><span style="${kbd}">F</span></div>
      <div style="${row}"><span>切换倍速 1x/1.25x/1.5x/2x/0.5x</span><span style="${kbd}">1~5</span></div>
      <div style="${row}"><span>显示 / 隐藏此帮助</span><span style="${kbd}">?</span></div>
      <div style="${row};border-bottom:none"><span>关闭浮层</span><span style="${kbd}">Esc</span></div>
    </div>
    <div style="margin-top:16px;text-align:right">
      <button class="btn btn-secondary" onclick="this.closest('#help-overlay').remove()">关闭</button>
    </div>
  </div>`;
  document.body.appendChild(o);
}

// ═══════════════════════════════════════
// ─── PRD-014 Mobile & PWA ───
// ═══════════════════════════════════════

// ─── Mobile Sidebar Menu ───
function openSidebar() {
  const sb = $('sidebar'); const ov = $('sidebar-overlay');
  if (!sb || !ov) return;
  sb.classList.add('open');
  ov.classList.add('visible');
  document.body.style.overflow = 'hidden';
}
function closeSidebar() {
  const sb = $('sidebar'); const ov = $('sidebar-overlay');
  if (!sb || !ov) return;
  sb.classList.remove('open');
  ov.classList.remove('visible');
  document.body.style.overflow = '';
}
function toggleSidebar() {
  const sb = $('sidebar');
  if (!sb) return;
  if (sb.classList.contains('open')) closeSidebar(); else openSidebar();
}

// ─── Video Double-Tap Gestures ───
function attachVideoGestures(pid) {
  const wrap = document.getElementById(`vpw-${pid}`);
  if (!wrap || wrap._gestureBound) return;
  wrap._gestureBound = true;
  let lastTap = 0;
  let lastTapZone = null;
  wrap.addEventListener('touchend', (e) => {
    if (!e.changedTouches || e.changedTouches.length !== 1) return;
    const touch = e.changedTouches[0];
    const rect = wrap.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const zone = x < rect.width / 3 ? 'left' : (x > rect.width * 2 / 3 ? 'right' : 'center');
    const now = Date.now();
    const delta = now - lastTap;
    if (delta < 300 && lastTapZone === zone) {
      // Double-tap detected
      e.preventDefault();
      const v = document.getElementById(`vel-${pid}`);
      if (v) {
        if (zone === 'left') {
          // Undo the first tap's play/pause toggle, then rewind 10s
          vtoggle(pid);
          v.currentTime = Math.max(0, v.currentTime - 10);
          showVideoGestureFeedback(wrap, ICO.rewind, 'left');
        } else if (zone === 'right') {
          // Undo the first tap's play/pause toggle, then forward 10s
          vtoggle(pid);
          v.currentTime = Math.min(v.duration || 0, v.currentTime + 10);
          showVideoGestureFeedback(wrap, ICO.fastForward, 'right');
        } else {
          // Center: first tap already toggled once, which is the expected behavior
          showVideoGestureFeedback(wrap, ICO.play, 'center');
        }
      }
      lastTap = 0;
      lastTapZone = null;
    } else {
      lastTap = now;
      lastTapZone = zone;
    }
  }, { passive: false });
}

function showVideoGestureFeedback(wrap, icon, zone) {
  const fb = document.createElement('div');
  fb.className = `video-gesture-fb ${zone}`;
  fb.innerHTML = icon;
  wrap.appendChild(fb);
  setTimeout(() => fb.remove(), 600);
}

// ─── Offline / Online Banner ───
function showOfflineBanner() {
  if ($('offline-banner')) return;
  const b = document.createElement('div');
  b.id = 'offline-banner';
  b.className = 'offline-banner visible';
  b.textContent = '网络已断开，部分功能不可用';
  document.body.appendChild(b);
}
function hideOfflineBanner() {
  const b = $('offline-banner');
  if (b) b.remove();
}

// ─── PWA Install Prompt ───
function promptInstall() {
  if (!_deferredPrompt) return;
  _deferredPrompt.prompt();
  _deferredPrompt.userChoice.then(() => {
    _deferredPrompt = null;
    const btn = $('install-btn');
    if (btn) btn.classList.remove('visible');
    updateUI();
  }).catch(() => {});
}

// ─── Init ───
loadQueue();
document.addEventListener('keydown', handleKeydown);
document.addEventListener('DOMContentLoaded', () => {
  // Global keyboard accessibility for role="button" elements (WCAG 2.1 AA)
  document.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.getAttribute('role') === 'button') {
      e.preventDefault();
      e.target.click();
    }
  });

  // Mobile menu
  $('menu-toggle')?.addEventListener('click', toggleSidebar);
  $('sidebar-close')?.addEventListener('click', closeSidebar);
  $('sidebar-overlay')?.addEventListener('click', closeSidebar);

  // Sidebar nav items
  document.querySelectorAll('.sb-nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const nav = item.dataset.nav;
      if (nav === 'home') navigate('home');
      else if (nav === 'history') navigate('history');
      else if (nav === 'favorites') navigate('favorites');
      else if (nav === 'upload') navigate('upload');
      else if (nav === 'settings') { if(state.user) navigate('settings'); else showLogin(); }
      closeSidebar();
    });
  });

  // Bottom nav
  document.querySelectorAll('.bn-item').forEach(item => {
    item.addEventListener('click', () => {
      const nav = item.dataset.nav;
      if (nav === 'home') navigate('home');
      else if (nav === 'search') { state.search=''; state.page=1; navigate('home'); setTimeout(()=>{const si=$('si'); if(si){si.focus();si.scrollIntoView({behavior:'smooth',block:'center'});}},100); }
      else if (nav === 'upload') navigate('upload');
      else if (nav === 'favorites') navigate('favorites');
      else if (nav === 'profile') { if(state.user) navigate('settings'); else showLogin(); }
    });
  });

  // Online / Offline
  window.addEventListener('online', () => { hideOfflineBanner(); toast('网络已恢复', 'success'); });
  window.addEventListener('offline', showOfflineBanner);
  if (!navigator.onLine) showOfflineBanner();

  // PWA install prompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    _deferredPrompt = e;
    updateUI();
  });
  window.addEventListener('appinstalled', () => {
    _deferredPrompt = null;
    const btn = $('install-btn');
    if (btn) btn.classList.remove('visible');
    toast('安装成功', 'success');
  });

  initI18n().then(() => {
    checkAuth(); loadCats(); navigate('home'); initMiniPlayer();
  });
});

// ─── Service Worker Registration ───
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.getRegistrations().then(regs => {
      regs.forEach(r => r.update());
    });
    navigator.serviceWorker.register('/static/sw.js').then(reg => {
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        if (nw) nw.addEventListener('statechange', () => {
          if (nw.state === 'activated') navigator.serviceWorker.controller && location.reload();
        });
      });
    }).catch(() => {});
  });
}

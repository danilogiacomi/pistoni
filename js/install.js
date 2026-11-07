// Installazione della PWA: pulsante nativo (Chrome/Edge/Android) o istruzioni (iOS/Safari).
let deferred = null;
const listeners = new Set();
const DISMISS_KEY = 'pistoni:installDismissed';

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e;
  listeners.forEach((fn) => fn());
});
window.addEventListener('appinstalled', () => {
  deferred = null;
  listeners.forEach((fn) => fn());
});

export const install = {
  isInstalled() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  },
  canPrompt() { return !!deferred; },
  platform() {
    const ua = navigator.userAgent;
    const iOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (iOS) return /CriOS|FxiOS|EdgiOS/.test(ua) ? 'ios-other' : 'ios';
    if (/Android/.test(ua)) return 'android';
    if (/Safari/.test(ua) && !/Chrome|Chromium|Edg/.test(ua)) return 'mac-safari';
    if (/Firefox/.test(ua)) return 'firefox';
    return 'desktop';
  },
  async prompt() {
    if (!deferred) return false;
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    deferred = null;
    listeners.forEach((fn) => fn());
    return outcome === 'accepted';
  },
  dismissed() {
    try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch (e) { return false; }
  },
  dismiss() {
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch (e) { /* */ }
  },
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
};

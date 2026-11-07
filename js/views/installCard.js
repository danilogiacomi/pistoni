import { h, toast } from '../ui.js';
import { install } from '../install.js';

const SHARE_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-3px"><path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>';

function steps(platform) {
  switch (platform) {
    case 'ios':
      return [
        `Tocca il pulsante <b>Condividi</b> ${SHARE_ICON} nella barra di Safari.`,
        'Scorri e scegli <b>"Aggiungi alla schermata Home"</b>.',
        'Tocca <b>Aggiungi</b>: l\'icona di Pistoni comparirà tra le tue app.',
      ];
    case 'ios-other':
      return [
        'Su iPhone e iPad si installa da <b>Safari</b> (o dal menu Condividi del tuo browser, se presente).',
        `Apri questa pagina in Safari, tocca <b>Condividi</b> ${SHARE_ICON} e poi <b>"Aggiungi alla schermata Home"</b>.`,
      ];
    case 'android':
      return [
        'Apri il menu del browser <b>⋮</b> (in alto a destra in Chrome).',
        'Scegli <b>"Installa app"</b> o <b>"Aggiungi a schermata Home"</b>.',
      ];
    case 'mac-safari':
      return ['Nel menu <b>File</b> di Safari scegli <b>"Aggiungi al Dock…"</b>.'];
    case 'firefox':
      return ['Firefox per computer non installa le web app: apri questa pagina con Chrome, Edge o Safari. Su Android, Firefox ha "Installa" nel menu ⋮.'];
    default:
      return ['Cerca l\'icona di installazione <b>⊕</b> nella barra degli indirizzi, oppure il menu del browser → <b>"Installa Pistoni"</b>.'];
  }
}

/**
 * Riquadro di installazione. In home (compact) si nasconde se l'app è già installata
 * o se l'utente ha scelto "Non ora". In Impostazioni è sempre visibile.
 */
export function installCard({ compact = false } = {}) {
  const card = h('section', { class: 'card install-card' });

  const render = () => {
    card.replaceChildren();
    if (install.isInstalled()) {
      if (compact) { card.hidden = true; return; }
      card.append(h('h2', {}, 'App installata ✅'), h('p', { class: 'muted small' }, 'Stai usando Pistoni come app: funziona anche senza internet.'));
      return;
    }
    if (compact && install.dismissed()) { card.hidden = true; return; }
    card.hidden = false;

    card.append(
      h('div', { class: 'install-head' },
        h('img', { src: 'icons/icon-192.png', alt: '', width: 48, height: 48 }),
        h('div', {},
          h('h2', {}, 'Installa Pistoni sul telefono'),
          h('p', { class: 'muted small' }, 'Si apre come un\'app, a schermo intero, e funziona anche offline. È gratis e non serve nessuno store.'))),
    );

    if (install.canPrompt()) {
      card.append(h('button', {
        class: 'btn btn-primary btn-lg',
        onclick: async () => { if (await install.prompt()) toast('Installata! La trovi tra le tue app 🎺'); render(); },
      }, '⬇︎ Installa l\'app'));
    } else {
      card.append(h('ol', { class: 'install-steps' }, steps(install.platform()).map((s) => h('li', { html: s }))));
    }
    if (compact) {
      card.append(h('button', { class: 'btn btn-ghost install-later', onclick: () => { install.dismiss(); card.hidden = true; } }, 'Non ora'));
    }
  };

  render();
  const off = install.onChange(render);
  card.cleanup = off;
  return card;
}

# 🎺 Pistoni

PWA gratuita per chi suona la tromba (in Si♭). Funziona nel browser, si installa sul telefono e va anche offline.

**Apri l'app:** https://danilogiacomi.github.io/pistoni/

## Cosa contiene

- **Oggi** – routine quotidiana guidata (respirazione → buzzing → note lunghe → legati labiali → scala del giorno → articolazione → agilità → brani), cronometro di studio, serie di giorni consecutivi e diario settimanale.
- **Esercizi** – spartito generato (VexFlow) con suono guida, click e count-in: note lunghe, legati labiali sulle 7 posizioni, scale (maggiori e minori, 1–2 ottave, tutte le tonalità), arpeggi, studi di agilità in stile Clarke, scala cromatica, colpo di lingua semplice/doppio/triplo, buzzing al bocchino.
- **Suona e verifica** – in ogni esercizio l'app ascolta dal microfono mentre suoni e colora ogni nota (verde giusta e intonata, gialla stonata, rossa sbagliata, grigia non sentita), poi dà un punteggio con record personale e consigli.
- **Registratore** – registra un esercizio o un brano libero, riascoltati, condividi o scarica il file (le ultime 30 registrazioni restano sul dispositivo, in IndexedDB).
- **Pistoni** – tabella delle diteggiature con diteggiature alternative e consigli di intonazione, quiz, serie degli armonici.
- **Accordatore** – rileva la nota dal microfono (metodo McLeod), mostra la nota scritta per tromba in Si♭ e il suono reale, i cent, la diteggiatura e un grafico di stabilità per le note lunghe.
- **Metronomo** – tap tempo, suddivisioni, accento, accelerazione automatica, battute mute.
- **Altro** – bordone per l'intonazione, esercizi di respirazione, tabella di trasposizione, consigli su postura, imboccatura, studio, olio e pulizia.

## Tecnica

HTML/CSS/JavaScript senza build (moduli ES). Web Audio API per suoni e metronomo, `getUserMedia` per accordatore e verifica, `MediaRecorder` per il registratore, service worker per l'uso offline, dati salvati solo in `localStorage`.

Notazione: [VexFlow](https://www.vexflow.com) 4.2.5 (MIT), incluso in `vendor/`.

Per provarla in locale: `python3 -m http.server` e apri http://localhost:8000.

# AJE — controllo visivo rispetto alle tavole

**Findings**

- Nessun problema P0, P1 o P2 rimane aperto dopo l’ultimo confronto.
- [P3] La UI usa Inter e DM Serif Display con fallback di sistema, ma i font non sono incorporati localmente: l’aspetto può variare leggermente fra dispositivi. Per l’uso offline sono stati mantenuti fallback locali.
- [P3] I pannelli di Home e Documenti dipendono dai dati reali: senza movimenti il grafico è vuoto e senza documenti compare lo stato vuoto. La cattura usa fixture sintetiche per rendere visibile l’aspetto popolato, senza scrivere dati nel backend.

**Open Questions**

- Le tavole sono board riepilogative con viste desktop/mobile, non file di design con misure o token esportabili. Sono state trattate come riferimento visivo, conservando i flussi già presenti nell’app.
- La verifica descritta qui è stata svolta sulla versione locale; la pubblicazione del frontend è stata richiesta successivamente.

**Implementation Checklist**

- Palette crema, verde petrolio e indaco; tema scuro coordinato.
- Navigazione laterale desktop e barra inferiore mobile.
- Titoli display, superfici e spaziatura applicati alle otto pagine esistenti.
- Home/Finanze con dati demo visibili durante la cattura.
- Agenda con attività e calendario affiancati su desktop; selezione a schede e cambio Attività/Calendario su mobile.
- Input dell’assistente disposto correttamente rispetto alla sidebar; mappa carburanti ridimensionata correttamente anche su desktop.
- Nessun dato finanziario reale o credenziale usato nelle catture.

## Fonti, preview e misure

Tavole sorgente fornite dall’utente:

- `C:/Users/stafi.000/Desktop/Immagine Codex 23 set 2026, 16_00_31-1.png` — 1055 × 1491 px, tema chiaro e accesso/home/finanze.
- `C:/Users/stafi.000/Desktop/Immagine Codex 23 set 2026, 16_00_38-2.png` — 1055 × 1491 px, agenda/documenti/assistente/carburanti.
- `C:/Users/stafi.000/Desktop/Immagine Codex 23 set 2026, 16_00_42-3.png` — 1055 × 1491 px, impostazioni/guida/stati.
- `C:/Users/stafi.000/Desktop/Immagine Codex 23 set 2026, 16_00_46.png` — 1448 × 1086 px, tema scuro.

Implementazione browser-rendered: `output/playwright/aje-ui-screenshots/`, catturata con Chromium, device scale factor 1, desktop 1440 × 1000 CSS px (full-page) e mobile 390 × 844 CSS px (viewport). Home desktop/tema scuro risultano 1440 × 1241 px a pagina intera; Agenda desktop 1440 × 1000 px; le schermate telefono sono 390 × 844 px. Le tavole includono più schermate e dispositivi nella stessa immagine: per il confronto sono state usate aree di contenuto ritagliate e affiancate alle catture browser, poi normalizzate alla stessa dimensione per il controllo visivo. L’intera immagine composita non è stata confrontata come fosse una singola schermata app.

Confronti alla radice del bundle screenshot:

- `compare-home-light.png` — area dashboard del riferimento chiaro vs Home desktop.
- `compare-agenda-light.png` — agenda desktop affiancata vs implementazione desktop.
- `compare-home-dark.png` — dashboard scura vs Home desktop con tema scuro.

Altre prove: `agenda-calendar-mobile.png` mostra la scheda Calendario dopo averla selezionata; `impostazioni-desktop.png` mostra le impostazioni; le versioni mobile e le altre pagine sono catalogate in `output/playwright/aje-ui-screenshots/README.md`.

## Verifiche

- Build: `npm run build` completato; solo l’avviso preesistente di deprecazione Vite/PWA su `inlineDynamicImports`.
- Catture: 19 screenshot con fixture di movimenti, budget, attività e prezzi carburante inventati; nessun dato dell’utente.
- Flussi provati nel browser: accesso demo e arrivo in Impostazioni; selezione della scheda Calendario su mobile; scelta del tema Scuro nelle impostazioni; posizione demo e risultati carburanti.
- Errori console e overflow orizzontale non rilevati a 1440 × 1000 e 390 × 844. Tablet, provider AI reali e persistenza reale non sono stati verificati.
- Accessibilità: campi leggibili, focus evidente e stati attivi distinguibili tramite forma/testo/colore; non è stato svolto un audit completo WCAG con strumenti assistivi.

## Iterazioni P2 risolte

1. **Saldo home a contrasto insufficiente:** la superficie verde del riepilogo veniva sovrascritta dallo stile condiviso della card. Impostata la superficie sul token verde in modo esplicito e verificata nella cattura Home.
2. **Barra Assistente nascosta dalla sidebar desktop:** applicata la regola di posizionamento al composer corretto, allineandolo all’area contenuto.
3. **Mappa carburanti vuota sul desktop:** aggiunto l’aggiornamento dimensioni Leaflet al mount e ai resize; ricatturata con cartografia e risultati demo visibili.
4. **Agenda desktop troppo vuota e priva del calendario simultaneo:** implementate due colonne affiancate, mentre su mobile restano le schede; verificata anche la selezione Calendario.
5. **Riquadro Report home allungato dalla griglia:** il report ora mantiene altezza contenuta invece di estendersi accanto al grafico.
6. **Cattura mobile fuorviante:** sostituita la cattura full-page con viewport 390 × 844 per mantenere la barra fissa al bordo inferiore; non era un difetto del layout a runtime.

## Follow-up polish

- Incorporare font tipografici locali, se si desidera un’identità tipografica identica su ogni dispositivo.
- Aggiungere fixture e confronto visuale per i passaggi interni del wizard PDF e per la scheda desktop dei movimenti, che le tavole mostrano anche come stati separati.

**final result: passed**

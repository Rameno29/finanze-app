Stai lavorando sulla repo finanze-app (React 19 + Vite + TypeScript + Tailwind v4, PWA).
Nella cartella `design_handoff_aje_redesign/` c'è il redesign completo dell'app ("Flusso").

1. Leggi per intero `design_handoff_aje_redesign/README.md`: è la specifica e vale più di qualsiasi altra indicazione. Guarda anche le immagini in `design_handoff_aje_redesign/screenshots/`. I file `.dc.html` sono solo prototipi di riferimento: non importarli nell'app.
2. Prima di scrivere codice:
   - esplora `src/App.tsx`, `src/components/*`, `src/index.css` e i moduli in `src/modules/*`;
   - lancia `grep -rn "getBy\|locator(" tests/` per conoscere i nomi accessibili che i test e2e si aspettano;
   - mostrami un piano breve per la fase 1.
3. Lavora **una fase alla volta** seguendo il §10 del README. Per ogni fase:
   - crea un branch `redesign/<n>-<nome>`;
   - rispetta le regole del §2 (nessuna funzionalità rimossa, lucide-react, Geist self-hosted, CSP invariata, BrowserRouter, breakpoint lg, nomi accessibili dei test);
   - aggiorna i test e2e nella stessa fase solo dove il README lo prevede (§9);
   - alla fine esegui `npm run lint`, `npm test`, `npm run build` e `npm run test:e2e`, e correggi finché sono tutti verdi;
   - spunta la checklist del §11 e fai un commit con un messaggio chiaro;
   - fermati e riassumimi cosa hai cambiato, cosa devo provare io sul telefono e sul computer, e se ci sono punti del README che non hai potuto applicare e perché.
4. Se qualcosa nel README è in conflitto con il codice (dati mancanti, API diverse), non inventare: scegli la soluzione che mantiene il comportamento attuale e segnalamelo.

Inizia dalla fase 1.

# 📖 AJE — Documento di riferimento del progetto

> **Leggi questo file per primo.** Contiene tutto: cos'è l'app, com'è fatta, cosa è stato
> realizzato, i problemi incontrati e come sono stati risolti, lo stato attuale e i piani futuri.
> Ultimo aggiornamento: **24 settembre 2026**.

## Redesign "Flusso" — completato e pubblicato

La specifica è `design_handoff_aje_redesign/README.md` (i file `.dc.html` sono solo prototipi,
esclusi da build e lint). Il lavoro è stato fatto in 9 fasi, una per branch `redesign/<n>-<nome>`,
partendo da `redesign/handoff`.

**Rilascio del 25 settembre 2026.**
- **Merge**: le 9 fasi sono entrate in `main` con un fast-forward fino a `624f3bd`.
- **Verifiche prima del push**, eseguite su `main`: lint, 151 test Vitest, build e 40 test
  browser desktop/mobile, tutti verdi.
- **Deploy**: workflow GitHub Pages `36139098991` riuscito (build e deploy).
- **Controllo online**:
  - l'asset principale online (`index-CWBrHQKY.js`) è identico alla build locale;
  - il font Geist è servito dal sito e il manifest ha `theme_color` `#07382f`;
  - la pagina di accesso non mostra errori in console.
- **Da verificare sul dispositivo**: le funzioni autenticate con dati reali e l'installazione
  sull'iPhone restano da collaudare di persona.

- **Fase 1 — Fondamenta** (`redesign/1-fondamenta`): token colore/movimento/ombre di
  `tokens.css` in `src/index.css` (nomi invariati; `--nav-bg` più scuro, nuove `--warn-bg`,
  `--warn-text`, `--warning`, `--skeleton`, `--ease-*`, `--shadow-*` e utility Tailwind
  `bg-brand`, `bg-nav`, `text-warning`…); font **Geist** self-hosted con
  `@fontsource-variable/geist` importato in `src/main.tsx` (CSP invariata, i file `woff2` entrano
  nella precache del service worker per l'uso offline); classe `.tabular`; blocco
  `prefers-reduced-motion` che riduce animazioni e transizioni a dissolvenze di 150 ms;
  `theme-color` `#f6f4ed`/`#081b19` e manifest `#07382f`. Le schermate non sono ancora
  ridisegnate: `.display-type` resta finché le singole pagine non passano al titolo sans.
- **Fase 2 — Componenti condivisi** (`redesign/2-componenti`):
  - `Sheet` (`src/components/ui.tsx`) ha la stessa API più `footer`. È reso in un portal su
    `document.body`. Su mobile è un foglio dal basso con maniglia: mentre è aperto `.app-main` si
    rimpicciolisce e la pagina non scorre. Su desktop è un dialog centrato di 460px.
  - Il foglio ha `role="dialog"`, `aria-modal` e `aria-labelledby`; Esc chiude solo il foglio più
    recente e c'è il focus trap. Il focus iniziale va sul primo campo su desktop e sul foglio su
    mobile, per non aprire la tastiera da sola. Alla chiusura il focus torna dove era.
  - Il foglio resta montato 500 ms dopo la chiusura, per l'uscita animata, mostrando l'ultimo
    contenuto. Lo sfondo non è più un pulsante "Chiudi": ne resta uno solo, la X.
  - `PageHeader`: titolo sans 34px; su mobile scorre col contenuto, su desktop resta in alto.
    `EmptyState` accetta `tone`, `action` e `onAction`.
  - Nuovi componenti: `Toast` con `ToastProvider` montato in `App.tsx` e hook `useToast()`
    (`toastContext.ts`), `Segmented`, `Switch` (`role="switch"`), `Chip` (filtro, scelta,
    suggerimento), `Skeleton`/`SkeletonRow`, `TransactionRow` e `TaskRow`.
  - `TransactionRow` e `TaskRow` supportano l'apertura evidenziata delle righe nuove (`isNew`).
    Righe, chip e skeleton entrano nelle schermate dalle fasi 4–6.
  - Nuovo `formatSignedCents` in `src/lib/format.ts`, con test: "− 46,80 €" con il segno U+2212.
  - Con movimento ridotto fogli, toast e righe nuove usano solo dissolvenze.
- **Fase 3 — Shell** (`redesign/3-shell`):
  - **Barra flottante mobile** (`TabBar.tsx`): Home · Finanze · + · Agenda · Documenti, con pill
    attiva animata. "Altro" non è più nella barra: si apre dall'avatar della Home (link "Altro").
  - **Pagine secondarie** (`/altro`, `/assistente`, `/carburanti`, `/impostazioni`, `/guida`):
    su mobile la barra scende fuori schermo (`inert`) e `PageHeader` mostra "Indietro". Il
    pulsante usa la cronologia; senza cronologia sostituisce la pagina con Altro, e Altro con la
    Home.
  - **Sidebar desktop**: wordmark bianco, stesse 8 voci, CTA contestuale, email e pulsante tema.
  - **"+" contestuale** (barra e CTA della sidebar): le pagine registrano l'azione con
    `useQuickAction` (`quickActionContext.ts`). Finanze apre "Nuovo movimento", Agenda "Nuova
    attività", Documenti porta ai pulsanti di caricamento. Senza azione registrata (Home, pagine
    secondarie su desktop) si apre `GlobalTransactionSheet`. Dopo il salvataggio,
    `notifyDataChanged()` ricarica movimenti e conti già montati. I vecchi "+" flottanti di
    Finanze e Agenda sono stati tolti.
  - **Nuova rotta `/altro`** (`MorePage`, solo mobile; su desktop reindirizza a Impostazioni):
    account con ruolo, link alle pagine secondarie ed "Esci". Il logout è condiviso con
    Impostazioni in `src/lib/signOut.ts`.
  - **Transizione di pagina** a ogni cambio di rotta: laterale su mobile, dal basso su desktop.
    Lo spazio per la barra flottante è in `.page-bottom` (130px più la safe area) e ha sostituito
    i `pb-28` delle pagine.
  - **Banner offline**: pillola flottante in alto con i colori `--warn-*`; uno spazio in flusso
    evita che copra l'intestazione. Il composer dell'Assistente ora è a fondo schermo.
  - **Test e2e**: su mobile i test che partono da Impostazioni tornano alla Home con "Indietro";
    il test del microfono esce dall'Assistente con "Indietro"; `/altro` è nel giro delle pagine
    controllate.
- **Fase 4 — Home** (`redesign/4-home`):
  - Blocchi senza card: intestazione (wordmark su mobile, "Buongiorno" su desktop, data, tema e
    avatar), patrimonio, spesa giorno per giorno, "Puoi spendere ancora oggi", ultimi 4
    movimenti (`TransactionRow`), "Da fare oggi" (`TaskRow`) e domande "Chiedi ad AJE".
  - **Patrimonio**: somma dei saldi dei conti (`fetchAccountBalances`, come in Conti). Il numero
    scorre verso il nuovo valore quando cambia (`useAnimatedNumber` in `components/motion.ts`,
    niente animazione al primo caricamento né con movimento ridotto). Sotto ci sono entrate e
    uscite del mese.
  - **Grafico giorno per giorno**: barre in `<button aria-label="Giorno N">`, altezza ∝ √spesa, i
    giorni futuri sono fermi. Sostituisce il grafico "Ultimi 6 mesi".
  - **Movimenti e attività**: le righe nuove si aprono evidenziate (`useNewIds`). Nelle attività
    quelle completate oggi restano visibili e barrate.
  - **Logica pura** in `src/lib/home.ts` con test: spesa giornaliera, altezze delle barre,
    disponibile al giorno, meta delle attività, separazione dei decimali.
  - **Chiedi ad AJE**: le chip aprono l'Assistente e inviano la domanda tramite lo stato della
    rotta, non nell'URL; l'Assistente la invia una volta e la toglie dalla cronologia. La domanda
    sull'obiettivo usa il primo obiettivo non raggiunto. "Report di <mese>" apre il report AI
    esistente nella Home.
  - "Uscite per categoria" e "Carica la busta paga" restano sotto i suggerimenti, senza card.
  - **Corretto**: la legenda di "Uscite per categoria" usava il nome come chiave e poteva
    duplicare le voci "Altro" quando le categorie arrivavano dopo i movimenti.
- **Fase 5 — Finanze e nuovo movimento** (`redesign/5-finanze`):
  - **`TransactionSheet`**: segmented Uscita/Entrata, importo 52px con tastierino stile POS
    (`padAppend`/`padBackspace` in `src/lib/finance.ts`, massimo 999.999,99; cifre, Backspace e
    Invio anche dalla tastiera fisica), chip delle categorie scorrevoli, descrizione e pulsante che
    passa al conto successivo.
  - **Meta del foglio**: la riga "Oggi, 25 set · EUR · Nessuna ricorrenza" apre data, valuta e
    ricorrenza con i controlli nativi esistenti. Il cambio BCE, la bozza AI, la modifica e
    l'eliminazione restano invariati.
  - **Salvataggio**: con importo 0 il numero trema e non si salva. Dopo il salvataggio compare il
    toast "Uscita di … salvata" con "Annulla", che cancella tramite `mutateOffline` e quindi
    passa anche dalla coda offline.
  - **Aggiornamento delle viste**: il foglio chiama sempre `notifyDataChanged()`, così si
    aggiornano lista, Home, budget e saldi dei conti; `onSaved` è facoltativo.
  - **Finanze su mobile**: sub-tab Movimenti · Budget · Obiettivi · Conti con indicatore e binario
    orizzontale; i pannelli non attivi sono `inert` e senza altezza.
  - **Finanze su desktop**: griglia a due colonne, Movimenti a sinistra e gli altri a destra.
  - **Movimenti**: raggruppati per giorno ("Oggi", "Ieri", "22 settembre") con il netto del giorno
    e `TransactionRow`; la riga nuova si apre evidenziata (`useNewIds` riparte al cambio mese).
  - **Invariati, solo restilizzati**: aggiunta rapida, voce, Diario, export CSV e What-if.
  - **Budget**: totale del mese, barre animate (`ProgressBar`) con `--warning` da 85% ed
    `--expense` oltre il 100%. Le categorie senza budget si impostano da "Senza budget";
    scadenzario invariato. Le Categorie si aprono in un foglio da "Gestisci categorie".
  - **Obiettivi**: percentuale grande, scadenza e "Aggiungi risparmio".
  - **Conti**: righe da 72px con icone Landmark/CreditCard/Banknote (`AccountIcon.tsx`),
    "Trasferisci tra conti", "Nuovo conto" e import CSV per conto invariato.
  - **Accessibilità**: le chip di categorie, icone e colori non sono più dentro un `<label>`, che
    dava a tutte il nome "Categoria …".
  - **Test e2e**: l'apertura del CSV tocca la sub-tab "Conti" solo su mobile.
- **Fase 6 — Agenda e nuova attività** (`redesign/6-agenda`):
  - **Intestazione**: "Agenda" con il riepilogo "N da fare · N in ritardo". Su mobile c'è il
    segmented Attività/Calendario con binario orizzontale; su desktop due colonne. `.agenda-panel`
    non ha più bordo, ombra né sfondo.
  - **Elenco**: gruppi "In ritardo", "Oggi", "Prossimi giorni", "Senza data" con il conteggio e
    `TaskRow` (meta "Domani · 10:00", "In ritardo · ieri", "Fatto"). Le attività spuntate durante
    la sessione restano nel loro gruppo, barrate. Le completate in precedenza restano nella
    sezione richiudibile "Completate".
  - **Calendario**: griglia con lunedì come primo giorno e celle da 46px; stati selezionato, oggi e
    passato; pallino per i giorni con attività aperte. Sotto ci sono "Oggi · gio 24 settembre" e le
    attività del giorno.
  - **`TaskSheet`**: titolo 56px che trema se vuoto; chip "Quando" (Oggi, Domani, Sabato N, Senza
    data, Altra data) e "Orario" (Nessun orario, 09:00, 15:30, 20:00, Altro orario) sui selettori
    nativi. Note invariate. La nota sulle notifiche compare solo con push attive
    (`getPushSubscription`). CTA "Aggiungi all’agenda".
  - **Dopo il salvataggio**: toast "Attività aggiunta: domani" e riga nuova evidenziata. Su desktop
    la nuova attività parte dal giorno selezionato nel calendario.
  - **Logica pura** in `src/lib/agenda.ts` con test: gruppi, settimane del calendario, prossimo
    sabato, etichette.
- **Fase 7 — Documenti, PDF e caricamento** (`redesign/7-documenti`):
  - **Layout**: sottotitolo "Buste paga, scontrini e PDF generati"; generatore e archivio in colonna
    su mobile, affiancati da `lg` e senza card.
  - **Crea un documento PDF**:
    - indicatore a 4 passi (Fonte, Formato, Genera, Anteprima) che avanza con lo stato;
    - fonte a righe radio e formato a chip, con i `<select aria-label="Fonte/Formato">` collegati
      e nascosti (sr-only);
    - formati invariati `sintesi`/`appunti`/`schema`, perché sono quelli accettati dal server;
    - durante la generazione un avanzamento stimato in percentuale;
    - anteprima su foglio bianco nella pagina, modificabile, con "Chiudi", "Scarica PDF",
      "Salva nell’archivio privato" e "Ricomincia";
    - l'anteprima scorre in vista quando è pronta.
  - **Carica documento** (`UploadSheet.tsx`):
    - si apre dal "+" su mobile e dalla CTA della sidebar su desktop;
    - tipi "Busta paga…", "Scontrino…", "Documento Spiegazione AI";
    - "Scatta foto" (`capture="environment"`) solo su mobile, "Scegli file", drag & drop sulla
      pagina su desktop;
    - avanzamento "Carico il file cifrato…" / "Leggo il documento…" e risultato con spunta;
    - busta paga e scontrino aprono i fogli di conferma esistenti;
    - gli `input[type=file]` restano nel DOM.
  - **Archivio**: filtri a pill, righe da 72px con icona per tipo e chip di stato
    (Analizzato/Caricato/Non leggibile); ricerca, "Analizza" e "Andamento stipendio" invariati.
  - **Corretto — "+" durante il caricamento della pagina**: se si tocca "+" su Agenda o Documenti
    prima che la pagina registri la sua azione, il tocco resta in attesa invece di aprire
    "Nuovo movimento".
  - **Test e2e**: i test che cercavano i tipi di caricamento sulla pagina ora aprono prima il
    foglio "Carica documento" (`openUploadSheet`).
- **Fase 8 — Login, Assistente, Carburanti, Impostazioni, Guida** (`redesign/8-schermate`):
  - **Login**:
    - colonna unica con wordmark, "Bentornato." e label visibili;
    - "Mostra/Nascondi" dentro il campo password, con `aria-label` "Mostra password"/"Nascondi
      password";
    - "Password dimenticata?", CTA "Accedi" e "Accedi con passkey" (solo con WebAuthn);
    - il recupero resta nella vista con la conferma "Link inviato. Controlla anche lo spam.";
    - il test unitario `LoginPage.test.ts` ora verifica il titolo "Bentornato." e il pulsante
      "Accedi".
  - **Assistente**:
    - sotto il titolo lo stato della chiave (`user-credentials` list);
    - stato vuoto con 3 suggerimenti; bolle da 20px con entrata animata;
    - attesa "AJE sta controllando i tuoi dati…";
    - composer flottante da 58px con "Parla" e invio `ArrowUp`;
    - lo scroll in fondo parte solo quando c'è una conversazione.
  - **Carburanti**:
    - selettore carburante a segmented, mappa più bassa su mobile, "Cerca in quest’area" e
      posizione sotto la mappa;
    - righe da 64px con "più economico" e "Naviga";
    - **"Registra rifornimento"** apre `TransactionSheet` con categoria Trasporti e descrizione
      "Rifornimento";
    - costo al km, statistiche e prezzo al litro del §7.9 **non sono realizzati**: non esistono
      dati di litri e chilometri.
  - **Impostazioni**:
    - scorciatoie "Vai a" (Assistente, Carburanti, Guida) dentro `.settings-layout`;
    - sezioni a fisarmonica con riepilogo: Account, Ospite (solo proprietario), Chiavi e
      integrazioni, Aspetto, Notifiche, Offline;
    - Chiavi e Ospite sono aperte di default e il contenuto resta montato (`inert` quando chiuso);
    - `Switch` per le push (permesso chiesto solo al tocco), "Come fare" verso `/guida?q=install`
      su iPhone non installato, chip "Bloccate" se il permesso è negato;
    - stato della coda offline con "Sincronizza";
    - "Esci" è una riga in fondo alla pagina.
    - I pannelli inviti/integrazioni sono senza card e riportano i riepiloghi con callback.
  - **Guida**:
    - voci a domanda e risposta in `guideEntries.ts`, aggiornate alla nuova interfaccia;
    - ricerca senza accenti (test), filtri per categoria, "+" che ruota;
    - nuova voce "Installare AJE sul telefono", aperta da `/guida?q=install`;
    - messaggio "Nessun risultato per …".
  - **`PageHeader narrow`**: allinea il titolo ai contenuti da 720px su desktop. Rimossa la
    vecchia griglia a due colonne di Impostazioni e Guida.
- **Fase 9 — PWA, stati vuoti ed errori** (`redesign/9-pwa-stati`):
  - **Installazione** (`src/lib/install.ts`, importato in `main.tsx` per non perdere
    `beforeinstallprompt`):
    - rileva se AJE è già installata (`display-mode: standalone` / `navigator.standalone`);
    - su Android e desktop offre il prompt; su iOS mostra le istruzioni di Safari;
    - la chiusura del banner vale 30 giorni (`aje-install-dismissed`);
    - banner in Home (solo mobile), "Installa AJE sul computer" nella sidebar e toast "AJE
      installata" (`InstallWatcher`);
    - funzioni pure testate.
  - **Home vuota** (nessun conto): saldo in grigio e blocco "Iniziamo dal tuo conto".
    "Aggiungi un conto" apre Finanze → Conti con il foglio "Nuovo conto" già aperto (stato della
    rotta); "Oppure importa un CSV della banca" porta ai Conti.
  - **Caricamento**: `PageSkeleton` al posto dello spinner durante il caricamento delle pagine
    lazy; lo spinner resta solo per l'autenticazione.
  - **Errore di rete**:
    - `loadWithOfflineCache` registra l'esito dell'ultimo caricamento online (`getLoadHealth`) e
      l'ora dell'ultimo riuscito in `localStorage` (`aje-last-sync:<utente>:<raccolta>`); i dati
      restituiti non cambiano;
    - `useTransactions` espone `failed`/`lastSuccess`;
    - in Finanze compare "Non riesco a caricare i movimenti" con "Riprova" e l'orario
      dell'ultimo aggiornamento, oppure un avviso se c'è la copia offline.
  - **Offline**: `listPendingChanges` / `describeMutation` (sola lettura, testata) elencano le
    modifiche in coda in Impostazioni → Offline, con l'avvertenza di non cancellare i dati del
    sito. Plurale corretto "1 modifica" anche nel banner.
  - **Assistente senza chiave**: "Serve la tua chiave Gemini" con "Aggiungi la chiave"
    (`/impostazioni#integrazioni`, con scorrimento alla sezione) e "Come ottenerla"
    (`/guida?q=chiave`); il composer resta disponibile.
  - **Documento non leggibile** nel foglio di caricamento: anteprima, tre consigli, "Scatta di
    nuovo" / "Scegli un altro file", "Inserisci i dati a mano" (busta paga e scontrino aprono i
    fogli di conferma vuoti). Senza chiave Gemini il file risulta solo archiviato.
  - **Accesso sospeso** (`MembershipGate`): stato con `Lock` ed "Esci" con bordo; l'errore di
    verifica ha `TriangleAlert`, "Riprova" e "Torna al login".

## Inviti senza limite applicativo

La migration `20260923202147_unlimited_invites_auth_lookup.sql` corregge il blocco degli inviti:
il ruolo server verifica l'identità Auth tramite due funzioni private circoscritte, senza ottenere
lettura generale di `auth.users`. Il limite applicativo di un ospite è rimosso; restano i limiti
operativi del fornitore Supabase. Gli inviti rimangono riservati al proprietario, personali e
monouso. L'elenco nelle Impostazioni è paginato, quindi mostra anche gli invitati oltre i primi 100.
«Prepara email» genera un link e offre «Apri app di posta» con destinatario e messaggio compilati:
è il proprietario a inviare il messaggio. La copia manuale del link resta disponibile e non serve SMTP.
I test usano solo account e indirizzi sintetici; nessun invito reale è stato generato nel collaudo.

## Icona deluxe AJE v3

La prima delle tre proposte visive approvate è ora l'icona dell'app: stesso volto sereno e foglia
centrale, palette verde petrolio e avorio, finitura a smalto satinato con rilievo discreto.
La sorgente resta in `scripts/aje-brand-mark-v3-source.png` e si rigenera con
`node scripts/generate-app-icon-v3.mjs`. I file v3 per PWA, iOS, favicon e icona della Home
usano nomi versionati per evitare che i dispositivi mantengano la precedente immagine in cache.
Il wordmark AJE e il logo del login restano invariati; le icone v2 sono conservate per confronto.

## Marchio AJE v2 — interfaccia aggiornata

Il logo originale con il volto sereno e la foglia centrale è stato ridisegnato in forma più pulita;
la scritta «AJE» è ora un wordmark con dettagli a foglia nelle lettere A ed E. Le versioni chiara
e scura sono usate in login, navigazione desktop e Home. Le icone v2 per favicon, iOS e PWA sono
generate da `scripts/aje-brand-mark-v2-source.png` con `node scripts/generate-brand-v2.mjs`.
I file precedenti restano nel progetto per poter confrontare o ripristinare il vecchio marchio.
Il rilascio frontend include il nuovo marchio e le icone PWA con nomi versionati; le immagini
WebP usate dall'interfaccia entrano nella precache per restare visibili anche offline.

La successiva pulizia dell'interfaccia elimina slogan e frasi decorative vicino al logo.
Nel login mobile resta una fascia compatta con il solo marchio, mentre su desktop resta la foto;
il modulo ora ha un titolo d'azione chiaro e recupero password e accesso su invito sono più
facili da individuare. Anche il menu desktop, la scheda Assistente nella Home e i sottotitoli
ridondanti di alcune pagine sono stati alleggeriti. Restano le istruzioni operative, gli stati
d'errore e gli avvisi di sicurezza. La modifica non cambia autenticazione o dati.
Il logo del login desktop è stato abbassato di 16 px per dargli più respiro dal bordo superiore;
la posizione nella fascia mobile non cambia.
I test browser verificano il contrasto reale dei campi nei temi chiaro e scuro e distinguono
i collegamenti nelle Impostazioni da quelli del menu desktop.

## Rifocalizzazione pubblicata — ritiro server legacy completato

La proposta approvata è in `docs/superpowers/specs/2026-09-23-rifocalizzazione-aje-design.md`;
il piano tecnico è in `docs/superpowers/plans/2026-09-23-rifocalizzazione-pdf.md`.
Il rilascio `f3713d9` alleggerisce la navigazione eliminando le pagine
Media e Google, Spotify, il player e i rispettivi flussi OAuth. Conserva Agenda, Carburanti,
Documenti e la generazione di PDF da link YouTube incollato. Le credenziali obsolete già presenti
non vengono cancellate automaticamente: le Impostazioni ne consentono la rimozione volontaria.
Anche lo scanner multipagina e i suoi filtri vengono rimossi; il caricamento normale di foto e PDF
resta nella pagina Documenti.
Il contratto server della generazione PDF distingue testo, link YouTube e documenti
privati; respinge link non validi, verifica la proprietà del file e valida il risultato AI.
L'interfaccia locale offre le tre fonti alternative e i formati sintesi/appunti/schema, consente
di correggere titolo e sezioni in anteprima, impagina anche paragrafi lunghi su più pagine e salva
il PDF nell'archivio solo dopo un'azione esplicita; il download usa lo stesso renderer del salvataggio.
Il frontend aggiornato è online su GitHub Pages. Il server `ai-analyze` v12 controlla
l'effettivo consumo di token video e respinge i vecchi modi `youtube`, `websearch` e
`detect_corners`; `youtube-search` v2 restituisce 410. Il ritiro server è stato distribuito
dopo il passaggio temporaneo tramite `ai-analyze` v11 compatibile con la vecchia PWA.
Non sono state cancellate chiavi o righe personali.
Le righe più sotto che citano Media, Google, scanner e relative chiavi sono cronologia del vecchio rilascio.
Nel collaudo completo è stato corretto anche il rientro dall'invito: dopo la password,
la schermata segue ora la route `/impostazioni` senza restare sul callback.
Workflow Pages `35856141050` riuscito il 23 settembre; hash dell'asset principale online uguale
alla build locale. Smoke live della pagina login su mobile: campi leggibili, nessun errore console.
Le funzioni autenticate e i PDF con chiavi reali richiedono ancora il collaudo personale.

## Intervento multiutente — pubblicato, collaudo personale da completare

Il branch `codex/multiutente-api-audit` contiene l'esecuzione del piano in
`docs/superpowers/plans/2026-09-20-multiutente-api-audit.md`. Le sezioni storiche sottostanti
descrivono la versione pubblicata a luglio, non certificano il rilascio delle nuove modifiche.
Registro delle prove e limiti: `docs/audit/2026-09-20-audit.md`.
Consegna e passaggi che richiedono il proprietario: `docs/consegna-multiutente.md`.

- Login solo su invito, recupero password, contrasto e autofill corretti; callback password dedicata.
- Membership server con proprietario e inviti dalle Impostazioni senza limite applicativo di ospiti;
  RLS restrittive applicano lo stato attivo anche a JWT emessi prima della sospensione.
- API key Gemini/YouTube personali cifrate AES-256-GCM nel database; la chiave principale
  deve stare esclusivamente nei secret delle Edge Functions. Non è cifratura end-to-end.
- Client ID Google/Spotify personali nelle Impostazioni; token OAuth temporanei separati
  per identità. Rimossi i Client ID condivisi e la chiave YouTube dalla build.
- AI e YouTube richiedono la credenziale dell'utente; nessun fallback a `app_secrets.GEMINI_API_KEY`.
  L'endpoint `analyze-payslip` è ritirato (410); resta `ai-analyze` per le buste paga.
- Nuove funzioni `manage-invites`, `user-credentials`, `youtube-search`; migration additiva
  `20260920103659_multiuser_credentials_invites.sql`. Bootstrap sul UUID dell'unico account Auth
  preesistente, con lock e arresto se gli account non sono esattamente uno. La vecchia allowlist
  non è autorevole: la verifica remota in sola lettura ha rilevato un indirizzo storico diverso.
- Seconda migration `20260921175220_functional_audit_regressions.sql`: trasferimenti atomici,
  unicità della conferma documento, ricorrenze con giorno ancorato e recupero arretrati;
  prenotazioni temporanee dei promemoria per cron concorrenti, accessibili solo al servizio server.
- Cache offline: creazione atomica delle chiavi, richieste legate al token originale, lock
  tra schede e stato separato per account. Nessun reload PWA forzato durante i moduli aperti.
- Una risposta UPDATE senza righe non elimina più le modifiche dalla coda; DELETE vuoti
  richiedono membership ancora attiva. La cancellazione di trasferimenti sospesi fallisce esplicitamente.
- Password callback legata alla sessione verificata dal link, anche dopo errore/riprova e cambio
  account in un'altra scheda. Refresh Spotify e notifiche mantengono l'identità iniziale della richiesta.
- Scritture dell'identità push ordinate; attivazione senza service worker restituisce un errore
  invece di attendere indefinitamente. Test di regressione prima e dopo le correzioni.
- Snapshot delle modifiche offline cifrati anche quando il movimento cambia mese o conto;
  totali e saldi includono inserimenti/cancellazioni pendenti. Cache totali versionata senza eliminare code.
- Import CSV: verifica duplicati paginata per conto, errore di lettura bloccante, singolo batch
  con UUID stabili e riprova senza duplicazioni dopo risposta persa finché il pannello resta aperto.
- Upload documenti/scanner con identità fissata e riconciliazione per UUID: una risposta persa
  non cancella più il file già registrato. Gli esiti incerti possono lasciare orfani privati da verificare.
- Promemoria: claim con scadenza e verifica di data/orario/titolo prima della conferma; errori
  lettura cron segnalati. Il cambio BCE odierno viene aggiornato dopo un'ora, non congelato nella cache.
- Revisione finale circoscritta di accessi, RLS/RPC, inviti, credenziali, callback e upload:
  nessun ulteriore blocco critico/alto confermato dopo le correzioni. Non certifica tutti i moduli
  né sostituisce il collaudo sul backend e sul dispositivo reale.
- Diario e azioni confermate dell'assistente vincolati alla sessione iniziale; la coda rifiuta
  payload di un altro account. Riprova del diario con UUID stabili e selezione congelata, senza
  duplicare righe già salvate finché il pannello resta aperto.
- Microfono annullato alla chiusura del modulo, anche durante attesa permesso e coda audio;
  rilascio delle tracce dopo errore Web Audio, verifica identità prima della trascrizione.
- Collaudo locale: 142 test Vitest (inclusi SQL/RLS), 20 test Deno, 26 test browser desktop/mobile
  con backend simulato. Esiti aggiornati e limiti nel registro audit. Lint conserva 5 warning Fast Refresh.
- Audit del 22 settembre: zero vulnerabilità note nei grafi npm e Deno esaminati. Il controllo Deno
  aveva trovato 11 segnalazioni su Nodemailer 7.0.10: aggiornato a 10.0.10, composizione invito
  verificata senza SMTP reale. Non è una garanzia di assenza di vulnerabilità applicative/cloud.
- Procedura operativa in `docs/release-multiutente.md`; utility di rotazione server
  `supabase/scripts/rotate-credentials.ts`, predefinita in dry-run, verificata su fixture sintetiche
  (dry-run/apply/conflitto/chiave mancante) e non eseguita sui dati reali.

Il rilascio è stato autorizzato il 22 settembre; Docker Desktop installato con autorizzazione
e motore verificato. Backup completo fuori Git e ripristino SQL su PostgreSQL isolato riusciti.
Entrambe le migrazioni (transazioni esplicite), master key e nove Edge Functions sono distribuiti;
owner attivo unico, 20 movimenti e due documenti conservati. All'epoca era previsto un posto ospite,
poi rimosso dalla migration per gli inviti illimitati. Site URL Auth e callback
corretti per GitHub Pages. Smoke remoto: otto endpoint 401 senza sessione, legacy 410.
Frontend `175ccf6` pubblicato su Pages: workflow `35781348797` riuscito il 22 settembre.
Verifica live in browser nuovo: login solo su invito, email/password leggibili, mostra/nascondi
password e recupero presenti; viewport desktop/mobile scuro e console senza errori.
Le skill Supabase/verifica hanno guidato backup e controllo del ripristino; Playwright il controllo live.
Registro completo in `docs/release-multiutente.md`.
Restano inserimento delle credenziali personali e collaudo autenticato/iPhone del proprietario.
La UI attuale prepara il messaggio nella posta locale e conserva la copia del link; SMTP non è richiesto.
Nessun invito o email reale inviato nei test.
Le impostazioni `verify_jwt=false` delle nuove funzioni non significano accesso libero: gli handler
verificano il bearer con Supabase Auth e applicano membership e limiti. Il cron usa il proprio secret;
l'endpoint legacy restituisce soltanto 410. Non distribuire un handler privo di questi controlli.

---

## 1. Cos'è AJE

**AJE** è un'app personale (webapp installabile / PWA) per **gestire finanze, tempo e documenti**,
ottimizzata per **iPhone 16 Pro Max** ma funzionante anche su Android e desktop.

- **App online:** https://rameno29.github.io/finanze-app/
- **Repository GitHub:** https://github.com/Rameno29/finanze-app (pubblico)
- **Utente/proprietario:** Bogdan (bogdanstafie1996@gmail.com)
- **Lingua:** italiano
- **Filosofia:** costi minimi (backend e AI su piani gratuiti), tutto il codice pubblico ma
  **nessun dato personale o segreto nel repository**.

### Come si installa sul telefono
- **iPhone:** Safari → apri l'URL → Condividi → "Aggiungi a schermata Home".
- **Android:** Chrome → apri l'URL → menu ⋮ → "Installa app" / "Aggiungi a schermata Home".

---

## 2. Strumenti e tecnologie utilizzate

| Ambito | Strumento | Note |
|---|---|---|
| **Frontend** | Vite + React 19 + TypeScript | App a pagina singola (SPA) |
| **Stile** | Tailwind CSS 4 | Mobile-first, tema chiaro/scuro |
| **Grafici** | Recharts | Torte, barre, andamenti |
| **Icone** | lucide-react | Set coerente in tutta l'app |
| **PWA** | vite-plugin-pwa (Workbox) | Installabile + service worker + notifiche push |
| **PDF** | jsPDF | Generazione documenti lato client |
| **Backend** | **Supabase** (piano gratuito) | Database, autenticazione, storage, funzioni server |
| **Database** | PostgreSQL (Supabase) | Con Row Level Security (RLS) |
| **Funzioni server** | Supabase Edge Functions (Deno) | Logica AI e notifiche |
| **Automazioni** | pg_cron + pg_net (Postgres) | Task pianificati (ricorrenze, promemoria) |
| **AI** | **Google Gemini 2.5 Flash** (piano gratuito) | Analisi documenti, assistente, voce, ricerca web |
| **Hosting** | GitHub Pages | Deploy automatico via GitHub Actions |
| **Integrazioni** | Google (Calendar/Gmail/Drive/Maps), Spotify, YouTube | Vedi sezione 6 |

### Dettagli infrastruttura
- **Progetto Supabase:** `finanze-organizzazione` — ID `boucbthrnddmnzcowafy`, regione eu-central-1.
- **Deploy:** ogni `git push` sul branch `main` fa partire GitHub Actions che compila e pubblica su
  GitHub Pages. C'è anche un workflow **keep-alive** che "sveglia" Supabase ogni 3 giorni per evitare
  che il progetto gratuito venga messo in pausa.
- **base URL:** l'app vive nel sottopercorso `/finanze-app/` (importante per link e routing).

---

## 3. Architettura in breve

```
┌─────────────────────────┐        ┌──────────────────────────────┐
│  App (browser/telefono) │        │  Supabase (cloud gratuito)   │
│  React PWA su GitHub     │◄──────►│  • Auth (email/password)     │
│  Pages                   │        │  • Postgres + RLS            │
│                          │        │  • Storage (documenti)       │
│  Chiama le Edge Function │        │  • Edge Functions (Deno):    │
│  per le funzioni AI      │        │      - ai-analyze            │
└─────────────────────────┘        │      - ai-command            │
                                     │      - send-reminders        │
          │                          │  • pg_cron (task notturni)   │
          │                          └──────────────┬───────────────┘
          │                                         │
          └─── integrazioni dirette ───┐            └──► Google Gemini API
              (dal browser):           │
              Google, Spotify, YouTube ┘
```

**Principio di sicurezza:** le chiavi segrete (Gemini, VAPID per le notifiche) stanno **solo sul
server** (tabella protetta `app_secrets` o secret di GitHub). Il browser non le vede mai. Le chiavi
"pubbliche per design" (Client ID Google/Spotify, chiave anon Supabase) possono stare nel codice.

---

## 4. Funzionalità realizzate (stato: completo e online)

### 💰 Finanze
- Entrate/uscite con categorie personalizzabili (icona + colore), seed automatico di 12 categorie
  italiane al primo accesso.
- Vista mensile con saldo, filtri, modifica/elimina.
- **Budget mensili** per categoria con barra di avanzamento (rossa se sfori).
- **Obiettivi di risparmio** ("salvadanaio") con traguardo, scadenza e avanzamento.
- **Movimenti ricorrenti automatici** (affitto, stipendio…): si registrano da soli alla scadenza.
- **Scadenzario spese fisse e abbonamenti** con costo mensile/annuo.
- **Export CSV/Excel** di tutti i movimenti (formato italiano, protetto da CSV injection).
- **Aggiunta rapida a voce o con una frase** ("20 euro pizza ieri") → l'AI compila il movimento.
- **Diario del giorno**: un'unica dettatura o frase con più spese ("caffè 1,20, pranzo 8 euro,
  benzina 40") → l'AI la separa in movimenti singoli con categoria proposta; selezione, conto
  comune e salvataggio in blocco (funziona anche offline tramite la coda).
- **Simulatore what-if** (scheda Obiettivi): proiezione del patrimonio a 6/12/24/60 mesi calcolata
  su medie reali di entrate/uscite (mesi completi) + scenario "risparmio/spesa in più al mese",
  grafico baseline vs scenario e commento AI sulla sostenibilità (`src/lib/whatif.ts`, testato).
- **Supporto multivaluta**: 16 valute, importo originale e controvalore EUR calcolato con il cambio
  ufficiale BCE del giorno o dell'ultimo giorno lavorativo precedente; tasso, data e fonte restano
  salvati sul movimento e sono inclusi nell'export CSV.
- **Multi-conto**: conti separati per contanti, banca e carte con saldo iniziale (anche negativo),
  saldo aggiornato per conto e patrimonio totale; ogni movimento può essere assegnato a un conto.
- **Trasferimenti interni** tra conti: coppia di movimenti legati (`transfer_group`), esclusi dai
  totali entrate/uscite e dai grafici; si eliminano insieme.
- **Import estratti conto CSV** (lato client, il file non lascia il dispositivo): riconoscimento
  automatico di delimitatore, colonne (anche dare/avere separate), date e importi italiani;
  mappatura colonne modificabile, anteprima con selezione riga per riga, possibili duplicati
  segnalati e deselezionati, categoria proposta dallo storico dei movimenti.

### 📅 Agenda
- Attività/promemoria con data, ora e note; raggruppate per urgenza (in ritardo/oggi/prossime).
- Vista **calendario mensile** con puntini sui giorni impegnati.
- Widget "Da fare oggi" in Home.
- **Notifiche push** all'orario dell'attività (con pulsante "invia notifica di prova").

### 📄 Documenti (AI)
- **Busta paga** (PDF o foto) → estrae netto/lordo/trattenute → crea l'entrata stipendio + grafico andamento.
- **Scontrini/ricevute** → estrae totale, data, negozio, categoria → crea l'uscita.
- **Documento qualsiasi** (contratto, bolletta, referto…) → riassunto + spiegazione semplice.
- **Ricerca completa nei documenti**: Full Text Search PostgreSQL in italiano su nome file, titolo,
  riassunto, spiegazione e punti chiave dell'analisi AI (colonna `search_vector` generata + indice
  GIN, risultati filtrati dalla RLS).
- **Crea PDF con l'AI** da una richiesta scritta o dal contenuto di un video YouTube.
- **Scanner documenti** (tutto lato client, `src/lib/scanner.ts` + `src/lib/docDetect.ts` +
  `ScannerSheet.tsx`): fotocamera o galleria, fino a 20 pagine; **riconoscimento automatico dei
  bordi** (Otsu + componente connessa più grande + 8 estremi direzionali → quadrilatero di area
  massima) e **raddrizzamento prospettico** (omografia 8×8 risolta con Gauss, warp bilineare) come
  le app di scansione; editor con i **4 angoli trascinabili** (bordi automatici / foto intera /
  manuali); filtri per pagina (Migliorato = stretch contrasto sui percentili 2–98, Grigio, B/N con
  soglia di Otsu, Originale), rotazione, PDF A4 con jsPDF e condivisione con il foglio nativo
  (Web Share API con file; fallback download); salvataggio facoltativo nei Documenti senza avvio
  automatico dell'analisi AI.

### 🤖 Assistente AI (chat + voce)
- **Risponde** a domande sui tuoi dati ("quanto ho speso in ristoranti?").
- **Agisce** su comando (registra spese, crea promemoria/obiettivi, imposta budget) **previa conferma**.
- **Microfono**: registri, vedi la trascrizione **modificabile**, la correggi e invii.
- Report mensile scritto dall'AI (dalla Home).

### 🔵 Google (tab Altro → Google)
- **Ricerca web con AI** (con fonti).
- **Maps** (ricerca luoghi).
- **Calendar / Gmail / Drive** in lettura (prossimi eventi, email non lette, file recenti).

### 🎵 Media (tab Altro → Media)
- **YouTube**: ricerca video in-app, mini-player persistente, riassunto AI del video, Picture-in-Picture.
- **Spotify**: ricerca brani, player interno (embed), controllo riproduzione sul dispositivo.

### ⚙️ Altro
- **Carburanti**: mappa interattiva Leaflet/OpenStreetMap (trascinabile e zoomabile) dei
  distributori italiani con i prezzi degli open data MIMIT (Edge Function `fuel-prices` con cache
  in memoria 6h, filtro per raggio, prezzi più vecchi di 30 giorni esclusi); geolocalizzazione,
  "Cerca in quest'area" sul centro mappa, classifica per prezzo e link "Naviga" verso Google Maps.
- Tema chiaro/scuro/automatico.
- **Passkey (WebAuthn)**: accesso con Face ID/Touch ID senza password (API sperimentale Supabase,
  `signInWithPasskey`/`registerPasskey`); gestione delle passkey (elenco, creazione, eliminazione)
  in Altro → "Passkey e Face ID". La password resta come metodo alternativo.
- **Modalità offline automatica**: ultime viste di Finanze e Agenda cifrate sul dispositivo; creazione,
  modifica ed eliminazione di movimenti e attività accodate e sincronizzate in ordine al ritorno online.
  La barra di stato mostra offline, sincronizzazione ed eventuali operazioni in attesa.
- **Guida all'uso** completa dentro l'app (accordion per ogni sezione).
- Login/registrazione con **lista di email autorizzate** (app privata).

---

## 5. Schema del database (Supabase / Postgres)

Tutte le tabelle hanno `user_id` + **RLS**: ogni utente vede solo i propri dati.

| Tabella | Contenuto |
|---|---|
| `categories` | Categorie entrate/uscite (nome, tipo, colore, icona) |
| `accounts` | Conti dell'utente (nome, tipo contanti/banca/carta, saldo iniziale) |
| `transactions` | Movimenti (controvalore EUR, valuta/importo originali, cambio BCE, tipo, categoria, conto, gruppo trasferimento, data, ricorrenza, documento) |
| `exchange_rates` | Cache server dei cambi di riferimento BCE per valuta e giorno (sola lettura per utenti autenticati) |
| `budgets` | Budget mensile per categoria |
| `goals` | Obiettivi di risparmio (traguardo, risparmiato, scadenza) |
| `tasks` | Attività/promemoria dell'agenda (+ flag `notified` per le notifiche) |
| `documents` | Documenti caricati (tipo, path storage, stato, analisi AI salvata, `search_vector` per la ricerca) |
| `payslips` | Dati estratti dalle buste paga |
| `push_subscriptions` | Iscrizioni alle notifiche push |
| `allowed_emails` | Email autorizzate a registrarsi (protetta, solo server) |
| `app_secrets` | Segreti server: chiave Gemini, chiavi VAPID, segreto cron (protetta, solo server) |

**Storage:** bucket privato `documents` (max 20 MB, solo PDF/immagini), ogni file nella cartella
dell'utente.

**Edge Functions (Deno):**
- `ai-analyze` — analisi buste paga/scontrini/documenti, riassunti YouTube, generazione PDF, ricerca web, assistente sui dati.
- `ai-command` — interpreta comandi (testo o voce) in azioni + sola trascrizione vocale.
- `send-reminders` — invia le notifiche push dei promemoria (chiamata dal cron ogni 5 min) + notifica di prova.
- `analyze-payslip` — funzione legacy mantenuta per compatibilità; il frontend corrente usa
  `ai-analyze` anche per le buste paga.
- `ecb-rates` — recupera i cambi giornalieri dal Data Portal BCE, usa solo valute ammesse, autentica
  l'utente, riutilizza la cache server e restituisce il giorno lavorativo disponibile più vicino.
- `fuel-prices` — scarica i CSV open data MIMIT dei prezzi carburante (cache in memoria 6 ore),
  autentica l'utente e restituisce i distributori nel raggio richiesto ordinati per prezzo.

**Task pianificati (pg_cron):**
- `materialize-recurring` — ogni notte crea i movimenti ricorrenti scaduti.
- `send-reminders` — ogni 5 minuti controlla e invia i promemoria dovuti.

---

## 6. Configurazione e chiavi (cosa serve per far funzionare tutto)

| Cosa | Dove sta | Stato |
|---|---|---|
| **Chiave Gemini** (AI) | Supabase `app_secrets.GEMINI_API_KEY` | ✅ Configurata (Google AI Studio) |
| **Chiavi VAPID** (notifiche push) | Supabase `app_secrets` | ✅ Generate e configurate |
| **Segreto cron** | Supabase `app_secrets.CRON_SECRET` | ✅ Configurato |
| **Google Client ID** (Calendar/Gmail/Drive/Maps) | `src/lib/config.ts` (pubblico) | ✅ Configurato |
| **Spotify Client ID** | `src/lib/config.ts` (pubblico) | ✅ Configurato |
| **Chiave YouTube Data API** | secret GitHub `VITE_YOUTUBE_API_KEY` | ✅ Configurata + ristretta al dominio |
| **Chiave anon Supabase** | `src/lib/config.ts` (pubblica per design) | ✅ |
| **Passkey (WebAuthn)** | Dashboard Supabase → Authentication → Passkeys | ⚠️ Da attivare: RP Display Name `AJE`, RP ID `rameno29.github.io`, RP Origins `https://rameno29.github.io` |

**Google OAuth** è in modalità test: solo le email aggiunte come "utenti di test" nella console
Google Cloud possono collegarsi (compare l'avviso "app non verificata", normale).

---

## 7. Problemi incontrati e come sono stati risolti

Cronologia dei principali intoppi e delle soluzioni — utile per non ripetere gli errori.

1. **Deploy iniziale su Vercel bloccato** (CLI non autenticata sul PC).
   → Passati a **GitHub Pages** con deploy automatico via GitHub Actions.

2. **Popup illeggibile sui grafici della Home** (tooltip bianco fisso, invisibile nel tema scuro).
   → Sostituito con un **riquadro dettagli sotto il grafico** (tocchi un mese → vedi entrate/uscite/saldo),
   coerente col tema.

3. **Chiave YouTube esposta nel repository** (avviso di GitHub).
   → Spostata in un **secret di GitHub** e, soprattutto, **ristretta al dominio** dell'app su Google
   Cloud (una chiave così, anche se visibile, non è usabile da altri siti).

4. **Analisi buste paga a pagamento (Anthropic)** era la scelta iniziale.
   → Passati a **Google Gemini** (piano gratuito), che gestisce anche audio e video.

5. **Audit di sicurezza** → chiuse diverse falle:
   - chiunque poteva registrarsi → **lista email autorizzate**;
   - funzione ricorrenze invocabile da fuori → **permessi revocati**;
   - export CSV vulnerabile a injection → **celle neutralizzate**;
   - aggiunta **Content-Security-Policy**, indici DB, policy RLS ottimizzate.

6. **Notifiche push "non arrivavano"**.
   → In realtà **il sistema funzionava**: l'attività di test era stata segnata come completata prima
   che scattasse il controllo (che gira ogni 5 min). Aggiunti: **pulsante "invia notifica di prova"**,
   fix per non "bruciare" un promemoria se un invio fallisce, diagnostica.

7. **Microfono che tagliava le parole se si parlava veloce** e **niente possibilità di correggere**.
   → Riscritto: registrazione in **formato WAV** (compatibile ovunque, niente più problemi coi formati
   di iPhone/Android), con **cattura della coda** della frase; nuovo **flusso a due passi**: registri →
   la trascrizione appare **modificabile** → correggi e invii.

8. **Riconoscimento vocale del browser inaffidabile su iPhone** (Web Speech API).
   → Sostituito con **registrazione audio + trascrizione via Gemini** sul server: funziona identico su
   tutti i dispositivi.

9. **"Sempre Ops, non sono riuscito a elaborare la richiesta"**.
   → Diagnosi: **server perfetto** (tutti i test a 200). Causa: **versione vecchia in cache** della PWA
   sull'iPhone (iOS non aggiorna le web-app installate finché non le chiudi del tutto). Fix: **auto-reload
   quando esce una nuova versione**; soluzione immediata: rimuovere e reinstallare l'app dalla Home.

10. **Limiti del piano gratuito Gemini** (troppe richieste ravvicinate durante i test → errori 429/503).
    → Aggiunto **ritentativo automatico** quando il servizio è momentaneamente occupato. Per l'uso
    normale i limiti non si toccano.

11. **Audit funzionale e di sicurezza del 10 luglio 2026**.
    → Aggiunti test automatici di regressione; protezione OAuth `state` per Spotify; validazione più
    rigorosa di importi, file, URL e payload; limiti alle richieste AI; isolamento `user_id` rinforzato
    nelle funzioni server; gestione esplicita degli errori nei salvataggi; conferme di scontrini e
    buste paga rese idempotenti; caricamento delle pagine separato per ridurre il bundle iniziale.

12. **Multivaluta e modalità offline del 12 luglio 2026**.
    → Gli aggregati restano sempre in EUR per non alterare budget e grafici; il database conserva
    anche importo/valuta originali e rifiuta tramite trigger controvalori incoerenti col cambio.
    I cambi arrivano esclusivamente dall'API ufficiale BCE e vengono memorizzati con data e fonte.
    La cache offline usa IndexedDB e AES-GCM con chiave non esportabile separata per utente; payload
    della coda e viste sono cifrati. Non vengono messi nella cache offline documenti, allegati o token.
    Sono accodabili solo movimenti e attività; AI, documenti e integrazioni esterne richiedono rete.

13. **Debug generale del 14 luglio 2026** (dopo multi-conto e ricerca documenti). Trovati e corretti:
    il contesto dell'assistente AI contava i trasferimenti come entrate/uscite (ora esclusi con
    `transfer_group is null`, `ai-analyze` v6); i saldi dei conti in cache offline non riflettevano
    le operazioni in coda (ora le cache derivate `account-balances` e `recurring` vengono aggiornate);
    gli importi CSV con solo separatore delle migliaia ("1.234") venivano rifiutati; cambiando la
    colonna data nell'import non si ricontrollavano i duplicati sul nuovo intervallo. Collaudo E2E
    autenticato eseguito con utente temporaneo poi eliminato: conti, trasferimento (saldi 850/350,
    totali mese a zero) e ricerca documenti verificati nel browser contro il database reale.

---

## 8. Stato attuale

✅ **App completa e funzionante online.** Tutte le funzionalità della visione iniziale sono realizzate:
finanze, agenda, documenti con AI, integrazioni Google, musica/video, assistente vocale, notifiche.

Punti di attenzione noti:
- **Google OAuth in modalità test** (solo email autorizzate; avviso "app non verificata" normale).
- **Limiti iOS non aggirabili**: audio di YouTube in sottofondo si ferma a schermo bloccato (soluzione:
  Picture-in-Picture); player Spotify completo dentro l'app non è possibile (si usa il controllo remoto).
- **Piani gratuiti**: Supabase (tenuto attivo dal keep-alive), Gemini (limiti generosi per uso personale).
- I cambi BCE sono tassi informativi di riferimento: possono differire dal cambio realmente applicato
  da banca o carta. Un cambio già salvato sul movimento non viene riscritto retroattivamente.
- L'offline diventa disponibile dopo aver visitato almeno una volta online la vista interessata; le
  modifiche locali sono sincronizzate in ordine e una coda con errore resta visibile per il nuovo tentativo.
- Consigliato attivare su Supabase la **"Leaked password protection"** (Authentication → Passwords).

---

## 9. Roadmap proposta (ricerca aggiornata all'11 luglio 2026)

Le funzioni seguenti non sono ancora realizzate. L'ordine privilegia valore nell'uso quotidiano,
costi gratuiti, semplicità operativa e protezione dei dati.

### Priorità A — consigliate come prossimi sviluppi

1. **Agenda Google scrivibile e sincronizzazione Google Tasks**
   - Creare eventi Calendar dall'agenda o dall'assistente solo dopo conferma esplicita.
   - Collegare opzionalmente una lista Google Tasks, salvando gli ID esterni per evitare duplicati e
     conflitti; partire con sincronizzazione manuale/monodirezionale prima del bidirezionale.
   - Richiede ampliare gli scope OAuth attuali, quindi va mostrata chiaramente la nuova autorizzazione.

2. **Backup cifrato su Google Drive**
   - Esportazione JSON versionata nel folder nascosto `appDataFolder`, accessibile solo ad AJE.
   - Cifratura lato client prima dell'upload, ripristino con anteprima e controllo versione schema.
   - Lo scope `drive.appdata` è più ristretto e non sensibile rispetto all'accesso generale a Drive.

3. **Scadenze intelligenti e controllo abbonamenti**
   - Rilevare automaticamente ricorrenze, rincari, doppioni e servizi non usati dai movimenti.
   - Promemoria per rinnovi, disdette, documenti, garanzie, bollo, assicurazione e contratti.
   - Previsione di fine mese, confronto anno su anno e simulatore “quanto posso spendere”.

4. **MFA con app Authenticator**
   - Aggiungere enrollment, verifica e recupero TOTP nelle impostazioni account.
   - La MFA di base è compresa nel piano gratuito Supabase ed è preferibile all'SMS per costi e
     affidabilità.
   - Priorità ridotta dal 15 luglio 2026: le **passkey con Face ID** (già realizzate) offrono
     un accesso resistente al phishing; la MFA TOTP resta utile solo per rafforzare il login
     con password.

### Priorità B — utili dopo il consolidamento del modello dati

5. **Modalità famiglia/coppia con spazi condivisi**
   - Tabelle `households`, `memberships` e ruoli; ogni movimento appartiene a uno spazio personale o
     condiviso.
   - RLS basata sulle membership e aggiornamenti live tramite canali Supabase Realtime privati.
   - Richiede una migrazione delicata: non va implementata aggiungendo semplicemente altri `user_id`.

6. **Import di fatture e ricevute da Gmail**
   - Ricerca mirata di email selezionate dall'utente e download dei soli allegati confermati, poi
     riuso dell'analisi scontrini/documenti già esistente.
   - `gmail.readonly` permette query e allegati ma è uno scope Google ristretto: mantenere l'app
     privata/in test, minimizzare i dati e non creare scansioni automatiche indiscriminate.

### Sperimentali / da valutare contrattualmente

7. **Sincronizzazione bancaria Open Banking (PSD2)**
    - GoCardless Bank Account Data dichiara fino a 24 mesi di storico e fino a 90 giorni di accesso
      continuativo; le banche possono limitare le chiamate anche a quattro al giorno.
    - TrueLayer espone conti, carte, saldi, transazioni, addebiti diretti e ordini permanenti.
    - Prima di sviluppare servono conferma aggiornata di copertura delle banche italiane, accesso alla
      produzione, prezzo e condizioni per uso personale. Secret e refresh token dovrebbero vivere
      solo nelle Edge Functions; l'utente deve poter revocare e cancellare ogni collegamento.

8. **Integrazione Splitwise o servizi simili**
    - Utile solo se la modalità condivisa interna non basta.
    - Richiederebbe OAuth, token server-side, mapping degli utenti e strategia anti-duplicati; priorità
     bassa per evitare una seconda fonte autorevole delle stesse spese.

### Completate dalla roadmap

- ✅ **Ricerca completa nei documenti (fase 1)** — realizzata il 14 luglio 2026 con Full Text Search
  PostgreSQL in italiano (colonna generata + indice GIN) e barra di ricerca nella pagina Documenti.
  La fase 2 facoltativa (ricerca semantica `pgvector`) resta un possibile sviluppo futuro.
- ✅ **Multi-conto + import estratti conto CSV** — realizzata il 14 luglio 2026: conti con saldo
  iniziale e patrimonio, trasferimenti interni esclusi dai totali, import CSV lato client con
  mappatura colonne, duplicati segnalati e categoria proposta dallo storico. (Le regole persistenti
  per esercente restano un possibile raffinamento futuro.)
- ✅ **Multi-valuta e viaggi** — realizzata il 12 luglio 2026 con importo originale, controvalore EUR,
  tassi giornalieri BCE e cache locale/server.
- ✅ **Modalità offline controllata** — realizzata il 12 luglio 2026 per lettura delle ultime viste e
  operazioni su movimenti/attività, con IndexedDB cifrato e coda automatica osservabile.

### Riferimenti tecnici ufficiali della ricerca

- Google Calendar `events.insert`: https://developers.google.com/workspace/calendar/api/guides/create-events
- Google Tasks API: https://developers.google.com/workspace/tasks/reference/rest
- Google Drive `appDataFolder`: https://developers.google.com/workspace/drive/api/guides/appdata
- Gmail ricerca messaggi/allegati: https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/list
- Supabase Full Text Search: https://supabase.com/docs/guides/database/full-text-search
- Supabase ricerca semantica/pgvector: https://supabase.com/docs/guides/ai/semantic-search
- Supabase MFA: https://supabase.com/docs/guides/auth/auth-mfa
- Supabase Realtime privato: https://supabase.com/docs/guides/realtime/subscribing-to-database-changes
- API dati BCE: https://data.ecb.europa.eu/help/api/data-examples
- GoCardless Bank Account Data: https://developer.gocardless.com/bank-account-data/overview
- TrueLayer Data API: https://docs.truelayer.com/docs/data-api-basics

---

## 10. Manutenzione e sviluppo (per riprendere in mano il progetto)

### Regola di documentazione automatica
Ogni modifica significativa al codice, alla configurazione, alla sicurezza, ai test, al database o
all'infrastruttura deve essere riportata in questo file nello stesso intervento. Prima di concludere
un'attività bisogna aggiornare almeno la data in alto e le sezioni interessate, mantenendo questo
documento coerente con lo stato reale del progetto. Le semplici operazioni di lettura o diagnosi che
non cambiano il progetto non richiedono un aggiornamento.

### Sviluppo locale
```bash
npm install
npm run dev       # sviluppo su http://localhost:5173/finanze-app/
npm test          # suite automatica di regressione
npm run lint      # controlli statici React/TypeScript
npm run build     # build di produzione in dist/
npm run preview   # anteprima della build di produzione
```
Serve un file **`.env`** locale (non versionato) con:
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

### Deploy
- Basta fare **push su `main`**: GitHub Actions compila e pubblica su GitHub Pages.
- Le **Edge Functions** si ridistribuiscono dal pannello Supabase o via connettore.
- Le **icone attuali** dell'app si rigenerano da `scripts/aje-brand-mark-v2-source.png`
  con `node scripts/generate-brand-v2.mjs`; il marchio precedente resta in
  `scripts/icon-source.png` e si rigenera con `node scripts/generate-icons.mjs`.

### Ultimo rilascio
- **20 luglio 2026 — rilevamento bordi molto più robusto:** dopo il feedback ("non legge bene i
  bordi"), rifatta la pipeline in `src/lib/docDetect.ts` (solo frontend, nessun deploy funzione):
  chiusura morfologica (`closeMask`, dilata+erode) per riempire il testo e ricucire le ombre;
  gradiente Sobel (`sobelMagnitude`) + `edgeAlignment` (i lati del quad devono appoggiarsi a bordi
  reali); 5 soglie candidate (Otsu + percentili 30/45/60/75, chiaro e scuro), punteggio
  area×riempimento×allineamento invece della prima valida. La chiusura è **separabile** (passata
  orizzontale + verticale, esatta per kernel quadrato) e la griglia di analisi è 340 px: il
  rilevamento locale scende a ~180–230 ms. L'AI resta **manuale** ("Trova i bordi con l'AI"): una
  prova di auto-AI-alla-cattura è stata scartata perché la chiamata vision di Gemini impiega
  10–20 s per pagina (troppo lenta e costosa) mentre il detector locale, verificato E2E su una foto
  difficile (beige su beige, ombra, tilt), ora azzecca i 4 angoli con **scarto ~0,5%**. Verifiche:
  101 test (chiusura, Sobel, allineamento, caso "ombra su un lato"), lint/`tsc` puliti, build ok.
- **19 luglio 2026 — precisione bordi scanner:** 1) *lente d'ingrandimento* nell'editor dei bordi:
  trascinando un angolo compare una lente (120 px, zoom 2,5×) con mirino sopra il dito, spostata
  sotto quando l'angolo è in alto; 2) *"Trova i bordi con l'AI"*: nuova modalità `detect_corners`
  in `ai-analyze` v8 (immagine base64 ≤1,4 MB — cap payload della funzione alzato a 1,5 MB, come
  già fa `ai-command` per l'audio; schema Gemini con angoli interi 0–1000, validazione lato server
  e `orderQuad` lato client; avvertenza privacy sotto il bottone: la foto viene inviata al server
  solo per questa richiesta); 3) rilevamento locale migliorato: blur 3×3 anti-rumore e più soglie
  candidate (Otsu + percentili 35/65, chiaro/scuro) con scelta a punteggio area×riempimento invece
  della prima valida. Verifiche: 95 test (blur e basso contrasto inclusi), lint/`tsc` puliti,
  build ok; `ai-analyze` v8 distribuita ACTIVE; E2E con utente temporaneo (eliminato): sulla foto
  sintetica in prospettiva "Trova i bordi con l'AI" ha posizionato i 4 angoli con scarti del
  4–8% dagli angoli reali (Gemini stima, poi si rifinisce con la lente) e la lente con mirino
  compare correttamente durante il trascinamento (spostata sotto il dito quando l'angolo è in alto).
- **18 luglio 2026 (sera) — scanner "vero" con raddrizzamento:** su richiesta di Bogdan lo scanner
  ora funziona come CamScanner. Nuovo `src/lib/docDetect.ts` (matematica pura, 10 test):
  rilevamento del documento (Otsu → componente connessa più grande via flood fill → 8 estremi
  direzionali → quadrilatero di area massima; ordinamento angolare attorno al centroide robusto
  anche a 45°, dove le diagonali producono pareggi — bug trovato e corretto in sviluppo),
  omografia prospettica (sistema 8×8 con eliminazione di Gauss) e warp bilineare. `processScan`
  ora ritaglia e raddrizza sul quadrilatero prima di ruotare e filtrare; `previewScan` genera
  l'anteprima originale + bordi rilevati. In `ScannerSheet`: ritaglio automatico all'aggiunta
  (badge "ritagliata"/"foto intera") ed editor "Regola i bordi" con i 4 angoli trascinabili
  (pointer events), overlay SVG, bottoni Bordi automatici/Foto intera. Verifiche: 92 test,
  lint/`tsc` puliti, build ok; E2E con foto sintetica in prospettiva su sfondo scuro: bordi
  rilevati con scarto <1% dagli angoli reali, documento raddrizzato senza sfondo residuo.
- **18 luglio 2026 — scanner documenti:** solo frontend (nessuna migrazione né Edge Function).
  Card "Scanner documenti" nella pagina Documenti → `ScannerSheet` con fotocamera/galleria
  (`input capture`, max 20 pagine), filtri per pagina in `src/lib/scanner.ts` (Migliorato =
  stretch contrasto percentili 2–98, Grigio, B/N con soglia di Otsu, Originale; ridimensionamento
  a 2200 px, EXIF gestito da `createImageBitmap` con ripiego `<img>`), rotazione 90°, PDF A4
  multi-pagina con jsPDF, condivisione con Web Share API (foglio nativo iOS: WhatsApp, Mail, …)
  con ripiego download, salvataggio facoltativo nei Documenti (upload storage + riga `documents`,
  senza avvio automatico dell'analisi AI, per privacy sui documenti d'identità). Verifiche: 82
  test (11 nuovi su filtri/Otsu/percentili/fit A4), lint/`tsc` puliti, build PWA ok; collaudo E2E
  con utente temporaneo (poi eliminato, incluso il file di test nello storage via Storage API —
  nota: `storage.objects` non è cancellabile via SQL): 2 foto sintetiche → anteprime, B/N binario
  al 92% verificato sui pixel, PDF salvato nei Documenti con stato "Da analizzare", fallback
  download della condivisione corretto.
- **15 luglio 2026 (sera) — what-if, diario vocale e carburanti:** tre funzioni nuove.
  1) *Simulatore what-if* nella scheda Obiettivi: proiezione patrimonio con medie reali +
  scenario mensile, grafico e commento AI (riusa mode `assistant`; `src/lib/whatif.ts` con 8 test).
  2) *Diario del giorno* nei Movimenti: dettatura unica → `ai-analyze` v7 mode
  `parse_transactions` (schema ARRAY, max 20 movimenti) → conferma in blocco con conto comune.
  3) *Carburanti* in Altro: nuova Edge Function `fuel-prices` (open data MIMIT, ~8 MB CSV in cache
  6h) + pagina `/carburanti` con mappa Leaflet/OpenStreetMap navigabile (nuova dipendenza
  `leaflet`, tile consentiti dalla CSP esistente via `img-src https:`), geolocalizzazione,
  ricerca sul centro mappa (zoom automatico sui risultati), classifica prezzi e link navigazione.
  Verifiche: 71 test, lint/`tsc` puliti, build PWA ok (FuelPage in chunk lazy separato da 46 kB gz);
  `fuel-prices` v1 e `ai-analyze` v7 distribuite ACTIVE e collaudo E2E autenticato con utente
  temporaneo (poi eliminato): 60 distributori reali intorno a Roma con "PIÙ ECONOMICO" evidenziato,
  diario "caffè 1,20, pranzo 12, benzina 40, ricevuti 25 da Luca" → 4 movimenti con categorie
  corrette registrati in blocco, simulatore con proiezione +1.200 €/anno e commento Gemini coerente.
- **15 luglio 2026 — passkey con Face ID:** accesso senza password con WebAuthn (API sperimentale
  Supabase, client con `auth.experimental.passkey`, supabase-js 2.110): bottone "Accedi con passkey
  (Face ID)" nel login (visibile solo se il browser supporta WebAuthn) e sezione "Passkey e Face ID"
  in Altro per creare/elencare/eliminare le passkey (`src/lib/passkeys.ts` con messaggi di errore in
  italiano). La password resta come metodo alternativo. **Da fare una volta nel dashboard Supabase**
  (Authentication → Passkeys): abilitare e impostare RP Display Name `AJE`, RP ID
  `rameno29.github.io`, RP Origins `https://rameno29.github.io` — finché non è attivo, il bottone
  mostra un avviso dedicato. Nota: con questo RP ID la cerimonia non funziona da `localhost` (è
  legata al dominio di produzione). Verifiche: `tsc`/lint puliti, 63 test, build PWA ok, smoke test
  del messaggio "passkey non attive" nel browser; il test biometrico reale va fatto sull'iPhone.
- **14 luglio 2026 (sera) — ricerca documenti + debug generale:** colonna generata `search_vector`
  (tsvector italiano su nome file e analisi AI) + indice GIN su `documents` (migrazione remota
  `20260714010629`), barra di ricerca nella pagina Documenti (`websearch`, debounce, max 50
  risultati, RLS invariata). Debug approfondito con 4 correzioni (vedi sezione 7, punto 12) e
  ridistribuzione `ai-analyze` v6. Verifiche: 63 test, lint e `tsc` puliti, build PWA ok, collaudo
  E2E autenticato di conti/trasferimenti/ricerca su database reale con utente temporaneo (rimosso).
- **14 luglio 2026 — multi-conto/import CSV:** nuova tabella `accounts` (RLS) e colonne
  `account_id`/`transfer_group` su `transactions` (migrazione `20260714020000_accounts_transfers.sql`,
  con vincolo: i trasferimenti non hanno categoria né ricorrenza); la funzione delle ricorrenze
  conserva il conto. Nuova vista **Conti** in Finanze: saldi per conto e patrimonio, trasferimenti
  interni (coppia di movimenti, esclusi da totali/grafici, eliminazione in coppia, funziona anche
  offline tramite la coda), import CSV guidato per conto (`src/lib/csvImport.ts` +
  `ImportSheet.tsx`, tutto lato client), selettore conto nel movimento, conto nell'export CSV.
  Verifiche locali: 62 test superati, lint invariato, `tsc` pulito e build PWA completata.
  Migrazione applicata al database remoto (versione `20260714002316`, cronologia locale/remota
  allineata, advisor di sicurezza senza nuove segnalazioni); frontend pubblicato con commit
  `4b3dd5b`: workflow GitHub Pages completato e verificato che il chunk `FinancePage` online
  contenga le nuove funzioni. Il test completo autenticato richiede l'accesso dell'utente nell'app.
- **12 luglio 2026 — multivaluta/offline:** aggiunti schema e controlli DB multivaluta, Edge Function
  `ecb-rates`, UI a 16 valute, export esteso, cache IndexedDB AES-GCM, coda offline per movimenti e
  attività con replay idempotente, indicatore di stato e guida aggiornata. Verifiche locali: 43 test
  superati, lint senza errori e build PWA completata. Migrazione
  `20260712090000_multicurrency.sql` applicata al database; `ecb-rates` v2 distribuita `ACTIVE` con
  verifica JWT e testata: le richieste prive di sessione vengono respinte con HTTP 401. Cronologia
  migrazioni locale/remota allineata e `npm audit --omit=dev`: 0 vulnerabilità.
  Frontend pubblicato con commit `0625dfa`: workflow GitHub Pages completato e pagina online caricata
  senza errori JavaScript; il test autenticato completo richiede l'accesso dell'utente nell'app.
- **11 luglio 2026 — CI/CD:** aggiornate alle versioni stabili basate sul runtime Node 24
  `actions/checkout` (v5), `actions/setup-node` (v5) e `actions/upload-pages-artifact` (v4).
  Gli avvisi Node 20 residui provengono dalla dipendenza interna `actions/upload-artifact@v4.6.2`
  e da `actions/deploy-pages@v4`; GitHub ne forza già l'esecuzione su Node 24 e il deploy termina
  correttamente. Non risultano ancora major ufficiali successive per l'intero flusso Pages.
- **11 luglio 2026 — frontend:** commit `7c5e098` pubblicato su `main`; workflow GitHub Pages
  completato con successo e build online verificata tramite l'hash dell'asset principale.
- **11 luglio 2026 — Edge Functions:** `ai-analyze` v5, `ai-command` v6, `send-reminders` v3 e
  `analyze-payslip` v3 validate con `deno check`, ridistribuite e verificate `ACTIVE`. La verifica JWT
  è attiva sulle funzioni AI; `send-reminders` mantiene `verify_jwt=false` perché il cron la autentica
  tramite `CRON_SECRET`.

### Struttura cartelle principali
```
src/
  lib/            → supabase, config, voice, push, pdf, export, import CSV, dati, cambi BCE, offline cifrato
  context/        → Auth, Tema
  components/     → UI condivisa, TabBar, AiText
  modules/        → home, finance, agenda, documents, assistant, settings, guide, auth
supabase/functions/ → ai-analyze, ai-command, send-reminders, ecb-rates e tombstone legacy (codice Deno)
supabase/migrations/ → cronologia SQL completa + schema multivaluta
.github/workflows/  → deploy.yml (GitHub Pages), keep-alive.yml (Supabase)
```

### Se qualcosa "non si aggiorna" sul telefono
Verifica prima che la coda offline sia vuota, salva i moduli aperti e riapri l'app. Il nuovo branch
rimuove il reload forzato. Non cancellare storage, cache del sito o installazione se ci sono operazioni
in attesa: i dati non ancora sincronizzati esistono solo sul dispositivo.

---

## 11. Cose che il proprietario (Bogdan) deve sapere

- **Dati sincronizzati:** sono nel database cloud; le operazioni offline pendenti non lo sono ancora.
- **Costi e privacy:** quote e gratuità dipendono dai provider. Valutare le condizioni prima di inviare
  buste paga o altri dati sensibili; cifrare la chiave salvata non rende private le richieste al provider.
- **Inviti:** Impostazioni → Utenti e inviti. Nessun limite applicativo di ospiti; dati e chiavi
  restano separati. Puoi copiare il link o preparare il messaggio nella tua app di posta.
- **Notifiche su iPhone:** funzionano solo con l'app installata sulla Home e permesso concesso.

---

*Documento mantenuto aggiornato insieme all'evoluzione dell'app. Per la cronologia tecnica dettagliata,
vedere anche i messaggi di commit su GitHub.*

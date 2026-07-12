# 📖 AJE — Documento di riferimento del progetto

> **Leggi questo file per primo.** Contiene tutto: cos'è l'app, com'è fatta, cosa è stato
> realizzato, i problemi incontrati e come sono stati risolti, lo stato attuale e i piani futuri.
> Ultimo aggiornamento: **12 luglio 2026**.

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
- **Supporto multivaluta**: 16 valute, importo originale e controvalore EUR calcolato con il cambio
  ufficiale BCE del giorno o dell'ultimo giorno lavorativo precedente; tasso, data e fonte restano
  salvati sul movimento e sono inclusi nell'export CSV.

### 📅 Agenda
- Attività/promemoria con data, ora e note; raggruppate per urgenza (in ritardo/oggi/prossime).
- Vista **calendario mensile** con puntini sui giorni impegnati.
- Widget "Da fare oggi" in Home.
- **Notifiche push** all'orario dell'attività (con pulsante "invia notifica di prova").

### 📄 Documenti (AI)
- **Busta paga** (PDF o foto) → estrae netto/lordo/trattenute → crea l'entrata stipendio + grafico andamento.
- **Scontrini/ricevute** → estrae totale, data, negozio, categoria → crea l'uscita.
- **Documento qualsiasi** (contratto, bolletta, referto…) → riassunto + spiegazione semplice.
- **Crea PDF con l'AI** da una richiesta scritta o dal contenuto di un video YouTube.

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
- Tema chiaro/scuro/automatico.
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
| `transactions` | Movimenti (controvalore EUR, valuta/importo originali, cambio BCE, tipo, categoria, data, ricorrenza, documento) |
| `exchange_rates` | Cache server dei cambi di riferimento BCE per valuta e giorno (sola lettura per utenti autenticati) |
| `budgets` | Budget mensile per categoria |
| `goals` | Obiettivi di risparmio (traguardo, risparmiato, scadenza) |
| `tasks` | Attività/promemoria dell'agenda (+ flag `notified` per le notifiche) |
| `documents` | Documenti caricati (tipo, path storage, stato, analisi AI salvata) |
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

1. **Multi-conto + import estratti conto CSV**
   - Conti separati per contanti, banca e carte, con saldo e trasferimenti interni.
   - Import guidato CSV con anteprima, mappatura colonne, riconoscimento duplicati e regole automatiche
     per categoria/esercente.
   - È la strada più utile e affidabile per ridurre l'inserimento manuale senza dipendere da API
     bancarie a pagamento o da consensi PSD2 periodici.

2. **Ricerca completa nei documenti**
   - Prima fase gratuita con Full Text Search nativa di PostgreSQL su titolo, riassunto, spiegazione e
     punti chiave; indice GIN e risultati sempre filtrati tramite RLS.
   - Seconda fase facoltativa con ricerca semantica `pgvector`, generando embeddings solo sul testo
     già estratto e non sui file originali.

3. **Agenda Google scrivibile e sincronizzazione Google Tasks**
   - Creare eventi Calendar dall'agenda o dall'assistente solo dopo conferma esplicita.
   - Collegare opzionalmente una lista Google Tasks, salvando gli ID esterni per evitare duplicati e
     conflitti; partire con sincronizzazione manuale/monodirezionale prima del bidirezionale.
   - Richiede ampliare gli scope OAuth attuali, quindi va mostrata chiaramente la nuova autorizzazione.

4. **Backup cifrato su Google Drive**
   - Esportazione JSON versionata nel folder nascosto `appDataFolder`, accessibile solo ad AJE.
   - Cifratura lato client prima dell'upload, ripristino con anteprima e controllo versione schema.
   - Lo scope `drive.appdata` è più ristretto e non sensibile rispetto all'accesso generale a Drive.

5. **Scadenze intelligenti e controllo abbonamenti**
   - Rilevare automaticamente ricorrenze, rincari, doppioni e servizi non usati dai movimenti.
   - Promemoria per rinnovi, disdette, documenti, garanzie, bollo, assicurazione e contratti.
   - Previsione di fine mese, confronto anno su anno e simulatore “quanto posso spendere”.

6. **MFA con app Authenticator**
   - Aggiungere enrollment, verifica e recupero TOTP nelle impostazioni account.
   - La MFA di base è compresa nel piano gratuito Supabase ed è preferibile all'SMS per costi e
     affidabilità.

### Priorità B — utili dopo il consolidamento del modello dati

7. **Modalità famiglia/coppia con spazi condivisi**
   - Tabelle `households`, `memberships` e ruoli; ogni movimento appartiene a uno spazio personale o
     condiviso.
   - RLS basata sulle membership e aggiornamenti live tramite canali Supabase Realtime privati.
   - Richiede una migrazione delicata: non va implementata aggiungendo semplicemente altri `user_id`.

8. **Import di fatture e ricevute da Gmail**
   - Ricerca mirata di email selezionate dall'utente e download dei soli allegati confermati, poi
     riuso dell'analisi scontrini/documenti già esistente.
   - `gmail.readonly` permette query e allegati ma è uno scope Google ristretto: mantenere l'app
     privata/in test, minimizzare i dati e non creare scansioni automatiche indiscriminate.

### Sperimentali / da valutare contrattualmente

11. **Sincronizzazione bancaria Open Banking (PSD2)**
    - GoCardless Bank Account Data dichiara fino a 24 mesi di storico e fino a 90 giorni di accesso
      continuativo; le banche possono limitare le chiamate anche a quattro al giorno.
    - TrueLayer espone conti, carte, saldi, transazioni, addebiti diretti e ordini permanenti.
    - Prima di sviluppare servono conferma aggiornata di copertura delle banche italiane, accesso alla
      produzione, prezzo e condizioni per uso personale. Secret e refresh token dovrebbero vivere
      solo nelle Edge Functions; l'utente deve poter revocare e cancellare ogni collegamento.

12. **Integrazione Splitwise o servizi simili**
    - Utile solo se la modalità condivisa interna non basta.
    - Richiederebbe OAuth, token server-side, mapping degli utenti e strategia anti-duplicati; priorità
     bassa per evitare una seconda fonte autorevole delle stesse spese.

### Completate dalla roadmap

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
VITE_YOUTUBE_API_KEY=...
```

### Deploy
- Basta fare **push su `main`**: GitHub Actions compila e pubblica su GitHub Pages.
- Le **Edge Functions** si ridistribuiscono dal pannello Supabase o via connettore.
- Le **icone** dell'app si rigenerano da `scripts/icon-source.png` con `node scripts/generate-icons.mjs`.

### Ultimo rilascio
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
  lib/            → supabase, config, voice, push, pdf, export, dati, cambi BCE, offline cifrato
  context/        → Auth, Tema, Player YouTube
  components/     → UI condivisa, TabBar, MiniPlayer, AiText
  modules/        → home, finance, agenda, documents, google, media, assistant, settings, guide, auth
supabase/functions/ → ai-analyze, ai-command, send-reminders, analyze-payslip, ecb-rates (codice Deno)
supabase/migrations/ → cronologia SQL completa + schema multivaluta
.github/workflows/  → deploy.yml (GitHub Pages), keep-alive.yml (Supabase)
```

### Se qualcosa "non si aggiorna" sul telefono
Chiudi del tutto l'app (app switcher) o rimuovila dalla Home e reinstallala da Safari. I dati non si
perdono (sono nel cloud). Con l'auto-reload aggiunto, dovrebbe aggiornarsi da sola.

---

## 11. Cose che il proprietario (Bogdan) deve sapere

- **I dati sono al sicuro** nel database cloud: rimuovere/reinstallare l'app non li cancella.
- **Costi:** tutto su piani gratuiti. Gemini gratuito potrebbe usare i dati inviati per migliorare i
  servizi Google (irrilevante per i riassunti; per le buste paga valutare, se si vuole massima privacy,
  una chiave a pagamento in futuro).
- **Per far usare l'app a qualcun altro** (famiglia): va aggiunta la sua email alla lista autorizzate.
- **Notifiche su iPhone:** funzionano solo con l'app installata sulla Home e permesso concesso.

---

*Documento mantenuto aggiornato insieme all'evoluzione dell'app. Per la cronologia tecnica dettagliata,
vedere anche i messaggi di commit su GitHub.*

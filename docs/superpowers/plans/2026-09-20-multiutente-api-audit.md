# AJE — Piano per accessi su invito, API personali e audit

Data: 20 settembre 2026. Stato aggiornato il 22 settembre: piano approvato ed eseguito localmente;
rilascio e collaudo reale da autorizzare. Il documento da solo non autorizza modifiche cloud.

**Obiettivo:** rendere AJE utilizzabile dal proprietario e da una seconda persona, con dati separati, inviti dalle Impostazioni, credenziali personali cifrate e correzione dei difetti verificati in tutti i moduli esistenti.

**Architettura proposta:** mantenere React/TypeScript/Vite, GitHub Pages e Supabase. Aggiungere gestione accessi e credenziali sul server; usare la sessione verificata per determinare sempre l'utente. Ogni richiesta AI o YouTube usa soltanto la credenziale di quell'utente.

**Esecuzione proposta:** un agente nella stessa attività, per fasi verificabili; niente deleghe automatiche. Il proprietario ha chiesto di approvare o modificare il piano prima del lavoro. Le scelte sotto sono proposte, salvo le preferenze già confermate.

## 1. Requisiti e decisioni

### Stato di esecuzione — 22 settembre 2026

Piano approvato e implementazione locale conclusa nelle prosecuzioni di questa attività. Login, inviti,
membership, credenziali personali, guide, isolamento e correzioni principali sono nel branch locale.
Le checklist sotto restano la specifica originale: una casella non spuntata non prova che il codice
sia assente, né i test locali provano che il rilascio sia concluso. Il dettaglio verificato e i casi
ancora da completare sono nel [registro audit](../../audit/2026-09-20-audit.md).
Le istruzioni di backup/deploy/ripristino sono in [rilascio](../../release-multiutente.md).
Audit locale e revisione finale circoscritta conclusi, con limiti espliciti nel registro. Nessuna
pubblicazione remota eseguita; collaudo con servizi/dispositivo reali ancora da effettuare.
Le fasi 1–5 sono implementate e verificate localmente; la fase 6 ha prodotto le correzioni e la
matrice di copertura; la fase 7 è conclusa per test/documentazione/preparazione, non per il rilascio.

Confermati dall'utente:

- Correggere il testo poco leggibile nei campi email e password.
- Consentire l'uso a un'altra persona oltre al proprietario, per ora.
- Gestire l'invito dalle Impostazioni del proprietario.
- Conservare le chiavi personali salvate e cifrate nell'account.
- Mostrare nell'app i link e le istruzioni per ottenere le proprie API, con attenzione ai piani gratuiti.
- Evitare che l'ospite consumi le chiavi personali del proprietario.
- Eseguire un audit di tutti i moduli, correggere i difetti riproducibili e verificarli.
- Segnalare al proprietario i punti in cui conviene cambiare modello Codex.

Proposte adottate per rendere il piano concreto:

- Spazi personali separati: nessuna condivisione di movimenti, documenti o agenda tra i due account.
- Un solo amministratore, identificato sul server dal suo UUID Auth; il ruolo non proviene da campi modificabili dall'utente.
- Capacità iniziale: proprietario + un ospite attivo o invitato. Gli inviti pendenti riservano il posto; i reinvii non creano posti aggiuntivi. Limite configurabile sul server per una futura estensione.
- L'amministratore gestisce gli accessi; nell'interfaccia non può vedere dati finanziari o credenziali dell'ospite.
- Le integrazioni sono facoltative: finanze manuali, agenda e scanner locale funzionano anche senza API personali.
- Nessuna attivazione automatica di servizi a pagamento, acquisto di domini o creazione di account presso provider durante l'implementazione.

## 2. Riscontri nel repository e limiti dell'analisi iniziale

Workspace effettivo: `C:/Users/stafi.000/Desktop/Lavori ClaudeCodex/App gestione finanze e organizzazione`.

- `src/index.css`: la regola globale non inserita in un layer contiene `color: inherit` per input, select, textarea e button. Può prevalere sulle utility Tailwind del login. Riprodurre con gli stili calcolati nel browser prima di correggere; controllare anche autofill.
- `src/modules/auth/LoginPage.tsx`: registrazione pubblicamente visibile, errori server poco guidati e redirect fisso. Mancano schermate dedicate a invito e impostazione/recupero password.
- La migrazione `20260707202051_security_hardening_audit.sql` abilita solo la mail del proprietario. Il blocco dei nuovi account è una regola intenzionale da evolvere.
- `ai-analyze` e `ai-command` leggono la chiave Gemini globale. La funzione legacy `analyze-payslip` legge una chiave Anthropic globale: anche questa via deve essere chiusa al consumo condiviso.
- `MediaPage.tsx` esegue la ricerca YouTube dal browser con `VITE_YOUTUBE_API_KEY` condivisa. Una variabile Vite incorporata nella build è leggibile dal browser anche quando nasce da un secret GitHub.
- Google usa `sessionStorage.google_token`; Spotify usa chiavi globali in `localStorage`. Il logout nelle Impostazioni chiama direttamente Supabase: serve verificare e correggere la permanenza dei collegamenti passando da A a B.
- La coda offline è già divisa per utente, ma deve essere verificato il cambio sessione durante la sincronizzazione: una risposta senza righe aggiornate non deve far sparire un'operazione dell'account precedente.
- Il controllo precedente ha eseguito 101 test con successo; riguarda soprattutto funzioni locali, non prova l'isolamento tra due utenti o il funzionamento dei servizi remoti.
- File OAuth locale non tracciato e non ignorato con indicazione di client secret: evitare inclusione in commit, esaminare la reale esposizione senza stampare il valore.
- Il README breve descrive ancora il vecchio flusso Anthropic; aggiornare in fase di implementazione.
- Lo stato di produzione, SMTP, credenziali effettive, autorizzazioni OAuth e policy attive va verificato: i file locali non ne certificano lo stato.

## 3. Esperienza utente prevista

### Accesso

Campi sempre leggibili in tema chiaro/scuro, digitazione, focus, compilazione automatica e password manager. Controllo mostra/nascondi password con etichetta accessibile. Indicazioni chiare per accesso su invito, sessione scaduta, link non valido e recupero password; nessuna esposizione di errori tecnici grezzi.

### Impostazioni → Utenti e inviti (solo proprietario)

Mostra i posti disponibili, l'ospite attivo e l'eventuale invito pendente. Il proprietario inserisce l'email, genera l'invito e può copiarne il link o inviarlo via email quando SMTP è operativo. Sono previsti reinvio e annullamento degli inviti; la sospensione di un ospite esistente conserva i suoi dati e blocca nuovi accessi ai servizi.

Il link è monouso, scade e rimane associato all'email invitata. L'ospite apre il link, imposta la password e accede alla configurazione guidata. Il sistema gestisce anche account già esistenti e link aperti mentre è autenticato un altro account, senza collegare identità sbagliate.

### Impostazioni → Le mie integrazioni

Per ciascun servizio: funzione sbloccata, stato, pulsante per aprire la guida ufficiale, passaggi in italiano, campo credenziale mascherato, salva/sostituisci/verifica/rimuovi. Le chiavi salvate non vengono restituite integralmente al browser: mostrare solo stato e suffisso mascherato. Il test della chiave è richiesto dall'utente e può consumare una piccola quota, indicata nel testo.

Se manca una chiave, il pulsante della funzione porta alla relativa configurazione. Nessun tentativo usa la chiave del proprietario come ripiego. Le API che hanno esaurito la quota o rifiutano la chiave producono messaggi distinti, senza bloccare il resto dell'app.

## 4. Quali credenziali servono

| Funzionalità | Configurazione dell'utente | Comportamento senza configurazione |
|---|---|---|
| Assistente, analisi documenti, dettatura, report, riassunti e ricerca AI | Chiave Gemini del proprio progetto | Funzioni AI indisponibili; dati e funzioni manuali utilizzabili |
| Ricerca YouTube | Chiave YouTube Data API del proprio progetto | Apertura e riproduzione tramite link diretto ancora disponibili |
| Google Calendar/Gmail/Drive | Collegamento OAuth al proprio account; Client ID del proprio progetto per separare anche le quote del progetto | Sezione scollegata, guida disponibile |
| Spotify | Collegamento OAuth al proprio account; Client ID del proprio progetto per separare anche le quote dell'app | Collegamenti/embed ove utilizzabili, controllo API disattivato |
| Scanner locale, PDF locale, gestione manuale | Nessuna chiave esterna personale | Funzionanti |
| Cambi BCE e carburanti | Nessuna chiave personale nell'integrazione attuale | Accesso tramite servizi esistenti, salvo guasti del provider |
| Supabase, notifiche push e invio inviti | Configurazione infrastrutturale del proprietario | Restano servizi dell'app; non si richiede un progetto Supabase all'ospite |

I Client ID OAuth non sono password. Per rispettare la separazione delle quote, proporre configurazione personale Google/Spotify, con i redirect/origini esatti da copiare. Mantenere il Client ID del proprietario associato soltanto al suo profilo. Un'eventuale app OAuth condivisa renderebbe comunque personali gli account collegati, ma non tutte le quote: non abilitarla implicitamente.

Gratuità e disponibilità vanno descritte per servizio e funzione, senza promesse illimitate. In particolare controllare modelli Gemini disponibili, ricerca con fonti, trattamento dei documenti e requisiti Spotify. La cifratura delle chiavi non cambia le condizioni del provider sui contenuti inviati.

Link da includere nella guida in-app e ricontrollare al rilascio:

- Gemini: https://aistudio.google.com/apikey — https://ai.google.dev/gemini-api/docs/api-key — https://ai.google.dev/gemini-api/docs/pricing
- YouTube: https://console.cloud.google.com/apis/library/youtube.googleapis.com — https://console.cloud.google.com/apis/credentials — https://developers.google.com/youtube/v3/getting-started
- Google OAuth: https://console.cloud.google.com/auth/clients — https://developers.google.com/identity/oauth2/web/guides/overview
- Spotify: https://developer.spotify.com/dashboard — https://developer.spotify.com/documentation/web-api/concepts/quota-modes

## 5. Architettura di accessi e cifratura

### Accessi e inviti

- Ruoli e stato di accesso conservati in tabelle protette. Proposta: `app_members` (UUID Auth, owner/member, stato) e `app_invites` (email normalizzata, stato, scadenza, autore, riferimento al destinatario).
- Operazioni amministrative tramite Edge Function `manage-invites`; JWT verificato, ruolo letto dal server, autorizzazione controllata a ogni operazione.
- Prenotazione del posto atomica nel database: due richieste concorrenti non possono invitare due ospiti. Idempotenza per doppio clic e reinvio; nessuna transazione mantenuta aperta durante l'invio email.
- Riutilizzare i token monouso di Supabase Auth, con verifica server dello stato e scadenza dell'invito prima di concedere membership attiva. Non registrare i link completi nei log.
- Integrare la allowlist attuale col flusso di invito; non eliminare semplicemente il trigger e aprire le registrazioni a tutti. Gestire esplicitamente i percorsi signup diretto, invito e account preesistente.
- Invito scaduto/annullato non dà accesso anche se esiste ancora un token Auth. Invio email fallito resta distinguibile da invito generato; retry sicuro, senza nuova prenotazione del posto.
- Per la sospensione: controllo membership attiva nelle policy dati/storage e nelle Edge Functions, oltre alla revoca delle sessioni. Un access token già emesso non deve conservare accesso ai servizi. Nessuna promessa di cancellare dati già scaricati su un dispositivo offline.
- Copiare un invito nelle Impostazioni evita la dipendenza SMTP; l'invio email usa SMTP configurato. Non aggiungere l'ospite al team amministrativo Supabase per superare i limiti email.

### Chiavi personali

- Tabella privata `user_api_credentials`: `(user_id, provider)` univoco, ciphertext, nonce, versione chiave di cifratura, suffisso mascherato e data aggiornamento. Accesso negato ai client; lettura/scrittura gestita da funzioni server autorizzate.
- Cifratura AES-256-GCM tramite Web Crypto: nonce casuale diverso per ogni salvataggio; dati autenticati comprendenti UUID utente, provider e versione del formato, per impedire lo scambio di ciphertext tra record.
- Chiave principale generata casualmente e conservata nei secret server delle Edge Functions, separata dal database dei ciphertext. Mai in variabili `VITE_*`, Git o output dei comandi.
- Gestione con Edge Function `user-credentials`: elenco dei soli metadati, salvataggio, verifica e cancellazione. L'UUID viene dalla sessione verificata, non dal body del client.
- Decifratura solo per la richiesta del proprietario della chiave e solo per il provider richiesto. Nessun segreto nei log, errori, analytics, cache offline o risposte HTTP; risposte gestione chiavi non memorizzabili in cache.
- La cifratura è gestita dal server, non end-to-end: l'infrastruttura deve poter decifrare per effettuare le chiamate. Chi amministra tecnicamente il server dispone di questo potere; il pannello amministratore non espone le chiavi.
- Versionamento e procedura di rotazione: aggiungere nuova chiave server, ricifrare e verificare i record, ritirare quella precedente solo dopo controllo e compatibilità con i backup. Perdere la chiave principale richiede reinserire le credenziali.
- I Client ID OAuth personali sono configurazioni non segrete; i token OAuth temporanei restano separati per identità e vengono eliminati dal dispositivo al logout. Questo piano non promette la sincronizzazione cloud dei collegamenti OAuth: su un nuovo dispositivo potrà essere richiesto un nuovo consenso.

### Chiamate ai provider

- Helper server condiviso per autorizzazione, recupero/decifratura credenziale, timeout, limiti e traduzione errori.
- Aggiornare tutte le modalità AI e neutralizzare la funzione legacy Anthropic: nessun endpoint residuo deve usare segreti globali per gli ospiti.
- Nuova Edge Function `youtube-search`: riceve soltanto query e opzioni ammesse, usa la chiave personale sul server e restituisce risultati filtrati. Nessun proxy verso URL arbitrari.
- Togliere `VITE_YOUTUBE_API_KEY` dal frontend e dal workflow; migrare la configurazione del proprietario con reinserimento protetto o migrazione server strettamente legata al suo UUID.
- Restrizioni YouTube coerenti con uso server: una chiave limitata ai referrer browser può fallire dal proxy. La guida deve descrivere la configurazione corretta senza promettere IP di uscita fissi non disponibili.
- Limitatore persistente per utente e provider; contatori atomici anche con più istanze delle funzioni, limite concorrenza, dimensione payload, timeout e retry limitati. Le sole mappe in memoria non bastano a garantire una quota unica.

## 6. Fasi operative e criteri di accettazione

Le attività seguenti saranno eseguite dopo approvazione del piano. Ogni difetto funzionale corretto riceve una prova di regressione adeguata; le modifiche visive vengono verificate nel browser, evitando test che confrontano semplicemente stringhe CSS.

### Fase 0 — Baseline, ambiente e registro audit

File: `package.json`, `package-lock.json`, `.gitignore`, `.github/workflows/deploy.yml`, `supabase/config.toml`, migrazioni e documentazione. Nuovo registro: `docs/audit/2026-09-20-audit.md`.

- [ ] Verificare stato Git, istruzioni locali, strumenti e accessi disponibili; preservare modifiche e file locali del proprietario.
- [ ] Eseguire lint, test, build e audit dipendenze, registrando esito completo e codici di uscita; distinguere rischi di produzione da dipendenze di sviluppo.
- [ ] Confrontare migrazioni/funzioni/configurazione remota con repository, usando accessi autorizzati in sola lettura; indicare gli elementi non verificabili.
- [ ] Escludere il file OAuth locale da Git; verificare se il segreto è stato esposto nella cronologia. La rotazione del segreto sul provider va coordinata col proprietario.
- [ ] Preparare ambiente di test con due identità e dati sintetici, oltre a richieste anonime/non invitate. Evitare prove distruttive sui dati reali.

Uscita: baseline ripetibile, registro con gravità/prova/riproduzione, ambiente di collaudo e nessun segreto nei risultati.

### Fase 1 — Login leggibile e flussi di autenticazione

File: `src/index.css`, `src/modules/auth/LoginPage.tsx`, `src/context/AuthContext.tsx`, `src/App.tsx`. Nuovo `src/modules/auth/AuthCallbackPage.tsx`; test browser `tests/e2e/auth.spec.ts`.

- [ ] Riprodurre il contrasto insufficiente e leggere gli stili calcolati in chiaro/scuro, con tastiera e autofill.
- [ ] Correggere la precedenza del reset CSS nel layer appropriato e gli stati dei campi; controllare anche pulsanti e input negli altri moduli.
- [ ] Introdurre percorso invito/recupero password, normalizzazione email, mostra password, errori di rete leggibili e ritorno utilizzabile a login.
- [ ] Gestire separatamente callback Spotify e callback Supabase: il solo parametro `code` non deve far presumere Spotify.
- [ ] Verificare digitazione, incolla, autofill, password manager, focus, password errata e link scaduto; nessun salto inatteso di account.

Uscita: testo e placeholder distinguibili e contrasto del testo normale almeno 4,5:1; login utilizzabile su viewport mobile e desktop. Autofill/Face ID e PWA iOS vanno confermati anche sul dispositivo reale.

### Fase 2 — Isolamento multiutente e dati esistenti

File: `src/context/AuthContext.tsx`, `src/context/PlayerContext.tsx`, `src/lib/offline.ts`, `src/lib/googleAuth.ts`, `src/lib/spotifyAuth.ts`, `src/modules/settings/SettingsPage.tsx`, funzioni server e nuove migrazioni create tramite CLI Supabase. Test: `tests/e2e/account-isolation.spec.ts`, `supabase/tests/isolation.test.sql`.

- [ ] Testare A e B su tutte le tabelle, storage e funzioni: tentativi di lettura, modifica, cancellazione e riferimenti a record dell'altro utente vengono negati.
- [ ] Verificare che foreign key verso conto/categoria/documento non permettano di associare dati di A ai record di B; correggere vincoli o trigger con migrazioni additive.
- [ ] Centralizzare logout/cambio utente: fermare sincronizzazioni, annullare richieste, azzerare player e stato visuale, cancellare token OAuth locali e impedire che risposte tardive di A popolino l'interfaccia di B.
- [ ] Legare la coda offline all'identità e ricontrollarla prima di ogni operazione; preservare le operazioni non sincronizzate di A senza eseguirle o cancellarle sotto B.
- [ ] Testare logout mentre la rete torna disponibile, seconda scheda aperta e cambio account sul medesimo telefono.

Uscita: B non vede dati, collegamenti o chiavi di A e non perde né esegue la coda di A; i dati esistenti del proprietario restano coerenti.

### Fase 3 — Inviti nelle Impostazioni

Nuovi file: `src/modules/settings/InvitesPanel.tsx`, `src/lib/invitations.ts`, `supabase/functions/manage-invites/index.ts`, helper accesso in `supabase/functions/_shared/access.ts`. Modifiche a Settings, callback Auth e migrazioni. Test: `supabase/functions/manage-invites/index.test.ts`, `tests/e2e/invitations.spec.ts`.

- [ ] Implementare membership protette e inviti compatibili con la allowlist; migrare il proprietario tramite UUID verificato.
- [ ] Implementare prenotazione atomica del posto e operazioni lista/crea/reinvia/annulla/sospendi; verificare ruolo lato server anche con richieste HTTP costruite manualmente.
- [ ] Collegare token Supabase monouso e pagina imposta password; proteggere accettazione/replay, email differente e token ancora valido dopo annullamento.
- [ ] Aggiungere pannello proprietario con stato inviti e copia link; abilitare invio email solo dopo verifica SMTP, gestendo fallimenti senza perdere lo stato.
- [ ] Testare invito riuscito, reinvio, annullamento, scadenza, limite posti e due inviti concorrenti; testare che un ospite non possa promuoversi o invitarne altri.

Uscita: invito completabile interamente dall'app; registrazione non invitata bloccata; sospensione blocca servizi anche con JWT precedentemente valido. Email reale solo a destinatario indicato dal proprietario per quella prova.

### Fase 4 — Credenziali cifrate e migrazione provider

Nuovi file: `supabase/functions/_shared/credentials.ts`, `supabase/functions/user-credentials/index.ts`, `supabase/functions/youtube-search/index.ts`, `src/lib/integrations.ts`, `src/modules/settings/IntegrationsPanel.tsx`. Modifiche: funzioni AI, Media, config, workflow e migrazioni.

- [ ] Verificare cifratura/decifratura, nonce distinti, rifiuto ciphertext alterato e rifiuto cambio utente/provider nei dati autenticati.
- [ ] Implementare salvataggio/sostituzione/rimozione e lettura soli metadati; testare assenza di credenziali nei log, JSON di risposta e bundle.
- [ ] Adattare ogni modalità AI e la ricerca YouTube; rimuovere il fallback alle chiavi globali e chiudere l'endpoint legacy al consumo condiviso.
- [ ] Testare due credenziali distinte con provider simulato che registra quale chiave riceve; dimostrare che la richiesta di B non invia mai la credenziale di A, anche con configurazione globale presente.
- [ ] Gestire credenziale assente/errata, quota finita, timeout, risposta malformata, cancellazione e aggiornamento; evitare cache della chiave che sopravvive alla rimozione.
- [ ] Preparare rotazione e recupero della chiave principale, e percorso di migrazione del proprietario prima di disabilitare i vecchi percorsi in produzione.

Uscita: credenziali persistenti tra dispositivi, cifrate a riposo, mai restituite integralmente dopo il salvataggio; nessun consumo della chiave del proprietario per gli ospiti.

### Fase 5 — Guide in-app e integrazioni personali

File: `src/modules/settings/IntegrationsPanel.tsx`, `src/modules/guide/GuidePage.tsx`, `src/lib/config.ts`, moduli Google/Media/AI e helper OAuth. Nuovo catalogo guide: `src/lib/integrationGuides.ts`.

- [ ] Aggiungere schede con link ufficiali, passaggi numerati, origini/redirect copiabili e distinzione tra API key e Client ID.
- [ ] Associare i Client ID personali al profilo; callback OAuth con state/PKCE ove richiesto, legata anche all'identità AJE che ha avviato il flusso.
- [ ] Rendere espliciti i limiti del provider e i servizi disponibili senza configurazione; niente quota o prezzo codificati come garanzia permanente.
- [ ] Collegare ogni errore di configurazione alla scheda pertinente e verificare il percorso del nuovo utente senza credenziali.
- [ ] Verificare uso di progetti personali senza dipendenza dalle allowlist OAuth del proprietario; se un provider non consente una funzione nelle condizioni dell'utente, mostrarlo chiaramente.

Uscita: un ospite può configurare le integrazioni leggendo solo la guida nell'app; non deve chiedere chiavi al proprietario.

### Fase 6 — Audit e correzioni di tutti i moduli

File: moduli sotto `src/modules/`, `src/lib/`, `src/sw.ts`, tutte le Edge Functions e migrazioni coinvolte. Registro: `docs/audit/2026-09-20-audit.md` con problema, gravità, prova, correzione, test ed eventuale limite residuo.

| Area | Casi obbligatori |
|---|---|
| Finanze/conti | Saldi iniziali, modifica/eliminazione, trasferimenti atomici e non conteggiati come reddito/spesa, importi in centesimi |
| Multivaluta/ricorrenze | Tasso mancante o cache obsoleta, fine mese/anno bisestile, arretrati cron, fuso Europe/Rome, esecuzioni duplicate |
| CSV/budget/obiettivi | Importi italiani, duplicati, righe invalide, formule in export, budget limite, obiettivi vuoti/completati |
| Documenti/stipendi | MIME/dimensione, percorso storage, upload interrotto, record/file orfani, conferma doppia, ricerca e isolamento |
| Scanner/PDF | Fotocamera negata, foto ruotata, più pagine, annullamento, export/share e memoria su mobile |
| Assistente/voce | Comandi malformati, ID estranei, conferma prima delle scritture, doppio invio, registrazione interrotta, indisponibilità provider |
| Agenda/push | Cambio orario/data, scaduti, modifica dopo notifica, invio fallito, endpoint push non attendibili, proprietà della sottoscrizione |
| Google/Spotify/YouTube | Revoca/scadenza token, callback errata, cambio utente, rate limit, chiavi personali, video non disponibile |
| Carburanti | Geolocalizzazione negata, nessun risultato, feed vecchio/indisponibile, input coordinate invalide |
| PWA/offline | Aggiornamento con modifiche in coda, reload su URL profondo, doppio replay, schede concorrenti e perdita rete |
| UI/accessibilità | Tema, autofill, tastiera, label, messaggi, focus dei dialoghi, contrasto e dimensioni mobili |
| Sicurezza/toolchain | RLS/storage/RPC, funzioni privilegiate, payload grandi, CORS/CSP, segreti, dipendenze e bundle |

- [ ] Riprodurre i difetti e correggerli in ordine: accesso ai dati altrui/segreti, perdita o corruzione dati, flussi bloccati, UI e prestazioni.
- [ ] Aggiungere test mirati per i difetti confermati; non riscrivere moduli estranei al problema.
- [ ] Aggiornare dipendenze vulnerabili con versioni compatibili e lockfile; motivare eventuali segnalazioni non applicabili invece di equiparare audit npm a vulnerabilità sfruttabile.
- [ ] Verificare payload reali dei provider con dati sintetici e credenziali di test autorizzate; usare simulazioni per quote, errori e casi distruttivi.

Uscita: nessun problema critico/alto confermato aperto al rilascio; ogni area ha un esito verificato o un limite esplicito. Un audit esteso non costituisce garanzia di assenza assoluta di bug.

### Fase 7 — Collaudo, documentazione e preparazione rilascio

File: `package.json`, `.github/workflows/deploy.yml`, eventuale workflow CI dedicato, `README.md`, `README_FIRST.md`, registro audit e istruzioni di rilascio.

- [ ] Eseguire lint, test unitari/integrati, controlli TypeScript e Deno, test RLS e build completa PWA con codice di uscita verificato.
- [ ] Eseguire E2E desktop/mobile su build di produzione: invito → password → accesso → chiavi → operazione AI/YouTube → logout → secondo utente.
- [ ] Verificare nel traffico di rete che nessuna risposta fornisca chiavi salvate e che nessuna richiesta dell'ospite usi la configurazione personale del proprietario.
- [ ] Aggiungere test/lint al flusso CI prima del deploy; escludere prove che inviano email o consumano API reali dalle esecuzioni automatiche ordinarie.
- [ ] Aggiornare documentazione e data senza confondere nuove funzioni locali con funzioni già rilasciate.
- [ ] Preparare backup, migrazioni additive, ordine di deploy (accessi/secret server → database → funzioni → frontend), prove post-deploy e ripristino compatibile con il nuovo schema.
- [ ] Presentare risultati, diff, passaggi manuali rimasti e piano di rilascio al proprietario prima della pubblicazione. Il rollback non deve riaprire l'uso delle chiavi globali agli ospiti.

Uscita: release verificata e pronta da pubblicare, con report comprensibile e nessuna cancellazione dei dati del proprietario.

## 7. Prove trasversali che bloccano il rilascio

1. A esce durante una sincronizzazione; B accede: nessuna risposta, token o scrittura di A viene attribuita a B (fase 2).
2. Due richieste di invito arrivano insieme: un solo posto ospite viene prenotato; annullamento e token pendente restano coerenti (fase 3).
3. L'ospite manca della chiave personale: zero chiamate al provider con la chiave globale/proprietario, incluse funzioni legacy (fase 4).
4. Un ciphertext viene spostato su altro utente/provider o manomesso: decifratura rifiutata senza esporre dettagli o segreti (fase 4).
5. PWA viene aggiornata o chiusa con operazioni offline pendenti: nessuna perdita e nessuna duplicazione al rientro (fasi 2 e 6).

## 8. Gestione modelli Codex e consumo

- Mantenere il modello attuale per piano, autorizzazioni, cifratura, isolamento dati e diagnosi complesse.
- Segnalare prima delle sole attività prevalentemente visive/documentali se conviene passare a GPT-5.6 Terra con ragionamento medium, secondo disponibilità nel selettore dell'utente.
- Ritornare al modello più capace per verifiche di sicurezza e revisione finale. Il cambio viene effettuato dal proprietario, non è automatico.
- Evitare cambi continui per interventi brevi: il risparmio dipende dal lavoro e dai limiti dell'abbonamento, non è quantificato da questo piano.
- Esecuzione proposta nella stessa attività e senza subagenti per contenere la duplicazione del contesto.

## 9. Dipendenze esterne e cose da chiedere al momento giusto

- Email dell'ospite solo per il vero invito finale; non serve per scrivere il codice.
- Credenziali personali inserite nell'app dai rispettivi utenti; non richieste nella chat.
- Accesso ai servizi cloud per verificare/deployare; account provider, consensi OAuth e test biometrico reale richiedono l'intervento del titolare.
- SMTP/mittente per invio email, se richiesto; se assente rimane il link d'invito copiabile.
- Identità amministratore ricavata dal progetto effettivo; nessun nuovo indirizzo personale nel repository pubblico.

## 10. Fonti consultate e verifiche ancora richieste

Consultate il 20 settembre 2026:

- Supabase inviti: https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail
- Supabase SMTP: https://supabase.com/docs/guides/auth/auth-smtp — il servizio predefinito limita i destinatari al team del progetto; verificare configurazione reale prima di promettere invio all'ospite.
- Supabase secret server: https://supabase.com/docs/guides/functions/secrets
- Gemini chiavi: https://ai.google.dev/gemini-api/docs/api-key — verificare compatibilità delle chiavi esistenti con i requisiti correnti.
- Gemini prezzi/funzioni: https://ai.google.dev/gemini-api/docs/pricing — disponibilità gratuita distinta per modello e funzione.
- YouTube: https://developers.google.com/youtube/v3/getting-started — quote associate al progetto.
- Spotify: https://developer.spotify.com/documentation/web-api/concepts/quota-modes — requisiti sviluppo, autorizzazioni utenti e quote legate alle app.

Il changelog Supabase in formato markdown non era raggiungibile tramite il lettore web durante la pianificazione; va ricontrollato prima dell'implementazione. Nessuna modifica di prodotto o infrastruttura è stata eseguita in questa fase.

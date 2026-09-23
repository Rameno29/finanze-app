# Rilascio multiutente AJE — procedura autorizzata

Aggiornata il 23 settembre 2026. Rilascio autorizzato dal proprietario: backup verificato,
secret, migrazioni, funzioni Supabase e frontend distribuiti il 22 settembre.
Il registro [audit](audit/2026-09-20-audit.md) elenca anche i collaudi ancora aperti: questa guida
non li considera superati e non autorizza da sola la pubblicazione.

### Registro operativo del 22 settembre

- Installazione Docker Desktop 4.91.0 per utente, autorizzata dal proprietario; motore 29.8.0 verificato.
- Recupero dell'avvio: vecchi socket Windows conservati rinominando esclusivamente le directory
  runtime `Docker/run` e `docker-secrets-engine` con suffisso `.pre-release-20260922`; nessun reset,
  cancellazione di volumi o riavvio automatico del PC.
- Backup privato fuori Git di schema, ruoli, dati Auth/app/Storage, cron e cronologia migrazioni,
  configurazione remota, sei Edge Functions precedenti e due file Storage (16.902 byte).
- Ripristino SQL riuscito in PostgreSQL 17.6, isolato senza rete: un account Auth, 20 movimenti,
  due documenti/oggetti, nove migrazioni e 13 policy. Entrambe le nuove migrazioni provate sulla copia.
- Primo `db push` respinto al primo statement, senza modifiche: la CLI non apriva una transazione
  per `LOCK TABLE`. Aggiunti `BEGIN/COMMIT` a entrambe le migrazioni; prova senza transazione
  implicita su una seconda copia riuscita, suite Vitest ripetuta, successivo push riuscito.
- Sul progetto remoto risultano 11 migrazioni, owner attivo unico, un posto ospite e conteggi invariati.
  Zero tabelle pubbliche senza RLS; client senza accesso alle credenziali cifrate o ai claim promemoria.
- Master key generata con CSPRNG, caricata nei secret Edge; copia cifrata DPAPI verificata con
  round-trip e legata all'account Windows dell'operatore. File temporaneo in chiaro rimosso.
  Il backup DPAPI richiede tale account Windows: non è una copia portabile su un altro PC.
- Site URL corretto da localhost all'app e aggiunto `/finanze-app/auth/callback`; le altre
  impostazioni remote, incluse conferme email e MFA, lasciate invariate.
- Nove funzioni distribuite: otto endpoint restituiscono 401 senza sessione; legacy 410.
- Advisor: restano i warning preesistenti `pg_net` in public e leaked-password protection disabilitata.
  Le tabelle server-only senza policy client sono intenzionalmente deny-by-default, non da aprire.
- Preflight remoto: un account Auth, 20 movimenti, due documenti; zero conferme duplicate,
  trasferimenti sbilanciati o riferimenti ad account/categorie/documenti di altri utenti.
- Ripetuti 142 test Vitest, 20 test Deno e 26 E2E simulati: tutti superati; typecheck e build riusciti.
  Deno 2.9.6 richiamato tramite `npx --package deno -c ...` perché non presente nel PATH della shell.
- Frontend `175ccf606503e4a52588c4f49b78afd31922ab5d` su main: build e deploy del
  [workflow 35781348797](https://github.com/Rameno29/finanze-app/actions/runs/35781348797) riusciti.
  Il workflow ha ripetuto lint, test, typecheck, build e browser prima della pubblicazione.
- Browser nuovo sulla pagina live: registrazione pubblica assente, campi leggibili con valori sintetici,
  mostra/nascondi password, viewport desktop e mobile scuro; console senza errori. Nessun form inviato.
  Screenshot locali in `output/playwright/release-login-*.png` (fuori Git).
- Backup operatore in `C:/Users/stafi.000/AJE-private-backups/release-2026-09-22`, accesso NTFS
  limitato all'account Windows e SYSTEM, istruzioni `RESTORE-NOTES.md` e manifest SHA-256.
  Non caricare i backup in Git: includono dati personali e segreti precedenti al rilascio.
- Rilascio tecnico concluso; accettazione personale ancora aperta per account, provider reali,
  invito al destinatario scelto, SMTP opzionale e iPhone fisico. Nessuna chiave globale revocata.

## 1. Prima della finestra di rilascio

1. Chiudere i rilievi tecnici residui dell'audit e concordare il collaudo sul dispositivo del proprietario.
2. Eseguire dalla copia destinata al rilascio: `npm ci`, lint, test, check/test Edge, build, E2E.
   Confrontare gli esiti con il registro; gli E2E usano provider simulati, non chiavi personali.
   Eseguire anche `npm audit` e `deno audit --lock supabase/functions/deno.lock`: sono grafi separati.
3. Verificare progetto Supabase, repository, branch e corrispondenza delle nove migrazioni pregresse.
   Non applicare le nuove migrazioni su un progetto diverso o già parzialmente modificato.
4. Far terminare la sincronizzazione offline su tutti i dispositivi e chiudere le vecchie sessioni
   dell'app. Non eliminare IndexedDB, cache, installazione o dati del sito per forzare l'aggiornamento.
5. Preparare e verificare un backup recuperabile del database (inclusi dati Auth e configurazione
   necessaria al ripristino), delle policy/funzioni e dei file del bucket Documents. Un export CSV
   dei movimenti non è un backup completo. Conservare i secret separatamente dal repository.
6. Ripetere il preflight in sola lettura: esattamente un account Auth, UUID riconosciuto come
   proprietario, nessun duplicato `(user_id, document_id)`, nessun trasferimento sbilanciato né
   riferimento a conti/categorie/documenti di un altro utente. Se qualcosa diverge, fermarsi.

Il bootstrap usa il UUID dell'unico account Auth, non la vecchia allowlist email. Non cancellare
account per soddisfare il controllo: se ce n'è più di uno serve una migrazione deliberata diversa.

## 2. Configurazione server, senza esporre segreti

- `CREDENTIAL_MASTER_KEYS`: oggetto JSON che associa versioni a chiavi casuali di **32 byte
  codificate Base64**, ad esempio struttura `{"v1":"<valore segreto>"}`. Generare il valore con
  un generatore crittografico e conservarlo in un gestore di segreti; non stamparlo nei log/chat.
- `CREDENTIAL_KEY_VERSION`: `v1` per il primo rilascio. La chiave principale resta esclusivamente
  nei secret Edge; non nel database, frontend, GitHub Pages, variabili `VITE_*` o repository.
- Conservare la normale configurazione Supabase delle funzioni. La service-role è server-only.
- SMTP inviti opzionale: `INVITE_SMTP_URL` e `INVITE_FROM`. Senza SMTP l'owner genera e copia
  il link; non promettere l'invio email. Il recupero password standard usa la configurazione
  SMTP di Supabase Auth, distinta da queste due variabili dell'Edge Function.
- Verificare Site URL e redirect Auth per `https://rameno29.github.io/finanze-app/auth/callback`.
  Confrontare anche le impostazioni correnti di conferma email, scadenza link e password sicure.
- Non chiedere le API key personali nella chat: owner e ospite le inseriranno nell'app.

## 3. Ordine di distribuzione

Non invitare l'ospite finché l'intera sequenza non è completata e collaudata.

1. Dopo backup e preflight, predisporre i secret server.
2. Applicare in ordine, tramite il flusso migrazioni Supabase del progetto:
   - `20260920103659_multiuser_credentials_invites.sql`
   - `20260921175220_functional_audit_regressions.sql`
3. Verificare `app_members` (owner attivo unico), `app_settings` (un posto), RLS e permessi
   sulle nuove tabelle. Verificare che il numero di movimenti/documenti preesistenti non sia diminuito.
   `app_reminder_claims`, `claim_task_reminder` e `finish_task_reminder` devono essere accessibili
   solo a service_role; distribuire il cron aggiornato solo dopo la seconda migrazione.
4. Distribuire insieme gli handler aggiornati e i relativi moduli condivisi: `ai-analyze`,
   `ai-command`, `manage-invites`, `user-credentials`, `youtube-search`, `ecb-rates`,
   `fuel-prices`, `send-reminders` e **anche `analyze-payslip`**, che deve rispondere 410.
5. Usare la configurazione di `supabase/config.toml`: il gateway JWT è disattivato dove l'handler
   valida direttamente il bearer con Auth. Ogni endpoint utente deve rifiutare anonimi e sospesi;
   il cron usa il suo secret. Non distribuire solo il cambio config con i vecchi handler.
6. Pubblicare il frontend solo dopo le verifiche backend; il push su `main` attiva Pages.
   Il workflow esegue lint, Vitest, Deno, build e Playwright prima di caricare l'artefatto.
7. Riaprire l'app come owner e inserire le proprie chiavi Gemini/YouTube e Client ID personali.
   L'assenza temporanea delle chiavi disabilita le funzioni esterne, non deve attivare fallback.
8. Verificare l'assenza di chiamanti legacy; solo allora rimuovere/ruotare le vecchie chiavi globali
   e la vecchia configurazione YouTube della build, come attività esplicita di bonifica.

Tra database/funzioni/frontend possono esserci incompatibilità temporanee: pianificare una breve
finestra senza utilizzo. Non riaprire chiavi condivise o policy più permissive per ridurla.

## 4. Collaudo reale e accettazione

- Owner: accesso e recupero password; finanze/documenti preesistenti invariati; saldi e conteggi confrontati.
- Link generato dall'owner: apertura, password, attivazione; scaduto, annullato e già usato respinti.
  Il vero destinatario va scelto dal proprietario; non inviare inviti a indirizzi di prova casuali.
- Ospite: un posto, nessun pannello amministratore, nessun dato o configurazione owner.
- Nessuna chiave ospite: zero chiamate a Gemini/YouTube usando credenziali owner. Con chiave
  personale: una richiesta sintetica autorizzata; verificare quote e messaggi. Non usare documenti sensibili.
- Sospensione: negazione delle operazioni server anche con JWT già emesso; dati conservati.
- Cambio account fra schede durante password/OAuth/replay; coda precedente non cancellata o attribuita a B.
- iPhone fisico: autofill/contrasto, passkey, microfono/fotocamera, condivisione PDF, OAuth popup,
  push installato e logout, aggiornamento PWA con operazioni pendenti. Non basta il viewport mobile Chromium.
- Controllare errori di Auth/Edge/cron senza registrare chiavi, bearer, inviti completi o documenti.
- Provare un promemoria modificato durante l'invio e un invio fallito: nessuna conferma della nuova
  versione, prenotazione rilasciata o scaduta. Non promettere consegna esattamente una volta in caso di crash.
- Dopo un upload con esito incerto, confrontare record e Storage prima di ricaricare o rimuovere file.
  Non eseguire pulizie automatiche degli orfani mentre possono esserci scritture ancora in corso.
- Dopo aggiornamento, aprire online le finanze per inizializzare la cache totali v2. Le code esistenti
  restano conservate; non cancellarle per ricostruire la cache.

Annotare nel registro audit data, esito e limiti. Solo dopo queste prove dichiarare il rilascio concluso.

## 5. Ripristino e rotazione

Preferire una correzione in avanti. Un ripristino del vecchio frontend non è neutro: la vecchia
coda non riconosce necessariamente i nuovi trasferimenti atomici. Prima di ogni rollback verificare
code pendenti e compatibilità schema/funzioni. Non rimuovere le policy membership e non riabilitare
`analyze-payslip` o chiavi globali per gli ospiti. Conservare schema e dati nuovi fino a recupero verificato.

Per ruotare la master key, dopo un test su fixture isolata:

1. Aggiungere una nuova versione al secret mantenendo tutte quelle precedenti; cambiare la versione
   attiva solo quando tutti gli handler conoscono sia la vecchia sia la nuova chiave.
2. Su un ambiente operatore protetto, configurare `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
   `CREDENTIAL_MASTER_KEYS` e `CREDENTIAL_KEY_VERSION` senza passarne i valori nella riga di comando.
3. Eseguire `deno run --allow-env --allow-net --config supabase/functions/deno.json supabase/scripts/rotate-credentials.ts`:
   è dry-run, decifra/verifica senza aggiornare; stampa solo conteggi. Verificare i contatori.
4. Aggiungere `--apply` solo dopo verifica e backup: batch massimo 100, confronto ottimistico del
   ciphertext per non sovrascrivere salvataggi concorrenti. Ripetere fino a zero righe della vecchia
   versione; eventuali conflitti richiedono una nuova lettura, non una scrittura forzata.
5. Conservare le vecchie master key finché esistono ciphertext o backup che le richiedono.
   Perdita della chiave principale: reinserimento delle API key personali; non sono recuperabili dal suffisso.

Questa utility è stata sottoposta a typecheck e test dry-run/apply su fixture sintetiche,
**non ancora a un'esecuzione operativa**. Non eseguirla
sui dati reali come test. Le API key dei provider si revocano/ruotano inoltre nei rispettivi pannelli.

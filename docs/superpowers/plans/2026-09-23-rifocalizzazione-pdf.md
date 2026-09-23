# AJE Rifocalizzazione e PDF Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ridurre le sezioni estranee alla gestione personale e migliorare la creazione di PDF da testo, video pubblici e documenti privati senza compromettere agenda, Carburanti e dati esistenti.

**Architecture:** Il frontend mantiene le cinque schede attuali e Carburanti; dismette player, pagine Google/Media e scanner. `ai-analyze` resta l'unico ingresso AI per i PDF, con un contratto esplicito per una fonte per richiesta e con controllo della proprietà dei documenti. Il risultato strutturato viene validato, modificato in anteprima ed esportato con jsPDF; il salvataggio nell'archivio è facoltativo.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Playwright, jsPDF, Supabase Edge Functions/Deno.

**Spec:** `docs/superpowers/specs/2026-09-23-rifocalizzazione-aje-design.md`

## Global Constraints

- Non restringere l'agenda e non modificare tabella `tasks`, notifiche o coda offline.
- Conservare Carburanti, upload documenti, jsPDF, Gemini personale cifrato, inviti e isolamento tra account.
- Non cancellare dati, file, chiavi esistenti o record delle vecchie integrazioni automaticamente.
- Usare `apply_patch` per gli edit locali; aggiornare `README_FIRST.md` nello stesso intervento funzionale.
- La sezione video richiede un URL YouTube pubblico; mostrare errore quando la fonte non è usata.
- Nessun costo API OpenAI è introdotto nell'app; il modello Codex scelto per sviluppo è distinto da Gemini nell'app.

## Review Focus

- Link YouTube sintatticamente plausibile ma video privato/non disponibile: errore esplicito, nessun PDF attribuito al video.
- Risposta AI malformata o sezioni vuote: nessuna anteprima o download apparentemente valido.
- Documento di un altro account: il server nega l'accesso prima di scaricare il file o chiamare Gemini.
- PDF con un singolo paragrafo più lungo di una pagina: testo entro margini e pagine numerate.
- Credenziali obsolete presenti nel database: il frontend non le espone come integrazioni attive ma consente rimozione esplicita; nessuna cancellazione automatica.

---

### Task 1: Togliere Media e Google senza toccare gli strumenti conservati

**Files:** `src/App.tsx`, `src/modules/settings/SettingsPage.tsx`, `src/modules/settings/IntegrationsPanel.tsx`, `src/lib/integrations.ts`, `src/lib/integrationGuides.ts`, `src/lib/config.ts`, `src/modules/guide/GuidePage.tsx`; eliminare file Media/Google, player e OAuth non più importati; `tests/e2e/auth.spec.ts` per smoke autenticato.

**Interfaces:** Restano `callFunction` e `invokeFunction` per Gemini, Carburanti e inviti. Restano le route `/agenda`, `/documenti`, `/carburanti`.

- [ ] Scrivere un test browser autenticato che visiti Impostazioni, trovi Carburanti e il link Gemini e non trovi le sezioni Media/Google, poi apra Documenti e Agenda.
- [ ] Eseguire il test e vedere il fallimento dovuto ai link ancora presenti.
- [ ] Rimuovere route, callback, player, OAuth e guide obsolete; mantenere un comando per rimuovere volontariamente credenziali preesistenti se il server le elenca.
- [ ] Eseguire test browser, TypeScript/build e suite Vitest; correggere import rimasti e commit.

### Task 2: Rimuovere lo scanner mantenendo l'upload

**Files:** `src/modules/documents/DocumentsPage.tsx`, `src/modules/documents/ScannerSheet.tsx`, `src/lib/scanner.ts`, `src/lib/docDetect.ts`, relativi test, `src/modules/guide/GuidePage.tsx`.

**Interfaces:** `uploadDocument(file, docType)` e `downloadPdf(doc)` restano disponibili.

- [ ] Estendere il test browser per verificare che Documenti mostri upload busta paga/scontrino/documento e «Crea PDF», senza il comando Scanner.
- [ ] Eseguire e osservare il fallimento sul comando Scanner ancora visibile.
- [ ] Rimuovere solo codice e test del flusso scanner; eliminare `detect_corners` dal server in Task 5 dopo la prova che non vi siano più chiamanti.
- [ ] Eseguire browser, `npm test`, `npm run build`; commit.

### Task 3: Rendere affidabile il contratto PDF e consentire documenti caricati

**Files:** `supabase/functions/ai-analyze/index.ts`, nuovi moduli piccoli per validazione del payload/risposta e relativi test Deno, `src/lib/integrations.ts` per messaggi errore.

**Interfaces:** `mode:'generate'` con `source:'text'|'youtube'|'document'`, `prompt`, `format:'sintesi'|'appunti'|'schema'`, `video_url` oppure `document_id`. Output `{title:string,sections:{heading:string,body:string}[],source:{kind,url?,file_name?}}` validato; vecchio payload `mode:'generate',prompt` continua a funzionare come fonte testo durante il rollout.

- [ ] Test Deno RED: link non valido → 400; fonte documento non dell'utente → 404 senza provider; risposta AI malformata → errore; video pubblico → richiesta Gemini con link; quota esaurita → errore controllato.
- [ ] Implementare parser della fonte, controllo `user_id` e `storage_path`, preparazione input al provider e validazione del JSON restituito. Non leggere documenti senza sessione attiva.
- [ ] Test GREEN, `npm run test:edge`, `npm run check:edge`; commit.

### Task 4: Anteprima modificabile, PDF robusto e salvataggio manuale

**Files:** `src/modules/documents/DocumentsPage.tsx` o un componente focalizzato `src/modules/documents/GeneratePdfCard.tsx`, `src/lib/pdf.ts`, `src/lib/pdf.test.ts`, `src/lib/documentUpload.ts` (solo se necessario), `tests/e2e/auth.spec.ts`.

**Interfaces:** Consuma il contratto del Task 3. `createPdfBlob(doc): Blob` produce il medesimo PDF usato sia per download sia per eventuale upload privato; `downloadPdf(doc)` resta wrapper.

- [ ] Test RED: un paragrafo molto lungo crea più pagine entro i margini; una sezione vuota è rifiutata; il selettore fonte impone una fonte alla volta; la modifica dell'anteprima cambia il PDF scaricato; il salvataggio è invocato solo dal pulsante esplicito.
- [ ] Implementare form a tre fonti con formato, errori leggibili, editor di titolo/sezioni e comando di rigenerazione.
- [ ] Implementare impaginazione a righe con page break, metadati fonte e blob condiviso fra download e upload; salvare con `doc_type:'altro'` senza analisi AI automatica.
- [ ] Test GREEN, suite Vitest, browser, lint e build; commit.

### Task 5: Dismissione controllata, documentazione e verifica finale

**Files:** `supabase/functions/ai-analyze/index.ts`, `supabase/functions/security_test.ts`, `supabase/functions/youtube-search/index.ts`, `supabase/config.toml`, `package.json`, `README_FIRST.md`, guida e documenti di rilascio pertinenti.

**Interfaces:** Conservare `generate`, `payslip`, `receipt`, `document`, `assistant` e comandi finanziari. Le vecchie modalità Media/Google/scanner non sono più richiamate dal frontend.

- [ ] Test RED che le vecchie modalità `youtube`, `websearch`, `detect_corners` non usino più il provider; aggiornare i test sicurezza per Gemini e autenticazione, senza cancellare record cifrati preesistenti.
- [ ] Rimuovere i rami e la funzione `youtube-search` dal codice attivo/configurazione. Preparare un piano esplicito per la dismissione remota dell'endpoint dopo la pubblicazione del nuovo frontend.
- [ ] Aggiornare `README_FIRST.md` distinguendo cronologia storica e stato nuovo, guida delle integrazioni e controlli per l'utente.
- [ ] Eseguire `npm test`, `npm run test:edge`, `npm run check:edge`, `npm run lint`, `npm run build`, `npm run test:e2e`, controllare `git diff --check` e fare commit.
- [ ] Revisionare il diff completo rispetto al commit base; correggere problemi importanti e ripetere le prove mirate.

### Task 6: Pubblicazione e collaudo

**Files:** nessun nuovo file obbligatorio; aggiornare le note di rilascio e `README_FIRST.md` soltanto con fatti verificati.

**Interfaces:** Il frontend aggiornato precede il ritiro di endpoint server obsoleti. `ai-analyze` aggiornato deve essere compatibile con il frontend vecchio durante la propagazione PWA.

- [ ] Preparare il commit completo e verificare che la coda offline del proprietario non sia stata azzerata da cache reset o reinstallazioni.
- [ ] Distribuire server compatibile, poi frontend, poi ritirare l'endpoint `youtube-search` dopo la verifica che la build live non lo richiami. Registrare commit, workflow e prove live.
- [ ] Verificare con browser desktop/mobile: login, Agenda, Carburanti, upload Documenti, PDF testo/link/documento con account di test o backend simulato. Annotare ciò che richiede il proprietario, senza fingere test con credenziali personali non disponibili.

# Rilascio AJE rifocalizzazione e PDF — 23 settembre 2026

## Gate e invarianti

- Il proprietario ha confermato che la coda offline è vuota sui dispositivi usati.
- Questa release non contiene migrazioni SQL e non cancella record, file o chiavi API.
- Non cancellare cache, IndexedDB o installazioni PWA per forzare l'aggiornamento.
- Progetto Supabase: `boucbthrnddmnzcowafy`; sito: `https://rameno29.github.io/finanze-app/`.
- Collaudo locale prima del rilascio: Vitest, Deno, typecheck/lint/build, Playwright desktop/mobile. I test Gemini usano risposte simulate; la chiave personale reale non è stata letta.

## Ordine senza interruzione delle PWA esistenti

1. Distribuire **solo `ai-analyze`** dal branch locale compatibile `codex/rifocalizzazione-staged-server` (commit `a134b3e`), che aggiunge il nuovo contratto PDF e il controllo dei token video ma conserva temporaneamente le vecchie modalità Media/Google/scanner. Specificare `--project-ref boucbthrnddmnzcowafy --no-verify-jwt`. Verificare la versione `ACTIVE`, accesso anonimo 401 e test locali del contratto.
2. Pubblicare la build completa del branch rifocalizzato tramite fast-forward di `main` e push; attendere il workflow GitHub Pages e verificare HTML/chunk online, navigazione e PDF con backend simulato. La vecchia PWA resta compatibile con il server durante la propagazione.
3. Solo quando i dispositivi in uso hanno caricato la nuova PWA e non ci sono richieste delle vecchie modalità, distribuire `ai-analyze` finale e la tombstone `youtube-search` (410). Non eliminare il record della funzione remota né i secret degli utenti. Verificare `ACTIVE`, 401 per richieste anonime a `ai-analyze`, 410 per `youtube-search`, e che `generate` con le tre fonti continui a funzionare. Se tale conferma manca, lasciare la versione compatibile fino al controllo successivo.

## Limiti del collaudo

- Gli account, la chiave Gemini reale, i PDF di documenti personali, i video specifici e l'iPhone fisico vanno provati dal proprietario. Non presentare test simulati come prova end-to-end con dati reali.
- Per i video la risposta Gemini deve contenere conteggi di token non testuali (`VIDEO`, `AUDIO` o `IMAGE`) nell'input. L'assenza di tali metadati blocca il PDF: è una scelta prudente che può rifiutare un video pubblico se il provider cambia risposta.
- Annotare qui commit, versioni Edge, workflow e prove live solo dopo averli osservati.

## Registro osservato

- Proprietario: coda offline vuota confermata prima del rilascio.
- Server compatibile `a134b3e`: `ai-analyze` distribuita come versione 11, `ACTIVE`, `verify_jwt=false` con autenticazione nello handler; richiesta anonima alla funzione rifiutata con 401. Vecchie modalità mantenute temporaneamente.
- Frontend `f3713d9`: push su `main`, workflow [35856141050](https://github.com/Rameno29/finanze-app/actions/runs/35856141050) completato con successo, inclusi 113 test Vitest, 30 Deno, 36 browser desktop/mobile, build e deploy Pages.
- Pagina live HTTP 200; asset principale `index-CiQaw7rA.js` identico alla build locale. Browser reale su viewport 390×844: login su invito e campi email/password leggibili con valori sintetici, console senza errori. Nessuna credenziale reale inserita né login tentato.
- Su successivo «prosegui» del proprietario è stato completato il ritiro server, interpretato come via libera dopo il gate della nuova PWA. Non è stata eseguita una verifica diretta su ogni dispositivo fisico.
- `ai-analyze` finale distribuita come versione 12 `ACTIVE` (`verify_jwt=false`, autenticazione nello handler): POST anonima 401. I vecchi modi `youtube`, `websearch` e `detect_corners` sono respinti dal codice finale.
- `youtube-search` tombstone distribuita come versione 2 `ACTIVE`: POST anonima 410. Il record remoto resta presente; nessun dato o secret personale eliminato.
- Verifica prima del ritiro: 113 Vitest, 30 Deno, check Deno, build e lint riusciti (tre avvisi Fast Refresh preesistenti). Non è stata eseguita una chiamata Gemini live con chiave privata.

# AJE

PWA in italiano per finanze, agenda, documenti, scanner, assistente AI e integrazioni Google/Spotify/YouTube.
Frontend React/TypeScript/Vite; backend Supabase con Auth, PostgreSQL/RLS, Storage ed Edge Functions.

[App online](https://rameno29.github.io/finanze-app/) · [Documento di progetto](README_FIRST.md)

## Versione multiutente pubblicata

Versione `175ccf6` pubblicata il 22 settembre 2026 su Supabase e GitHub Pages; controlli finali
documentati il 23 settembre. Accesso proprietario + un ospite, invitato dalle Impostazioni. Dati e integrazioni
rimangono personali: non è uno spazio finanziario condiviso.

- Campi di accesso leggibili, recupero password e completamento dell'invito.
- Chiavi personali Gemini e YouTube salvate cifrate AES-256-GCM sul server; nessun ripiego
  sulle chiavi del proprietario. Nell'interfaccia si legge solo il suffisso mascherato.
- Client ID OAuth personali Google/Spotify, con guide e link ufficiali nelle Impostazioni.
- Finanze manuali, agenda e scanner locale non richiedono chiavi AI.
- Cache/coda offline cifrate e separate per account. Non cancellare i dati del sito o reinstallare
  la PWA con operazioni ancora in attesa: quelle non sincronizzate non sono nel cloud.

L'AI usa Gemini, **non Anthropic**. L'endpoint legacy `analyze-payslip` è ritirato nella nuova
versione; l'analisi passa da `ai-analyze`. Quote gratuite, requisiti e condizioni privacy dipendono
dal provider: non sono garantiti né illimitati.

## Sviluppo e verifiche

Node.js 22; Deno per le funzioni server (CI: 2.9.6).

```sh
npm ci
npm run dev
npm test
npm run lint
npm run check:edge
npm run test:edge
npm run build
npx playwright install chromium
npm run test:e2e
```

L'anteprima E2E richiede prima la build. I test usano identità sintetiche, PostgreSQL embedded,
provider simulati e browser desktop/mobile; non inviano email né consumano chiavi reali.

La build accetta `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` come configurazione backend
pubblica. Non inserire API key personali, master key o service-role in variabili `VITE_*`.

## Rilascio

Leggere [registro audit](docs/audit/2026-09-20-audit.md) e
[procedura di rilascio](docs/release-multiutente.md). Servono backup, secret server, due migrazioni,
deploy delle funzioni e collaudo autenticato. Il push su `main` pubblica il frontend: non farlo
prima di aver predisposto il backend. Il rilascio autorizzato è riuscito:
[workflow verificato](https://github.com/Rameno29/finanze-app/actions/runs/35781348797).
Restano al proprietario inserimento delle proprie chiavi, invito alla persona scelta e collaudo iPhone/OAuth/push.

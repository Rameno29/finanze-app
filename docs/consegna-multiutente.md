# Consegna AJE — 22 settembre 2026

Sviluppo locale e collaudo automatico conclusi. Le modifiche sono nel branch
`codex/multiutente-api-audit`, ancora non committate né pubblicate. L'app online non è stata aggiornata.

## Cosa è pronto

- Email/password leggibili, login privato e recupero password.
- Impostazioni → Utenti e inviti: un posto ospite, link personale, eventuale invio SMTP,
  annullamento e sospensione. Dati separati tra proprietario e ospite.
- Impostazioni → Le mie integrazioni: chiavi API personali cifrate, sostituzione/rimozione/verifica,
  guide e link ufficiali Gemini, YouTube, Google e Spotify. Nessun fallback alle chiavi dell'owner.
- Correzioni di dati offline, trasferimenti, import CSV, diario, documenti, promemoria,
  sessioni/OAuth, microfono e cambi BCE; dipendenze vulnerabili aggiornate.

## Prove concluse

Installazione pulita `npm ci`, 142 test Vitest, 20 test Deno, 26 test browser desktop/mobile,
controlli TypeScript/Deno e build PWA riusciti. Audit npm e Deno: nessuna vulnerabilità nota rilevata.
Lint: zero errori, cinque warning Fast Refresh preesistenti; avvisi toolchain nel registro.

Revisione indipendente circoscritta conclusa senza ulteriori blocchi critici/alti confermati
dopo le correzioni. Non è una certificazione di sicurezza né un collaudo di produzione.
Dettagli, evidenze e limiti: [registro audit](audit/2026-09-20-audit.md).

## Cosa serve per usarlo davvero

1. **Autorizzare il rilascio controllato**, che modifica Supabase e pubblica su GitHub Pages:
   backup verificato, secret di cifratura server, due migrazioni additive, funzioni e frontend.
   Procedura dettagliata: [rilascio e ripristino](release-multiutente.md).
2. **Inserire le proprie credenziali nell'app**, mai nella chat. Ognuno usa le sue chiavi;
   gratuità, quote e requisiti restano quelli dei provider. Per i link copiabili non serve SMTP.
3. **Collaudare sul tuo iPhone e con i servizi reali**: accesso/autofill, invito alla persona scelta,
   isolamento account, OAuth, una richiesta AI/YouTube sintetica, microfono/fotocamera,
   notifiche e aggiornamento PWA. Non usare documenti sensibili per le prime prove.

Non cancellare dati del sito, cache o installazione con operazioni offline in attesa.
Un esito di upload incerto conserva il file; controllare l'elenco prima di reinserirlo.
Se CSV o diario falliscono a metà, riprovare nello stesso pannello; prima di chiuderlo e rifarlo,
controllare quali movimenti risultano già salvati.

Il passaggio successivo è il rilascio autorizzato, non un'altra fase generica di sviluppo.
Nessun invito reale, email, modifica dei secret, migrazione o deploy è stato eseguito finora.

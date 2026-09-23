# Consegna AJE — 23 settembre 2026

Sviluppo, collaudo automatico e rilascio autorizzato conclusi. Versione `175ccf6` integrata in
`main` e pubblicata il 22 settembre su Supabase e [GitHub Pages](https://rameno29.github.io/finanze-app/).
[Workflow completato](https://github.com/Rameno29/finanze-app/actions/runs/35781348797).

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

Backup privato con ripristino PostgreSQL isolato riuscito; 20 movimenti e due documenti conservati.
Due migrazioni e nove funzioni server distribuite; master key configurata e redirect Auth corretto.
Controlli anonimi server 401/410, RLS owner e login live desktop/mobile verificati, console senza errori.
Non sono prove dell'intero flusso autenticato su iPhone o delle credenziali dei provider.

## Cosa serve per usarlo davvero

1. **Riaprire l'app online** dopo aver sincronizzato la coda e salvato i moduli aperti.
   In Impostazioni → Utenti e inviti crea e copia il link per la persona scelta. SMTP inviti
   non configurato: nessuna email automatica promessa. Procedura: [rilascio e ripristino](release-multiutente.md).
2. **Inserire le proprie credenziali nell'app**, mai nella chat. Ognuno usa le sue chiavi;
   gratuità, quote e requisiti restano quelli dei provider. Per i link copiabili non serve SMTP.
3. **Collaudare sul tuo iPhone e con i servizi reali**: accesso/autofill, invito alla persona scelta,
   isolamento account, OAuth, una richiesta AI/YouTube sintetica, microfono/fotocamera,
   notifiche e aggiornamento PWA. Non usare documenti sensibili per le prime prove.

Non cancellare dati del sito, cache o installazione con operazioni offline in attesa.
Un esito di upload incerto conserva il file; controllare l'elenco prima di reinserirlo.
Se CSV o diario falliscono a metà, riprovare nello stesso pannello; prima di chiuderlo e rifarlo,
controllare quali movimenti risultano già salvati.

Nessun invito reale o email di prova è stato inviato. Le chiavi globali legacy non sono usate
dai nuovi endpoint, ma non sono state revocate presso i provider: la bonifica richiede verifica
degli altri eventuali utilizzatori. Restano due warning Supabase preesistenti descritti nel registro.

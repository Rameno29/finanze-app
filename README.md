# AJE

App personale (PWA) per gestire finanze, documenti e buste paga, ottimizzata per iPhone 16 Pro Max e Android.
Le icone si rigenerano da `scripts/icon-source.png` con `node scripts/generate-icons.mjs`.

**App online:** https://rameno29.github.io/finanze-app/

## Funzioni (MVP)

- **Finanze**: entrate/uscite con categorie, multi-conto (contanti/banca/carte) con saldi e trasferimenti interni, import estratti conto CSV con anteprima e duplicati, budget mensili con barre di avanzamento, dashboard con grafici (saldo mese, torta per categorie, andamento 6 mesi)
- **Documenti**: carica la busta paga (PDF o foto) → analisi AI (Claude) estrae netto, lordo, trattenute → conferma → l'entrata "Stipendio" appare nelle finanze; storico stipendi con grafico; ricerca full-text nei documenti analizzati
- **Extra**: diario vocale del giorno (più spese in una dettatura), simulatore what-if con proiezione del patrimonio, mappa dei distributori di carburante più economici (open data MIMIT)
- **Tema** chiaro/scuro automatico da sistema, forzabile dalle impostazioni
- Installabile sulla home: Safari → Condividi → "Aggiungi a schermata Home"

## Stack

- Frontend: Vite + React + TypeScript + Tailwind CSS 4 + Recharts + lucide-react (PWA via vite-plugin-pwa)
- Backend: Supabase (progetto `finanze-organizzazione`, regione eu-central-1) — Auth, Postgres con RLS, Storage, Edge Function `analyze-payslip`
- Deploy: GitHub Pages via Actions (push su `main` → deploy automatico)

## Attivare l'analisi AI delle buste paga

1. Crea una chiave API su [console.anthropic.com](https://console.anthropic.com)
2. Dashboard Supabase → progetto `finanze-organizzazione` → **Edge Functions → Secrets**
3. Aggiungi il secret `ANTHROPIC_API_KEY` con la tua chiave

Costo tipico: pochi centesimi per busta paga (modello Claude Haiku).

## Sviluppo locale

```bash
npm install
npm run dev       # http://localhost:5173/finanze-app/
npm run build     # produzione in dist/
```

La Edge Function è in `supabase/functions/analyze-payslip/` e si ridistribuisce dal connettore Supabase o con la CLI Supabase.

## Roadmap (moduli futuri)

- Agenda/organizzazione del tempo + Google Calendar
- Integrazioni Google (Gmail, Drive, Maps)
- Musica (Spotify Premium) e mini-player YouTube con riassunti AI
- Generazione PDF e ricerca web con AI

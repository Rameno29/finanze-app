# Audit visivo AJE — screenshot 23 settembre 2026

## Evidenza

Sono state catturate le pagine principali in desktop 1440×1000 e mobile 390×844 con un browser reale e backend sintetico. Le immagini sono in `output/playwright/aje-ui-screenshots/`.

## Passi e salute

1. Login — buona leggibilità dei campi e call to action chiara; da rendere più esplicita la gerarchia tra accesso, recupero e passkey.
2. Home — struttura pulita e riconoscibile; con dati vuoti resta troppo spazio inutilizzato e il riepilogo principale è poco dominante.
3. Finanze — funzioni ben raggruppate; su desktop la colonna centrale è stretta e l’azione per aggiungere movimento dovrebbe essere più contestuale e visibile.
4. Agenda — tabs semplici e empty state comprensibile; il calendario e l’azione di aggiunta possono avere maggiore priorità visiva.
5. Documenti — flusso PDF comprensibile e ben separato; il percorso fonte → formato → generazione può diventare più guidato e meno simile a un form tecnico.
6. Impostazioni — contenuti completi e trasparenti; la pagina è molto lunga, con integrazioni, sicurezza e preferenze da dividere in sezioni progressive.
7. Guida — utile come riferimento; va trasformata in contenuto scansionabile con ricerca, categorie e percorsi rapidi.
8. Assistente — accesso dedicato e riconoscibile; servono esempi iniziali, stato configurazione chiave e suggerimenti contestuali.
9. Carburanti — funzione mantenuta e coerente con l’app; il valore principale (costo/km e andamento) deve emergere prima dell’inserimento dati.

## Priorità di redesign

- P0: gerarchia della Home, Finanze e Documenti; rendere sempre evidente il prossimo passo.
- P1: suddivisione delle Impostazioni e riduzione del carico cognitivo della navigazione.
- P1: empty state e stati di errore/offline più informativi.
- P2: design system condiviso per colori, tipografia, icone, modali, bottom sheet e grafici.

## Limiti

Gli screenshot non permettono di verificare contrasto computato per ogni combinazione, ordine di focus da tastiera, screen reader, animazioni, dati reali, sincronizzazione offline o chiamate AI con chiavi personali. Questi aspetti richiedono un audit interattivo e dati di test dedicati.

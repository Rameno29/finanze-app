# Prompt UI/UX AJE per ChatGPT Immagini

Allega al prompt gli screenshot della cartella `output/playwright/aje-ui-screenshots/`.
Usa almeno una versione desktop e una mobile di ogni schermata.

```text
Agisci come lead product designer specializzato in app mobile-first per la gestione finanziaria personale.
Devi ridisegnare completamente l’interfaccia UI/UX dell’app AJE partendo dagli screenshot allegati.
Gli screenshot mostrano l’interfaccia attuale: usali come riferimento funzionale e non come stile da copiare.

OBIETTIVO
Creare un’app di finanza personale più chiara, moderna, affidabile e piacevole da usare ogni giorno.
L’utente deve capire in meno di 3 secondi: quanto ha, cosa deve fare oggi, dove registrare una spesa e come controllare i documenti.
Il risultato deve sembrare un prodotto premium reale, non una dashboard generica né un template SaaS.

FUNZIONALITÀ DA CONSERVARE
- Home con riepilogo finanziario, saldo, entrate, uscite, andamento e azioni rapide.
- Finanze con movimenti, conti, budget, categorie, obiettivi e diario vocale/testuale.
- Agenda con attività e calendario.
- Documenti con caricamento di buste paga, scontrini e documenti, oltre alla generazione di PDF da testo, video YouTube pubblico o documento archiviato.
- Impostazioni con invito di un solo ospite, chiavi API personali cifrate, tema, offline, notifiche, passkey e account.
- Guida, Assistente AI e Carburanti.
- Accesso tramite email/password, recupero password e passkey.

NON FARE
- Non aggiungere social, musica, video feed, Google Drive, email, mappe o funzioni non richieste.
- Non eliminare Agenda, Carburanti, Documenti, PDF, Assistente AI, inviti o modalità offline.
- Non cambiare la logica, i dati, i nomi delle funzioni, i flussi di sicurezza o le autorizzazioni.
- Non inventare numeri reali: usa dati demo chiaramente plausibili e indicati come demo.
- Non usare testo finto illeggibile, lorem ipsum, grafici decorativi senza significato o icone ambigue.

DIREZIONE VISIVA
- Stile: premium, calmo, personale, essenziale, accessibile.
- Palette consigliata: verde petrolio profondo come colore fiduciario, crema caldo per le superfici, indaco/viola solo per azioni primarie e AI, rosso solo per uscite o errori.
- Fondo leggermente caldo, superfici con contrasto netto, bordi sottili, ombre molto leggere, niente glassmorphism eccessivo.
- Tipografia sans-serif molto leggibile, gerarchia forte, numeri finanziari grandi e immediatamente scansionabili.
- Icone coerenti, semplici e riconoscibili; ogni icona importante deve avere un’etichetta.
- Mantieni un’identità italiana e umana: copy breve, concreto, rassicurante.

ARCHITETTURA E UX
- Mobile-first con navigazione inferiore a 5 voci: Home, Finanze, Agenda, Documenti, Altro.
- Su desktop usa una sidebar o una navigazione superiore più efficiente e sfrutta lo spazio senza allargare troppo i moduli.
- Rendi evidente l’azione primaria contestuale con un solo pulsante principale per schermata.
- Trasforma le impostazioni molto lunghe in sezioni ordinate, con riepilogo e disclosure progressive.
- Progetta empty state utili: spiegano cosa manca, perché conta e quale azione compiere.
- Progetta stati loading, errore, successo, offline, account sospeso, chiave API mancante e documento non leggibile.
- Per finanze: separa chiaramente saldo, movimenti, budget e obiettivi; rendi l’inserimento di una spesa raggiungibile in un tap.
- Per documenti: rendi chiarissimo il percorso fonte → formato → generazione → anteprima modificabile → download/salvataggio.
- Per Agenda: distingui attività e calendario senza nascondere il pulsante per aggiungere.
- Per Carburanti: mostra costo per rifornimento, costo/km e andamento in modo leggibile.

ACCESSIBILITÀ
- Contrasto WCAG AA minimo per testo normale e controlli.
- Touch target minimo 44×44 px.
- Focus da tastiera sempre visibile.
- Etichette associate ai campi, errori comprensibili, non affidarti solo al colore.
- Supporta testo ingrandito, riduzione movimento e tema chiaro/scuro.

OUTPUT RICHIESTO
Genera una tavola coerente con un design system e schermate complete, non singoli componenti isolati:
1. Login e recupero password.
2. Home dashboard con dati demo realistici.
3. Finanze: movimenti, conti, budget e obiettivi.
4. Inserimento movimento/spesa come bottom sheet o dialog.
5. Agenda attività e calendario.
6. Documenti con generazione PDF e anteprima.
7. Assistente AI.
8. Carburanti.
9. Impostazioni con invito, integrazioni e sicurezza.
10. Guida.
11. Stati vuoti, loading, errore, offline e conferma successo.

Per ogni schermata mostra almeno una variante desktop e una mobile, con griglia, spacing, colori, tipografia, componenti e stati coerenti.
Indica chiaramente quali elementi sono interattivi. Mantieni il testo in italiano.
Prima proponi una direzione visiva unica e motivata; poi applicala a tutte le schermate senza cambiare la funzionalità.
``` 

## Prompt breve per una singola schermata

```text
Ridisegna questa schermata AJE come prodotto premium di finanza personale mobile-first. Mantieni tutte le funzioni e il testo in italiano, migliora gerarchia, leggibilità, contrasto WCAG AA, empty state, azione primaria, touch target e responsive desktop/mobile. Usa verde petrolio, crema caldo e indaco per le azioni AI; evita glassmorphism e dashboard generiche. Restituisci una UI completa con dati demo realistici, non un wireframe.
```

Le immagini generate sono un riferimento visivo: per modificare davvero l’app bisogna poi scegliere una direzione e implementarla nel codice mantenendo rotte, dati e sicurezza.

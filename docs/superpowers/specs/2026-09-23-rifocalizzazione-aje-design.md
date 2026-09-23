# AJE: rifocalizzazione e documenti PDF — proposta da approvare

Data: 23 settembre 2026. Stato: proposta; nessuna modifica funzionale eseguita.

## Intento e criteri di successo

AJE deve mettere in primo piano le finanze personali senza perdere gli strumenti che il proprietario usa: Carburanti, agenda completa e generazione di PDF da testo, documenti e video. L'app resta privata, con due account separati, credenziali personali cifrate e costi contenuti.

La revisione riesce se la navigazione diventa più semplice, i PDF riportano fedelmente la fonte scelta e le funzioni finanziarie, l'agenda e Carburanti continuano a funzionare. L'eliminazione di un'interfaccia non deve cancellare dati, documenti o movimenti esistenti.

## Stato verificato nel repository

- `src/App.tsx` espone Home, Finanze, Agenda, Documenti, Impostazioni, Google, Media, Guida, Assistente e Carburanti. La pagina Media porta con sé player YouTube persistente e callback Spotify.
- `src/modules/agenda/AgendaPage.tsx` e `TaskSheet.tsx` offrono lista per urgenza, calendario mensile, attività senza data, completamento, note, data e ora. Home mostra attività del giorno; le notifiche push e la coda offline dipendono da `tasks`.
- `src/modules/documents/DocumentsPage.tsx` distingue caricamento di PDF/foto, scanner multipagina e generazione AI di un documento. `src/lib/pdf.ts` esporta il risultato con jsPDF.
- `supabase/functions/ai-analyze/index.ts`, modalità `generate`, accetta richiesta testuale e link YouTube opzionale. Attualmente un link fuori dal formato accettato viene ignorato senza errore. L'anteprima è di sola lettura e il risultato è scaricato, non salvato automaticamente nell'archivio.
- `src/modules/media/MediaPage.tsx` usa `youtube-search` e la relativa chiave personale per la ricerca in-app. La generazione PDF da un link incollato usa Gemini tramite `ai-analyze` e non chiama `youtube-search`.
- `src/modules/fuel/FuelPage.tsx` usa Leaflet/OpenStreetMap e `fuel-prices`. Google Maps è soltanto il link esterno per avviare la navigazione. Il modulo Google con OAuth non è una dipendenza di Carburanti.
- Le integrazioni personali Gemini/YouTube e i client ID Google/Spotify sono esposti da `IntegrationsPanel.tsx` e gestiti da `user-credentials`. Alcuni record possono già essere presenti: la rimozione delle schermate non implica la loro cancellazione.

## Decisione di prodotto consigliata

### Conservare

- Tutte le funzioni finanziarie, l'assistente sui propri dati, login/inviti, impostazioni di sicurezza, offline e import/export CSV.
- Carburanti con ricerca prezzi, mappa e collegamento esterno per la navigazione.
- Agenda completa come tab principale, con calendario, attività personali, note, promemoria, notifiche e offline. Il widget Home resta.
- Archivio Documenti, upload di foto/PDF, analisi di scontrini e buste paga, ricerca e generazione di PDF. Il link YouTube diretto resta un possibile input della generazione.

### Rimuovere dall'interfaccia e dal codice attivo

- La pagina Media: ricerca e player YouTube, mini-player, Spotify e relativa connessione OAuth.
- La pagina Google: riquadri Gmail/Drive/Calendar/Maps e ricerca web generica.
- Lo scanner CamScanner: rilevamento bordi, editor dei quattro angoli, filtri, rotazione e scansione multipagina. Il normale upload da fotocamera/galleria resta.

La guida e le Impostazioni vanno allineate. Le API e credenziali dei servizi rimossi vanno dismesse in una fase controllata: nessun record personale viene cancellato automaticamente per effetto di questa proposta. Un'eventuale pulizia delle chiavi inutilizzate deve essere esplicita e verificabile.

### Agenda: cambiamento proposto

Nessun restringimento della funzione nella prima release. Dopo l'alleggerimento della navigazione, valutare con l'uso reale una vista o un filtro «Scadenze finanziarie» dentro l'agenda esistente. Un filtro richiederebbe un modo affidabile per distinguere le attività finanziarie dalle altre; non dedurlo dal titolo. Calendario, dati, notifiche e offline devono mantenere il comportamento attuale. Non aggiungere ora Google Calendar o Google Tasks: erano idee della vecchia roadmap, non funzioni attive da preservare.

## Generazione PDF: esperienza proposta

Un unico percorso «Crea PDF» nella sezione Documenti, con una fonte alla volta:

1. **Richiesta scritta:** guida, appunti o documento libero.
2. **Video YouTube pubblico:** link incollato, più istruzioni facoltative. Scelta fra sintesi breve, appunti dettagliati e schema per argomenti. La risposta deve dichiarare quale video è stato effettivamente elaborato; se il provider non riesce ad accedervi, mostrare errore e non generare un documento attribuito al video.
3. **Documento già caricato:** scegliere un proprio PDF/immagine nell'archivio e chiedere una riscrittura, sintesi o spiegazione in PDF. Riutilizzare il controllo di proprietà della riga e del file già presente in `ai-analyze`.

Prima del download, mostrare un'anteprima modificabile (titolo, titoli di sezione e testo). L'utente può rigenerare oppure correggere il testo, poi scaricare il PDF. Il PDF deve gestire paragrafi molto lunghi, elenchi e cambio pagina senza tagli o sovrapposizioni. Per i video, includere titolo/link della fonte e timestamp solo quando restituiti in modo attendibile. Esporre in UI che si tratta di appunti o sintesi AI, non di trascrizione letterale garantita.

Salvataggio del PDF nell'archivio: opzione manuale successiva, non automatica. Usare lo stesso flusso di upload privato e la stessa proprietà utente dei documenti esistenti. Non aggiungere una seconda copia del video o dell'allegato senza scelta dell'utente.

La chiave Gemini personale continua a servire per l'elaborazione; non è richiesta una chiave YouTube Data API per il link diretto. Prima di promettere supporto a un video specifico va verificato che sia pubblico e accessibile al provider. La funzionalità YouTube URL di Gemini è in anteprima e condizioni/limiti possono cambiare: [documentazione Google](https://ai.google.dev/gemini-api/docs/generate-content/video-understanding).

## Alternative considerate

1. **Potatura mirata e potenziamento PDF — consigliata.** Rimuove tre esperienze poco usate, conserva integralmente agenda/Carburanti e rende i PDF affidabili. È divisa in release verificabili.
2. **Rendere tutto strettamente finanziario.** Toglierebbe anche le attività personali e i PDF generici; contraddice l'uso descritto dal proprietario.
3. **Nascondere soltanto i link in Impostazioni.** Riduce il rumore visivo, ma conserva OAuth, player, funzioni server e manutenzione inutili.

## Sequenza di lavoro proposta

### Fase 1 — Alleggerimento senza migrazione dei dati

1. Eliminare i collegamenti a Media e Google in `SettingsPage.tsx` e le route in `App.tsx`; rimuovere callback Spotify, provider e mini-player. Eliminare il codice Media/Google non più raggiungibile e aggiornare i test pertinenti.
2. Togliere il pulsante e il componente scanner da `DocumentsPage.tsx`; eliminare il codice scanner e rilevamento bordi soltanto dopo la verifica che nessun altro flusso li importi. Conservare `documentUpload.ts` e jsPDF, ancora necessari.
3. Ripulire guida, testi, configurazione OAuth e pannello integrazioni, mantenendo Gemini. Separare la rimozione delle schermate dall'eliminazione di eventuali credenziali già memorizzate.
4. Verificare su telefono e desktop: Finanze, Agenda, Carburanti, upload documenti e attuale PDF da link diretto. Il confronto con la versione precedente deve mostrare dati e allegati invariati.

### Fase 2 — Affidabilità PDF

1. Validare lato client e server il tipo di fonte e il link; un input non valido deve produrre un errore esplicito. Verificare il formato della risposta AI prima di mostrarla.
2. Offrire modelli di risultato (sintesi/appunti/schema), istruzioni facoltative e gestione degli errori del provider: video privato, non disponibile, quota esaurita, richiesta troppo lunga.
3. Consentire anteprima e correzione del testo. Correggere paginazione e impaginazione di `src/lib/pdf.ts` con esempi lunghi e caratteri italiani.
4. Aggiungere la fonte «documento caricato» riusando i controlli esistenti, e il salvataggio manuale del PDF nell'archivio privato.

### Fase 3 — Pulizia server e rilascio

1. Rimuovere i rami `websearch`, `youtube` (riassunto della pagina Media) e `detect_corners` da `ai-analyze` solo dopo aver verificato che nessun altro punto dell'app li usi. Conservare `generate` con video e le modalità di analisi documenti/finanze.
2. Ritirare `youtube-search` dopo il deploy del frontend che non la chiama più; aggiornare test, configurazione Edge, istruzioni sulle API e documentazione corrente. Valutare la gestione delle credenziali obsolete già salvate con un'azione esplicita di pulizia.
3. Eseguire test unitari mirati, controllo TypeScript/lint, build, test Edge e percorsi browser mobile/desktop. Pubblicare dopo il controllo dei dati e una verifica della coda offline vuota. Aggiornare `README_FIRST.md` insieme ai cambiamenti funzionali.

### Fase 4 — Agenda, solo dopo feedback d'uso

Presentare una schermata proposta per distinguere scadenze finanziarie e attività personali. Se è utile, progettare il campo dati, il filtro e il comportamento offline come intervento separato; altrimenti l'agenda rimane come oggi.

## Verifiche che devono passare

- I due account continuano a vedere soltanto i propri movimenti, attività, documenti e credenziali.
- Agenda: creare/modificare/completare attività online e offline; calendario, widget Home e notifiche conservano i risultati attesi.
- Carburanti: mappa, prezzi, geolocalizzazione e link «Naviga» funzionano senza configurare Google OAuth.
- Documenti: upload di foto e PDF, analisi, ricerca e accesso ai file già salvati funzionano dopo la rimozione dello scanner.
- PDF: testo semplice, video pubblico, link non valido, video non accessibile, quota esaurita, documento proprio e tentativo su documento altrui producono risultati o errori corretti. Un testo lungo non supera i margini del PDF.
- Pagine `/media` e `/google` non restano come percorsi utili; la PWA aggiornata non perde operazioni in coda. Nessun segreto finisce nella build o nei log.

## Limiti e decisioni lasciate alla revisione

- L'agenda rimane completa. La nuova vista finanziaria è una proposta separata e non condiziona le prime tre fasi.
- Il motore AI usato **dentro AJE** resta inizialmente Gemini con chiave personale. Un cambio di modello o provider va deciso con prove di qualità e costo sui documenti/video reali; non dipende dal modello Codex usato per sviluppare.
- Nessuna cancellazione automatica di dati o credenziali personali, nessun invito inviato e nessun deploy sono inclusi nella sola approvazione di questo documento.

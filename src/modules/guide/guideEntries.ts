export type GuideCategory = 'Finanze' | 'Documenti' | 'Agenda' | 'Account'

export interface GuideEntry {
  id: string
  category: GuideCategory
  question: string
  /** Paragrafi; `**testo**` diventa grassetto. */
  answer: string[]
}

export const GUIDE_CATEGORIES: GuideCategory[] = ['Finanze', 'Documenti', 'Agenda', 'Account']

export const GUIDE_ENTRIES: GuideEntry[] = [
  {
    id: 'install',
    category: 'Account',
    question: 'Installare AJE sul telefono',
    answer: [
      '**iPhone**: apri AJE in Safari, tocca Condividi e poi “Aggiungi alla schermata Home”. Si apre a tutto schermo e può inviarti notifiche.',
      '**Android**: in Chrome tocca “Installa” quando compare il banner in Home, oppure menu ⋮ → “Installa app”. Si apre come un’app e ricevi i promemoria come notifiche.',
      '**Computer**: in Chrome o Edge usa “Installa AJE sul computer” nella barra laterale, quando è disponibile.',
    ],
  },
  {
    id: 'home',
    category: 'Finanze',
    question: 'Cosa mostra la Home',
    answer: [
      '**Patrimonio**: la somma dei saldi dei tuoi conti, con entrate e uscite del mese corrente.',
      '**Giorno per giorno**: una barra per ogni giorno del mese; tocca una barra per vedere quanto hai speso quel giorno.',
      '**Puoi spendere ancora oggi**: se hai impostato dei budget, quanto resta al giorno fino a fine mese.',
      '**Ultimi movimenti** e **Da fare oggi**: tocca il cerchietto per completare un’attività al volo.',
      '**Chiedi ad AJE**: domande pronte per l’assistente; “Report del mese” apre il resoconto scritto dall’AI.',
    ],
  },
  {
    id: 'spesa',
    category: 'Finanze',
    question: 'Registrare una spesa o un’entrata',
    answer: [
      'Tocca **+** (o “Nuovo movimento” sul computer): scegli Uscita o Entrata, digita l’importo sul tastierino, scegli categoria e conto. Tocca la riga con data, valuta e ricorrenza per cambiarle.',
      'Dopo il salvataggio compare un messaggio con **Annulla**, se hai sbagliato. Tocca un movimento nella lista per modificarlo o eliminarlo.',
      '**Valute estere**: AJE conserva la cifra originale e usa il cambio ufficiale BCE del giorno per il controvalore in euro.',
    ],
  },
  {
    id: 'voce',
    category: 'Finanze',
    question: 'Aggiungere movimenti a voce o con una frase',
    answer: [
      'In Finanze → Movimenti scrivi o detta qualcosa come **“20 euro pizza ieri sera”**: l’AI compila il movimento e tu controlli prima di salvare.',
      '**Diario del giorno**: detta tutte le spese in una volta (“caffè 1,20, pranzo 8 euro, benzina 40”) e registrale in blocco.',
    ],
  },
  {
    id: 'conti',
    category: 'Finanze',
    question: 'Conti, trasferimenti e import CSV',
    answer: [
      'In Finanze → Conti crei conti per contanti, banca e carte, ognuno con il suo saldo iniziale.',
      '**Trasferisci tra conti** sposta soldi senza contare come entrata o uscita (per eliminarlo tocca uno dei due movimenti collegati).',
      '**Importa CSV**: l’icona accanto a un conto legge l’estratto conto della banca, propone le categorie e segnala i possibili duplicati. Il file non lascia il dispositivo.',
    ],
  },
  {
    id: 'budget',
    category: 'Finanze',
    question: 'Budget, categorie e obiettivi',
    answer: [
      '**Budget**: tocca una categoria e imposta il limite mensile; la barra diventa arancione dall’85% e rossa oltre il limite. In fondo trovi spese fisse e abbonamenti.',
      '**Categorie**: in Budget tocca “Gestisci categorie” per crearle, sceglierne icona e colore o eliminarle.',
      '**Obiettivi**: crea un obiettivo e tocca “Aggiungi risparmio”; il simulatore what-if mostra cosa succede se metti via di più ogni mese.',
      '**Export**: in fondo ai movimenti “Esporta CSV/Excel” scarica tutti i movimenti.',
    ],
  },
  {
    id: 'ricorrenze',
    category: 'Finanze',
    question: 'Movimenti ricorrenti',
    answer: ['Imposta “Ogni mese” su affitto o stipendio: alla scadenza la nuova occorrenza si crea da sola ogni notte.'],
  },
  {
    id: 'assistente',
    category: 'Finanze',
    question: 'Usare l’assistente',
    answer: [
      'Chiedi dei tuoi dati (**“Quanto ho speso in ristoranti?”**) oppure chiedi di agire (**“Ho speso 20 euro di pizza”**, **“Ricordami di pagare il bollo venerdì alle 18”**).',
      'Prima di salvare qualsiasi cosa ti mostra cosa ha capito e aspetta la tua conferma. La conversazione non viene memorizzata.',
      '**Microfono**: tocca Parla, poi ✓ per fermare; il testo compare nel campo e puoi correggerlo prima di inviare.',
    ],
  },
  {
    id: 'agenda',
    category: 'Agenda',
    question: 'Attività e calendario',
    answer: [
      '**Attività**: raggruppate in In ritardo, Oggi, Prossimi giorni e Senza data. Il cerchietto completa, il testo apre la modifica.',
      '**Calendario**: un pallino segnala i giorni con attività aperte; tocca un giorno per vederle. Il **+** crea l’attività su quel giorno.',
      'Nella nuova attività scegli **Quando** e **Orario** con un tocco, oppure usa “Altra data” e “Altro orario”.',
    ],
  },
  {
    id: 'notifiche',
    category: 'Agenda',
    question: 'Ricevere le notifiche dei promemoria',
    answer: [
      'Vai in Impostazioni → Notifiche e attiva l’interruttore: il permesso viene chiesto solo in quel momento.',
      'Ricevi un avviso all’ora dell’attività, o alle 9:00 se non ha orario. Su iPhone funzionano solo con AJE installata sulla schermata Home.',
      'Se risultano “Bloccate”, riattivale dalle impostazioni del browser.',
    ],
  },
  {
    id: 'carica',
    category: 'Documenti',
    question: 'Caricare buste paga, scontrini e documenti',
    answer: [
      'In Documenti tocca **+** (o “Carica documento”): scegli il tipo, poi **Scatta foto** o **Scegli file**. Sul computer puoi anche trascinare il file sulla pagina.',
      '**Busta paga**: l’AI estrae netto, lordo e trattenute; confermi e lo stipendio finisce nelle entrate.',
      '**Scontrino**: l’AI legge totale, data e negozio e alla conferma crea l’uscita.',
      '**Documento**: ricevi riassunto e spiegazione semplice, che resta salvata.',
      'La lettura automatica usa la tua chiave Gemini; senza chiave il file viene solo archiviato.',
    ],
  },
  {
    id: 'pdf',
    category: 'Documenti',
    question: 'Creare un PDF con l’AI',
    answer: [
      'Scegli una fonte (testo, video YouTube pubblico o documento archiviato), un formato (sintesi, appunti o schema) e tocca **Genera documento**.',
      'Correggi titolo e testo nell’anteprima, poi **Scarica PDF**. Solo **Salva nell’archivio privato** conserva il PDF nell’app. Controlla sempre i fatti generati dall’AI.',
    ],
  },
  {
    id: 'cerca-doc',
    category: 'Documenti',
    question: 'Cercare nei documenti',
    answer: ['Nell’archivio scrivi ad esempio “bolletta luce”: la ricerca guarda nome del file, titolo, riassunto e spiegazione. I filtri in alto mostrano solo buste paga, scontrini o altro.'],
  },
  {
    id: 'carburanti',
    category: 'Account',
    question: 'Trovare il distributore più economico',
    answer: [
      'In Carburanti la mappa mostra i prezzi comunicati al Ministero, aggiornati ogni mattina. Scegli il carburante, sposta la mappa e tocca “Cerca in quest’area”.',
      '“Registra rifornimento” apre un nuovo movimento già in Trasporti.',
    ],
  },
  {
    id: 'chiave',
    category: 'Account',
    question: 'Impostare la chiave Gemini',
    answer: [
      'In Impostazioni → Chiavi e integrazioni salva la tua chiave personale: è cifrata sul server e ogni account usa la propria.',
      'Trovi i passaggi per ottenerla, i link ufficiali e i limiti del piano gratuito nella stessa sezione.',
    ],
  },
  {
    id: 'ospite',
    category: 'Account',
    question: 'Invitare un ospite',
    answer: ['Solo il proprietario può generare un invito, copiarne il link o preparare l’email, annullarlo o sospendere l’ospite. I dati di ogni account restano separati.'],
  },
  {
    id: 'passkey',
    category: 'Account',
    question: 'Accedere con passkey (Face ID)',
    answer: ['In Impostazioni → Account crea una passkey su questo dispositivo: dalla volta dopo accedi col viso, l’impronta o il PIN. La password continua a funzionare.'],
  },
  {
    id: 'offline',
    category: 'Account',
    question: 'Usare AJE offline',
    answer: [
      'Dopo aver aperto almeno una volta Finanze o Agenda online, le ultime viste restano disponibili in forma cifrata. Puoi aggiungere o modificare movimenti e attività: il banner in alto indica le modifiche in attesa e le sincronizza appena torna la connessione.',
      'Non cancellare i dati del sito se ci sono modifiche in attesa: esistono solo sul dispositivo. Documenti e funzioni AI richiedono internet.',
    ],
  },
  {
    id: 'tema',
    category: 'Account',
    question: 'Tema chiaro o scuro',
    answer: ['Il pulsante con la luna in Home alterna chiaro e scuro. In Impostazioni → Aspetto puoi anche scegliere “Sistema”.'],
  },
  {
    id: 'privacy',
    category: 'Account',
    question: 'Privacy e aggiornamenti',
    answer: [
      'I dati sono protetti dal tuo account con accessi separati; si entra solo con invito. La cifratura delle chiavi è gestita dal server, non end-to-end.',
      'L’app si aggiorna da sola: se non vedi una novità, chiudila e riaprila.',
    ],
  },
]

/** Minuscole e senza accenti, per una ricerca tollerante. */
export function normalizeSearch(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export function searchGuide(entries: GuideEntry[], query: string, category: GuideCategory | null): GuideEntry[] {
  const terms = normalizeSearch(query).split(/\s+/).filter(Boolean)
  return entries.filter((entry) => {
    if (category && entry.category !== category) return false
    if (terms.length === 0) return true
    const haystack = normalizeSearch(`${entry.question} ${entry.category} ${entry.answer.join(' ')}`)
    return terms.every((term) => haystack.includes(term))
  })
}

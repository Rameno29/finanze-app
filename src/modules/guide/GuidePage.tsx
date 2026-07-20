import { createContext, useContext, useState, type ReactNode } from 'react'
import {
  Bot,
  CalendarDays,
  ChevronDown,
  FileText,
  Globe,
  Home,
  Lightbulb,
  Music,
  Settings,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { PageHeader } from '../../components/ui'

// Accordion esclusivo: aprire una sezione chiude le altre
const AccordionContext = createContext<{
  openId: string | null
  toggle: (id: string) => void
}>({ openId: null, toggle: () => {} })

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon
  title: string
  children: ReactNode
}) {
  const { openId, toggle } = useContext(AccordionContext)
  const open = openId === title
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
      <button
        onClick={() => toggle(title)}
        aria-expanded={open}
        className="flex min-h-[56px] w-full items-center gap-3 px-4 py-3 text-left font-semibold"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
          <Icon className="h-4 w-4" />
        </span>
        <span className="flex-1">{title}</span>
        <ChevronDown
          className={`h-5 w-5 text-muted transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="space-y-2.5 border-t border-line px-4 py-4 text-sm leading-relaxed text-muted">
          {children}
        </div>
      )}
    </div>
  )
}

function P({ children }: { children: ReactNode }) {
  return <p>{children}</p>
}

function B({ children }: { children: ReactNode }) {
  return <strong className="font-semibold text-ink">{children}</strong>
}

export function GuidePage() {
  const [openId, setOpenId] = useState<string | null>('Home')
  const toggle = (id: string) => setOpenId((current) => (current === id ? null : id))

  return (
    <div className="pb-28">
      <PageHeader title="Guida" subtitle="Come funziona ogni sezione di AJE" />

      <AccordionContext.Provider value={{ openId, toggle }}>
      <div className="mx-auto flex max-w-lg flex-col gap-3 px-5 pt-4">
        <Section icon={Home} title="Home">
          <P>La Home è il tuo colpo d'occhio quotidiano:</P>
          <P>• <B>Saldo del mese</B> — entrate, uscite e differenza del mese corrente.</P>
          <P>• <B>Da fare oggi</B> — le attività dell'agenda in scadenza oggi o in ritardo: tocca il cerchietto per completarle al volo.</P>
          <P>• <B>Uscite per categoria</B> — la torta di dove stanno andando i soldi questo mese.</P>
          <P>• <B>Ultimi 6 mesi</B> — tocca la colonna di un mese per vedere entrate, uscite e saldo di quel mese nel riquadro sotto il grafico.</P>
          <P>• <B>Disponibile oggi</B> — se hai impostato dei budget, calcola quanto puoi spendere al giorno da qui a fine mese (budget rimanente ÷ giorni rimasti).</P>
          <P>• <B>Chiedi ad AJE</B> — apre l'assistente AI (vedi la sezione dedicata).</P>
          <P>• <B>Report del mese scorso</B> — un resoconto scritto dall'AI: totali, categorie principali, budget e consigli per il mese in corso.</P>
        </Section>

        <Section icon={Bot} title="Assistente">
          <P>Una chat (anche <B>vocale</B>, col microfono) che fa due cose:</P>
          <P>• <B>Risponde</B> guardando i tuoi movimenti, budget e obiettivi: <B>"Quanto ho speso in ristoranti quest'anno?"</B>, <B>"Posso permettermi una spesa di 200 €?"</B>.</P>
          <P>• <B>Agisce</B> per te: <B>"Ho speso 20 euro di pizza"</B> registra l'uscita, <B>"Ricordami di pagare il bollo venerdì alle 18"</B> crea il promemoria, <B>"Metti 50 euro nelle vacanze"</B> aggiorna l'obiettivo, <B>"Imposta 300 euro di budget per la spesa"</B> imposta il budget.</P>
          <P>Prima di eseguire qualsiasi azione ti mostra <B>cosa ha capito e ti chiede conferma</B>: niente viene salvato senza il tuo ok. La conversazione non viene memorizzata: chiusa la pagina, riparte da zero.</P>
          <P><B>Microfono</B>: tocca il microfono e parla, poi tocca ✓ per fermare. Il testo di quello che hai detto compare nel campo e <B>puoi correggerlo</B> prima di premere Invia. Funziona su iPhone, Android e PC.</P>
        </Section>

        <Section icon={Wallet} title="Finanze">
          <P><B>Movimenti</B> — il registro di entrate e uscite. Il bottone <B>+</B> aggiunge un movimento: scegli tipo, importo, categoria, data e (se vuoi) una <B>ricorrenza</B>. Tocca un movimento per modificarlo o eliminarlo. Con le frecce ‹ › cambi mese.</P>
          <P><B>Valute estere</B> — scegli la valuta accanto all'importo: AJE conserva la cifra originale e usa il cambio ufficiale BCE del giorno (o dell'ultimo giorno lavorativo precedente) per mostrare e sommare il controvalore in euro.</P>
          <P><B>Aggiunta rapida a voce o con una frase</B> — nella barra in alto scrivi (o detti col microfono) qualcosa come <B>"20 euro pizza ieri sera"</B>: l'AI capisce importo, categoria e data e ti mostra il movimento già compilato — controlli e salvi.</P>
          <P><B>Diario del giorno</B> — a fine giornata detta (o scrivi) tutte le spese in una volta: <B>"caffè 1,20, pranzo 8 euro, benzina 40"</B>. L'AI le separa in movimenti singoli con categoria proposta: togli la spunta a quelli sbagliati, scegli il conto e registri tutto in blocco.</P>
          <P><B>Simulatore what-if</B> (nella scheda Obiettivi) — "e se mettessi via 100 € in più al mese?": il grafico confronta il tuo ritmo attuale con lo scenario, calcolato su entrate e uscite reali degli ultimi mesi. Il bottone AI ti dice se è sostenibile e dove recuperare la cifra.</P>
          <P><B>Ricorrenze automatiche</B> — se imposti "mensile" su affitto o stipendio, alla scadenza la nuova occorrenza si crea da sola ogni notte: non devi fare nulla.</P>
          <P><B>Conti</B> — crea conti separati per contanti, banca e carte, ognuno con il suo saldo iniziale: assegnando i movimenti a un conto vedi il saldo aggiornato di ognuno e il patrimonio totale. Il bottone <B>Trasferimento</B> sposta soldi tra due conti senza contare come entrata o uscita (per eliminarlo, tocca uno dei due movimenti collegati).</P>
          <P><B>Importa l'estratto conto (CSV)</B> — nella vista Conti, l'icona di caricamento accanto a un conto legge il file CSV scaricato dal sito della banca: AJE riconosce da solo colonne, date e importi (puoi correggerli), <B>propone la categoria</B> in base ai tuoi movimenti passati e <B>segnala i possibili duplicati</B>, che restano deselezionati. Scegli le righe e importi tutto in un colpo: il file non lascia il tuo dispositivo.</P>
          <P><B>Budget</B> — tocca una categoria e imposta il tetto mensile: la barra mostra quanto hai già speso e diventa rossa se sfori. In fondo trovi <B>Spese fisse e abbonamenti</B>: l'elenco dei movimenti ricorrenti con il costo al mese e all'anno.</P>
          <P><B>Categorie</B> — crea, personalizza (icona e colore) o elimina le categorie di entrata e uscita.</P>
          <P><B>Obiettivi</B> — il salvadanaio: crea un obiettivo (es. "Vacanze", 1.500 €), tocca la card per aggiungere o togliere risparmi e segui la barra fino al traguardo.</P>
          <P><B>Export Excel</B> — l'icona di download in alto scarica tutti i movimenti in un file CSV che si apre direttamente in Excel.</P>
        </Section>

        <Section icon={CalendarDays} title="Agenda">
          <P><B>Attività</B> — l'elenco delle cose da fare raggruppate per urgenza: In ritardo (rosso), Oggi, Prossime, Senza data e Completate. Il cerchietto completa, il testo apre la modifica.</P>
          <P><B>Calendario</B> — la griglia del mese: un puntino segnala i giorni con attività; tocca un giorno per vederle. Il bottone <B>+</B> crea l'attività già sul giorno selezionato.</P>
          <P>Ogni attività può avere data, ora e note — tutte facoltative.</P>
          <P><B>Notifiche</B> — attivale in <B>Altro → Notifiche promemoria</B>: riceverai un avviso sul telefono quando un'attività è in scadenza (all'ora impostata, o alle 9:00 se senza ora). Su iPhone funzionano solo con l'app installata sulla schermata Home.</P>
        </Section>

        <Section icon={FileText} title="Documenti">
          <P>Tre bottoni per tre tipi di analisi AI:</P>
          <P>• <B>Busta paga</B> (PDF o foto) — l'AI estrae netto, lordo, trattenute, ferie: tu controlli, correggi se serve e confermi. L'entrata "Stipendio" finisce da sola nelle Finanze e il grafico <B>Andamento stipendio</B> si aggiorna.</P>
          <P>• <B>Scontrino</B> — scatta una foto: l'AI legge totale, data, negozio e categoria, e alla conferma crea l'uscita nelle Finanze.</P>
          <P>• <B>Documento</B> — carica qualsiasi cosa (contratto, bolletta, lettera, referto): ricevi riassunto, punti chiave e una spiegazione in parole semplici, che resta salvata (ritocca il documento per rileggerla).</P>
          <P><B>Cerca nei documenti</B> — la barra di ricerca sopra l'elenco trova i documenti per parole contenute nel nome del file o nell'analisi AI (titolo, riassunto, spiegazione, punti chiave): scrivi ad esempio "bolletta luce" e vedi solo i documenti pertinenti.</P>
          <P><B>Crea un documento PDF</B> — descrivi cosa ti serve (una guida, una lettera, un programma) e volendo incolla un link YouTube: l'AI scrive il documento, tu lo vedi in anteprima e scarichi il PDF.</P>
          <P><B>Scanner documenti</B> — fotografa carta d'identità, moduli o contratti, anche su più pagine: AJE <B>riconosce da solo i bordi del foglio, lo ritaglia e lo raddrizza</B> come una vera scansione (anche se la foto è storta o in prospettiva). Appena scatti, AJE <B>riconosce i bordi del foglio e lo raddrizza da solo</B> sul telefono (veloce e senza internet). Col bottone dei bordi puoi <B>trascinare i 4 angoli</B> a mano — tenendo premuto compare una <B>lente d'ingrandimento</B> per la massima precisione — e, se il ritaglio automatico dovesse sbagliare su una foto difficile, usare <B>"Trova i bordi con l'AI"</B> (invia la foto alla funzione AI sicura del server; ritaglio, filtri e PDF restano sul telefono). Per ogni pagina scegli il filtro (Migliorato, Grigio, B/N o Originale), ruoti o elimini, poi <B>Condividi PDF</B> apre il foglio di iOS per mandarlo su WhatsApp, Mail o dove vuoi. Puoi anche scaricarlo o salvarlo nei Documenti. Le foto restano sul telefono: niente viene inviato a nessun server finché non scegli tu.</P>
        </Section>

        <Section icon={Globe} title="Google">
          <P>Si apre da <B>Altro → Google</B>.</P>
          <P>• <B>Ricerca web con AI</B> — fai una domanda: l'AI cerca su Google, legge i risultati e risponde in italiano citando le fonti.</P>
          <P>• <B>Maps</B> — cerca un posto e si apre in Google Maps.</P>
          <P>• <B>Calendar, Gmail, Drive</B> — dopo "Collega Google" vedi i prossimi eventi, le email non lette e i file recenti; tocca un elemento per aprirlo nell'app ufficiale. AJE legge soltanto: non modifica né invia nulla.</P>
        </Section>

        <Section icon={Music} title="Media">
          <P>Si apre da <B>Altro → Media</B>.</P>
          <P>• <B>YouTube</B> — cerca un video per parole o incolla un link: parte nel <B>mini-player</B> che resta visibile mentre giri per l'app. Con l'icona <B>Picture-in-Picture</B> del player il video continua in una finestrella anche fuori da AJE. Il bottone <B>Riassumi</B> fa guardare il video all'AI e ti dà il riassunto scritto.</P>
          <P>• <B>Spotify</B> — dopo "Collega Spotify": cerca un brano e toccalo per il <B>player interno</B>, oppure usa il bottone verde per avviarlo sull'app Spotify e comandarlo da AJE (play/pausa/salta).</P>
          <P>⚠️ <B>Limiti di iPhone</B> (imposti da Apple, non aggirabili): con lo schermo bloccato l'audio di YouTube si ferma; per la musica completa in sottofondo usa il bottone verde di Spotify.</P>
        </Section>

        <Section icon={Settings} title="Altro (impostazioni)">
          <P>• <B>Carburanti</B> — la mappa dei distributori con i prezzi comunicati al Ministero (aggiornati ogni mattina): il più economico è evidenziato in verde. Usa la tua posizione, ma puoi anche trascinare la mappa dove vuoi e toccare "Cerca in quest'area"; il bottone <B>Naviga</B> apre le indicazioni stradali.</P>
          <P>• <B>Tema</B> — chiaro, scuro o automatico come il sistema.</P>
          <P>• <B>Passkey e Face ID</B> — crea una passkey su questo dispositivo e dalla volta dopo accedi col viso (o l'impronta), senza scrivere la password. La passkey resta sul tuo dispositivo o nel portachiavi iCloud: AJE conserva solo la parte pubblica, e puoi eliminarla quando vuoi. La password continua comunque a funzionare.</P>
          <P>• <B>Account</B> — la tua email e il bottone Esci.</P>
          <P>• Le funzioni AI sono attive con Google Gemini (piano gratuito): la chiave sta al sicuro sul server, mai sul telefono.</P>
        </Section>

        <Section icon={Lightbulb} title="Consigli utili">
          <P>• <B>Installazione</B> — iPhone: Safari → Condividi → "Aggiungi a schermata Home". Android: Chrome → menu ⋮ → "Aggiungi a schermata Home" (o "Installa app").</P>
          <P>• <B>Aggiornamenti</B> — l'app si aggiorna da sola: se non vedi una novità, chiudila e riaprila.</P>
          <P>• <B>Uso offline</B> — dopo aver aperto almeno una volta Finanze o Agenda online, le ultime viste restano disponibili in forma cifrata. Puoi aggiungere o modificare movimenti e attività: la barra in alto indica le operazioni in attesa e le sincronizza in ordine appena torna la connessione. Documenti e funzioni AI richiedono internet.</P>
          <P>• <B>Privacy</B> — i tuoi dati sono nel tuo database personale, protetti dal tuo account; solo le email autorizzate possono registrarsi.</P>
          <P>• <B>Foto migliori per l'AI</B> — scontrini e buste paga ben illuminati e dritti si leggono meglio.</P>
        </Section>
      </div>
      </AccordionContext.Provider>
    </div>
  )
}

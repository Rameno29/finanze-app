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
        </Section>

        <Section icon={Bot} title="Assistente">
          <P>Una chat che risponde guardando i <B>tuoi</B> movimenti, budget e obiettivi degli ultimi 12 mesi.</P>
          <P>Esempi: <B>"Quanto ho speso in ristoranti quest'anno?"</B>, <B>"Come vanno i miei budget?"</B>, <B>"Posso permettermi una spesa di 200 €?"</B>, <B>"Dammi consigli per risparmiare"</B>.</P>
          <P>Le risposte si basano solo sui dati che hai registrato in AJE: più l'app è aggiornata, più l'assistente è preciso. La conversazione non viene salvata: chiusa la pagina, riparte da zero.</P>
        </Section>

        <Section icon={Wallet} title="Finanze">
          <P><B>Movimenti</B> — il registro di entrate e uscite. Il bottone <B>+</B> aggiunge un movimento: scegli tipo, importo, categoria, data e (se vuoi) una <B>ricorrenza</B>. Tocca un movimento per modificarlo o eliminarlo. Con le frecce ‹ › cambi mese.</P>
          <P><B>Aggiunta rapida a voce o con una frase</B> — nella barra in alto scrivi (o detti col microfono) qualcosa come <B>"20 euro pizza ieri sera"</B>: l'AI capisce importo, categoria e data e ti mostra il movimento già compilato — controlli e salvi.</P>
          <P><B>Ricorrenze automatiche</B> — se imposti "mensile" su affitto o stipendio, alla scadenza la nuova occorrenza si crea da sola ogni notte: non devi fare nulla.</P>
          <P><B>Budget</B> — tocca una categoria e imposta il tetto mensile: la barra mostra quanto hai già speso e diventa rossa se sfori.</P>
          <P><B>Categorie</B> — crea, personalizza (icona e colore) o elimina le categorie di entrata e uscita.</P>
          <P><B>Obiettivi</B> — il salvadanaio: crea un obiettivo (es. "Vacanze", 1.500 €), tocca la card per aggiungere o togliere risparmi e segui la barra fino al traguardo.</P>
          <P><B>Export Excel</B> — l'icona di download in alto scarica tutti i movimenti in un file CSV che si apre direttamente in Excel.</P>
        </Section>

        <Section icon={CalendarDays} title="Agenda">
          <P><B>Attività</B> — l'elenco delle cose da fare raggruppate per urgenza: In ritardo (rosso), Oggi, Prossime, Senza data e Completate. Il cerchietto completa, il testo apre la modifica.</P>
          <P><B>Calendario</B> — la griglia del mese: un puntino segnala i giorni con attività; tocca un giorno per vederle. Il bottone <B>+</B> crea l'attività già sul giorno selezionato.</P>
          <P>Ogni attività può avere data, ora e note — tutte facoltative.</P>
        </Section>

        <Section icon={FileText} title="Documenti">
          <P>Tre bottoni per tre tipi di analisi AI:</P>
          <P>• <B>Busta paga</B> (PDF o foto) — l'AI estrae netto, lordo, trattenute, ferie: tu controlli, correggi se serve e confermi. L'entrata "Stipendio" finisce da sola nelle Finanze e il grafico <B>Andamento stipendio</B> si aggiorna.</P>
          <P>• <B>Scontrino</B> — scatta una foto: l'AI legge totale, data, negozio e categoria, e alla conferma crea l'uscita nelle Finanze.</P>
          <P>• <B>Documento</B> — carica qualsiasi cosa (contratto, bolletta, lettera, referto): ricevi riassunto, punti chiave e una spiegazione in parole semplici, che resta salvata (ritocca il documento per rileggerla).</P>
          <P><B>Crea un documento PDF</B> — descrivi cosa ti serve (una guida, una lettera, un programma) e volendo incolla un link YouTube: l'AI scrive il documento, tu lo vedi in anteprima e scarichi il PDF.</P>
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
          <P>• <B>Tema</B> — chiaro, scuro o automatico come il sistema.</P>
          <P>• <B>Account</B> — la tua email e il bottone Esci.</P>
          <P>• Le funzioni AI sono attive con Google Gemini (piano gratuito): la chiave sta al sicuro sul server, mai sul telefono.</P>
        </Section>

        <Section icon={Lightbulb} title="Consigli utili">
          <P>• <B>Installazione</B> — iPhone: Safari → Condividi → "Aggiungi a schermata Home". Android: Chrome → menu ⋮ → "Aggiungi a schermata Home" (o "Installa app").</P>
          <P>• <B>Aggiornamenti</B> — l'app si aggiorna da sola: se non vedi una novità, chiudila e riaprila.</P>
          <P>• <B>Privacy</B> — i tuoi dati sono nel tuo database personale, protetti dal tuo account; solo le email autorizzate possono registrarsi.</P>
          <P>• <B>Foto migliori per l'AI</B> — scontrini e buste paga ben illuminati e dritti si leggono meglio.</P>
        </Section>
      </div>
      </AccordionContext.Provider>
    </div>
  )
}

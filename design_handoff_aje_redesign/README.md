# Handoff: AJE — redesign "Flusso" (web app responsive)

**Repo:** `Rameno29/finanze-app` · React 19 + Vite 8 + TypeScript + Tailwind v4 + react-router-dom 7 + lucide-react + vite-plugin-pwa · base `/finanze-app/` · UI in italiano.

Leggi tutto questo file prima di scrivere codice. Contiene le regole che evitano regressioni (§2), i token (§4), le specifiche delle schermate (§6–7), l'impatto sui test (§9) e i controlli finali (§11).

---

## 1. Cosa sono questi file

I file `.dc.html` sono **prototipi di design in HTML**: mostrano aspetto e comportamento, con dati finti. **Non vanno copiati né importati nell'app.** Il compito è ricreare il design nei componenti React esistenti (`src/modules/*`, `src/components/*`), riusando dati, hook, servizi Supabase e logica offline già presenti.

Per vederli, aprili nel browser (nella stessa cartella serve `support.js`):
- `AJE Web.dc.html` — **riferimento principale**, responsive: ridimensiona la finestra per vedere mobile e desktop.
- `AJE App.dc.html` — le stesse schermate in una cornice telefono 390×844.
- `AJE Stati.dc.html` — stati vuoti, errore, offline, ecc.
- `screenshots/` — 15 mobile, 8 desktop, 2 tavole di stati.

**Fedeltà:** alta. Colori, tipografia, spaziature, testi e animazioni sono definitivi.

---

## 2. Regole da rispettare (evitano errori)

1. **Nessuna funzionalità va rimossa.** Il prototipo non mostra tutto ciò che la repo fa già. Queste parti vanno *solo restilizzate* secondo §3–4 e restano raggiungibili:
   - Finanze: `DiarySheet` (diario vocale), `ImportSheet` (CSV), `CategoriesView`, `WhatIfCard`
   - Documenti: `PayslipConfirmSheet`, `ReceiptConfirmSheet`, `ExplainSheet`
   - Accesso: `AuthCallbackPage`, `MembershipGate`
   - Tutta la logica di `src/lib/*`: offline, push, passkeys, voice, pdf, csvImport, whatif, assistantActions
2. **Dati reali, non quelli del prototipo.** Categorie, colori e icone delle categorie arrivano dal database e da `src/lib/icons.tsx` (`CATEGORY_ICONS`). Importi e date si formattano con `src/lib/format.ts` e `src/lib/currency.ts`.
3. **Icone:** continua a usare **lucide-react**, senza aggiungere Material Symbols. Trovi la corrispondenza in §5. Con lucide-react v1 controlla che ogni nome esista nella versione installata, altrimenti la build fallisce.
4. **Font:** Geist va servito dal sito stesso, perché la CSP di `vite.config.ts` blocca Google Fonts (`font-src 'self' data:`, `style-src 'self' 'unsafe-inline'`). Installa `@fontsource-variable/geist` e importalo in `src/main.tsx`. **Non modificare la CSP.**
5. **Routing:** resta `BrowserRouter` con percorsi veri (`/finanze`, `/agenda`…), non con l'hash (`#`) usato nel prototipo. Aggiungi soltanto la rotta **`/altro`** (§7.7).
6. **Breakpoint:** il passaggio mobile → desktop resta a **`lg` (1024px)** come oggi (`lg:pl-[264px]`, sidebar 264px). Il prototipo cambia a 900px e usa una sidebar da 248px: puoi ignorarlo. Tra 900 e 1023px valgono le griglie a 2 colonne già presenti in `index.css`, con navigazione mobile.
7. **Tema:** usa `ThemeContext`, che mette la classe `.dark` su `<html>` e ha l'opzione `system`. Il pulsante tema in Home alterna chiaro e scuro con `setSetting`.
8. **Accessibilità e test:** mantieni i nomi accessibili elencati in §9, oppure aggiorna `tests/e2e` nella stessa PR. Target minimo 44px, `focus-visible` già definito in `index.css`, `prefers-reduced-motion` rispettato (§4.6).
9. **Input:** lascia la regola `font-size:16px` sugli input, che evita lo zoom automatico di iOS.
10. **Una PR per fase** (§10). Ogni PR deve passare `npm run lint`, `npm test`, `npm run build` e `npm run test:e2e`.

---

## 3. Principi visivi

- **Niente card e niente riquadri** per il contenuto principale: sezioni continue sullo sfondo `--bg`, separate da spazio (28–36px) e da linee di 1px `--border`. Le classi `.app-card`, `.agenda-panel` e il componente `Card` vanno ritirati dalle schermate ridisegnate. `Card` resta solo per l'anteprima del PDF, il banner di installazione e le aree evidenziate indicate sotto.
- Tipografia sans unica (Geist): la classe `.display-type` (DM Serif) **non si usa più** nei titoli.
- Numeri sempre con `font-variant-numeric: tabular-nums`.
- Una sola azione primaria per schermata, in `--accent`.

---

## 4. Design token → `src/index.css`

Mantieni **i nomi di variabile esistenti** e cambia solo i valori indicati. Il file `tokens.css` qui accanto contiene il blocco pronto da incollare.

### 4.1 Colori (chiaro / scuro)
| Variabile repo | Chiaro | Scuro | Uso |
|---|---|---|---|
| `--bg` | `#f6f4ed` | `#081b19` | sfondo |
| `--card` | `#fffefa` | `#102825` | fogli, dialog, input |
| `--card-2` | `#f2f0e9` | `#17332f` | tracce delle barre, segmented, pressed |
| `--text` | `#152c29` | `#f2f1e8` | testo |
| `--muted` | `#5c6b67` | `#b3c1bb` | secondario |
| `--border` | `#e4e4dc` | `#28514a` | divisori 1px |
| `--accent` | `#6253e8` | `#a39aff` | CTA, "+" |
| `--accent-soft` | `#efedff` | `#302e5b` | chip AI, evidenziazione della riga nuova |
| `--income` | `#07865f` | `#4dd49b` | entrate, successo |
| `--expense` | `#d94e59` | `#ff7a83` | uscite, errori, "in ritardo" |
| `--brand` | `#0b5145` | `#a5e2cb` | barre del grafico, progress |
| `--brand-soft` | `#e6f0ea` | `#153a32` | sfondo icone dei conti, chip "Analizzato" |
| `--nav-bg` | **`#07382f`** (oggi `#0a4239`) | **`#153b34`** (oggi `#061715`) | barra flottante e sidebar |
| `--warn-bg` *(nuova)* | `#f6e7c1` | `#3a2f12` | banner offline |
| `--warn-text` *(nuova)* | `#4d3a00` | `#f6e7c1` | banner offline |
| `--warning` *(nuova)* | `#d98a0b` | `#f0b44c` | budget ≥ 85% |

Aggiungi in `@theme inline`: `--color-brand: var(--brand)`, `--color-brand-soft: var(--brand-soft)`, `--color-nav: var(--nav-bg)`, `--color-warn-bg`, `--color-warn-text`, `--color-warning`. In questo modo funzionano classi come `bg-brand`, `text-warning`, ecc.

### 4.2 Tipografia (Geist)
| Ruolo | Dimensione / peso | Interlinea / spaziatura lettere |
|---|---|---|
| Saldo Home | 58px / 600 (decimali 28px / 500 `--muted`) | 1 / −0.035em |
| Titolo pagina | 34px / 600 (desktop 34px) | 1.1 / −0.03em |
| Importo nel foglio movimento | 52px / 600 | −0.035em |
| Valore in evidenza | 26px / 600 | −0.02em |
| Percentuale obiettivo | 32px / 600 | −0.03em |
| Titolo sezione | 15px / 600 | — |
| Titolo riga | 15px / 500 | — |
| Sottotitolo riga, meta | 13px / 400 `--muted` | — |
| Label della barra mobile | 10.5px / 600 | — |
| Assi del grafico, caption | 11–12px | — |

### 4.3 Spaziature
- Padding orizzontale mobile: 20px (`px-5`). Contenuto desktop: centrato, max 1120px (720px per Assistente, Impostazioni e Guida), padding 40px.
- Padding verticale mobile: in alto `calc(env(safe-area-inset-top) + 16px)`, in basso **130px** (spazio per la barra flottante).
- Distanza tra sezioni 28–36px; tra titolo sezione e contenuto 12–14px.
- Altezza righe: movimenti 64px, attività 60px, documenti e voci di Altro 72px, conti 72px, righe impostazioni 64px.

### 4.4 Raggi
Righe con evidenziazione 14px · input 12–14px · CTA 16–18px · chip e pill 9999px · icona categoria cerchio 40px · icona conto 44px con raggio 12px · fogli mobile 28px solo in alto · dialog desktop 28px · barra flottante 33px · segmented 14px (interno 10px).

### 4.5 Ombre
- Barra flottante: `0 12px 30px rgb(7 56 47 / .30)`
- "+": `0 6px 16px rgb(98 83 232 / .45)`
- Composer chat: `0 10px 30px rgb(21 44 41 / .12)`
- Anteprima PDF: `0 1px 2px rgb(0 0 0 / .08), 0 8px 24px rgb(21 44 41 / .10)`

### 4.6 Movimento
| Token | Easing | Durata | Uso |
|---|---|---|---|
| `--ease-standard` | `cubic-bezier(.2,.8,.2,1)` | 450–500ms | cambio scheda, righe che si aprono, scorrimenti orizzontali, barre |
| `--ease-sheet` | `cubic-bezier(.32,.72,0,1)` | 500ms | fogli e scala dell'app sotto |
| `--ease-spring` | `cubic-bezier(.3,1.25,.5,1)` | 400–450ms | pill attiva della nav, segmented, rotazione del "+", switch |
| `--ease-pop` | `cubic-bezier(.3,1.5,.5,1)` | 300ms | radio, pulsante invio |
| fade | `ease` | 300–350ms | opacità, toast |

Con `@media (prefers-reduced-motion: reduce)`: niente transform, stagger né scorrimento animato dei numeri; resta solo il fade da 150ms. Usa **solo transizioni CSS** e `requestAnimationFrame` (per il contatore del saldo), senza nuove librerie.

---

## 5. Icone: da Material (prototipo) a lucide-react
home→`Home` · wallet→`Wallet` · calendario→`CalendarDays` · documenti→`FileText` · assistente→`Bot` · carburanti→`Fuel` · guida→`BookOpen` · impostazioni→`Settings` · aggiungi→`Plus` · chiudi→`X` · avatar→`CircleUser` · tema→`Moon`/`Sun` · spunta→`Check` · successo→`CircleCheck` · indietro→`ArrowLeft` · invio→`ArrowUp` · chevron→`ChevronRight`/`ChevronDown`/`ChevronLeft` · cerca→`Search` · offline→`CloudOff` · trasferisci→`ArrowLeftRight` · AI→`Sparkles` · fotocamera→`Camera` · cartella→`FolderOpen` · upload→`Upload` · busta paga→`ReceiptText` · scontrino→`Receipt` · chiave→`KeyRound` · ospite→`UserPlus` · aspetto→`Palette` · notifiche→`Bell` · sync→`RefreshCw` · esci→`LogOut` · passkey→`Fingerprint` · installa→`Download` · microfono→`Mic` · testo→`PenLine` · video→`SquarePlay` · banca→`Landmark` · carta→`CreditCard` · contanti→`Banknote` · errore sync→`TriangleAlert` · lucchetto→`Lock` · orario→`Clock`.
Dimensioni: 22–24px nella nav, 20px nelle righe, `strokeWidth={1.9}`. La voce attiva della nav usa `strokeWidth={2.4}`, perché lucide non ha una variante piena.

---

## 6. Shell e navigazione (`src/App.tsx`, `src/components/TabBar.tsx`)

### 6.1 Mobile (< lg)
- **Barra flottante** `<nav aria-label="Navigazione principale">`, `position:fixed`:
  - posizione `left/right: 18px`, `bottom: calc(env(safe-area-inset-bottom) + 14px)`, `max-width: 480px`, `margin-inline: auto`;
  - dimensioni h 66px, raggio 33px, bg `--nav-bg`, ombra §4.5;
  - griglia di 5 colonne uguali: **Home · Finanze · [+] · Agenda · Documenti**.
- Voci: `NavLink` con icona 23px e label 10.5px/600. Inattive `rgb(255 255 255 / .72)`, attiva `#fff`.
- **Pill attiva** dietro la voce: `rgb(255 255 255 / .12)`, `inset-block: 7px`, larghezza `calc(20% - 8px)`, `margin-left: 4px`. Si sposta con `left` animato (`--ease-spring`, 450ms). Posizioni: Home 0%, Finanze 20%, Agenda 60%, Documenti 80%. Sulle altre rotte è nascosta (opacity 0).
- **"+"** centrale: cerchio 54px `--accent`, icona `Plus` 30px bianca, ombra §4.5, `:active scale(.9)`. Con un foglio aperto ruota di 45° (spring). Azione e `aria-label` dipendono dalla rotta:
  - `/`, `/finanze` → "Nuovo movimento" (apre `TransactionSheet`)
  - `/agenda` → "Nuova attività" (apre `TaskSheet`)
  - `/documenti` → "Carica documento" (apre il foglio di caricamento, §7.6)
  - altre rotte → "Nuovo movimento"
- Su `/assistente`, `/carburanti`, `/impostazioni`, `/guida`, `/altro` la barra **esce dallo schermo** (`translateY(140px)`, 450ms standard) e in alto a sinistra compare il pulsante indietro (`ArrowLeft`, 44px, `navigate(-1)` con fallback su `/altro`).
- "Altro" non è più nella barra: si apre dall'**avatar** (44px, bg `--brand-soft`, icona `--brand`) in alto a destra della Home, che è un `<Link to="/altro" aria-label="Altro">`.
- Il contenuto non deve finire sotto la barra: padding-bottom 130px sulle pagine.

### 6.2 Desktop (≥ lg)
- La `aside` esistente (264px, bg `--nav-bg`) resta con `<nav aria-label="Navigazione desktop">` e le 8 voci attuali, nello stesso ordine.
- Wordmark: `aje-wordmark-dark-v2.webp` invertito in bianco (`filter: brightness(0) invert(1)`), alto 26px. Se l'asset attuale `aje-logo-v2.webp` è già chiaro, puoi tenerlo.
- Voce: 48px, raggio 12px, gap 12px, 15px/500. Attiva `bg-white/13 text-white`, inattiva `text-white/74`, hover `bg-white/7`.
- Sotto le voci, a 22px di distanza, **CTA contestuale** a tutta larghezza: 48px, raggio 14px, `--accent`, `Plus` + la stessa label del "+" mobile.
- In fondo, dall'alto verso il basso:
  - "Installa AJE sul computer", solo se `beforeinstallprompt` è disponibile e l'app non è installata;
  - separatore `white/14`;
  - email dell'utente (13px, `white/80`, con ellissi se troppo lunga);
  - pulsante tema (44px cerchio `white/10`).
- Su desktop niente "Altro", niente pulsanti indietro, niente sub-tab: le viste affiancate diventano griglie.

### 6.3 Transizione di pagina
Wrappa `<Routes>` in un contenitore che, a ogni cambio di `location.pathname`, applica un'entrata: opacity 0→1 (350ms) e transform (500ms standard). Su mobile il transform è `translateX(±28px)`: +28px quando la destinazione è più a destra nell'ordine della barra, −28px quando è più a sinistra. Su desktop è `translateY(14px)`. Implementalo con una `key={pathname}` e un'animazione CSS di entrata; non servono uscite animate.

### 6.4 Fogli e dialog (`Sheet` in `src/components/ui.tsx`)
Riscrivi `Sheet` mantenendo la stessa API (`open`, `onClose`, `title`, `children`) e aggiungi `footer?: ReactNode`.
- **Mobile:** bottom sheet, `max-height: 92dvh`, raggio 28px in alto, maniglia 40×5px `--border` a 10px dal bordo superiore.
  - Header senza bordo: titolo 18px/600 a sinistra, chiudi 44px (`bg-card-2`, `aria-label="Chiudi"`) a destra.
  - Contenuto scrollabile; footer sticky in fondo con `padding-bottom: calc(env(safe-area-inset-bottom) + 20px)`.
  - Entrata `translateY(105%)→0` (500ms `--ease-sheet`); backdrop `rgb(0 0 0 / .4)` in fade 400ms.
  - Mentre è aperto, il contenitore dell'app (`.app-main`) va a `transform: scale(.94) translateY(8px); border-radius: 28px; overflow: hidden` con la stessa curva.
- **Desktop:** dialog centrato, larghezza 460px, `max-height: min(760px, 92dvh)`, raggio 28px, entrata con opacity e `scale(.97)→1` (300ms e 500ms). Nessuna scala sull'app.
- In entrambi: Esc chiude, focus trap, focus iniziale sul primo campo, `role="dialog" aria-modal="true" aria-labelledby`. Per animare anche l'uscita, il componente resta montato 500ms dopo `open=false`.

### 6.5 Toast globale (nuovo `src/components/Toast.tsx` + context)
- Aspetto: bg `--text`, testo `--bg`, raggio 18px, padding 14px 18px, 14px. A sinistra `CircleCheck` 20px `#6fe0b0`, a destra "Annulla" sottolineato 600, solo se viene passato `onUndo`.
- Posizione: mobile `bottom: calc(env(safe-area-inset-bottom) + 96px)` (sopra la barra), desktop `bottom: 24px`, `max-width: 440px`, centrato.
- Entrata `translateY(40px)→0` più fade; resta 4200ms e poi esce da solo. Aggiungi `aria-live="polite"`.
- API: `toast({ text, onUndo? })`.

### 6.6 Banner offline (`OfflineBanner.tsx`)
Mantieni la logica esistente e cambia solo lo stile:
- pill flottante in alto: `top: calc(env(safe-area-inset-top) + 8px)` su mobile, 16px su desktop; `left/right: 16px`, `max-width: 560px`, raggio 14px, padding 10px 14px, 13px/500;
- offline: `--warn-bg`/`--warn-text`; sincronizzazione: `--accent-soft`/`--accent`;
- entrata `translateY(-120px)→0` (500ms standard);
- testi invariati.

---

## 7. Schermate

Per ogni schermata: layout mobile, poi le differenze su desktop. I testi tra virgolette sono **copy definitivo**, salvo i nomi da mantenere per i test (§9).

### 7.1 Login (`src/modules/auth/LoginPage.tsx`)
- Sfondo `--bg`, colonna a tutta altezza. Su desktop è centrata con `max-width: 420px` e padding verticale 8vh.
- Wordmark scuro, alto 34px, a 60px dall'alto (invertito in scuro).
- Titolo "Bentornato." 38px/600; sotto "Accedi per vedere conti, agenda e documenti." 15px `--muted`.
- Campi (a 30px dal testo), con **label visibili "Email" e "Password"** (14px/500 `--muted`): input 52px, raggio 14px, `bg-card`, bordo `--border`.
  - Nel campo password, a destra, un pulsante testuale `--accent` "Mostra/Nascondi" con `aria-label="Mostra password"` / "Nascondi password".
- "Password dimenticata?" allineato a destra, `--accent` 14px/600.
- In fondo, spinto giù da `flex:1`:
  - CTA "Accedi" (56px, raggio 18px, `--accent`);
  - "Accedi con passkey" (56px, bordo, `Fingerprint`);
  - nota 13px centrata: "La passkey usa Face ID, l'impronta o il PIN del dispositivo. Hai un invito? Apri il link ricevuto via email."
- Errore: mantieni il testo esistente "Accesso non riuscito: controlla email e password." sotto i campi, in `--expense`.
- Vista "Recupera la password" (usa il flusso esistente): titolo 34px, spiegazione "Ti mandiamo un link per sceglierne una nuova.", email, conferma "Link inviato. Controlla anche lo spam." su `--brand-soft` (entrata fade + translateY 8px), CTA "Invia il link" / "Invia di nuovo", secondaria "Torna all'accesso".
- Non aggiungere la registrazione (il test verifica che non ci sia).

### 7.2 Home (`src/modules/home/HomePage.tsx`)
Su mobile è una colonna unica. Su desktop è una griglia `repeat(auto-fit, minmax(min(100%, 380px), 1fr))` con `column-gap: 64px`: a sinistra i blocchi 3–5, a destra i blocchi 6–8.
1. **Header** (riga, gap 12px):
   - a sinistra una colonna: su mobile il wordmark alto 24px, su desktop "Buongiorno" 34px/600; sotto, la data estesa ("Giovedì 24 settembre", 13px `--muted`, `Intl` it-IT, prima lettera maiuscola);
   - a destra il pulsante tema (44px cerchio, bordo `--border`) e l'avatar di Altro (solo mobile, §6.1).
2. **Banner di installazione PWA** (solo mobile; regole in §8.1):
   - riga con padding 14px, raggio 18px, bg `--brand-soft`;
   - icona app 40px raggio 10px; titolo "Installa AJE sul telefono" 15px/600; testo 13px `--muted`;
   - pulsante "Installa" (pill `--brand`, solo Android) e chiudi (40px, `X`).
3. **Patrimonio**: "Patrimonio · N conti" 14px `--muted`; saldo 58px, con i decimali separati e più piccoli (§4.2). Sotto, a 14px, due indicatori affiancati: pallino 8px `--income` + "+ 2.180,00 € entrate" e pallino `--expense` + "− 1.246,35 € uscite" (mese corrente).
4. **"Settembre, giorno per giorno"** (nome del mese dinamico):
   - a destra il giorno selezionato: "Oggi · 50,00 €" oppure "12 set · 38,00 €";
   - grafico di barre, una per ogni giorno del mese: gap 3px, altezza massima 104px, raggio 3px;
   - altezza proporzionale a √(spesa del giorno) / √(spesa massima del mese), minimo 4px; giorni futuri fissi a 4px in `--border`;
   - colori: passato `--brand`, selezionato `--accent`; ogni barra è un `<button aria-label="Giorno N">`, i giorni futuri non sono cliccabili;
   - assi 11px `--muted`: 1, 10, 20, ultimo giorno;
   - entrata: altezza 0→valore, 700ms standard, stagger 18ms × indice. Oggi è selezionato di default.
   - Sostituisce il grafico recharts attuale della Home. Recharts può restare altrove.
5. **"Puoi spendere ancora oggi"**:
   - riga con `border-block: 1px --border` e padding 18px 0; a sinistra etichetta 14px `--muted` e valore 26px/600 `--income` "35,87 € al giorno"; a destra, 13px `--muted`, "251,11 € nei budget / per 7 giorni";
   - valore = (somma dei limiti dei budget del mese − speso nelle categorie con budget) / giorni rimanenti, oggi incluso;
   - senza budget la riga non compare; sotto zero il valore va in `--expense` con il testo "Hai superato i budget di X".
6. **"Ultimi movimenti"**: link "Tutti" (`--accent` 14px/600) che porta a `/finanze`; 4 righe movimento (§7.3.1).
7. **"Da fare oggi"**: attività aperte con scadenza ≤ oggi, nel formato riga attività di §7.5. Le attività completate oggi restano visibili, barrate. Se non ce ne sono, la sezione non compare.
8. **"Chiedi ad AJE"**: chip su una riga scrollabile orizzontalmente, senza scrollbar visibile, fino ai bordi dello schermo. Ogni chip è alto 44px, con padding 0 14px, bg `--accent-soft`, testo `--accent` 14px/500.
   - Domande: "Quanto ho speso in ristoranti?", "Report di agosto", "Posso permettermi il Giappone?". Il mese precedente e l'obiettivo sono dinamici.
   - Il tap apre `/assistente` e invia la domanda.
- Se in Home c'era `WhatIfCard` o un altro blocco, spostalo sotto il blocco 8, senza card e con titolo sezione 15px/600.

### 7.3 Finanze (`src/modules/finance/FinancePage.tsx` e le viste)
- Header: "Finanze" 34px/600, a destra il mese "Settembre 2026" 14px `--muted` con i chevron del selettore mese se esiste già.
- **Mobile**:
  - sub-tab sticky sotto l'header: Movimenti · Budget · Obiettivi · Conti, 4 colonne uguali, altezza 48px, 14px, attiva 600 `--text`, inattive 500 `--muted`, bordo inferiore 1px;
  - indicatore di 2px `--text`, largo 25%, che scorre (`left` 400ms standard);
  - contenuto in un binario orizzontale largo 400% che trasla di `-25% × indice` (500ms standard); i pannelli non attivi vanno a opacity 0;
  - le altre viste esistenti (Categorie, Import, Diario) restano raggiungibili dal menu che hanno oggi, restilizzate come fogli.
- **Desktop**: niente sub-tab; griglia `minmax(0,1.3fr) minmax(0,1fr)` con gap 32px; a sinistra Movimenti (`grid-row: span 3`), a destra Budget, Obiettivi e Conti impilati, ognuno con titolo sezione 15px/600 a 24px dal blocco precedente.

#### 7.3.1 Riga movimento (componente condiviso `TransactionRow`)
- Altezza 64px, gap 14px. Area di evidenziazione: `margin-inline: -10px; padding-inline: 10px`, raggio 14px.
- Icona: cerchio 40px con bg = colore categoria all'12% di opacità (`color-mix(in srgb, <colore> 12%, transparent)`), icona 20px nel colore della categoria.
- Testo: titolo 15px/500 con ellissi (descrizione oppure nome della categoria); sotto "Categoria · Conto" 13px `--muted`.
- Importo 15px/600 tabular: le uscite "− 46,80 €" in `--text`, le entrate "+ 1.980,00 €" in `--income`. Il segno usa il carattere U+2212 "−" seguito da uno spazio.
- **Movimenti:** raggruppati per giorno. Intestazione di gruppo 13px: a sinistra 600 `--muted` ("Oggi", "Ieri", "22 settembre"), a destra il totale netto del giorno. Margine sopra il gruppo 18px.

#### 7.3.2 Budget (`BudgetsView.tsx`)
- In alto "Budget del mese" 14px `--muted`, poi "668,89 € di 920,00 €" 30px/600.
- Per ogni budget, padding 18px 0 e bordo inferiore:
  - riga con icona categoria 20px colorata, nome 15px/500 e a destra "286,40 € / 400,00 €" 14px;
  - barra di 8px con raggio 4px su `--card-2`: `--brand` normale, `--warning` da 85%, `--expense` oltre il 100%;
  - nota 13px: "Restano X" in `--muted` oppure "Superato di X" in `--expense`.
- Entrata: la larghezza della barra passa da 0 al valore (900ms standard, stagger 90ms) quando la vista diventa visibile.

#### 7.3.3 Obiettivi (`GoalsView.tsx`)
- Per ogni obiettivo, padding 20px 0 e bordo inferiore: nome 17px/600, a destra la scadenza 14px `--muted` ("dic 2027" oppure "senza scadenza").
- Percentuale 32px/600, accanto "1.850,00 € di 4.000,00 €" 14px `--muted`.
- Barra di 8px `--brand`, animata come quelle dei budget (1s, stagger 120ms).
- Pulsante "Aggiungi risparmio": pill 44px, bordo `--border`, 14px/500.

#### 7.3.4 Conti (`AccountsView.tsx`)
- Riga di 72px con bordo inferiore:
  - icona 44px con raggio 12px, bg `--brand-soft`, colore `--brand`: `Landmark` per la banca, `CreditCard` per la carta, `Banknote` per i contanti;
  - nome 15px/500 e tipo 13px `--muted`;
  - saldo 16px/600.
- Sotto: "Trasferisci tra conti" (48px, raggio 14px, bordo, `ArrowLeftRight`), che usa il flusso esistente.

### 7.4 Nuovo movimento (`TransactionSheet.tsx`, dentro `Sheet`)
Dall'alto verso il basso:
1. Titolo "Nuovo movimento" (su mobile il foglio parte già al 92% di altezza).
2. **Segmented Uscita / Entrata**:
   - contenitore con padding 4px, raggio 14px, bg `--card-2`, 2 colonne; pulsanti di 44px, 15px/600;
   - indicatore assoluto largo `calc(50% - 4px)`, raggio 10px, bg `--expense` per Uscita e `--income` per Entrata; si sposta con `left` (400ms spring) e cambia colore (300ms);
   - testo attivo `#fff`, inattivo `--muted`.
3. **Importo** centrato, 52px/600, margine sopra 18px.
   - Inserimento stile POS: parte da "0,00 €" in `--muted`, ogni cifra entra dai centesimi; "00" aggiunge due zeri, "⌫" toglie l'ultima cifra; massimo 999.999,99.
   - Con un valore diverso da zero il colore è `--text` per le uscite e `--income` per le entrate.
4. **Categorie**: chip su una riga scrollabile orizzontalmente, filtrate per tipo (uscita/entrata), dal database.
   - Chip: altezza 40px, padding `0 14px 0 10px`, bordo 1.5px `--border`, icona 18px nel colore della categoria + nome 14px/500.
   - Chip selezionata: bordo `--text`, bg `--card-2` (250ms).
5. **Descrizione e conto**, in una griglia `1fr auto` con gap 8px:
   - input "Descrizione (facoltativa)" alto 44px, raggio 12px;
   - pulsante del conto alto 44px, con l'icona del conto e il nome, che passa al conto successivo a ogni tocco. Se oggi è un `<select>`, restilizzalo con lo stesso aspetto.
6. **Meta** 13px `--muted`: "Oggi, 24 set · EUR · Nessuna ricorrenza". Ogni voce è toccabile e apre il controllo che esiste già (data, valuta, ricorrenza).
7. **Tastierino** 3×4: 1–9, 00, 0, ⌫ (`aria-label="Cancella"`).
   - Tasti trasparenti, 26px/500, righe `minmax(44px, 1fr)`; da premuto bg `--card-2` e `scale(.94)`.
   - Se lo schermo è basso, **il foglio scorre**: i tasti non si schiacciano sotto i 44px.
   - Su desktop e sui dispositivi con tastiera fisica il tastierino resta, e in più: le cifre e Backspace sulla tastiera fisica inseriscono o cancellano (quando il focus non è in un input), Invio salva, Esc chiude.
8. **Footer**: CTA larga 56px, raggio 18px: "Salva uscita · 12,50 €" / "Salva entrata · …". Con importo 0 il testo è "Inserisci un importo".
- **Validazione:** salvare con importo 0 fa tremare l'importo in orizzontale (8, −8, 6, −6, 0 px, 60ms per passo) e non salva. Gli altri controlli esistenti restano invariati.
- **Dopo il salvataggio** (è il cuore dell'animazione "intelligente"):
  1. il foglio si chiude;
  2. dopo 380ms la nuova riga in cima alla lista (Home e Finanze) si apre passando da altezza 0 a 64px (450ms standard), con bg `--accent-soft` che sfuma a trasparente in 1400ms;
  3. dopo 450ms il saldo della Home scorre dal vecchio al nuovo valore in 900ms (easeOutCubic, con `requestAnimationFrame`);
  4. la barra di oggi nel grafico, le barre dei budget e i saldi dei conti si aggiornano con le loro transizioni;
  5. toast "Uscita di 12,50 € salvata" con **Annulla**, che cancella il movimento (riusa la cancellazione esistente, compatibile con la coda offline) e fa scorrere il saldo indietro.

### 7.5 Agenda (`src/modules/agenda/AgendaPage.tsx`, `TaskSheet.tsx`)
- Header: "Agenda" 34px/600; su mobile, a destra, il segmented Attività/Calendario (pulsanti di 40px, 13px/600, indicatore bg `--card` con ombra leggera che scorre). Sotto il titolo il riepilogo "6 da fare · 1 in ritardo" 14px `--muted`.
- **Mobile:** binario orizzontale largo 200% (come Finanze). **Desktop:** due colonne `1fr 1fr` con gap 32px, senza segmented. Qui `.agenda-layout` e `.agenda-panel` diventano senza bordo, senza ombra e senza sfondo.
- **Elenco attività:**
  - gruppi, a 22px di distanza l'uno dall'altro: "In ritardo" (etichetta `--expense`), "Oggi", "Prossimi giorni", "Senza data"; intestazione 13px/600 con il conteggio a destra in `--muted`;
  - riga attività alta 60px con bordo inferiore:
    - checkbox rotonda 26px con bordo 2px `--border`; da completata ha bg e bordo `--income`, `Check` bianco 16px e `scale(1.08)` (300ms standard);
    - titolo 15px, che da completato diventa barrato con opacity .5;
    - meta 13px: "Domani · 10:00", "sab 26 set · 20:30", "In ritardo · ieri" (quest'ultima in `--expense`), "Fatto".
- **Calendario:**
  - intestazione "Settembre 2026" 17px/600 con i chevron 44px; giorni della settimana "L M M G V S D" 12px/500 `--muted`;
  - griglia di 7 colonne con celle alte 46px e giorno in un cerchio di 36px; offset iniziale in base al giorno della settimana, con lunedì come primo;
  - stati: selezionato bg `--text` e testo `--bg` 600; oggi (se non selezionato) anello interno 1.5px `--accent`; giorni passati `--muted`;
  - pallino di 4px sotto il numero (`--brand`, `--accent` se il giorno è selezionato) se il giorno ha attività aperte;
  - sotto la griglia, dopo un divisore: "Oggi · gio 24 settembre" 15px/600 e le attività del giorno;
  - stato vuoto: "Niente in programma. Tocca + per aggiungere un'attività a questo giorno." (su desktop "Usa Nuova attività per…").
- **TaskSheet** "Nuova attività":
  - campo titolo alto 56px, 18px/500, placeholder "Cosa devi fare?"; da vuoto va in errore con bordo `--expense` e tremolio;
  - "Quando": chip (Oggi, Domani, il prossimo sabato, Senza data, più il datepicker esistente); "Orario": chip (Nessun orario, 09:00, 15:30, 20:00, più il timepicker);
  - nota "Ti avviso con una notifica il giorno stesso" (`Bell`), visibile solo se le push sono attive;
  - CTA "Aggiungi all'agenda";
  - dopo il salvataggio: la riga si apre ed è evidenziata come nel §7.4, toast "Attività aggiunta: domani".

### 7.6 Documenti + PDF (`DocumentsPage.tsx`, `GeneratePdfCard.tsx`, `*ConfirmSheet.tsx`)
- Header: "Documenti", sottotitolo "Buste paga, scontrini e PDF generati".
- Layout: mobile in colonna; da 1024px griglia a due colonne con il generatore PDF a sinistra e l'archivio a destra (si possono riusare le classi `.document-*` esistenti, **senza card**).
- **Crea PDF**. **Mantieni l'heading "Crea un documento PDF"**, perché il test lo cerca.
  - Indicatore a 4 passi (Fonte, Formato, Genera, Anteprima): segmenti di 4px con raggio 2px che si riempiono di `--accent` (500ms); label 12px, quella del passo attivo 600 `--text`.
  - I passi scorrono in orizzontale in un binario largo 400%.
  - Passo 1 "Fonte": 3 opzioni a righe di 64px con radio 22px (il pallino interno entra con pop): Testo scritto / Video YouTube pubblico / Documento archiviato. **Il controllo accessibile deve restare un `<select aria-label="Fonte">` con i valori `text|youtube|document`** (il test usa `selectOption`). Si può mostrare la lista come radio visive e tenere il select collegato e nascosto visivamente (`sr-only`), oppure aggiornare il test nella stessa PR. Sotto compare il campo che corrisponde alla fonte scelta (label esistenti: "Testo o istruzioni", "Link YouTube", "Documento dell’archivio").
  - Passo 2 "Formato": chip (Riassunto, Appunti di studio, Report, Spiegazione semplice). **Stessa regola per `<select aria-label="Formato">`**, che usa i valori esistenti (per esempio `sintesi`).
  - Passo 3 "Genera": percentuale grande 44px, messaggio di stato 14px `--muted`, barra di 6px `--accent`. **Il pulsante resta "Genera documento".**
  - Passo 4 "Anteprima": **heading "Anteprima PDF"**. Foglio bianco `#fffefa` con raggio 6px, ombra §4.5 e padding 22px 20px, che entra con translateY(20px) e scale .96→1 (600ms). Il campo "Titolo" resta modificabile. Azioni: "Scarica PDF" (CTA), "Salva nell’archivio privato", che dopo il salvataggio mostra "Salvato nell’archivio", e "Ricomincia".
- **Archivio:**
  - titolo sezione con il conteggio a destra; filtri a pill (Tutti, Buste paga, Scontrini, Altro), alti 40px; quella attiva bg `--text` e testo `--bg`;
  - riga documento alta 72px: icona 44px con raggio 12px su `--brand-soft`, nome 15px/500 con ellissi, meta 13px (in `--expense` se c'è un errore);
  - chip di stato 12px/600 con raggio 10px: "Analizzato" (`--brand-soft`/`--brand`), "Caricato" (`--card-2`/`--muted`), "Non leggibile" (`--expense` al 14%/`--expense`).
- **Carica documento**: dal "+" su mobile e dalla CTA della sidebar su desktop, dentro `Sheet`.
  - Tipi, **mantenendo i nomi dei pulsanti "Busta paga…", "Scontrino…", "Documento Spiegazione AI"** usati dai test: righe di 68px con bordo 1.5px; quella selezionata ha bordo `--text` e bg `--card-2`.
  - Azioni: su mobile "Scatta foto" (`<input type="file" accept="image/*" capture="environment">`) e "Scegli file"; su desktop solo "Scegli un file dal computer", più il drag & drop su tutta la pagina Documenti. **L'`input[type=file]` deve restare nel DOM** (il test usa `setInputFiles`).
  - Nota: "La lettura automatica usa la tua chiave Gemini; senza chiave il file viene solo archiviato."
  - Avanzamento: percentuale 44px con i messaggi "Carico il file cifrato…" e "Leggo il documento…".
  - Risultato: spunta 52px su `--brand-soft`, titolo 20px, riepilogo, CTA. Per busta paga e scontrino apre i `PayslipConfirmSheet` / `ReceiptConfirmSheet` esistenti, restilizzati.

### 7.7 Altro — nuova rotta `/altro`, solo mobile (`src/modules/more/MorePage.tsx`)
- Titolo "Altro". Blocco account: avatar 56px, email 17px/600, ruolo 13px `--muted` ("proprietario" oppure "ospite"), bordo inferiore.
- Righe di 72px (icona 24px, titolo 16px/500, sottotitolo 13px, `ChevronRight`), come `<Link>`:
  - Assistente AI → `/assistente` ("Gemini · chiave personale attiva" oppure "Chiave non impostata");
  - Carburanti → `/carburanti`;
  - Impostazioni → `/impostazioni` ("Ospite, chiavi, tema, offline");
  - Guida → `/guida` ("Come fare le cose in AJE").
- "Esci" in `--expense` con `LogOut`; versione dell'app 12px `--muted`.
- Su desktop `/altro` reindirizza a `/impostazioni`.

### 7.8 Assistente (`AssistantPage.tsx`)
- Header: "Assistente", sotto lo stato con un pallino 8px `--income`: "Gemini · chiave personale attiva". Senza chiave vedi lo stato in `AJE Stati`.
- Stato vuoto: frase 17px "Chiedimi dei tuoi soldi, dei documenti o dell'agenda. Rispondo usando i tuoi dati." e 3 suggerimenti come nella Home, in colonna.
- Messaggi:
  - utente allineato a destra: bg `--accent`, testo bianco, raggio `20 20 6 20`, `max-width: 84%`, padding 12px 16px, 15px/1.5;
  - AJE allineato a sinistra: bg `--card-2`, raggio `20 20 20 6`;
  - entrata di ogni messaggio: opacity e translateY(12px→0) in 500ms;
  - attesa: "AJE sta controllando i tuoi dati…" con `Sparkles`;
  - dopo ogni messaggio scroll morbido fino in fondo.
- Composer flottante (`.assistant-composer`):
  - su mobile `left/right: 16px`, `bottom: calc(env(safe-area-inset-bottom) + 14px)` (la barra è nascosta); su desktop centrato con max 720px;
  - alto 58px, raggio 29px, bg `--card`, bordo, ombra §4.5;
  - input 15px; pulsanti microfono e **"Parla"** (mantieni l'esistente, usato dai test); invio 46px `--accent`, che passa da scale .85 a 1 quando c'è del testo.
- Le azioni dell'assistente esistenti (`assistantActions`) restano invariate.

### 7.9 Carburanti (`FuelPage.tsx`)
- "Costo per km · settembre" 14px `--muted`; poi "0,112 €" 58px/600 con "/km" 20px `--muted`; il delta "−8% rispetto ad agosto" è in `--income` se migliora, `--expense` se peggiora.
- Tre statistiche in griglia a 3 colonne, con `border-block` e divisori verticali: Speso / Rifornimenti / Km percorsi (label 12px, valore 17px/600).
- "Prezzo pagato al litro": una barra per ognuno degli ultimi 6 rifornimenti, altezza proporzionale al prezzo nell'intervallo min–max, raggio 6px, l'ultima in `--accent`; valore sopra 11px/600, data sotto; altezza animata con stagger 70ms.
- "Distributori vicini":
  - segmented Benzina/Diesel/GPL (come quello dell'Agenda);
  - mappa Leaflet esistente alta 130px su mobile e più alta su desktop, raggio 16px, bordo;
  - lista a righe di 64px: nome, "Self · 0,4 km", prezzo 17px/600 con 3 decimali, tag "più economico" 12px/600 `--income` sul primo.
- CTA "Registra rifornimento" (`Fuel`), che apre `TransactionSheet` con categoria Trasporti e descrizione "Rifornimento".
- Desktop: due colonne, come le `.fuel-layout` esistenti.

### 7.10 Impostazioni (`SettingsPage.tsx`, `InvitesPanel.tsx`, `IntegrationsPanel.tsx`)
- Sottotitolo "Tocca una sezione per aprirla". Le sezioni diventano un **accordion**.
  - Riga di 64px: icona 22px `--brand`, titolo 16px/500, riepilogo a destra 13px `--muted`, `ChevronDown` che ruota di 180°.
  - Il contenuto si apre con max-height e opacity (500ms standard), con rientro sinistro di 36px. `aria-expanded` sul pulsante.
- Sezioni e riepiloghi:
  - Account (email)
  - Ospite ("Nessuno" / "Invito inviato")
  - Chiavi e integrazioni ("1 di 4 attive")
  - Aspetto ("Chiaro" / "Scuro" / "Sistema")
  - Notifiche ("Attive" / "Spente")
  - Offline ("Sincronizzato" / "N in attesa" in `--warning`)
- Righe interne alte 52px: label 15px + sottotitolo 13px; a destra un pulsante pill 40px, un chip di stato oppure uno switch.
- **Switch**: 52×32 con padding 3px; traccia `--brand` quando è attivo e `--border` quando è spento; pomello bianco 26px con ombra, che si sposta di 20px con spring 350ms; `role="switch"` con `aria-checked`.
- **Notifiche push** (vedi §8.2).
- **Mantieni heading e label dei test:** "Le mie integrazioni", "Utenti e inviti", "Gemini", "Email dell’ospite", "Genera invito", "Link personale dell’invito".
  - Per non romperli, le sezioni che li contengono si aprono di default, oppure il contenuto resta nel DOM anche da chiuso. Soluzione consigliata: accordion con `hidden="until-found"`, altrimenti contenuto sempre montato e nascosto con max-height 0. `getByRole` deve trovarli **visibili**, quindi apri di default "Chiavi e integrazioni" e "Ospite".
- Il contenitore `.settings-layout` resta e contiene i link Carburanti e Assistente, che il test cerca lì. Su mobile mettili in cima come due righe link "Vai a…", oppure aggiorna il test (vedi §9).

### 7.11 Guida (`GuidePage.tsx`)
- Ricerca: campo alto 48px con raggio 14px, `Search`, placeholder "Cerca: spesa, PDF, ospite…".
- Filtri a pill per categoria (Tutte, Finanze, Documenti, Agenda, Account).
- Voci a fisarmonica: riga di 60px con domanda 15px/500 e categoria 12px `--muted`; `Plus` che ruota di 45°; risposta 14px/1.55 `--muted`.
- Aggiungi la voce **"Installare AJE sul telefono"** con le istruzioni di §8.1.
- Nessun risultato: "Nessun risultato per “…”. Prova con “spesa”, “PDF” o “offline”."

### 7.12 Stati (`AJE Stati.dc.html`)
Ogni stato dice cosa è successo e cosa fare dopo, con una sola azione primaria.
- **Home vuota:** saldo 0,00 € in grigio, barre piatte, "Iniziamo dal tuo conto" + spiegazione; CTA "Aggiungi un conto", secondaria "Oppure importa un CSV della banca" (`ImportSheet`).
- **Caricamento:** skeleton con la stessa forma del contenuto. Colore `#ebe8df` (scuro: `--card-2`), shimmer leggero solo senza reduced-motion. Sostituisce `FullPageSpinner` dentro le pagine; resta solo per il caricamento dell'autenticazione.
- **Errore di rete:** icona `TriangleAlert` 40px `--expense`, "Non riesco a caricare i movimenti", spiegazione; CTA "Riprova", sotto "Ultimo aggiornamento riuscito: oggi alle 12:40".
- **Offline:** banner (§6.6) più l'elenco delle modifiche in coda (`Clock` `--warning`) e l'avvertenza "Non cancellare i dati del sito…".
- **Chiave API mancante (Assistente):** `KeyRound` `--accent`, "Serve la tua chiave Gemini"; CTA "Aggiungi la chiave" (porta a Impostazioni → Chiavi), secondaria "Come ottenerla".
- **Documento non leggibile:** anteprima, "Non riesco a leggere…", 3 consigli; CTA "Scatta di nuovo", secondaria "Inserisci i dati a mano".
- **Conferma:** toast (§6.5).
- **Ospite sospeso** (`MembershipGate`): `Lock`, "Il tuo accesso è sospeso" + spiegazione; pulsante "Esci" con bordo.
- `EmptyState` in `ui.tsx`: restilizzalo con icona 36px nel colore del contesto, titolo 20px/600, hint 14px/1.55 e una CTA opzionale (aggiungi le prop `action?`, `onAction?`).

---

## 8. Comportamenti da web app (PWA)

### 8.1 Installazione (nuovo hook `src/lib/install.ts`)
- Installata se `matchMedia('(display-mode: standalone)').matches` oppure se `navigator.standalone === true`. In questo caso non mostrare nulla.
- **Android/Chrome e desktop:** intercetta `beforeinstallprompt` (`preventDefault`, salva l'evento); "Installa" chiama `prompt()`; su `appinstalled` il banner si nasconde e compare il toast "AJE installata".
- **iOS Safari** (UA iPhone/iPad, niente `beforeinstallprompt`): nessun pulsante, solo il testo "In Safari tocca Condividi e poi “Aggiungi alla schermata Home”: si apre a tutto schermo e può inviarti notifiche."
- Testo Android: "Aprila a tutto schermo come un’app e ricevi i promemoria come notifiche."
- La chiusura si ricorda in `localStorage` (`aje-install-dismissed`, per 30 giorni).
- `index.html`: aggiorna `theme-color` a `#f6f4ed` (chiaro) e `#081b19` (scuro); nel manifest di `vite.config.ts` metti `theme_color` e `background_color` a `#07382f`. Non toccare la CSP.

### 8.2 Notifiche push (riusa `src/lib/push.ts`)
- Il permesso si chiede **solo dopo un tocco** su "Consenti" in Impostazioni → Notifiche, mai al caricamento.
- Su iOS senza installazione: la riga dice "Su iPhone funzionano solo con AJE installata sulla schermata Home" e il pulsante "Come fare" porta a `/guida?q=install`.
- Permesso negato: chip "Bloccate", con la spiegazione "Riattivale dalle impostazioni del browser".

### 8.3 Fotocamera e file
Vedi §7.6. Su desktop non mostrare "Scatta foto".

### 8.4 Passkey
Riusa `src/lib/passkeys.ts`. Se WebAuthn non è disponibile, nascondi "Accedi con passkey".

### 8.5 Safe area
Già presenti `pt-safe` e `pb-safe`. Aggiungi le proprietà `calc(env(...) + X)` indicate nelle sezioni sopra. `index.html` ha già `viewport-fit=cover`.

---

## 9. Impatto sui test e2e (`tests/e2e/*.spec.ts`)
Nomi e controlli da **mantenere**:
- Login: label "Email" e "Password", pulsanti "Accedi" e "Mostra password", testo "Accesso non riuscito: controlla email e password.", nessun pulsante per registrarsi.
- `navigation "Navigazione desktop"` con il link "Impostazioni".
- Link "Agenda" e "Documenti"; in Agenda l'heading "Calendario" (desktop) o il pulsante "Calendario" (mobile).
- Documenti: pulsanti /Busta paga/, /Scontrino/, "Documento Spiegazione AI"; `input[type=file]`; heading "Crea un documento PDF"; select "Fonte" e "Formato"; campi "Link YouTube", "Testo o istruzioni", "Documento dell’archivio", "Titolo"; pulsanti "Genera documento", "Scarica PDF", "Salva nell’archivio privato" / "Salvato nell’archivio"; heading "Anteprima PDF"; pulsante "Chiudi"; testo "Fonte documento: …".
- Impostazioni: heading "Le mie integrazioni", "Gemini", "Utenti e inviti"; `.settings-layout` con i link "Carburanti" e "Assistente"; campi dell'invito ospite.
- Assistente: pulsante "Parla".

Da **aggiornare** nella stessa PR:
- `auth.spec.ts` ~r.240: su mobile "Altro" non è più un link dentro `navigation "Navigazione principale"`. Sostituisci con `page.getByRole('link', {name: 'Altro'}).click()` (l'avatar in Home) e poi il link "Impostazioni" in `/altro`.
- Se sposti i link Carburanti/Assistente fuori da `.settings-layout` (r.138, r.234), aggiorna quei selettori.

Esegui prima `grep -rn "getBy\|locator(" tests/` per rivedere la lista completa: sono circa 115 occorrenze. Dopo ogni fase lancia `npm run test:e2e`.

---

## 10. Ordine di lavoro (una PR per fase)
1. **Fondamenta:** `tokens.css` in `index.css`, font Geist (`@fontsource-variable/geist`), variabili di movimento, `prefers-reduced-motion`, `theme-color`.
2. **Componenti condivisi:** `Sheet` (§6.4), `Toast` + provider (§6.5), `TransactionRow`, `TaskRow`, `Segmented`, `Switch`, `Chip`, `Skeleton`, `EmptyState`, `PageHeader` (titolo sans 34px, senza bordo né blur su mobile; su desktop resta sticky e trasparente).
3. **Shell:** `TabBar` (barra flottante + sidebar + CTA contestuale), transizione di pagina, rotta `/altro` + `MorePage`, `OfflineBanner`, aggiornamento dei test e2e sulla nav.
4. **Home.**
5. **Finanze + TransactionSheet + animazione di salvataggio/annulla.**
6. **Agenda + TaskSheet.**
7. **Documenti + PDF + caricamento.**
8. **Assistente, Carburanti, Impostazioni, Guida, Login.**
9. **PWA:** installazione, push, stati vuoti ed errori.

---

## 11. Controlli finali (per ogni PR)
- [ ] `npm run lint` · `npm test` · `npm run build` · `npm run test:e2e` tutti verdi
- [ ] Nessuna funzionalità esistente rimossa (§2.1)
- [ ] Verifica a 375×812, 430×932, 1024×768 e 1440×900, in chiaro e in scuro
- [ ] Nessun contenuto nascosto sotto la barra flottante; safe area corretta su iPhone
- [ ] Contrasto del testo ≥ 4.5:1; target ≥ 44px; focus visibile; Esc chiude i fogli
- [ ] Con `prefers-reduced-motion` restano solo i fade
- [ ] Offline: aggiunta e annullamento di un movimento funzionano e vanno in coda
- [ ] Nessuna richiesta a domini esterni nuovi (CSP invariata)

## 12. Asset
- `public/aje-wordmark-dark-v2.webp`, `public/aje-icon-v3.webp`: già nella repo.
- Font: `@fontsource-variable/geist` (npm).
- Icone: lucide-react (già installato).

## 13. File in questo pacchetto
- `README.md`: questa specifica
- `tokens.css`: blocco di variabili pronto per `src/index.css`
- `PROMPT_CLAUDE_CODE.md`: prompt da dare a Claude Code
- `ISTRUZIONI.md`: passi per chi consegna
- `AJE Web.dc.html`, `AJE App.dc.html`, `AJE Stati.dc.html`, `support.js`: prototipi di riferimento
- `screenshots/`: immagini di riferimento
- `public/`: logo e icona

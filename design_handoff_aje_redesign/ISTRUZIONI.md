# Come consegnare il redesign a Claude Code (app desktop)

Non serve usare il terminale: basta chiedere a Claude Code di eseguire i comandi al posto tuo.

## Una volta sola
1. Scarica e scompatta `design_handoff_aje_redesign.zip`.
2. Con Finder o Esplora risorse copia la cartella `design_handoff_aje_redesign` nella cartella principale del progetto `finanze-app`, accanto a `package.json`, `src` e `public`.
3. Apri **Claude Code desktop** e scegli la cartella `finanze-app` come progetto o cartella di lavoro.
4. Come primo messaggio scrivi:
   > Crea un branch `redesign/handoff`, aggiungi la cartella `design_handoff_aje_redesign` e fai un commit "Pacchetto design". Poi esegui `npm install` e `npm run build` e dimmi se va tutto bene.

   Quando Claude Code ti chiede il permesso di eseguire un comando, concedilo. Se vuoi evitare di confermare ogni volta, puoi scegliere l'opzione che consente sempre i comandi di questo progetto.

## Avviare il lavoro
5. In una **nuova conversazione**, sempre nello stesso progetto, incolla il contenuto di `PROMPT_CLAUDE_CODE.md`.
6. Claude Code ti mostrerà un piano per la fase 1: se ti va bene, rispondi "procedi".

## A ogni fase (sono 9)
7. Quando Claude Code si ferma e ti riassume il lavoro, chiedigli:
   > Avvia l'app in locale anche per il telefono e dammi i due indirizzi da aprire.

   Dietro le quinte usa `npm run dev -- --host`. Apri il primo indirizzo sul computer e il secondo sul telefono, con il telefono sulla stessa rete Wi-Fi.
8. Prova quello che ti indica, in tema chiaro e scuro.
   - Se qualcosa non va, scrivilo in parole semplici (per esempio "la barra in basso copre l'ultimo movimento"). Puoi trascinare uno screenshot direttamente nella chat.
   - Se va tutto bene, scrivi "ok, fai il merge su main e passa alla fase successiva". Se preferisci rivedere le modifiche su GitHub, chiedigli di aprire una pull request.
9. Quando la conversazione diventa molto lunga, aprine una nuova e scrivi:
   > Continua il redesign da dove eravamo: leggi `design_handoff_aje_redesign/README.md` e `git log`, poi passa alla prossima fase del §10.

## Consigli
- Non saltare le fasi: le prime tre (colori, componenti, navigazione) sono la base di tutte le altre.
- Se una fase diventa troppo lunga, chiedi a Claude Code di dividerla.
- Dopo la fase 3 installa l'app sul telefono (in Safari: Condividi → Aggiungi alla schermata Home) e provala da lì: è come la useranno davvero.
- Se Claude Code propone di togliere una funzionalità, di cambiare la sicurezza (CSP) o di aggiungere librerie grandi, chiedigli perché: il README dice di non farlo.

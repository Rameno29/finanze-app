import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/geist'
import './index.css'
import App from './App.tsx'

// Nessun reload forzato: può cancellare un modulo, una registrazione o un upload in corso.
// Il nuovo codice si carica alla successiva apertura/ricarica scelta dall'utente.

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Quando il nuovo service worker prende il controllo (nuova versione pubblicata),
// ricarica una sola volta la pagina così l'app usa subito il codice aggiornato.
// Risolve il problema delle web-app iOS che restano su una versione vecchia in cache.
if ('serviceWorker' in navigator) {
  let reloaded = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return
    reloaded = true
    window.location.reload()
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

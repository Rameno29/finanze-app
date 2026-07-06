import { useEffect } from 'react'
import { BrowserRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { PlayerProvider } from './context/PlayerContext'
import { TabBar } from './components/TabBar'
import { MiniPlayer } from './components/MiniPlayer'
import { FullPageSpinner } from './components/ui'
import { handleSpotifyCallback } from './lib/spotifyAuth'
import { LoginPage } from './modules/auth/LoginPage'
import { HomePage } from './modules/home/HomePage'
import { FinancePage } from './modules/finance/FinancePage'
import { AgendaPage } from './modules/agenda/AgendaPage'
import { DocumentsPage } from './modules/documents/DocumentsPage'
import { SettingsPage } from './modules/settings/SettingsPage'
import { GooglePage } from './modules/google/GooglePage'
import { MediaPage } from './modules/media/MediaPage'

function Shell() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()

  // Ritorno dal login Spotify (?code=...)
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('code')) {
      void handleSpotifyCallback().then((ok) => {
        if (ok) navigate('/media', { replace: true })
      })
    }
  }, [navigate])

  if (loading) return <FullPageSpinner />
  if (!session) return <LoginPage />

  return (
    <div className="min-h-dvh bg-bg">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/finanze" element={<FinancePage />} />
        <Route path="/agenda" element={<AgendaPage />} />
        <Route path="/documenti" element={<DocumentsPage />} />
        <Route path="/impostazioni" element={<SettingsPage />} />
        <Route path="/google" element={<GooglePage />} />
        <Route path="/media" element={<MediaPage />} />
        <Route path="*" element={<HomePage />} />
      </Routes>
      <MiniPlayer />
      <TabBar />
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <PlayerProvider>
          <BrowserRouter basename={import.meta.env.BASE_URL}>
            <Shell />
          </BrowserRouter>
        </PlayerProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

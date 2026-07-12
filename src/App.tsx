import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { PlayerProvider } from './context/PlayerContext'
import { TabBar } from './components/TabBar'
import { MiniPlayer } from './components/MiniPlayer'
import { FullPageSpinner } from './components/ui'
import { handleSpotifyCallback } from './lib/spotifyAuth'
import { LoginPage } from './modules/auth/LoginPage'
import { OfflineBanner } from './components/OfflineBanner'

const HomePage = lazy(() => import('./modules/home/HomePage').then((m) => ({ default: m.HomePage })))
const FinancePage = lazy(() => import('./modules/finance/FinancePage').then((m) => ({ default: m.FinancePage })))
const AgendaPage = lazy(() => import('./modules/agenda/AgendaPage').then((m) => ({ default: m.AgendaPage })))
const DocumentsPage = lazy(() => import('./modules/documents/DocumentsPage').then((m) => ({ default: m.DocumentsPage })))
const SettingsPage = lazy(() => import('./modules/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })))
const GooglePage = lazy(() => import('./modules/google/GooglePage').then((m) => ({ default: m.GooglePage })))
const MediaPage = lazy(() => import('./modules/media/MediaPage').then((m) => ({ default: m.MediaPage })))
const GuidePage = lazy(() => import('./modules/guide/GuidePage').then((m) => ({ default: m.GuidePage })))
const AssistantPage = lazy(() => import('./modules/assistant/AssistantPage').then((m) => ({ default: m.AssistantPage })))

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
      <OfflineBanner userId={session.user.id} />
      <Suspense fallback={<FullPageSpinner />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/finanze" element={<FinancePage />} />
          <Route path="/agenda" element={<AgendaPage />} />
          <Route path="/documenti" element={<DocumentsPage />} />
          <Route path="/impostazioni" element={<SettingsPage />} />
          <Route path="/google" element={<GooglePage />} />
          <Route path="/media" element={<MediaPage />} />
          <Route path="/guida" element={<GuidePage />} />
          <Route path="/assistente" element={<AssistantPage />} />
          <Route path="*" element={<HomePage />} />
        </Routes>
      </Suspense>
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

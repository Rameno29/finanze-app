import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { TabBar } from './components/TabBar'
import { FullPageSpinner } from './components/ui'
import { LoginPage } from './modules/auth/LoginPage'
import { OfflineBanner } from './components/OfflineBanner'
import { AuthCallbackPage } from './modules/auth/AuthCallbackPage'
import { MembershipGate } from './modules/auth/MembershipGate'

const HomePage = lazy(() => import('./modules/home/HomePage').then((m) => ({ default: m.HomePage })))
const FinancePage = lazy(() => import('./modules/finance/FinancePage').then((m) => ({ default: m.FinancePage })))
const AgendaPage = lazy(() => import('./modules/agenda/AgendaPage').then((m) => ({ default: m.AgendaPage })))
const DocumentsPage = lazy(() => import('./modules/documents/DocumentsPage').then((m) => ({ default: m.DocumentsPage })))
const SettingsPage = lazy(() => import('./modules/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })))
const GuidePage = lazy(() => import('./modules/guide/GuidePage').then((m) => ({ default: m.GuidePage })))
const AssistantPage = lazy(() => import('./modules/assistant/AssistantPage').then((m) => ({ default: m.AssistantPage })))
const FuelPage = lazy(() => import('./modules/fuel/FuelPage').then((m) => ({ default: m.FuelPage })))

function Shell() {
  const { session, loading } = useAuth()

  if (loading) return <FullPageSpinner />
  if (window.location.pathname.endsWith('/auth/callback')) return <AuthCallbackPage />
  if (!session) return <LoginPage />

  return (
    <MembershipGate key={session.user.id} userId={session.user.id}><div className="min-h-dvh bg-bg">
      <OfflineBanner userId={session.user.id} />
      <Suspense fallback={<FullPageSpinner />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/finanze" element={<FinancePage />} />
          <Route path="/agenda" element={<AgendaPage />} />
          <Route path="/documenti" element={<DocumentsPage />} />
          <Route path="/impostazioni" element={<SettingsPage />} />
          <Route path="/guida" element={<GuidePage />} />
          <Route path="/assistente" element={<AssistantPage />} />
          <Route path="/carburanti" element={<FuelPage />} />
          <Route path="*" element={<HomePage />} />
        </Routes>
      </Suspense>
      <TabBar />
    </div></MembershipGate>
  )
}

function SessionShell() {
  return <BrowserRouter basename={import.meta.env.BASE_URL}><Shell /></BrowserRouter>
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SessionShell />
      </AuthProvider>
    </ThemeProvider>
  )
}

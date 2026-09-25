import { lazy, Suspense, useRef, type CSSProperties } from 'react'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { TabBar } from './components/TabBar'
import { ToastProvider } from './components/Toast'
import { QuickActionProvider } from './components/QuickAction'
import { InstallWatcher } from './components/InstallBanner'
import { routeOrder } from './lib/navigation'
import { FullPageSpinner } from './components/ui'
import { PageSkeleton } from './components/Skeleton'
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
const MorePage = lazy(() => import('./modules/more/MorePage').then((m) => ({ default: m.MorePage })))

/** Entrata della pagina a ogni cambio di rotta: da destra o da sinistra secondo l'ordine della barra. */
function usePageDirection(pathname: string) {
  const previous = useRef(pathname)
  const direction = useRef(1)
  if (previous.current !== pathname) {
    direction.current = routeOrder(pathname) >= routeOrder(previous.current) ? 1 : -1
    previous.current = pathname
  }
  return direction.current
}

function Shell() {
  const { session, loading } = useAuth()
  const location = useLocation()
  const direction = usePageDirection(location.pathname)

  if (loading) return <FullPageSpinner />
  if (location.pathname === '/auth/callback') return <AuthCallbackPage />
  if (!session) return <LoginPage />

  return (
    <MembershipGate key={session.user.id} userId={session.user.id}><QuickActionProvider><div className="min-h-dvh bg-bg">
      <OfflineBanner userId={session.user.id} />
      <div className="app-main page-bottom bg-bg lg:pl-[264px]">
        <Suspense fallback={<PageSkeleton />}>
          <div
            key={location.pathname}
            className="page-enter"
            style={{ '--page-enter-x': `${direction * 28}px` } as CSSProperties}
          >
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/finanze" element={<FinancePage />} />
              <Route path="/agenda" element={<AgendaPage />} />
              <Route path="/documenti" element={<DocumentsPage />} />
              <Route path="/altro" element={<MorePage />} />
              <Route path="/impostazioni" element={<SettingsPage />} />
              <Route path="/guida" element={<GuidePage />} />
              <Route path="/assistente" element={<AssistantPage />} />
              <Route path="/carburanti" element={<FuelPage />} />
              <Route path="*" element={<HomePage />} />
            </Routes>
          </div>
        </Suspense>
      </div>
      <TabBar />
      <InstallWatcher />
    </div></QuickActionProvider></MembershipGate>
  )
}

function SessionShell() {
  return <BrowserRouter basename={import.meta.env.BASE_URL}><Shell /></BrowserRouter>
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <SessionShell />
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

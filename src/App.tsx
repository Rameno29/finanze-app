import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { TabBar } from './components/TabBar'
import { FullPageSpinner } from './components/ui'
import { LoginPage } from './modules/auth/LoginPage'
import { HomePage } from './modules/home/HomePage'
import { FinancePage } from './modules/finance/FinancePage'
import { AgendaPage } from './modules/agenda/AgendaPage'
import { DocumentsPage } from './modules/documents/DocumentsPage'
import { SettingsPage } from './modules/settings/SettingsPage'

function Shell() {
  const { session, loading } = useAuth()

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
        <Route path="*" element={<HomePage />} />
      </Routes>
      <TabBar />
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <Shell />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}

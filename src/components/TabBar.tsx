import { NavLink, useLocation } from 'react-router-dom'
import { Bot, BookOpen, CalendarDays, Download, FileText, Fuel, Home, Moon, Plus, Settings, Sun, Wallet } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { barColumn, isSecondaryRoute, quickActionLabel } from '../lib/navigation'
import { promptInstall, useInstallState } from '../lib/install'
import { useQuickActionTrigger } from './quickActionContext'

const MOBILE_TABS = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/finanze', label: 'Finanze', icon: Wallet },
  { to: '/agenda', label: 'Agenda', icon: CalendarDays },
  { to: '/documenti', label: 'Documenti', icon: FileText },
]

const DESKTOP_LINKS = [
  ...MOBILE_TABS,
  { to: '/assistente', label: 'Assistente AI', icon: Bot },
  { to: '/carburanti', label: 'Carburanti', icon: Fuel },
  { to: '/guida', label: 'Guida', icon: BookOpen },
  { to: '/impostazioni', label: 'Impostazioni', icon: Settings },
]

function useIsDark() {
  const { setting } = useTheme()
  return setting === 'dark' || (setting === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
}

/** Pulsante tema: alterna chiaro e scuro in modo esplicito. */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const { setSetting } = useTheme()
  const dark = useIsDark()
  const Icon = dark ? Sun : Moon
  return (
    <button
      type="button"
      onClick={() => setSetting(dark ? 'light' : 'dark')}
      aria-label={dark ? 'Passa al tema chiaro' : 'Passa al tema scuro'}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${className}`}
    >
      <Icon className="h-5 w-5" strokeWidth={1.9} />
    </button>
  )
}

export function TabBar() {
  const { pathname } = useLocation()
  const { session } = useAuth()
  const trigger = useQuickActionTrigger()
  const label = quickActionLabel(pathname)
  const column = barColumn(pathname)
  const hidden = isSecondaryRoute(pathname)
  const install = useInstallState()

  const [first, second, third, fourth] = MOBILE_TABS
  const mobileLink = ({ to, label: text, icon: Icon }: (typeof MOBILE_TABS)[number]) => (
    <NavLink
      key={to}
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `relative z-[1] flex flex-col items-center justify-center gap-1 text-[10.5px] font-semibold transition-colors duration-300 ${
          isActive ? 'text-white' : 'text-white/72'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon className="h-[23px] w-[23px]" strokeWidth={isActive ? 2.4 : 1.9} aria-hidden="true" />
          {text}
        </>
      )}
    </NavLink>
  )

  return (
    <>
      <nav
        aria-label="Navigazione principale"
        aria-hidden={hidden || undefined}
        inert={hidden}
        className="mobile-tabbar fixed inset-x-[18px] bottom-[calc(env(safe-area-inset-bottom)+14px)] z-40 mx-auto grid h-[66px] max-w-[480px] grid-cols-5 rounded-[33px] bg-nav shadow-[var(--shadow-nav)] lg:hidden"
        data-hidden={hidden || undefined}
      >
        <span
          aria-hidden="true"
          className="mobile-tabbar-pill absolute inset-y-[7px] ml-1 w-[calc(20%-8px)] rounded-[26px] bg-white/12"
          style={{ left: `${(column ?? 0) * 20}%`, opacity: column === null ? 0 : 1 }}
        />
        {mobileLink(first)}
        {mobileLink(second)}
        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={trigger}
            aria-label={label}
            className="tabbar-plus flex h-[54px] w-[54px] items-center justify-center rounded-full bg-accent text-white shadow-[var(--shadow-fab)]"
          >
            <Plus className="h-[30px] w-[30px]" strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>
        {mobileLink(third)}
        {mobileLink(fourth)}
      </nav>

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] flex-col overflow-y-auto bg-nav px-4 pb-5 pt-7 text-white lg:flex">
        <NavLink to="/" aria-label="AJE, vai alla Home" className="mb-8 block self-start rounded-xl px-3">
          <img
            src={`${import.meta.env.BASE_URL}aje-wordmark-dark-v2.webp`}
            alt=""
            className="h-[26px] w-auto brightness-0 invert"
          />
        </NavLink>
        <nav aria-label="Navigazione desktop" className="flex flex-col gap-1">
          {DESKTOP_LINKS.map(({ to, label: text, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex min-h-12 items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition-colors ${
                  isActive ? 'bg-white/13 text-white' : 'text-white/74 hover:bg-white/7 hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className="h-5 w-5" strokeWidth={isActive ? 2.4 : 1.9} aria-hidden="true" />
                  {text}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <button
          type="button"
          onClick={trigger}
          className="mt-[22px] flex min-h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-accent text-[15px] font-semibold text-white transition active:scale-[0.98]"
        >
          <Plus className="h-5 w-5" strokeWidth={2.2} aria-hidden="true" />
          {label}
        </button>
        <div className="mt-auto pt-6">
          {install.canPrompt && !install.installed && (
            <button
              type="button"
              onClick={() => void promptInstall()}
              className="mb-3 flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-[15px] font-medium text-white/74 transition-colors hover:bg-white/7 hover:text-white"
            >
              <Download className="h-5 w-5" strokeWidth={1.9} aria-hidden="true" />
              Installa AJE sul computer
            </button>
          )}
          <div className="flex items-center gap-3 border-t border-white/14 pt-4">
            <p className="min-w-0 flex-1 truncate text-[13px] text-white/80" title={session?.user.email ?? undefined}>
              {session?.user.email}
            </p>
            <ThemeToggle className="bg-white/10 text-white hover:bg-white/15" />
          </div>
        </div>
      </aside>
    </>
  )
}

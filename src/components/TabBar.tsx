import { NavLink } from 'react-router-dom'
import { Bot, BookOpen, CalendarDays, FileText, Fuel, Home, Settings, Wallet } from 'lucide-react'

const MOBILE_TABS = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/finanze', label: 'Finanze', icon: Wallet },
  { to: '/agenda', label: 'Agenda', icon: CalendarDays },
  { to: '/documenti', label: 'Documenti', icon: FileText },
  { to: '/impostazioni', label: 'Altro', icon: Settings },
]

const DESKTOP_LINKS = [
  ...MOBILE_TABS.slice(0, 4),
  { to: '/assistente', label: 'Assistente AI', icon: Bot },
  { to: '/carburanti', label: 'Carburanti', icon: Fuel },
  { to: '/guida', label: 'Guida', icon: BookOpen },
  { ...MOBILE_TABS[4], label: 'Impostazioni' },
]

export function TabBar() {
  return (
    <>
      <nav aria-label="Navigazione principale" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/95 backdrop-blur-lg pb-safe lg:hidden">
        <div className="mx-auto flex max-w-lg items-stretch">
          {MOBILE_TABS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex min-h-[60px] flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors ${isActive ? 'text-accent' : 'text-muted'}`
              }
            >
              <Icon className="h-5 w-5" strokeWidth={1.9} />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] flex-col bg-[var(--nav-bg)] px-4 py-6 text-white lg:flex">
        <NavLink to="/" className="mb-8 block rounded-2xl px-3">
          <img src={`${import.meta.env.BASE_URL}aje-logo-v2.webp`} alt="AJE" className="h-11 w-auto" />
        </NavLink>
        <nav aria-label="Navigazione desktop" className="flex flex-col gap-1">
          {DESKTOP_LINKS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors ${isActive ? 'bg-white/12 text-white' : 'text-white/70 hover:bg-white/7 hover:text-white'}`
            }
          >
            <Icon className="h-[18px] w-[18px]" strokeWidth={1.9} />
            {label}
          </NavLink>
          ))}
        </nav>
      </aside>
    </>
  )
}

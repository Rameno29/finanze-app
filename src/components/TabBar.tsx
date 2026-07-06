import { NavLink } from 'react-router-dom'
import { CalendarDays, FileText, Home, Settings, Wallet } from 'lucide-react'

const TABS = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/finanze', label: 'Finanze', icon: Wallet },
  { to: '/agenda', label: 'Agenda', icon: CalendarDays },
  { to: '/documenti', label: 'Documenti', icon: FileText },
  { to: '/impostazioni', label: 'Altro', icon: Settings },
]

export function TabBar() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/90 backdrop-blur-lg pb-safe">
      <div className="mx-auto flex max-w-lg items-stretch">
        {TABS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
                isActive ? 'text-accent' : 'text-muted'
              }`
            }
          >
            <Icon className="h-6 w-6" strokeWidth={2} />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

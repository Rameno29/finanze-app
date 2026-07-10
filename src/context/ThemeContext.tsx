import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type ThemeSetting = 'system' | 'light' | 'dark'

interface ThemeContextValue {
  setting: ThemeSetting
  setSetting: (s: ThemeSetting) => void
}

const ThemeContext = createContext<ThemeContextValue>({ setting: 'system', setSetting: () => {} })

function storedTheme(): ThemeSetting {
  const value = localStorage.getItem('theme')
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system'
}

function applyTheme(setting: ThemeSetting) {
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const dark = setting === 'dark' || (setting === 'system' && systemDark)
  document.documentElement.classList.toggle('dark', dark)
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [setting, setSettingState] = useState<ThemeSetting>(storedTheme)

  useEffect(() => {
    applyTheme(setting)
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme(setting)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [setting])

  const setSetting = (s: ThemeSetting) => {
    localStorage.setItem('theme', s)
    setSettingState(s)
  }

  return <ThemeContext.Provider value={{ setting, setSetting }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext)
}

import { createContext, useContext, useState, type ReactNode } from 'react'

interface PlayerContextValue {
  videoId: string | null
  play: (id: string) => void
  stop: () => void
}

const PlayerContext = createContext<PlayerContextValue>({
  videoId: null,
  play: () => {},
  stop: () => {},
})

/** Stato globale del mini-player YouTube: il video continua tra un tab e l'altro. */
export function PlayerProvider({ children }: { children: ReactNode }) {
  const [videoId, setVideoId] = useState<string | null>(null)
  return (
    <PlayerContext.Provider value={{ videoId, play: setVideoId, stop: () => setVideoId(null) }}>
      {children}
    </PlayerContext.Provider>
  )
}

export function usePlayer() {
  return useContext(PlayerContext)
}

/** Estrae l'ID video da un link YouTube (watch, youtu.be, shorts, live). */
export function extractYouTubeId(input: string): string | null {
  const trimmed = input.trim()
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed
  const patterns = [
    /[?&]v=([\w-]{11})/,
    /youtu\.be\/([\w-]{11})/,
    /shorts\/([\w-]{11})/,
    /live\/([\w-]{11})/,
    /embed\/([\w-]{11})/,
  ]
  for (const p of patterns) {
    const m = trimmed.match(p)
    if (m) return m[1]
  }
  return null
}

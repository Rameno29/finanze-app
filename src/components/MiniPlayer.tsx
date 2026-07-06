import { X } from 'lucide-react'
import { usePlayer } from '../context/PlayerContext'

/** Player YouTube fisso sopra la tab bar, persistente durante la navigazione. */
export function MiniPlayer() {
  const { videoId, stop } = usePlayer()
  if (!videoId) return null
  return (
    <div className="fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom))] z-30 border-t border-line bg-card shadow-2xl">
      <div className="mx-auto max-w-lg">
        <div className="relative aspect-video w-full">
          <iframe
            className="h-full w-full"
            src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1`}
            title="Player YouTube"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
          <button
            onClick={stop}
            aria-label="Chiudi player"
            className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  )
}

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  ExternalLink,
  LogOut,
  Music,
  Pause,
  Play,
  Search,
  SkipForward,
  Sparkles,
  CirclePlay,
} from 'lucide-react'
import { SPOTIFY_CLIENT_ID } from '../../lib/config'
import {
  beginSpotifyAuth,
  disconnectSpotify,
  isSpotifyConnected,
  spotifyFetch,
} from '../../lib/spotifyAuth'
import { extractYouTubeId, usePlayer } from '../../context/PlayerContext'
import { Card, PageHeader, PrimaryButton, Spinner, inputClass } from '../../components/ui'

interface SpotifyTrack {
  id: string
  name: string
  uri: string
  artists: Array<{ name: string }>
  album: { images: Array<{ url: string }> }
  external_urls: { spotify: string }
}

interface NowPlaying {
  is_playing: boolean
  item: SpotifyTrack | null
}

export function MediaPage() {
  const spotifyConfigured = SPOTIFY_CLIENT_ID !== ''
  const [connected, setConnected] = useState(isSpotifyConnected())
  const [query, setQuery] = useState('')
  const [tracks, setTracks] = useState<SpotifyTrack[] | null>(null)
  const [now, setNow] = useState<NowPlaying | null>(null)
  const [searching, setSearching] = useState(false)
  const [notice, setNotice] = useState('')

  const [ytUrl, setYtUrl] = useState('')
  const [ytError, setYtError] = useState('')
  const { play } = usePlayer()

  const refreshNow = useCallback(async () => {
    if (!isSpotifyConnected()) return
    try {
      const data = await spotifyFetch<NowPlaying>('/me/player/currently-playing')
      setNow(data)
    } catch {
      setNow(null)
    }
  }, [])

  useEffect(() => {
    if (connected) void refreshNow()
  }, [connected, refreshNow])

  async function searchSpotify(e: FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    setNotice('')
    try {
      const data = await spotifyFetch<{ tracks: { items: SpotifyTrack[] } }>(
        `/search?type=track&limit=10&q=${encodeURIComponent(query.trim())}`,
      )
      setTracks(data?.tracks.items ?? [])
    } catch {
      setNotice('Ricerca non riuscita: prova a ricollegare Spotify.')
      setConnected(isSpotifyConnected())
    } finally {
      setSearching(false)
    }
  }

  async function playTrack(t: SpotifyTrack) {
    setNotice('')
    try {
      await spotifyFetch('/me/player/play', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uris: [t.uri] }),
      })
      setTimeout(refreshNow, 600)
    } catch {
      // Nessun dispositivo attivo: apri il brano nell'app Spotify
      setNotice('Nessun dispositivo attivo: apro il brano nell’app Spotify. Avvia la riproduzione lì e poi controllala da qui.')
      window.open(t.external_urls.spotify, '_blank')
    }
  }

  async function togglePlayback() {
    if (!now) return
    try {
      await spotifyFetch(now.is_playing ? '/me/player/pause' : '/me/player/play', { method: 'PUT' })
      setTimeout(refreshNow, 500)
    } catch {
      setNotice('Comando non riuscito: assicurati che Spotify sia in riproduzione su un dispositivo.')
    }
  }

  async function nextTrack() {
    try {
      await spotifyFetch('/me/player/next', { method: 'POST' })
      setTimeout(refreshNow, 700)
    } catch {
      setNotice('Comando non riuscito: assicurati che Spotify sia in riproduzione su un dispositivo.')
    }
  }

  function playYouTube(e: FormEvent) {
    e.preventDefault()
    const id = extractYouTubeId(ytUrl)
    if (!id) {
      setYtError('Link non riconosciuto: incolla un link YouTube valido.')
      return
    }
    setYtError('')
    play(id)
  }

  return (
    <div className="pb-28">
      <PageHeader title="Media" subtitle="Musica e video" />

      <div className="mx-auto flex max-w-lg flex-col gap-4 px-5 pt-4">
        {/* YouTube: funziona senza configurazione */}
        <Card>
          <h2 className="mb-2 flex items-center gap-2 font-semibold">
            <CirclePlay className="h-4 w-4 text-expense" /> YouTube
          </h2>
          <p className="mb-3 text-sm text-muted">
            Incolla un link: il video parte in un mini-player che resta visibile mentre usi il
            resto dell’app.
          </p>
          <form onSubmit={playYouTube} className="flex gap-2">
            <input
              value={ytUrl}
              onChange={(e) => setYtUrl(e.target.value)}
              className={inputClass}
              placeholder="https://youtube.com/watch?v=…"
            />
            <button
              type="submit"
              aria-label="Riproduci video"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent text-white"
            >
              <Play className="h-5 w-5" />
            </button>
          </form>
          {ytError && <p className="mt-3 rounded-xl bg-expense/10 px-4 py-3 text-sm text-expense">{ytError}</p>}
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
            <Sparkles className="h-3.5 w-3.5" /> Riassunto scritto del video: arriverà con
            l’attivazione dell’AI.
          </p>
        </Card>

        {/* Spotify */}
        {!spotifyConfigured ? (
          <Card>
            <h2 className="mb-2 flex items-center gap-2 font-semibold">
              <Music className="h-4 w-4 text-income" /> Spotify
            </h2>
            <p className="text-sm text-muted">
              Per collegare il tuo Spotify Premium serve un ultimo passaggio di configurazione
              (gratuito) su developer.spotify.com. Segui la guida che ti ha dato Claude e la
              funzione si attiverà.
            </p>
          </Card>
        ) : !connected ? (
          <Card>
            <h2 className="mb-2 flex items-center gap-2 font-semibold">
              <Music className="h-4 w-4 text-income" /> Spotify
            </h2>
            <p className="mb-4 text-sm text-muted">
              Cerca brani e controlla la riproduzione del tuo account Premium direttamente da qui.
            </p>
            <PrimaryButton onClick={() => void beginSpotifyAuth()}>Collega Spotify</PrimaryButton>
          </Card>
        ) : (
          <Card>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-semibold">
                <Music className="h-4 w-4 text-income" /> Spotify
              </h2>
              <button
                onClick={() => {
                  disconnectSpotify()
                  setConnected(false)
                  setTracks(null)
                  setNow(null)
                }}
                aria-label="Scollega Spotify"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-card-2 text-muted"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>

            {now?.item && (
              <div className="mb-3 flex items-center gap-3 rounded-xl bg-card-2 p-3">
                {now.item.album.images.at(-1) && (
                  <img
                    src={now.item.album.images.at(-1)!.url}
                    alt=""
                    className="h-12 w-12 rounded-lg"
                  />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{now.item.name}</span>
                  <span className="block truncate text-xs text-muted">
                    {now.item.artists.map((a) => a.name).join(', ')}
                  </span>
                </span>
                <button
                  onClick={togglePlayback}
                  aria-label={now.is_playing ? 'Pausa' : 'Riprendi'}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-white"
                >
                  {now.is_playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                </button>
                <button
                  onClick={nextTrack}
                  aria-label="Brano successivo"
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-card text-ink"
                >
                  <SkipForward className="h-5 w-5" />
                </button>
              </div>
            )}

            <form onSubmit={searchSpotify} className="flex gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className={inputClass}
                placeholder="Cerca brani o artisti…"
              />
              <button
                type="submit"
                aria-label="Cerca su Spotify"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent text-white"
              >
                {searching ? <Spinner className="h-5 w-5 text-white" /> : <Search className="h-5 w-5" />}
              </button>
            </form>

            {notice && <p className="mt-3 rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent">{notice}</p>}

            {tracks && (
              <ul className="mt-3 divide-y divide-line">
                {tracks.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 py-2.5">
                    {t.album.images.at(-1) && (
                      <img src={t.album.images.at(-1)!.url} alt="" className="h-10 w-10 rounded-lg" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{t.name}</span>
                      <span className="block truncate text-xs text-muted">
                        {t.artists.map((a) => a.name).join(', ')}
                      </span>
                    </span>
                    <button
                      onClick={() => void playTrack(t)}
                      aria-label={`Riproduci ${t.name}`}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-income text-white"
                    >
                      <Play className="h-4 w-4" />
                    </button>
                    <a
                      href={t.external_urls.spotify}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="Apri in Spotify"
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-card-2 text-muted"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>
    </div>
  )
}

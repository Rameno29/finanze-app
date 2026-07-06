import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  CirclePlay,
  ExternalLink,
  LogOut,
  MonitorSmartphone,
  Music,
  Pause,
  Play,
  Search,
  SkipForward,
  Sparkles,
  X,
} from 'lucide-react'
import { SPOTIFY_CLIENT_ID, YOUTUBE_API_KEY } from '../../lib/config'
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

interface YtVideo {
  id: string
  title: string
  channel: string
  thumbnail: string
}

/** I titoli YouTube arrivano con entità HTML (&quot; ecc.) */
function decodeHtml(s: string): string {
  const t = document.createElement('textarea')
  t.innerHTML = s
  return t.value
}

export function MediaPage() {
  const spotifyConfigured = SPOTIFY_CLIENT_ID !== ''
  const [connected, setConnected] = useState(isSpotifyConnected())
  const [query, setQuery] = useState('')
  const [tracks, setTracks] = useState<SpotifyTrack[] | null>(null)
  const [embedTrackId, setEmbedTrackId] = useState<string | null>(null)
  const [now, setNow] = useState<NowPlaying | null>(null)
  const [searching, setSearching] = useState(false)
  const [notice, setNotice] = useState('')

  const [ytQuery, setYtQuery] = useState('')
  const [ytResults, setYtResults] = useState<YtVideo[] | null>(null)
  const [ytSearching, setYtSearching] = useState(false)
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
      setEmbedTrackId(null)
    } catch {
      setNotice('Ricerca non riuscita: prova a ricollegare Spotify.')
      setConnected(isSpotifyConnected())
    } finally {
      setSearching(false)
    }
  }

  async function playOnDevice(t: SpotifyTrack) {
    setNotice('')
    try {
      await spotifyFetch('/me/player/play', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uris: [t.uri] }),
      })
      setTimeout(refreshNow, 600)
    } catch {
      setNotice(
        'Nessun dispositivo Spotify attivo: apri un attimo l’app Spotify sul telefono e riprova, oppure usa il player qui sotto toccando il brano.',
      )
    }
  }

  async function togglePlayback() {
    if (!now) return
    try {
      await spotifyFetch(now.is_playing ? '/me/player/pause' : '/me/player/play', { method: 'PUT' })
      setTimeout(refreshNow, 500)
    } catch {
      setNotice('Comando non riuscito: assicurati che Spotify sia attivo su un dispositivo.')
    }
  }

  async function nextTrack() {
    try {
      await spotifyFetch('/me/player/next', { method: 'POST' })
      setTimeout(refreshNow, 700)
    } catch {
      setNotice('Comando non riuscito: assicurati che Spotify sia attivo su un dispositivo.')
    }
  }

  async function handleYouTube(e: FormEvent) {
    e.preventDefault()
    const input = ytQuery.trim()
    if (!input) return
    setYtError('')

    // Se è un link, riproduci direttamente
    const id = extractYouTubeId(input)
    if (id) {
      play(id)
      return
    }

    // Altrimenti cerca (serve la chiave API)
    if (YOUTUBE_API_KEY === '') {
      setYtError(
        'La ricerca si attiva con la chiave YouTube (guida di Claude). Nel frattempo incolla direttamente un link YouTube.',
      )
      return
    }
    setYtSearching(true)
    try {
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=8&q=${encodeURIComponent(input)}&key=${YOUTUBE_API_KEY}`,
      )
      if (!res.ok) throw new Error(String(res.status))
      const data = await res.json()
      setYtResults(
        (data.items ?? []).map(
          (v: {
            id: { videoId: string }
            snippet: { title: string; channelTitle: string; thumbnails: { medium?: { url: string } } }
          }) => ({
            id: v.id.videoId,
            title: decodeHtml(v.snippet.title),
            channel: v.snippet.channelTitle,
            thumbnail: v.snippet.thumbnails.medium?.url ?? '',
          }),
        ),
      )
    } catch {
      setYtError('Ricerca non riuscita: controlla la chiave YouTube o riprova più tardi.')
    } finally {
      setYtSearching(false)
    }
  }

  return (
    <div className="pb-28">
      <PageHeader title="Media" subtitle="Musica e video" />

      <div className="mx-auto flex max-w-lg flex-col gap-4 px-5 pt-4">
        {/* YouTube */}
        <Card>
          <h2 className="mb-2 flex items-center gap-2 font-semibold">
            <CirclePlay className="h-4 w-4 text-expense" /> YouTube
          </h2>
          <form onSubmit={handleYouTube} className="flex gap-2">
            <input
              value={ytQuery}
              onChange={(e) => setYtQuery(e.target.value)}
              className={inputClass}
              placeholder="Cerca un video o incolla un link…"
            />
            <button
              type="submit"
              aria-label="Cerca o riproduci"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent text-white"
            >
              {ytSearching ? <Spinner className="h-5 w-5 text-white" /> : <Search className="h-5 w-5" />}
            </button>
          </form>
          {ytError && <p className="mt-3 rounded-xl bg-expense/10 px-4 py-3 text-sm text-expense">{ytError}</p>}

          {ytResults && (
            <ul className="mt-3 divide-y divide-line">
              {ytResults.map((v) => (
                <li key={v.id}>
                  <button onClick={() => play(v.id)} className="flex w-full items-center gap-3 py-2.5 text-left">
                    {v.thumbnail && (
                      <img src={v.thumbnail} alt="" className="h-14 w-24 shrink-0 rounded-lg object-cover" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 font-medium">{v.title}</span>
                      <span className="block truncate text-xs text-muted">{v.channel}</span>
                    </span>
                    <Play className="h-5 w-5 shrink-0 text-accent" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-3 text-xs text-muted">
            💡 Il video resta nel mini-player mentre usi l’app. Per continuare a guardarlo/ascoltarlo
            fuori dall’app, tocca l’icona <strong>Picture-in-Picture</strong> nel player: il video
            prosegue in una finestrella sopra le altre app (limite Apple: con lo schermo bloccato
            l’audio si ferma).
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
            <Sparkles className="h-3.5 w-3.5" /> Riassunto scritto del video: arriverà con l’attivazione dell’AI.
          </p>
        </Card>

        {/* Spotify */}
        {!spotifyConfigured ? (
          <Card>
            <h2 className="mb-2 flex items-center gap-2 font-semibold">
              <Music className="h-4 w-4 text-income" /> Spotify
            </h2>
            <p className="text-sm text-muted">
              Per collegare Spotify serve la configurazione su developer.spotify.com (guida di Claude).
            </p>
          </Card>
        ) : !connected ? (
          <Card>
            <h2 className="mb-2 flex items-center gap-2 font-semibold">
              <Music className="h-4 w-4 text-income" /> Spotify
            </h2>
            <p className="mb-4 text-sm text-muted">
              Cerca brani, ascoltali nel player interno o comanda la riproduzione sull’app Spotify.
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
                  setEmbedTrackId(null)
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
                  <img src={now.item.album.images.at(-1)!.url} alt="" className="h-12 w-12 rounded-lg" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{now.item.name}</span>
                  <span className="block truncate text-xs text-muted">
                    {now.item.artists.map((a) => a.name).join(', ')} · su Spotify
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

            {/* Player interno (embed ufficiale Spotify) */}
            {embedTrackId && (
              <div className="relative mt-3">
                <iframe
                  src={`https://open.spotify.com/embed/track/${embedTrackId}?utm_source=generator`}
                  width="100%"
                  height="152"
                  frameBorder="0"
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                  loading="lazy"
                  className="rounded-xl"
                  title="Player Spotify"
                />
                <button
                  onClick={() => setEmbedTrackId(null)}
                  aria-label="Chiudi player Spotify"
                  className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full bg-card shadow text-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {tracks && (
              <ul className="mt-3 divide-y divide-line">
                {tracks.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 py-2.5">
                    <button
                      onClick={() => setEmbedTrackId(t.id)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      {t.album.images.at(-1) && (
                        <img src={t.album.images.at(-1)!.url} alt="" className="h-10 w-10 rounded-lg" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{t.name}</span>
                        <span className="block truncate text-xs text-muted">
                          {t.artists.map((a) => a.name).join(', ')}
                        </span>
                      </span>
                    </button>
                    <button
                      onClick={() => void playOnDevice(t)}
                      aria-label={`Riproduci ${t.name} sull'app Spotify`}
                      title="Riproduci sull'app Spotify"
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-income text-white"
                    >
                      <MonitorSmartphone className="h-4 w-4" />
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

            <p className="mt-3 text-xs text-muted">
              Tocca un brano per il <strong>player interno</strong>. Il bottone verde lo avvia
              sull’app Spotify (che deve essere aperta su un dispositivo) e da qui la comandi:
              è l’unico modo su iPhone per l’ascolto completo in sottofondo — limite imposto da
              Spotify/Apple, non aggirabile.
            </p>
          </Card>
        )}
      </div>
    </div>
  )
}

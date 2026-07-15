import { useCallback, useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Crosshair, Fuel, Navigation, Search } from 'lucide-react'
import { Card, EmptyState, PageHeader, Spinner } from '../../components/ui'
import { supabase } from '../../lib/supabase'

const FUEL_OPTIONS = ['Benzina', 'Gasolio', 'GPL', 'Metano'] as const
type FuelType = (typeof FUEL_OPTIONS)[number]

interface Station {
  id: string
  brand: string
  name: string
  address: string
  comune: string
  lat: number
  lon: number
  distance_km: number
  price: number
  is_self: boolean
  updated: string
}

/** Centro Italia: vista iniziale quando la posizione non è disponibile. */
const DEFAULT_CENTER: [number, number] = [41.9, 12.5]

function priceColor(price: number, min: number, max: number): string {
  if (max <= min) return '#16a34a'
  const t = (price - min) / (max - min)
  return t < 0.34 ? '#16a34a' : t < 0.67 ? '#d97706' : '#dc2626'
}

function navigationUrl(station: Station): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${station.lat},${station.lon}`
}

export function FuelPage() {
  const mapRef = useRef<L.Map | null>(null)
  const mapDivRef = useRef<HTMLDivElement>(null)
  const markersRef = useRef<L.LayerGroup | null>(null)
  const positionMarkerRef = useRef<L.CircleMarker | null>(null)

  const [fuel, setFuel] = useState<FuelType>('Benzina')
  const [stations, setStations] = useState<Station[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('Sto cercando la tua posizione…')
  const [located, setLocated] = useState(false)

  /** Interroga la Edge Function per il centro indicato e aggiorna mappa e lista. */
  const search = useCallback(async (lat: number, lon: number, fuelType: FuelType) => {
    if (!navigator.onLine) {
      setMessage('Per i prezzi dei carburanti serve la connessione a internet.')
      return
    }
    setBusy(true)
    setMessage('')
    try {
      const { data, error } = await supabase.functions.invoke('fuel-prices', {
        body: { lat, lon, radius_km: 7, fuel: fuelType },
      })
      if (error) throw error
      const found = (data as { stations: Station[] }).stations ?? []
      setStations(found)
      if (found.length === 0) {
        setMessage('Nessun distributore con prezzi aggiornati in quest’area: sposta la mappa e riprova.')
      }
    } catch {
      setMessage('Ricerca non riuscita, riprova tra poco.')
    } finally {
      setBusy(false)
    }
  }, [])

  // Inizializza la mappa Leaflet (una sola volta)
  useEffect(() => {
    if (!mapDivRef.current || mapRef.current) return
    const map = L.map(mapDivRef.current, { zoomControl: true }).setView(DEFAULT_CENTER, 6)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    }).addTo(map)
    markersRef.current = L.layerGroup().addTo(map)
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      markersRef.current = null
      positionMarkerRef.current = null
    }
  }, [])

  const locate = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setMessage('Questo dispositivo non fornisce la posizione: sposta la mappa e usa "Cerca in quest’area".')
      return
    }
    setMessage('Sto cercando la tua posizione…')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        const map = mapRef.current
        if (map) {
          map.setView([latitude, longitude], 13)
          if (positionMarkerRef.current) positionMarkerRef.current.setLatLng([latitude, longitude])
          else {
            positionMarkerRef.current = L.circleMarker([latitude, longitude], {
              radius: 8, color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.9, weight: 2,
            })
              .addTo(map)
              .bindPopup('Sei qui')
          }
        }
        setLocated(true)
        setMessage('')
        void search(latitude, longitude, fuel)
      },
      () => {
        setMessage(
          'Posizione non disponibile (controlla il permesso). Sposta la mappa sulla tua zona e tocca "Cerca in quest’area".',
        )
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    )
    // `fuel` è volutamente letto al momento del tap
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, fuel])

  useEffect(() => {
    locate()
    // Solo al primo accesso alla pagina
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Aggiorna i marker quando cambiano i risultati
  useEffect(() => {
    const layer = markersRef.current
    const map = mapRef.current
    if (!layer || !map) return
    layer.clearLayers()
    if (stations.length === 0) return
    const min = stations[0].price
    const max = stations[stations.length - 1].price
    for (const station of stations) {
      const color = priceColor(station.price, min, max)
      const icon = L.divIcon({
        className: '',
        html:
          `<div style="background:${color};color:#fff;font-weight:700;font-size:11px;` +
          'padding:2px 6px;border-radius:10px;box-shadow:0 1px 4px rgba(0,0,0,.4);white-space:nowrap">' +
          `${station.price.toFixed(3).replace('.', ',')}</div>`,
        iconSize: [48, 18],
        iconAnchor: [24, 9],
      })
      L.marker([station.lat, station.lon], { icon })
        .addTo(layer)
        .bindPopup(
          `<strong>${station.brand}</strong><br>${station.address || station.comune}<br>` +
            `${fuel}: <strong>${station.price.toFixed(3).replace('.', ',')} €/L</strong>` +
            `${station.is_self ? ' (self)' : ''}<br>` +
            `<a href="${navigationUrl(station)}" target="_blank" rel="noopener">Naviga →</a>`,
        )
    }
    // Inquadra tutti i risultati (senza avvicinarsi troppo).
    map.fitBounds(L.latLngBounds(stations.map((s) => [s.lat, s.lon])), {
      padding: [24, 24],
      maxZoom: 14,
    })
  }, [stations, fuel])

  function searchHere() {
    const center = mapRef.current?.getCenter()
    if (center) void search(center.lat, center.lng, fuel)
  }

  function changeFuel(next: FuelType) {
    setFuel(next)
    const center = mapRef.current?.getCenter()
    if (center && (located || stations.length > 0)) void search(center.lat, center.lng, next)
  }

  return (
    <div className="pb-28">
      <PageHeader title="Carburanti" subtitle="Il distributore più conveniente vicino a te" />

      <div className="mx-auto flex max-w-lg flex-col gap-4 px-5 pt-4">
        {/* Selettore carburante */}
        <div className="grid grid-cols-4 gap-1 rounded-xl bg-card-2 p-1">
          {FUEL_OPTIONS.map((option) => (
            <button
              key={option}
              onClick={() => changeFuel(option)}
              className={`min-h-[40px] rounded-lg text-[12px] font-semibold transition ${
                fuel === option ? 'bg-card shadow text-ink' : 'text-muted'
              }`}
            >
              {option}
            </button>
          ))}
        </div>

        {/* Mappa interattiva (trascinabile e zoomabile) */}
        <div className="relative overflow-hidden rounded-2xl border border-line">
          <div ref={mapDivRef} className="h-[320px] w-full" />
          <div className="absolute bottom-3 left-1/2 z-[1000] flex -translate-x-1/2 gap-2">
            <button
              onClick={searchHere}
              disabled={busy}
              className="flex min-h-[40px] items-center gap-1.5 rounded-full bg-accent px-4 text-sm font-semibold text-white shadow-lg disabled:opacity-60"
            >
              {busy ? <Spinner className="h-4 w-4 text-white" /> : <Search className="h-4 w-4" />}
              Cerca in quest'area
            </button>
            <button
              onClick={locate}
              disabled={busy}
              aria-label="Vai alla mia posizione"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-card text-accent shadow-lg disabled:opacity-60"
            >
              <Crosshair className="h-5 w-5" />
            </button>
          </div>
        </div>

        {message && <p className="rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent">{message}</p>}

        {/* Classifica per prezzo */}
        {stations.length > 0 && (
          <Card className="divide-y divide-line p-0">
            {stations.slice(0, 12).map((station, index) => (
              <div key={station.id} className="flex items-center gap-3 px-4 py-3">
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white ${
                    index === 0 ? 'bg-income' : 'bg-card-2 !text-muted'
                  }`}
                >
                  <Fuel className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {station.brand}
                    {index === 0 && (
                      <span className="ml-2 rounded-full bg-income/15 px-2 py-0.5 text-[10px] font-bold text-income">
                        PIÙ ECONOMICO
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {station.address || station.comune} · {station.distance_km.toFixed(1).replace('.', ',')} km
                    {station.is_self ? ' · self' : ''}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-bold">{station.price.toFixed(3).replace('.', ',')} €</span>
                  <a
                    href={navigationUrl(station)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-accent"
                  >
                    <Navigation className="h-3 w-3" /> Naviga
                  </a>
                </span>
              </div>
            ))}
          </Card>
        )}

        {!busy && stations.length === 0 && !message && (
          <EmptyState
            icon={<Fuel className="h-10 w-10" />}
            title="Nessun risultato"
            hint="Sposta la mappa sulla zona che ti interessa e tocca «Cerca in quest'area»."
          />
        )}

        <p className="pb-2 text-center text-[11px] text-muted">
          Prezzi comunicati dai gestori al MIMIT (aggiornati ogni mattina) · Mappa © OpenStreetMap
        </p>
      </div>
    </div>
  )
}

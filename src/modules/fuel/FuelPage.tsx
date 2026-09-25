import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Crosshair, Fuel as FuelIcon, Navigation, Search } from 'lucide-react'
import { EmptyState, PageHeader, Spinner } from '../../components/ui'
import { Segmented } from '../../components/Segmented'
import { useAccounts, useCategories } from '../../lib/data'
import { TransactionSheet, type TransactionDraft } from '../finance/TransactionSheet'
import { invokeFunction } from '../../lib/integrations'

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
      const { data, error } = await invokeFunction('fuel-prices', {
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
    const mapElement = mapDivRef.current
    if (!mapElement || mapRef.current) return
    const map = L.map(mapElement, { zoomControl: true }).setView(DEFAULT_CENTER, 6)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    }).addTo(map)
    markersRef.current = L.layerGroup().addTo(map)
    mapRef.current = map
    const resizeObserver = new ResizeObserver(() => map.invalidateSize({ pan: false }))
    resizeObserver.observe(mapElement)
    requestAnimationFrame(() => map.invalidateSize({ pan: false }))
    return () => {
      resizeObserver.disconnect()
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

  // "Registra rifornimento": foglio movimento con categoria Trasporti e descrizione precompilate
  const { categories } = useCategories()
  const { accounts } = useAccounts()
  const [refuelOpen, setRefuelOpen] = useState(false)
  const refuelDraft = useMemo<TransactionDraft>(() => {
    const transport = categories.find((c) => c.kind === 'expense' && c.name.trim().toLowerCase() === 'trasporti')
    return { kind: 'expense', category_id: transport?.id ?? null, description: 'Rifornimento' }
  }, [categories])

  return (
    <div>
      <PageHeader title="Carburanti" subtitle="Prezzi dei distributori vicini" />

      <div className="fuel-layout mx-auto flex w-full max-w-[1120px] flex-col gap-5 px-5 pt-4 lg:px-10 lg:pt-2">
        <div>
          <h2 className="mb-3 text-[15px] font-semibold">Distributori vicini</h2>
          <Segmented
            label="Carburante"
            size="sm"
            value={fuel}
            onChange={changeFuel}
            options={FUEL_OPTIONS.map((option) => ({ value: option, label: option }))}
          />
        </div>

        {/* Mappa interattiva (trascinabile e zoomabile) */}
        <div className="fuel-map">
          <div className="relative z-0 overflow-hidden rounded-2xl border border-line">
            <div ref={mapDivRef} className="h-[130px] w-full lg:h-[420px]" />
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={searchHere}
              disabled={busy}
              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full border border-line text-sm font-medium disabled:opacity-60"
            >
              {busy ? <Spinner className="h-4 w-4" /> : <Search className="h-4 w-4" strokeWidth={1.9} />}
              Cerca in quest'area
            </button>
            <button
              onClick={locate}
              disabled={busy}
              aria-label="Vai alla mia posizione"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line text-accent disabled:opacity-60"
            >
              <Crosshair className="h-5 w-5" strokeWidth={1.9} />
            </button>
          </div>
          <button
            onClick={() => setRefuelOpen(true)}
            className="mt-4 hidden min-h-14 w-full items-center justify-center gap-2 rounded-[18px] bg-accent text-[16px] font-semibold text-white transition active:scale-[0.98] lg:flex"
          >
            <FuelIcon className="h-5 w-5" strokeWidth={1.9} /> Registra rifornimento
          </button>
        </div>

        <div className="fuel-results flex flex-col">
          {message && <p role="status" className="mb-3 rounded-[14px] bg-accent-soft px-4 py-3 text-sm text-accent">{message}</p>}

          {stations.length > 0 && (
            <div>
              {stations.slice(0, 12).map((station, index) => (
                <div key={station.id} className="flex min-h-16 items-center gap-3 border-b border-line">
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className="truncate text-[15px] font-medium">{station.brand}</span>
                      {index === 0 && <span className="shrink-0 text-xs font-semibold text-income">più economico</span>}
                    </span>
                    <span className="block truncate text-[13px] text-muted">
                      {station.is_self ? 'Self' : 'Servito'} · {station.distance_km.toFixed(1).replace('.', ',')} km
                      {station.address || station.comune ? ` · ${station.address || station.comune}` : ''}
                    </span>
                  </span>
                  <span className="tabular shrink-0 text-[17px] font-semibold">{station.price.toFixed(3).replace('.', ',')} €</span>
                  <a
                    href={navigationUrl(station)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Naviga verso ${station.brand}`}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-accent"
                  >
                    <Navigation className="h-[18px] w-[18px]" strokeWidth={1.9} />
                  </a>
                </div>
              ))}
            </div>
          )}

          {!busy && stations.length === 0 && !message && (
            <EmptyState
              icon={<FuelIcon />}
              title="Nessun risultato"
              hint="Sposta la mappa sulla zona che ti interessa e tocca «Cerca in quest'area»."
            />
          )}

          <button
            onClick={() => setRefuelOpen(true)}
            className="mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-[18px] bg-accent text-[16px] font-semibold text-white transition active:scale-[0.98] lg:hidden"
          >
            <FuelIcon className="h-5 w-5" strokeWidth={1.9} /> Registra rifornimento
          </button>

          <p className="mt-4 text-center text-[11px] text-muted">
            Prezzi comunicati dai gestori al MIMIT (aggiornati ogni mattina) · Mappa © OpenStreetMap
          </p>
        </div>
      </div>

      <TransactionSheet
        open={refuelOpen}
        onClose={() => setRefuelOpen(false)}
        categories={categories}
        accounts={accounts}
        editing={null}
        draft={refuelDraft}
      />
    </div>
  )
}

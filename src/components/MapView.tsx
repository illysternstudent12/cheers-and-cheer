import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { LatLng, VenueRow } from '../lib/venues'

/*
 * Dark basemap. Primary: Stadia "Alidade Smooth Dark" (OpenStreetMap data),
 * which works without a key on localhost; a deployed site needs a free
 * Stadia account/domain allow-listing. If those tiles fail to load we fall
 * back to standard OpenStreetMap tiles, darkened with a CSS filter
 * (fine for development traffic under the OSM tile policy, not for production).
 */
const PRIMARY = {
  url: 'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png',
  attribution:
    '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}
const FALLBACK = {
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}

interface Props {
  rows: VenueRow[]
  center: LatLng
  zoom: number
  selected?: string
  hovered?: string
  origin?: LatLng & { gps: boolean }
  onSelect?: (id: string) => void
  interactive?: boolean
  className?: string
  /** When this changes, the map fits itself to the current markers. */
  fitKey?: string
}

function markerHtml(r: VenueRow): string {
  const b = r.broadcast
  const fans = b?.fans ?? 0
  const party = b?.watchParty ? '<span class="vm-party" aria-hidden="true">★</span>' : ''
  const sound = b?.sound ? ' has-sound' : ''
  const full = b && b.tablesLeft === 0 ? ' is-full' : ''
  const label = b ? (fans >= 1000 ? `${(fans / 1000).toFixed(1)}k` : String(fans)) : '·'
  return `<div class="vm${sound}${full}"><span class="vm-ring"></span><span class="vm-pin"><span class="vm-n">${label}</span></span>${party}<span class="vm-name">${escapeHtml(r.venue.name)}</span></div>`
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

export function MapView({ rows, center, zoom, selected, hovered, origin, onSelect, interactive = true, className, fitKey }: Props) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)
  const markers = useRef(new Map<string, L.Marker>())
  const originMarker = useRef<L.Marker | null>(null)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  // Create once.
  useEffect(() => {
    if (!el.current) return
    const m = L.map(el.current, {
      center: [center.lat, center.lng],
      zoom,
      zoomControl: false,
      attributionControl: true,
      dragging: interactive,
      scrollWheelZoom: interactive,
      doubleClickZoom: interactive,
      touchZoom: interactive,
      keyboard: interactive,
    })
    let errors = 0
    const primary = L.tileLayer(PRIMARY.url, { attribution: PRIMARY.attribution, maxZoom: 19 })
    primary.on('tileerror', () => {
      errors += 1
      if (errors === 3) {
        m.removeLayer(primary)
        L.tileLayer(FALLBACK.url, { attribution: FALLBACK.attribution, maxZoom: 19 }).addTo(m)
        el.current?.classList.add('mapview-osm')
      }
    })
    primary.addTo(m)
    if (interactive) L.control.zoom({ position: 'bottomright' }).addTo(m)
    layer.current = L.layerGroup().addTo(m)
    map.current = m
    // Containers that animate in (list ↔ map) need a size refresh.
    const ro = new ResizeObserver(() => m.invalidateSize())
    ro.observe(el.current)
    const mks = markers.current
    return () => {
      ro.disconnect()
      m.remove()
      map.current = null
      mks.clear()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Recentre when the city changes.
  useEffect(() => {
    map.current?.setView([center.lat, center.lng], zoom, { animate: true })
  }, [center.lat, center.lng, zoom])

  // Sync markers with rows.
  useEffect(() => {
    const lg = layer.current
    if (!lg) return
    const seen = new Set<string>()
    rows.forEach((r, i) => {
      seen.add(r.venue.id)
      const icon = L.divIcon({ className: 'vm-wrap', html: markerHtml(r), iconSize: [0, 0] })
      let mk = markers.current.get(r.venue.id)
      if (!mk) {
        mk = L.marker([r.venue.lat, r.venue.lng], { icon, keyboard: interactive, title: r.venue.name, riseOnHover: true })
        mk.on('click', () => onSelectRef.current?.(r.venue.id))
        mk.addTo(lg)
        markers.current.set(r.venue.id, mk)
        const node = mk.getElement()
        if (node) node.style.setProperty('--d', `${i * 40}ms`)
      } else {
        mk.setIcon(icon)
      }
    })
    for (const [id, mk] of markers.current) {
      if (!seen.has(id)) {
        lg.removeLayer(mk)
        markers.current.delete(id)
      }
    }
  }, [rows, interactive])

  // Frame the venues whenever the game or city changes.
  const lastFit = useRef<string | undefined>(undefined)
  useEffect(() => {
    const m = map.current
    if (!m || !fitKey || fitKey === lastFit.current || rows.length === 0) return
    lastFit.current = fitKey
    const b = L.latLngBounds(rows.map((r) => [r.venue.lat, r.venue.lng] as [number, number]))
    m.fitBounds(b, { padding: [60, 60], maxZoom: 15, animate: lastFit.current !== undefined })
  }, [fitKey, rows])

  // Selection + hover state.
  useEffect(() => {
    for (const [id, mk] of markers.current) {
      const node = mk.getElement()
      if (!node) continue
      node.classList.toggle('is-selected', id === selected)
      node.classList.toggle('is-hovered', id === hovered && id !== selected)
      mk.setZIndexOffset(id === selected ? 1000 : id === hovered ? 500 : 0)
    }
  }, [selected, hovered, rows])

  // Fly to selection.
  useEffect(() => {
    if (!selected || !map.current) return
    const mk = markers.current.get(selected)
    if (!mk) return
    const ll = mk.getLatLng()
    const m = map.current
    if (!m.getBounds().pad(-0.25).contains(ll)) m.flyTo(ll, Math.max(m.getZoom(), 15), { duration: 0.6 })
  }, [selected])

  // "You are here" dot.
  useEffect(() => {
    const m = map.current
    if (!m) return
    originMarker.current?.remove()
    originMarker.current = null
    if (origin?.gps) {
      originMarker.current = L.marker([origin.lat, origin.lng], {
        icon: L.divIcon({ className: 'vm-wrap', html: '<div class="vm-me"></div>', iconSize: [0, 0] }),
        interactive: false,
        zIndexOffset: 2000,
      }).addTo(m)
    }
  }, [origin?.lat, origin?.lng, origin?.gps])

  return <div ref={el} className={`mapview ${className ?? ''}`} role="region" aria-label="Map of venues" />
}

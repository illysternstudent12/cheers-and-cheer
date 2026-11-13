import { getCity } from '../data/demo'
import { usePrefs } from '../state/prefs'
import { distanceKm, type LatLng } from './venues'

export interface Origin extends LatLng {
  label: string
  gps: boolean
}

/** An absolute link to a page of this site (works under the GitHub Pages sub-path too). */
export const siteUrl = (path: string) => location.origin + import.meta.env.BASE_URL.replace(/\/$/, '') + path

/** Where distances are measured from: the device if it's in the chosen city, else the city centre. */
export function useOrigin(): Origin {
  const { city, here } = usePrefs()
  const c = getCity(city)
  if (here && distanceKm(here, c) < 25) return { ...here, label: 'you', gps: true }
  return { lat: c.lat, lng: c.lng, label: `${c.name} centre`, gps: false }
}

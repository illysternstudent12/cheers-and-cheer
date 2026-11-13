import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Games } from './pages/Games'
import { Home } from './pages/Home'
import { MatchPage } from './pages/MatchPage'
import { NotFound } from './pages/NotFound'
import { SearchPage } from './pages/SearchPage'
import { Teams } from './pages/Teams'
import { PrefsProvider } from './state/prefs'
import { SessionProvider } from './state/session'
import { AuthPage } from './pages/AuthPage'
import { MePage } from './pages/MePage'
import { PartyPage } from './pages/PartyPage'
import { TicketPage } from './pages/TicketPage'

// The map (Leaflet) only loads when someone opens a map or venue page.
const MapPage = lazy(() => import('./pages/MapPage').then((m) => ({ default: m.MapPage })))
const VenuePage = lazy(() => import('./pages/VenuePage').then((m) => ({ default: m.VenuePage })))
const OwnerPage = lazy(() => import('./pages/OwnerPage').then((m) => ({ default: m.OwnerPage })))
const CheckinPage = lazy(() => import('./pages/CheckinPage').then((m) => ({ default: m.CheckinPage })))
const Loading = () => <div className="page-loading" aria-label="Loading" />

export default function App() {
  return (
    <PrefsProvider>
      <SessionProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="games" element={<Games />} />
            <Route path="match/:id" element={<MatchPage />} />
            <Route path="teams" element={<Teams />} />
            <Route path="map" element={<Suspense fallback={<Loading />}><MapPage /></Suspense>} />
            <Route path="venue/:id" element={<Suspense fallback={<Loading />}><VenuePage /></Suspense>} />
            <Route path="search" element={<SearchPage />} />
            <Route path="signin" element={<AuthPage mode="signin" />} />
            <Route path="join" element={<AuthPage mode="join" />} />
            <Route path="me" element={<MePage />} />
            <Route path="ticket/:code" element={<TicketPage />} />
            <Route path="party/:slug" element={<PartyPage />} />
            <Route path="owner" element={<Suspense fallback={<Loading />}><OwnerPage /></Suspense>} />
            <Route path="checkin/:code" element={<Suspense fallback={<Loading />}><CheckinPage /></Suspense>} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
      </SessionProvider>
    </PrefsProvider>
  )
}

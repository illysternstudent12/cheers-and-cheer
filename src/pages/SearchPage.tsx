import { Link } from 'react-router-dom'
import { SportIcon } from '../components/Icons'
import { SearchBox } from '../components/SearchBox'
import { CITIES, LEAGUES, SPORTS } from '../data/demo'
import { POPULAR_SEARCHES } from '../lib/search'

export function SearchPage() {
  return (
    <div className="searchpage">
      <section className="games-hero">
        <div className="wrap">
          <p className="eyebrow">Search</p>
          <h1 className="display display-sm">
            What are you <em>watching?</em>
          </h1>
          <SearchBox autoFocus />
        </div>
      </section>
      <div className="wrap band-tight">
        <p className="eyebrow">Popular</p>
        <div className="chips chips-wrap">
          {POPULAR_SEARCHES.map((s) => (
            <Link key={s} className="chip" to={`/games?q=${encodeURIComponent(s)}`}>
              {s}
            </Link>
          ))}
        </div>

        <p className="eyebrow">Sports</p>
        <div className="chips chips-wrap">
          {SPORTS.map((s) => (
            <Link key={s.id} className="chip" to={`/games?sport=${s.id}`}>
              <SportIcon sport={s.id} size={15} /> {s.name}
            </Link>
          ))}
        </div>

        <p className="eyebrow">Leagues</p>
        <div className="chips chips-wrap">
          {LEAGUES.map((l) => (
            <Link key={l.id} className="chip" to={`/games?league=${l.id}`}>
              {l.name}
            </Link>
          ))}
        </div>

        <p className="eyebrow">Cities</p>
        <div className="chips chips-wrap">
          {CITIES.map((c) => (
            <Link key={c.id} className="chip" to={`/games?city=${c.id}`}>
              {c.name}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

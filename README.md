# Cheers & Cheer — MVP

Mobile-first sports discovery and social booking, with two sides:
- **Fans:** find a game, explore the bars showing it, see who's going, reserve a table, and check in with a QR code.
- **Venues:** confirm their broadcasts, manage capacity, check guests in and track attendance.

```bash
npm install
npm run dev        # app + API on http://localhost:5173 (SQLite at data/cheers.db, seeded on first run)
npm run test:api   # 23 end-to-end API checks against an in-memory database
npm run build && npm start   # production: one Node process serves dist/ + /api on :8787
```

## Status

| Batch | Scope | State |
|---|---|---|
| 1 | Foundation & game discovery: homepage, live/upcoming schedule, search, favourites & recommendations, countdowns, sport/date filters | **Done** |
| 2 | Venue discovery & interactive map: Tel Aviv-first map, venue markers per match, broadcast / screens / sound, distance · sound · availability · atmosphere filters, venue cards & profiles, fan counts & watch parties, map ↔ list | **Done** |
| 3 | Reservations & fan community: accounts, table booking with arrival slots & party size, confirmation/cancellation, QR tickets, "My nights" dashboard, "I'm going", favourite venues, watch parties with shareable links and in-app invitations, prefs synced to the account | **Done** |
| 4 | Venue dashboard: owner accounts (seeded or claim-code sign-up), broadcast verification/screens/sound, capacity, reservations, QR/code check-in & no-shows, analytics (bookings, attendance, repeat visits) | **Done** |

## Test accounts (localhost only)

These are listed in `server/seed.ts`:
- a fan account
- three venue-owner accounts: The Copper Tap, North Stand Bar, Half Time Social

Every other demo venue can be claimed by signing up at `/join?venue=1` with its claim code (`CLAIM-<VENUE-ID>`). Delete `data/cheers.db` to reset to a fresh seed.

## Architecture

- **Front end:** Vite + React + TypeScript and react-router. Map, venue and owner pages are lazy-loaded.
- **API:** Express 5 (`server/app.ts`).
  - **Dev:** mounted inside the Vite dev server by a small plugin in `vite.config.ts`, so `npm run dev` is the whole stack.
  - **Production:** `server/start.ts` serves both the app and the API.
- **Database:** SQLite through Node's built-in `node:sqlite` (`server/db.ts`). The schema is plain SQL, so moving to Postgres for a multi-city launch is mechanical.
- **Auth:** email + password (scrypt hashes) with an httpOnly SameSite=Lax session cookie, which blocks cross-site requests carrying the session. Sign-in has brute-force throttling. Fans and venues are separate roles, and each owner is scoped to their own venue.
- **Shared rules:** `src/lib/booking.ts` (slots, tables, capacity) is imported by both the screen and the server, so they can't disagree.

### Booking model

- **Tables:** each table seats 4 and is held for the whole game.
- **Party size:** 1 to 12 guests, which works out to `ceil(guests / 4)` tables.
- **Arrival slots:** 90, 60 and 30 minutes before kick-off, or at kick-off. Each slot has its share of the venue's bookable tables, and the venue sets that table count in Settings.
- **Limits:** one active booking per fan per game. Bookings are only accepted while the venue is showing the game (an owner can hide it).

## Data integrity — what's real and what's demo

| Shown as | Source |
|---|---|
| **Verified by venue** | An owner confirmed the broadcast in their dashboard (`broadcast_overrides`). |
| **Listed** / **Unconfirmed** | Generated demo listing, not confirmed by anyone. |
| **~N expected** | Simulated crowd estimate. |
| **N confirmed**, names in "going here" | Real fans who tapped "I'm going", booked, or joined a watch party. |
| Tables free | Bookable tables, minus simulated demo occupancy (said so in the booking sheet), minus real bookings. |
| Dashboard rows marked **Demo** | Seeded booking history, flagged `seeded = 1`. The "Real only" filter hides them, and they never count against real availability. |

Fixtures, times, scores, venues and venue names are illustrative. Team crests are generic shields in team colours, not official marks.

## Design system: "the basement bar"

The fan-facing pages are styled as a real underground sports bar: brick walls, walnut counter, brass fittings, burgundy, warm cream paper. There is no orange in the palette; the deck's copper was retired in the redesign. Tokens are at the top of `src/index.css`. The bar layer (nav, TV wall, counter, ticker, posters, TV match cards, games shelf) lives in `src/styles/bar.css`.

- **Type:**
  - Cormorant Garamond 700 for headlines, with the accent line in *italic brass*.
  - DM Sans for body text.
  - **Barlow Condensed** (`--font-cond`) is the broadcast voice: scorebugs, channels, times, badges.
- **Colour:**
  - espresso / charcoal room
  - brick `#8e3b2c`
  - burgundy `#7a1f2b`
  - walnut
  - aged brass `#c9a45c`
  - cream paper `#efe3cc`
  - on-air red `#c8423a`, used only for LIVE
- **TV wall (`TvWall.tsx`):**
  - **Screens:** nine sets on brick, with live games first. The biggest local crowd goes on the main screen.
  - **Remote:** re-tunes the whole wall by channel (all / live / sport), with a CRT power-on effect.
  - **Broadcast graphics:** each screen draws its sport's surface (`Field.tsx`), a live scorebug or a kick-off slate with a countdown, and a lower third on hover or focus.
  - **Light:** each screen's team colours spill onto the brick. Pointer parallax moves the brick, the lamps and the wall.
  - **Crowd:** the silhouetted crowd cheers when a live screen is lit.
- **Other motifs:**
  - pendant lamps
  - walnut counter with a brass foot rail, holding the search
  - beer-mat coasters for popular searches
  - TV score crawl
  - pinned match-bill posters
  - match cards drawn as mounted TVs with a brass plaque
- **Buttons & controls (`src/styles/controls.css`, loaded last): "enamel & hairline" signage.**
  - **Primary** (`.btn-primary`): burgundy enamel pill with a brass double rule and ◆ ornaments.
  - **Secondary** (`.btn-ghost`): brass double hairline with no fill. On cream it becomes `.btn-ink`.
  - **Booking** (`.btn-book`): an enamel pill body with a squared, perforated brass stub. `.btn-book-held` is the cream version for a table you already hold.
  - **Chips, toggles, arrival slots, day strip, remote:** dark letterspaced labels that turn into cream enamel plates when active.
  - **Navigation:** brass lettering with a glowing lamp dot under the active item.
- **Header (`src/styles/header.css` + `Layout.tsx`, loaded after everything else):**
  - **Promo strip:** tonight's biggest local game, taken from the schedule.
  - **Bar:** flush with the room at the top of the page. On scroll it turns into a floating frosted capsule.
  - **Links:** centred on a quiet track, with a highlight that glides to the hovered link and labels that roll on hover.
  - **Right side:** live count, city, a round account button and the "Find a bar" pill.
- **Venue imagery:** generated SVG interiors (`VenueArt.tsx`), not stock photos. Swap in real photography when partners supply it.

## Structure

```
server/
  app.ts          API: auth, live feed, availability, bookings, going, favourites, parties, invites, owner endpoints
  db.ts           schema + transactions          seed.ts   test accounts, claim codes, flagged demo history
  start.ts        production server               api.test.ts  end-to-end API checks
src/
  data/           demo.ts (fixtures), venues.ts (venues + broadcast generator), rand.ts
  lib/            match, search, filters, recommend, time, venues, booking (shared with server), origin
  state/          prefs (local + synced), session (auth), live (server feed merged over demo listings)
  api/client.ts   typed fetch client
  components/     MatchCard, SearchBox, MapView, VenueCard, VenueArt, Badges, BookingSheet, Social (going/fav/QR/share/toasts), …
  pages/          Home, Games, Match, Map, Venue, Teams, Search, Auth, Me, Ticket, Party, Owner, Checkin
```

## Before deploying

- **Map tiles:** Stadia "Alidade Smooth Dark" works without a key on `localhost` only. Create a free Stadia account and allow-list the domain. If the tiles fail, `MapView` falls back to OpenStreetMap tiles, but OSM's tile policy rules them out for production traffic.
- **Cookies:** set `COOKIE_SECURE=1` behind HTTPS.
- **Data location:** use `DB_FILE` to place the database on persistent storage.
- **Email:** there is no email delivery. Invitations appear in the invitee's account when they sign in with that email, and the shareable party link works for anyone.
- **QR scanning in the dashboard:** uses the browser's `BarcodeDetector` (Chrome on Android, for example). Any phone camera can also open the ticket's QR link, which lands on `/checkin/CODE` and checks the guest in for signed-in venue staff. Typing the 6-character code always works.
- **Payments:** deliberately out of scope for the MVP.

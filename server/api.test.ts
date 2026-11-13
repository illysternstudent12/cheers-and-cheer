/**
 * End-to-end API check against an in-memory database.
 *   npm run test:api
 */
import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import { BROADCASTS } from '../src/data/demo'
import { createApp } from './app'
import { openDb } from './db'
import { FAN_PASSWORD, OWNER_PASSWORD, seed } from './seed'

const db = openDb(':memory:')
seed(db)
const server = createApp(db).listen(0)
const base = `http://localhost:${(server.address() as AddressInfo).port}/api`

function client() {
  let cookie = ''
  return async (method: string, path: string, body?: unknown) => {
    const res = await fetch(base + path, {
      method,
      headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const set = res.headers.get('set-cookie')
    if (set) cookie = set.split(';')[0]
    return { status: res.status, body: (await res.json()) as Record<string, any> } // eslint-disable-line @typescript-eslint/no-explicit-any
  }
}

let passed = 0
async function step(name: string, fn: () => Promise<void>) {
  try {
    await fn()
    passed++
    console.log(`  ✓ ${name}`)
  } catch (e) {
    console.error(`  ✗ ${name}`)
    throw e
  }
}

const fan = client()
const friend = client()
const ownerC = client()
const venueId = 'copper-tap'
const bc = BROADCASTS.find((b) => b.venueId === venueId && b.matchId === 'rma-bar')
assert.ok(bc, 'demo data should list El Clásico at The Copper Tap')

console.log('Fan journey')
await step('rejects form posts that are not JSON (CSRF guard)', async () => {
  const r = await fetch(base + '/auth/login', { method: 'POST', body: 'email=x' })
  assert.equal(r.status, 415)
})
await step('registers a fan and starts a session', async () => {
  const r = await fan('POST', '/auth/register', { name: 'Test Fan', email: 'test.fan@example.test', password: 'longenough1' })
  assert.equal(r.status, 201)
  assert.equal((await fan('GET', '/auth/me')).body.user.email, 'test.fan@example.test')
})
await step('refuses duplicate email and short passwords', async () => {
  assert.equal((await client()('POST', '/auth/register', { name: 'X', email: 'test.fan@example.test', password: 'longenough1' })).status, 409)
  assert.equal((await client()('POST', '/auth/register', { name: 'X', email: 'new@example.test', password: 'short' })).status, 400)
})
await step('wrong password is rejected; seeded fan can sign in', async () => {
  assert.equal((await client()('POST', '/auth/login', { email: 'fan@cheers.test', password: 'nope' })).status, 401)
  assert.equal((await client()('POST', '/auth/login', { email: 'fan@cheers.test', password: FAN_PASSWORD })).status, 200)
})
let code = ''
await step('shows availability and books a table', async () => {
  const a = await fan('GET', `/availability/${venueId}/rma-bar`)
  assert.equal(a.body.showing, true)
  const slot = a.body.plan.find((s: { left: number }) => s.left >= 2)
  assert.ok(slot, 'needs a slot with 2 tables')
  const r = await fan('POST', '/bookings', { venueId, matchId: 'rma-bar', partySize: 6, slotOffset: slot.offset, note: 'Near the screen' })
  assert.equal(r.status, 201, JSON.stringify(r.body))
  code = r.body.booking.code
  assert.equal(r.body.booking.tables, 2)
  const after = await fan('GET', `/availability/${venueId}/rma-bar`)
  const same = after.body.plan.find((s: { offset: number }) => s.offset === slot.offset)
  assert.equal(same.left, slot.left - 2, 'real booking reduces the slot')
})
await step('blocks a second booking for the same game', async () => {
  const r = await fan('POST', '/bookings', { venueId, matchId: 'rma-bar', partySize: 2, slotOffset: 0 })
  assert.equal(r.status, 409)
})
await step('booking marks the fan as going', async () => {
  const live = await fan('GET', '/live')
  assert.ok(live.body.mine.going.some((g: { matchId: string }) => g.matchId === 'rma-bar'))
})
await step('rejects venues that are not showing the game', async () => {
  const notShown = BROADCASTS.find((b) => b.venueId === venueId)!.matchId
  const other = ['f1-vegas', 'nfl-kc-buf', 'nba-den-okc'].find((m) => !BROADCASTS.some((b) => b.venueId === venueId && b.matchId === m))
  assert.ok(notShown)
  if (other) assert.equal((await fan('POST', '/going', { matchId: other, venueId })).status, 400)
})
await step('favourites a venue', async () => {
  assert.equal((await fan('POST', `/favorites/${venueId}`, {})).status, 200)
  assert.deepEqual((await fan('GET', '/me/community')).body.favorites, [venueId])
})

console.log('Watch party')
let slug = ''
await step('creates a party with a shareable slug', async () => {
  const r = await fan('POST', '/parties', { matchId: 'rma-bar', venueId, title: 'Clásico crew' })
  assert.equal(r.status, 201)
  slug = r.body.party.slug
  assert.equal(r.body.party.isHost, true)
})
await step('invites a friend by email; invite appears after they sign up', async () => {
  await fan('POST', `/parties/${slug}/invite`, { email: 'friend@example.test' })
  await friend('POST', '/auth/register', { name: 'Friend Person', email: 'friend@example.test', password: 'longenough2' })
  const c = await friend('GET', '/me/community')
  assert.equal(c.body.invites.length, 1)
  const j = await friend('POST', `/parties/${slug}/join`, {})
  assert.deepEqual(j.body.party.members, ['Test', 'Friend'])
  assert.equal((await friend('GET', '/me/community')).body.invites.length, 0, 'joining accepts the invite')
})
await step('public party page hides emails', async () => {
  const p = await client()('GET', `/parties/${slug}`)
  assert.equal(p.body.party.invites, undefined)
  assert.ok(!JSON.stringify(p.body).includes('@'))
})

console.log('Venue owner (Batch 4)')
await step('fans cannot reach the dashboard', async () => {
  assert.equal((await fan('GET', '/owner/analytics')).status, 403)
})
await step('owner signs in', async () => {
  const r = await ownerC('POST', '/auth/login', { email: `owner+${venueId}@cheers.test`, password: OWNER_PASSWORD })
  assert.equal(r.body.user.role, 'venue')
})
await step('owner sees the booking and checks the guest in', async () => {
  const list = await ownerC('GET', '/owner/bookings?matchId=rma-bar')
  assert.ok(list.body.bookings.some((b: { code: string }) => b.code === code))
  const c = await ownerC('POST', '/owner/checkin', { code: code.toLowerCase() })
  assert.equal(c.body.booking.status, 'checked_in')
  const again = await ownerC('POST', '/owner/checkin', { code })
  assert.equal(again.body.already, true)
})
await step('fan can no longer cancel a checked-in booking', async () => {
  assert.equal((await fan('POST', `/bookings/${code}/cancel`, {})).status, 400)
})
await step('owner of another venue cannot check this booking in', async () => {
  const other = client()
  await other('POST', '/auth/login', { email: 'owner+north-stand@cheers.test', password: OWNER_PASSWORD })
  assert.equal((await other('POST', '/owner/checkin', { code })).status, 409)
})
await step('owner verifies a broadcast and it reaches the public feed', async () => {
  const r = await ownerC('PUT', '/owner/broadcasts/rma-bar', { screens: 3, sound: true, status: 'verified' })
  assert.equal(r.status, 200)
  const live = await client()('GET', '/live')
  const ov = live.body.overrides.find((o: { venueId: string; matchId: string }) => o.venueId === venueId && o.matchId === 'rma-bar')
  assert.equal(ov.status, 'verified')
  assert.equal(ov.screens, 3)
})
await step('hiding a broadcast stops new bookings', async () => {
  await ownerC('PUT', '/owner/broadcasts/rma-bar', { screens: 1, sound: false, status: 'hidden' })
  const r = await friend('POST', '/bookings', { venueId, matchId: 'rma-bar', partySize: 2, slotOffset: 0 })
  assert.equal(r.status, 400)
  await ownerC('DELETE', '/owner/broadcasts/rma-bar')
})
await step('capacity setting is enforced', async () => {
  await ownerC('PUT', '/owner/settings', { tables: 0 })
  const r = await friend('POST', '/bookings', { venueId, matchId: 'rma-bar', partySize: 2, slotOffset: -90 })
  assert.equal(r.status, 409)
})
await step('analytics count attendance and repeat guests', async () => {
  const a = await ownerC('GET', '/owner/analytics')
  assert.ok(a.body.totals.bookings > 0)
  assert.ok(a.body.totals.attended >= 1)
  assert.ok(a.body.totals.repeatGuests >= 1, 'seeded regulars should register as repeat guests')
  assert.ok(a.body.seededCount > 0)
})
await step('venue claim code registers an owner once', async () => {
  const r = await client()('POST', '/auth/register', { name: 'Corner', email: 'corner@example.test', password: 'longenough3', venueCode: 'claim-corner-flag' })
  assert.equal(r.body.user.role, 'venue')
  assert.equal(r.body.user.venueId, 'corner-flag')
  const again = await client()('POST', '/auth/register', { name: 'X', email: 'x2@example.test', password: 'longenough3', venueCode: 'CLAIM-CORNER-FLAG' })
  assert.equal(again.status, 400)
})
await step('sign-out ends the session', async () => {
  await fan('POST', '/auth/logout', {})
  assert.equal((await fan('GET', '/auth/me')).body.user, null)
})

console.log(`\n${passed} checks passed`)
server.close()

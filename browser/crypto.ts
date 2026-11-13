/*
 * node:crypto stand-in for the static build: just the four functions the
 * server uses. Passwords never leave the visitor's browser in this build, so
 * scryptSync is an iterated SHA-256 rather than real scrypt.
 */

/** Bytes that print as hex, like a Node Buffer. */
export class Bytes extends Uint8Array {
  toString(enc?: string) {
    if (enc !== 'hex') return super.toString()
    return Array.from(this, (b) => b.toString(16).padStart(2, '0')).join('')
  }
  static fromHex(hex: string) {
    const out = new Bytes(hex.length >> 1)
    for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16)
    return out
  }
}

export function randomBytes(n: number) {
  return crypto.getRandomValues(new Bytes(n))
}

export function randomInt(min: number, max: number) {
  const span = max - min
  const buf = crypto.getRandomValues(new Uint32Array(1))
  return min + (buf[0] % span)
}

export function timingSafeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i]
  return d === 0
}

/* ---------------------------- SHA-256 (sync) --------------------------- */
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be,
  0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa,
  0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85,
  0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
  0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f,
  0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
])

function sha256(msg: Uint8Array): Uint8Array {
  const len = msg.length
  const padded = new Uint8Array(((len + 9 + 63) >> 6) << 6)
  padded.set(msg)
  padded[len] = 0x80
  const view = new DataView(padded.buffer)
  view.setUint32(padded.length - 4, len * 8)
  const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19])
  const W = new Uint32Array(64)
  const rot = (x: number, n: number) => (x >>> n) | (x << (32 - n))
  for (let o = 0; o < padded.length; o += 64) {
    for (let t = 0; t < 16; t++) W[t] = view.getUint32(o + t * 4)
    for (let t = 16; t < 64; t++) {
      const s0 = rot(W[t - 15], 7) ^ rot(W[t - 15], 18) ^ (W[t - 15] >>> 3)
      const s1 = rot(W[t - 2], 17) ^ rot(W[t - 2], 19) ^ (W[t - 2] >>> 10)
      W[t] = (W[t - 16] + s0 + W[t - 7] + s1) | 0
    }
    let [a, b, c, d, e, f, g, h] = H
    for (let t = 0; t < 64; t++) {
      const t1 = (h + (rot(e, 6) ^ rot(e, 11) ^ rot(e, 25)) + ((e & f) ^ (~e & g)) + K[t] + W[t]) | 0
      const t2 = ((rot(a, 2) ^ rot(a, 13) ^ rot(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0
      h = g
      g = f
      f = e
      e = (d + t1) | 0
      d = c
      c = b
      b = a
      a = (t1 + t2) | 0
    }
    H[0] += a
    H[1] += b
    H[2] += c
    H[3] += d
    H[4] += e
    H[5] += f
    H[6] += g
    H[7] += h
  }
  const out = new Uint8Array(32)
  const ov = new DataView(out.buffer)
  H.forEach((v, i) => ov.setUint32(i * 4, v))
  return out
}

export function scryptSync(pw: string, salt: string, keylen: number) {
  const enc = new TextEncoder()
  let block = sha256(enc.encode(`${salt}:${pw}`))
  for (let i = 0; i < 2000; i++) block = sha256(block)
  const out = new Bytes(keylen)
  for (let o = 0; o < keylen; o += 32) {
    block = sha256(block)
    out.set(block.subarray(0, Math.min(32, keylen - o)), o)
  }
  return out
}

// server/app.ts uses the Node global Buffer.from(hex, 'hex')
const g = globalThis as unknown as { Buffer?: unknown }
g.Buffer ??= { from: (s: string) => Bytes.fromHex(s) }

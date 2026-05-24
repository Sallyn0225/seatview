// ULID generation safe for the Cloudflare Workers runtime.
//
// We do NOT import the `ulid` package here: its module top-level eagerly calls
// `detectPrng()` (to build the default `ulid()` export), which throws on workerd
// with "secure crypto unusable, insecure Math.random not allowed" — the eager
// detection runs at IMPORT time, before any of our code, so even importing just
// `{ factory }` triggers it. So this is a tiny self-contained ULID built on the
// Worker's WebCrypto (`crypto.getRandomValues`), which IS available.
//
// ULID = 48-bit timestamp (10 Crockford base32 chars) + 80 bits randomness
// (16 chars) = 26 chars, lexicographically sortable by time. Matches the shape
// the D1 `photos.id` / `staging_venues.id` columns expect (prd Data Model).

const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford base32
const TIME_LEN = 10;
const RANDOM_LEN = 16;

function encodeTime(now: number): string {
  let t = now;
  let out = "";
  for (let i = TIME_LEN - 1; i >= 0; i--) {
    const mod = t % 32;
    out = ENCODING[mod] + out;
    t = (t - mod) / 32;
  }
  return out;
}

function encodeRandom(): string {
  const bytes = new Uint8Array(RANDOM_LEN);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < RANDOM_LEN; i++) {
    out += ENCODING[bytes[i]! % 32];
  }
  return out;
}

/** A new ULID (lexicographically sortable, time-prefixed). */
export function newId(now: number = Date.now()): string {
  return encodeTime(now) + encodeRandom();
}

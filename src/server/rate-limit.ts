// KV-backed IP rate limiting (R8 + ADR-12 token notes).
//
// Two reusable primitives, intentionally generic so the upload step (10/day +
// 30s cooldown) AND later the staging step (5/day, step 7) and admin (step 8)
// all share ONE implementation (code-reuse-thinking-guide):
//
//   • checkDailyLimit  — per-IP-hash per-UTC-day counter with a 24h TTL. Reads
//                         the current count, returns allowed/remaining WITHOUT
//                         incrementing (so a Turnstile failure or a later step
//                         failing does not burn the user's quota). Increment is
//                         a separate explicit call after the action succeeds.
//   • cooldown         — short single-action cooldown (upload's 30s, R8.1).
//
// All counts are keyed by the HASHED ip (never the raw IP — privacy, prd Data
// Model "ip_hash 不存原 IP"). The hashing itself lives in ./ip.ts so the key
// builders here only ever see an already-hashed value.

import type { KVNamespace } from "@cloudflare/workers-types";

/** A day-scoped quota scope. New scopes reuse the same machinery. */
export type RateScope = "upload" | "staging" | "photo_correction" | "rating";

export interface DailyLimitResult {
  /** Whether the current count is still under the limit. */
  allowed: boolean;
  /** How many actions remain today (never negative). */
  remaining: number;
  /** The count already recorded for today. */
  count: number;
}

/** UTC day bucket, e.g. `2026-05-24`. Counters auto-expire after `DAY_TTL_S`. */
function utcDay(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

/** Day-bucket counter key, e.g. `ratelimit:upload:<ipHash>:2026-05-24`. */
export function dayKey(
  scope: RateScope,
  ipHash: string,
  now: number = Date.now(),
): string {
  return `ratelimit:${scope}:${ipHash}:${utcDay(now)}`;
}

/** Single-action cooldown key, e.g. `ratelimit:upload:cooldown:<ipHash>`. */
export function cooldownKey(scope: RateScope, ipHash: string): string {
  return `ratelimit:${scope}:cooldown:${ipHash}`;
}

/** Slightly longer than a calendar day so a counter never expires mid-day. */
const DAY_TTL_S = 60 * 60 * 25; // 25h

/**
 * Read today's count for an IP hash and report whether another action is
 * allowed. Does NOT mutate the counter — call {@link incrementDaily} only after
 * the guarded action actually succeeds, so failures (Turnstile, R2, D1) do not
 * consume quota.
 */
export async function checkDailyLimit(
  kv: KVNamespace,
  scope: RateScope,
  ipHash: string,
  limit: number,
  now: number = Date.now(),
): Promise<DailyLimitResult> {
  const raw = await kv.get(dayKey(scope, ipHash, now));
  const count = raw ? Number.parseInt(raw, 10) || 0 : 0;
  return {
    allowed: count < limit,
    remaining: Math.max(0, limit - count),
    count,
  };
}

/**
 * Increment today's counter by one (after the guarded action succeeds). Refreshes
 * the 24h+ TTL on every write so the key reliably outlives the day it counts.
 * Returns the new count.
 *
 * Note: KV is eventually consistent (~60s propagation, research §8). For upload
 * abuse this is acceptable (prd accepts eventual consistency); the 30s cooldown
 * is the immediate burst guard, the daily counter is the slow-drip guard.
 */
export async function incrementDaily(
  kv: KVNamespace,
  scope: RateScope,
  ipHash: string,
  now: number = Date.now(),
): Promise<number> {
  const key = dayKey(scope, ipHash, now);
  const raw = await kv.get(key);
  const next = (raw ? Number.parseInt(raw, 10) || 0 : 0) + 1;
  await kv.put(key, String(next), { expirationTtl: DAY_TTL_S });
  return next;
}

/**
 * Whether the IP hash is still inside its cooldown window for this scope.
 * Cooldown keys self-expire via their TTL, so presence == still cooling.
 */
export async function isCoolingDown(
  kv: KVNamespace,
  scope: RateScope,
  ipHash: string,
): Promise<boolean> {
  const raw = await kv.get(cooldownKey(scope, ipHash));
  return raw !== null;
}

/**
 * Start a cooldown window (TTL seconds). Used after a successful upload so the
 * next upload from the same IP must wait `seconds` (R8.1: 30s).
 */
export async function startCooldown(
  kv: KVNamespace,
  scope: RateScope,
  ipHash: string,
  seconds: number,
): Promise<void> {
  await kv.put(cooldownKey(scope, ipHash), String(Date.now()), {
    expirationTtl: Math.max(1, Math.floor(seconds)),
  });
}

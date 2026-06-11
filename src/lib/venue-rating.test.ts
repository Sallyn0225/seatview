import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyOptimisticRating,
  isValidRatingScore,
  ratingAverage,
  RATING_MAX,
  RATING_MIN,
  type VenueRatingSummaryDto,
} from "./venue-rating.ts";

// These pure helpers ARE the rating math contract: the server's batch writes
// (src/server/ratings.ts) and the island's optimistic state both follow the
// transitions asserted here, so a drift in either is a failure of this spec.

describe("isValidRatingScore", () => {
  it("accepts every integer in RATING_MIN..RATING_MAX", () => {
    for (let n = RATING_MIN; n <= RATING_MAX; n++) {
      assert.equal(isValidRatingScore(n), true);
    }
  });

  it("rejects out-of-range integers", () => {
    assert.equal(isValidRatingScore(RATING_MIN - 1), false);
    assert.equal(isValidRatingScore(RATING_MAX + 1), false);
    assert.equal(isValidRatingScore(-3), false);
  });

  it("rejects non-integers and non-numbers", () => {
    assert.equal(isValidRatingScore(3.5), false);
    assert.equal(isValidRatingScore(Number.NaN), false);
    assert.equal(isValidRatingScore("3"), false);
    assert.equal(isValidRatingScore(null), false);
    assert.equal(isValidRatingScore(undefined), false);
    assert.equal(isValidRatingScore(true), false);
  });
});

describe("ratingAverage", () => {
  it("returns null when nobody rated (callers render the zero state)", () => {
    assert.equal(ratingAverage(0, 0), null);
  });

  it("rounds to one decimal", () => {
    assert.equal(ratingAverage(3, 13), 4.3); // 4.333…
    assert.equal(ratingAverage(3, 14), 4.7); // 4.666…
    assert.equal(ratingAverage(2, 9), 4.5);
    assert.equal(ratingAverage(1, 5), 5);
  });
});

describe("applyOptimisticRating", () => {
  const fresh: VenueRatingSummaryDto = { count: 12, sum: 51, yourScore: null };

  it("new rating: count + 1, sum + score, yourScore set", () => {
    assert.deepEqual(applyOptimisticRating(fresh, 4), {
      count: 13,
      sum: 55,
      yourScore: 4,
    });
  });

  it("score change: count unchanged, sum moves by the delta", () => {
    const rated: VenueRatingSummaryDto = { count: 13, sum: 55, yourScore: 4 };
    assert.deepEqual(applyOptimisticRating(rated, 2), {
      count: 13,
      sum: 53, // 55 - 4 + 2
      yourScore: 2,
    });
  });

  it("same score: idempotent no-op (no count or sum drift)", () => {
    const rated: VenueRatingSummaryDto = { count: 13, sum: 55, yourScore: 4 };
    assert.deepEqual(applyOptimisticRating(rated, 4), rated);
  });

  it("first rating on an unrated venue starts the aggregate", () => {
    const empty: VenueRatingSummaryDto = { count: 0, sum: 0, yourScore: null };
    assert.deepEqual(applyOptimisticRating(empty, 5), {
      count: 1,
      sum: 5,
      yourScore: 5,
    });
  });

  it("does not mutate the input summary (rollback keeps the original)", () => {
    const before: VenueRatingSummaryDto = { count: 2, sum: 7, yourScore: null };
    applyOptimisticRating(before, 3);
    assert.deepEqual(before, { count: 2, sum: 7, yourScore: null });
  });
});

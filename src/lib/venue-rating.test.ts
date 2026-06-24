import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyOptimisticRating,
  AGGREGATE_RATING_MIN_COUNT,
  emptyRatingSums,
  isValidRatingScore,
  isValidRatingScores,
  ratingDimensionAverage,
  ratingOverallAverage,
  venueAggregateRating,
  RATING_DIMENSIONS,
  RATING_MAX,
  RATING_MIN,
  type RatingDimensionScores,
  type VenueRatingSummaryDto,
} from "./venue-rating.ts";

const scores: RatingDimensionScores = {
  view: 5,
  sound: 4,
  amenities: 3,
  transit: 5,
};

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

describe("isValidRatingScores", () => {
  it("accepts exactly the four required dimensions", () => {
    assert.equal(isValidRatingScores(scores), true);
  });

  it("rejects missing, extra, malformed, or out-of-range dimensions", () => {
    assert.equal(isValidRatingScores({ ...scores, transit: undefined }), false);
    assert.equal(isValidRatingScores({ ...scores, extra: 4 }), false);
    assert.equal(isValidRatingScores({ ...scores, view: 3.5 }), false);
    assert.equal(isValidRatingScores({ ...scores, sound: 6 }), false);
    assert.equal(isValidRatingScores(null), false);
  });
});

describe("rating averages", () => {
  it("returns null when nobody rated", () => {
    const summary: VenueRatingSummaryDto = {
      count: 0,
      sums: emptyRatingSums(),
      yourScores: null,
    };
    assert.equal(ratingOverallAverage(summary), null);
    assert.equal(
      ratingDimensionAverage(summary.count, summary.sums, "view"),
      null,
    );
  });

  it("rounds dimension averages to one decimal", () => {
    assert.equal(
      ratingDimensionAverage(
        3,
        { view: 13, sound: 14, amenities: 9, transit: 5 },
        "view",
      ),
      4.3,
    );
    assert.equal(
      ratingDimensionAverage(
        3,
        { view: 13, sound: 14, amenities: 9, transit: 5 },
        "sound",
      ),
      4.7,
    );
  });

  it("computes overall from raw sums before dimension rounding", () => {
    const summary: VenueRatingSummaryDto = {
      count: 3,
      sums: { view: 13, sound: 14, amenities: 10, transit: 15 },
      yourScores: null,
    };
    assert.equal(ratingOverallAverage(summary), 4.3);
  });
});

describe("venueAggregateRating", () => {
  // A summary with `count` raters whose dimension sums average to 4.0 overall
  // (each of the 4 dimensions sums to count*4).
  const summaryWith = (count: number): VenueRatingSummaryDto => ({
    count,
    sums: {
      view: count * 4,
      sound: count * 4,
      amenities: count * 4,
      transit: count * 4,
    },
    yourScores: null,
  });

  it("returns null when nobody rated", () => {
    assert.equal(venueAggregateRating(summaryWith(0)), null);
  });

  it("returns null just below the min-count threshold", () => {
    assert.equal(
      venueAggregateRating(summaryWith(AGGREGATE_RATING_MIN_COUNT - 1)),
      null,
    );
  });

  it("projects ratingValue/count/best/worst at the threshold", () => {
    assert.deepEqual(venueAggregateRating(summaryWith(AGGREGATE_RATING_MIN_COUNT)), {
      ratingValue: 4,
      ratingCount: AGGREGATE_RATING_MIN_COUNT,
      bestRating: RATING_MAX,
      worstRating: RATING_MIN,
    });
  });
});

describe("applyOptimisticRating", () => {
  const fresh: VenueRatingSummaryDto = {
    count: 12,
    sums: { view: 51, sound: 48, amenities: 42, transit: 55 },
    yourScores: null,
  };

  it("new rating: count + 1, each sum increases, yourScores set", () => {
    assert.deepEqual(applyOptimisticRating(fresh, scores), {
      count: 13,
      sums: { view: 56, sound: 52, amenities: 45, transit: 60 },
      yourScores: scores,
    });
  });

  it("score change: count unchanged, each sum moves by its own delta", () => {
    const rated: VenueRatingSummaryDto = {
      count: 13,
      sums: { view: 56, sound: 52, amenities: 45, transit: 60 },
      yourScores: scores,
    };
    assert.deepEqual(
      applyOptimisticRating(rated, {
        view: 4,
        sound: 4,
        amenities: 5,
        transit: 5,
      }),
      {
        count: 13,
        sums: { view: 55, sound: 52, amenities: 47, transit: 60 },
        yourScores: { view: 4, sound: 4, amenities: 5, transit: 5 },
      },
    );
  });

  it("same scores: idempotent no-op", () => {
    const rated: VenueRatingSummaryDto = {
      count: 13,
      sums: { view: 56, sound: 52, amenities: 45, transit: 60 },
      yourScores: scores,
    };
    assert.deepEqual(applyOptimisticRating(rated, scores), rated);
  });

  it("does not mutate the input summary or scores", () => {
    const before: VenueRatingSummaryDto = {
      count: 2,
      sums: { view: 8, sound: 7, amenities: 6, transit: 9 },
      yourScores: null,
    };
    applyOptimisticRating(before, scores);
    assert.deepEqual(before, {
      count: 2,
      sums: { view: 8, sound: 7, amenities: 6, transit: 9 },
      yourScores: null,
    });
    assert.deepEqual(RATING_DIMENSIONS, [
      "view",
      "sound",
      "amenities",
      "transit",
    ]);
  });
});

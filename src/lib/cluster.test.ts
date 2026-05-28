import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clusterPoints, type LaidOutPoint } from "./cluster.ts";
import type { PhotoDto } from "@/lib/photos";

function point(id: string, x: number, y = 0): LaidOutPoint {
  return {
    photo: {
      id,
      venueId: "test-venue",
      subMapId: "default",
      xPercent: 0,
      yPercent: 0,
      imageKey: `${id}.webp`,
      width: 100,
      height: 100,
      seatLabel: id,
      performanceDate: null,
      eventName: null,
      description: null,
      createdAt: 0,
    } satisfies PhotoDto,
    x,
    y,
  };
}

function memberSets(points: readonly LaidOutPoint[], scale: number): string[] {
  return clusterPoints(points, scale)
    .map((cluster) => cluster.members.map((member) => member.photo.id).sort())
    .sort((a, b) => a[0]!.localeCompare(b[0]!))
    .map((members) => members.join(","));
}

describe("clusterPoints", () => {
  it("clusters transitive chains even when endpoints are beyond threshold", () => {
    const points = [
      point("a", 0),
      point("b", 20),
      point("c", 40),
      point("d", 60),
      point("e", 80),
    ];

    const clusters = clusterPoints(points, 1);

    assert.equal(clusters.length, 1);
    assert.deepEqual(
      clusters[0]!.members.map((member) => member.photo.id),
      ["a", "b", "c", "d", "e"],
    );
  });

  it("returns the same member sets regardless of input order", () => {
    const ordered = [
      point("a", 0),
      point("b", 20),
      point("c", 40),
      point("d", 120),
      point("e", 140),
    ];
    const shuffled = [
      ordered[3]!,
      ordered[1]!,
      ordered[4]!,
      ordered[0]!,
      ordered[2]!,
    ];

    assert.deepEqual(memberSets(shuffled, 1), memberSets(ordered, 1));
  });

  it("keeps distant tight groups as separate clusters", () => {
    const points = [
      point("a", 0),
      point("b", 20),
      point("c", 200),
      point("d", 220),
    ];

    assert.deepEqual(memberSets(points, 1), ["a,b", "c,d"]);
  });

  it("splits points when zoom makes the threshold stricter than all distances", () => {
    const points = [point("a", 0), point("b", 20), point("c", 40)];

    assert.deepEqual(memberSets(points, 3), ["a", "b", "c"]);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertSafeHeicSourceDimensions } from "./heic-decode.ts";

describe("assertSafeHeicSourceDimensions", () => {
  it("allows common high-resolution phone HEIC dimensions before downscaling", () => {
    assert.doesNotThrow(() => assertSafeHeicSourceDimensions(8064, 6048));
  });

  it("rejects invalid dimensions", () => {
    assert.throws(
      () => assertSafeHeicSourceDimensions(0, 6048),
      /invalid image dimensions/,
    );
    assert.throws(
      () => assertSafeHeicSourceDimensions(8064.5, 6048),
      /invalid image dimensions/,
    );
  });

  it("rejects source dimensions beyond the safety cap", () => {
    assert.throws(
      () => assertSafeHeicSourceDimensions(10000, 8000),
      /too large/,
    );
  });
});

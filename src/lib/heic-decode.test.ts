import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertSafeHeicSourceDimensions,
  HeicImageTooLargeError,
} from "./heic-decode.ts";

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

  it("flags the too-large case with a discriminable error type", () => {
    // The UI keys off the error type to show "use a smaller image" instead of
    // the generic "try another format" — keep that contract typed, not stringly.
    assert.throws(
      () => assertSafeHeicSourceDimensions(10000, 8000),
      HeicImageTooLargeError,
    );
    // Invalid dimensions stay a generic failure, NOT the too-large type.
    assert.throws(
      () => assertSafeHeicSourceDimensions(0, 6048),
      (err) => {
        assert.ok(!(err instanceof HeicImageTooLargeError));
        return true;
      },
    );
  });
});

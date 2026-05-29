const HEIC_TYPES = new Set([
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
]);

export function isHeic(file: File): boolean {
  if (HEIC_TYPES.has(file.type)) return true;
  const ext = file.name.split(".").pop()?.toLowerCase();
  return ext === "heic" || ext === "heif";
}

/**
 * Thrown when a source HEIC exceeds the safe decode caps. Distinct from a
 * generic decode failure so the UI can route it to a size-specific message
 * ("use a smaller image") instead of the generic "try another format".
 */
export class HeicImageTooLargeError extends Error {
  constructor(message = "HEIC image is too large to decode safely") {
    super(message);
    this.name = "HeicImageTooLargeError";
  }
}

/** Output dimension cap for browser canvas conversion. */
const MAX_OUTPUT_DIMENSION = 4096;
const MAX_SOURCE_DIMENSION = 16384;
/** Source pixel cap before RGBA allocation; must still allow 48MP phone HEICs. */
const MAX_SOURCE_PIXELS = 64_000_000;

export function assertSafeHeicSourceDimensions(
  width: number,
  height: number,
): void {
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new Error("HEIC decode failed: invalid image dimensions");
  }

  if (
    width > MAX_SOURCE_DIMENSION ||
    height > MAX_SOURCE_DIMENSION ||
    width * height > MAX_SOURCE_PIXELS
  ) {
    throw new HeicImageTooLargeError();
  }
}

// libheif-js' HeifDecoder has no free(): the native heif_context it allocates
// (heif_context_alloc, in the WASM heap) is only released at the START of the
// SAME decoder's next decode() — JS GC of the wrapper never frees it. A fresh
// decoder per call therefore leaks one context per HEIC for the page lifetime.
// Uploads are strictly sequential (one file at a time), so a shared singleton
// is safe and bounds the leak to at most one outstanding context: every decode
// frees the previous one.
let sharedDecoder: import("libheif-js").HeifDecoder | null = null;

/**
 * Decode a HEIC/HEIF file via libheif-js (WASM) and return a WebP Blob.
 * Runs entirely in the browser — no server round-trip.
 */
export async function heicToBlob(
  file: File,
  signal?: AbortSignal,
): Promise<Blob> {
  signal?.throwIfAborted();

  // Reading the file and loading the (large) WASM bundle are independent —
  // run them concurrently so the module download/parse overlaps the file read.
  const [buffer, libheif] = await Promise.all([
    file.arrayBuffer(),
    import("libheif-js/wasm-bundle"),
  ]);
  sharedDecoder ??= new libheif.HeifDecoder();
  const images = sharedDecoder.decode(buffer);
  if (!images || images.length === 0) {
    throw new Error("HEIC decode failed: no images found");
  }
  const img = images[0]!;

  try {
    const srcW = img.get_width();
    const srcH = img.get_height();
    assertSafeHeicSourceDimensions(srcW, srcH);

    // Scale down if either dimension exceeds the cap (preserve aspect ratio).
    const needsResize =
      srcW > MAX_OUTPUT_DIMENSION || srcH > MAX_OUTPUT_DIMENSION;
    let width = srcW;
    let height = srcH;
    if (needsResize) {
      const scale = MAX_OUTPUT_DIMENSION / Math.max(srcW, srcH);
      width = Math.round(srcW * scale);
      height = Math.round(srcH * scale);
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;

    signal?.throwIfAborted();

    // libheif-js display() fills pixelData.data in-place, then calls callback
    // with the same object. The pre-allocation is required by the API.
    // Allocate at the ORIGINAL dimensions — libheif decodes at full resolution,
    // and we use createImageBitmap + drawImage to scale down afterward.
    const pixelData = { data: new Uint8ClampedArray(srcW * srcH * 4) };
    await new Promise<void>((resolve, reject) => {
      // display() decodes at full resolution and can take several seconds for a
      // 48MP source. Honor abort during that window instead of only before/after
      // (the throwIfAborted on either side would otherwise let a cancelled
      // decode run to completion before bailing).
      const onAbort = () =>
        reject(signal?.reason ?? new DOMException("Aborted", "AbortError"));
      if (signal?.aborted) {
        onAbort();
        return;
      }
      signal?.addEventListener("abort", onAbort, { once: true });
      const settle = (run: () => void) => {
        signal?.removeEventListener("abort", onAbort);
        run();
      };

      img.display(pixelData, (result: { data: Uint8ClampedArray } | null) => {
        // Fallback: some libheif-js versions may return null here but fill
        // pixelData.data directly.
        const data = result?.data ?? pixelData.data;
        if (!data || data.length === 0) {
          settle(() => reject(new Error("HEIC display failed")));
          return;
        }
        const imageData = new ImageData(
          data as Uint8ClampedArray<ArrayBuffer>,
          srcW,
          srcH,
        );
        // If we need to resize, downscale during decode via createImageBitmap's
        // resize options. This avoids materializing a SECOND full-resolution
        // bitmap (the full-res RGBA buffer above is already unavoidable —
        // libheif decodes at native resolution), keeping peak memory near one
        // source buffer instead of two on large phone HEICs.
        if (needsResize) {
          createImageBitmap(imageData, {
            resizeWidth: width,
            resizeHeight: height,
            resizeQuality: "high",
          }).then(
            (bmp) => {
              // Keep the explicit destination size: if a browser ignores the
              // resize options above (older Safari), bmp is still full-res and
              // this scales it down — without it, drawImage would crop instead.
              ctx.drawImage(bmp, 0, 0, width, height);
              bmp.close();
              settle(resolve);
            },
            (err) => settle(() => reject(err)),
          );
        } else {
          ctx.putImageData(imageData, 0, 0);
          settle(resolve);
        }
      });
    });

    signal?.throwIfAborted();

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (b && b.size > 0) resolve(b);
          else reject(new Error("Canvas toBlob failed"));
        },
        "image/webp",
        0.92,
      );
    });

    return blob;
  } finally {
    for (const image of images) {
      image.free();
    }
  }
}

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
    throw new Error("HEIC image is too large to decode safely");
  }
}

/**
 * Decode a HEIC/HEIF file via libheif-js (WASM) and return a WebP Blob.
 * Runs entirely in the browser — no server round-trip.
 */
export async function heicToBlob(
  file: File,
  signal?: AbortSignal,
): Promise<Blob> {
  signal?.throwIfAborted();

  const buffer = await file.arrayBuffer();
  const libheif = await import("libheif-js/wasm-bundle");
  const decoder = new libheif.HeifDecoder();
  const images = decoder.decode(buffer);
  if (!images || images.length === 0) {
    throw new Error("HEIC decode failed: no images found");
  }
  const img = images[0]!;

  try {
    const srcW = img.get_width();
    const srcH = img.get_height();
    assertSafeHeicSourceDimensions(srcW, srcH);

    // Scale down if either dimension exceeds the cap (preserve aspect ratio).
    let width = srcW;
    let height = srcH;
    if (width > MAX_OUTPUT_DIMENSION || height > MAX_OUTPUT_DIMENSION) {
      const scale = MAX_OUTPUT_DIMENSION / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
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
      img.display(pixelData, (result: { data: Uint8ClampedArray } | null) => {
        // Fallback: some libheif-js versions may return null here but fill
        // pixelData.data directly.
        const data = result?.data ?? pixelData.data;
        if (!data || data.length === 0) {
          reject(new Error("HEIC display failed"));
          return;
        }
        const imageData = new ImageData(
          data as Uint8ClampedArray<ArrayBuffer>,
          srcW,
          srcH,
        );
        // If we need to resize, drawImage handles the scaling.
        if (width !== srcW || height !== srcH) {
          createImageBitmap(imageData).then((bmp) => {
            ctx.drawImage(bmp, 0, 0, width, height);
            bmp.close();
            resolve();
          }, reject);
        } else {
          ctx.putImageData(imageData, 0, 0);
          resolve();
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

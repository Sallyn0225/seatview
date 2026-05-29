// Client-side image processing (R5) — runs entirely in the browser, no Worker
// CPU. Wraps browser-image-compression (Web Worker, ~40KB,
// frontend-libraries.md) with the SeatView parameters:
//   • long edge → 1920px   (R5.2, maxWidthOrHeight)
//   • format    → WebP     (R5.3, fileType "image/webp")
//   • EXIF      → dropped   (R5.4, preserveExif:false = default; re-encoding to
//                            WebP via canvas also strips metadata, so GPS/orient
//                            do not survive)
//   • size      → ~500KB    (R5.5, maxSizeMB 0.5; the lib iterates quality down
//                            to hit the target)
//
// Browser-only: imported lazily by the upload Sheet so the compression library
// (and its Web Worker) is not in the venue page's initial bundle.

import imageCompression from "browser-image-compression";
import { isHeic, heicToBlob } from "./heic-decode";

/** R5 target: ~500KB. */
const MAX_SIZE_MB = 0.5;
/** R5.2: long edge cap. */
const MAX_LONG_EDGE = 1920;
/** Output mime (R5.3). */
const OUTPUT_TYPE = "image/webp";

export interface CompressResult {
  /** The compressed WebP file (renamed `.webp`). */
  file: File;
  /** Final byte size (for the "photo.webp · 480KB" summary, shape Step 2). */
  bytes: number;
  /** Intrinsic pixel width of the compressed WebP (real aspect ratio). */
  width: number;
  /** Intrinsic pixel height of the compressed WebP. */
  height: number;
}

/**
 * Read the intrinsic pixel dimensions of an image blob. Prefer
 * `createImageBitmap` (decodes off the main thread, no DOM); fall back to an
 * `<img>` + object URL where the bitmap API is unavailable. The dimensions are
 * taken from the FINAL compressed WebP — the exact bytes that get uploaded — so
 * the persisted `photos.width`/`height` match the stored image (masonry lays
 * out at the real ratio, no crop, no CLS).
 */
async function readImageSize(
  file: Blob,
): Promise<{ width: number; height: number }> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    try {
      return { width: bitmap.width, height: bitmap.height };
    } finally {
      bitmap.close();
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<{ width: number; height: number }>(
      (resolve, reject) => {
        const img = new Image();
        img.onload = () =>
          resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => reject(new Error("decode failed"));
        img.src = url;
      },
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Compress a user-picked image to a SeatView-spec WebP. `onProgress` (0..100)
 * drives the Sheet's "压缩中... 72%" bar. `signal` lets the Sheet cancel if the
 * user picks a different file mid-compress.
 *
 * Throws if the lib fails (corrupt / unsupported file). The Sheet maps a throw
 * to its Step 2 inline error + "换一张" without losing the rest of the form.
 */
export async function compressToWebp(
  source: File,
  onProgress?: (percent: number) => void,
  signal?: AbortSignal,
): Promise<CompressResult> {
  // HEIC/HEIF is not supported by browser Canvas — convert via WASM first.
  // The intermediate name is irrelevant: the final `.webp` name below is
  // derived from `source.name`, and imageCompression keys off the explicit
  // `fileType` option, not the input extension.
  let input = source;
  if (isHeic(source)) {
    const blob = await heicToBlob(source, signal);
    input = new File([blob], "source.webp", {
      type: "image/webp",
      lastModified: Date.now(),
    });
  }

  const compressed = await imageCompression(input, {
    maxSizeMB: MAX_SIZE_MB,
    maxWidthOrHeight: MAX_LONG_EDGE,
    fileType: OUTPUT_TYPE,
    useWebWorker: true,
    preserveExif: false, // R5.4: do not carry EXIF (privacy)
    onProgress,
    signal,
  });

  // Normalize the name to `.webp` so the summary + R2 key extension agree.
  const baseName = source.name.replace(/\.[^./\\]+$/, "") || "photo";
  const file = new File([compressed], `${baseName}.webp`, {
    type: OUTPUT_TYPE,
    lastModified: Date.now(),
  });
  // Read the dimensions off the compressed WebP (the exact uploaded bytes), so
  // they match what the server stores and the grid lays out (no crop, no CLS).
  const { width, height } = await readImageSize(file);
  return { file, bytes: file.size, width, height };
}

/** Human byte size for the summary line, e.g. "480 KB" / "1.2 MB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

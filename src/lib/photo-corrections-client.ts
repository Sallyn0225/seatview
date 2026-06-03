import type {
  PhotoCorrectionErrorCode,
  PhotoCorrectionRequest,
  PhotoCorrectionResponse,
} from "@/lib/photo-corrections";

/** A typed transport failure the Lightbox maps to localized inline copy. */
export class PhotoCorrectionError extends Error {
  constructor(
    readonly code: PhotoCorrectionErrorCode | "network",
    readonly status?: number,
  ) {
    super(code);
    this.name = "PhotoCorrectionError";
  }
}

async function parseErrorCode(
  res: Response,
): Promise<PhotoCorrectionErrorCode | "network"> {
  try {
    const data = (await res.json()) as { error?: PhotoCorrectionErrorCode };
    return data.error ?? "server_error";
  } catch {
    return "server_error";
  }
}

/** Submit one anonymous seat-label correction request. Not retried. */
export async function submitPhotoCorrection(
  photoId: string,
  requestedSeatLabel: string,
  turnstileToken: string,
  signal?: AbortSignal,
): Promise<PhotoCorrectionResponse> {
  const body: PhotoCorrectionRequest = {
    photoId,
    requestedSeatLabel,
    turnstileToken,
  };
  let res: Response;
  try {
    res = await fetch("/api/photo-corrections", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch {
    throw new PhotoCorrectionError("network");
  }
  if (!res.ok) {
    throw new PhotoCorrectionError(await parseErrorCode(res), res.status);
  }
  return (await res.json()) as PhotoCorrectionResponse;
}

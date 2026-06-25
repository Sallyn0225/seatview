import type {
  PhotoCorrectionErrorCode,
  PhotoCorrectionRequest,
  PhotoCorrectionResponse,
} from "@/lib/photo-corrections";
import { TransportError, parseErrorCode } from "@/lib/transport";

/** A typed transport failure the Lightbox maps to localized inline copy. */
export class PhotoCorrectionError extends TransportError<PhotoCorrectionErrorCode> {
  constructor(code: PhotoCorrectionErrorCode | "network", status?: number) {
    super(code, status);
    this.name = "PhotoCorrectionError";
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
    throw new PhotoCorrectionError(
      await parseErrorCode<PhotoCorrectionErrorCode>(res),
      res.status,
    );
  }
  return (await res.json()) as PhotoCorrectionResponse;
}

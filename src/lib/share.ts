// Photo deep-link + share helpers.
//
// A photo's canonical share link carries the photo ULID in the query
// (`?photo=<id>`), alongside the existing `?tab=<sub-map>` (src/lib/submap.ts).
// The ULID alone resolves venue + sub-map server-side, so a shared link still
// opens after a sub-map rename (the same "rename never breaks links" rationale
// as `?tab=`, prd.md routing design). `tab` is kept only for readability and as
// a graceful fallback when the photo is gone.

import type { Locale } from "@/i18n/config";
import { fillTemplate } from "@/lib/format";
import { SUBMAP_QUERY_PARAM } from "@/lib/submap";

export const PHOTO_QUERY_PARAM = "photo";

/** Canonical site origin for share links (prod = https://seat.genchi.top),
 *  falling back to the live origin on the client. */
function shareOrigin(): string {
  const configured = import.meta.env.PUBLIC_SITE_URL as string | undefined;
  if (configured) return configured.replace(/\/+$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "https://seat.genchi.top";
}

/** Build the canonical share URL for one photo (current viewing locale). */
export function buildShareUrl(
  locale: Locale,
  venueId: string,
  subMapId: string,
  photoId: string,
): string {
  const url = new URL(`/${locale}/v/${venueId}`, shareOrigin());
  url.searchParams.set(SUBMAP_QUERY_PARAM, subMapId);
  url.searchParams.set(PHOTO_QUERY_PARAM, photoId);
  return url.toString();
}

export interface ShareTextTemplates {
  /** `{venue}` + `{region}` + `{url}` — used when the venue has real sub-maps. */
  withRegion: string;
  /** `{venue}` + `{url}` — used for single-map ("全场") venues. */
  withoutRegion: string;
}

/** Compose the share blurb. `region` null → drop the region clause entirely. */
export function buildShareText(
  templates: ShareTextTemplates,
  opts: { venue: string; region: string | null; url: string },
): string {
  if (opts.region) {
    return fillTemplate(templates.withRegion, {
      venue: opts.venue,
      region: opts.region,
      url: opts.url,
    });
  }
  return fillTemplate(templates.withoutRegion, {
    venue: opts.venue,
    url: opts.url,
  });
}

/** Read a photo id from a URL's query, if present. */
export function readPhotoIdFromUrl(url: URL): string | undefined {
  return url.searchParams.get(PHOTO_QUERY_PARAM) ?? undefined;
}

/**
 * Reflect the currently-open photo in the address bar (no reload, no history
 * entry) so the bare URL stays shareable / reloadable. Pass null to clear it on
 * close. Client-only; mirrors `setActiveSubMap`'s replaceState approach.
 */
export function setPhotoIdInUrl(photoId: string | null): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (photoId) url.searchParams.set(PHOTO_QUERY_PARAM, photoId);
  else url.searchParams.delete(PHOTO_QUERY_PARAM);
  window.history.replaceState(null, "", url.toString());
}

/**
 * Copy text to the clipboard with a legacy fallback for non-secure contexts /
 * older browsers. Returns whether the copy succeeded.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

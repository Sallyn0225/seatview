// JSON-LD builders for AI/search structured data (R2.2/R2.3).
//
// Pure functions: (domain data) → a plain JSON-LD object. The Astro pages
// serialize the result into a <script type="application/ld+json"> in <head>.
// No request/DOM access so they unit-test directly. Venue names are resolved
// per locale; user-authored content is never embedded here.

import type { Venue } from "@/types/venue";
import type { Prefecture } from "@/data/prefectures";
import { prefectureName } from "@/data/prefectures";
import { venueName } from "@/i18n";
import type { Locale } from "@/i18n/config";
import {
  venueAggregateRating,
  type VenueRatingSummaryDto,
} from "@/lib/venue-rating";
import {
  buildBreadcrumbLd,
  buildMusicVenueLd,
  buildOrganizationLd,
  buildVenuePhotosLd,
  buildWebsiteLd,
  type VenueImageLd,
} from "@/lib/seo/jsonld-core";

type JsonLd = Record<string, unknown>;

/** CC BY-NC 4.0 — the single license every uploaded photo is contributed under. */
export const PHOTO_LICENSE_URL =
  "https://creativecommons.org/licenses/by-nc/4.0/";

/** Cap how many seat-view photos enter the ImageGallery JSON-LD (keep <head> lean). */
export const VENUE_PHOTOS_LD_MAX = 30;

/**
 * `MusicVenue` for a venue page. Address is resolved as far as the data goes:
 * country (always JP), region (prefecture), locality (city). The first sub-map
 * image stands in as a representative image.
 */
export function musicVenueLd(
  venue: Venue,
  prefecture: Prefecture | undefined,
  locale: Locale,
  siteUrl: string | URL,
  ratingSummary?: VenueRatingSummaryDto,
): JsonLd {
  return buildMusicVenueLd({
    id: venue.id,
    name: venueName(venue, locale),
    aliases: venue.aliases,
    city: venue.city,
    imagePath: venue.subMaps[0]?.imageUrl,
    prefectureName: prefecture ? prefectureName(prefecture, locale) : undefined,
    locale,
    siteUrl,
    // Only attached when the venue clears the min-sample threshold (SEO B).
    aggregateRating: ratingSummary
      ? (venueAggregateRating(ratingSummary) ?? undefined)
      : undefined,
  });
}

/**
 * `ImageGallery` of a venue's seat-view photos for crawler image discovery.
 * Caller passes already-resolved (URL + locale-aware caption) images — kept out
 * of this layer so date/locale formatting stays at the page. Caps at
 * {@link VENUE_PHOTOS_LD_MAX}. Returns `null` when there are no photos.
 */
export function venuePhotosLd(
  name: string,
  pageUrl: string,
  images: readonly VenueImageLd[],
): JsonLd | null {
  return buildVenuePhotosLd({
    name,
    pageUrl,
    images: images.slice(0, VENUE_PHOTOS_LD_MAX),
    license: PHOTO_LICENSE_URL,
  });
}

/** `BreadcrumbList`: Home → Prefecture (when known) → Venue. */
export function breadcrumbLd(
  venue: Venue,
  prefecture: Prefecture | undefined,
  locale: Locale,
  siteUrl: string | URL,
  homeName: string,
): JsonLd {
  return buildBreadcrumbLd({
    locale,
    siteUrl,
    homeName,
    venueId: venue.id,
    venueName: venueName(venue, locale),
    prefectureName: prefecture ? prefectureName(prefecture, locale) : undefined,
  });
}

/** `WebSite` for the home page. No SearchAction (search is client-side only). */
export function websiteLd(
  siteUrl: string | URL,
  locale: Locale,
  name: string,
  description: string,
): JsonLd {
  return buildWebsiteLd(siteUrl, locale, name, description);
}

/** `Organization` for the home page. */
export function organizationLd(siteUrl: string | URL, name: string): JsonLd {
  return buildOrganizationLd(siteUrl, name);
}

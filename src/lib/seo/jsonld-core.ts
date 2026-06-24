type JsonLd = Record<string, unknown>;

function abs(path: string, siteUrl: string | URL): string {
  return new URL(path, siteUrl).href;
}

export interface AggregateRatingLd {
  ratingValue: number;
  ratingCount: number;
  bestRating: number;
  worstRating: number;
}

export interface MusicVenueLdInput {
  id: string;
  name: string;
  aliases: readonly string[];
  city: string;
  imagePath?: string | undefined;
  prefectureName?: string | undefined;
  locale: string;
  siteUrl: string | URL;
  // Omitted when the venue has too few ratings to expose (SEO B); only attached
  // when present, so low-sample venues carry no aggregateRating at all.
  aggregateRating?: AggregateRatingLd | undefined;
}

export function buildMusicVenueLd(input: MusicVenueLdInput): JsonLd {
  const address: JsonLd = {
    "@type": "PostalAddress",
    addressCountry: "JP",
  };
  if (input.prefectureName) address.addressRegion = input.prefectureName;
  if (input.city) address.addressLocality = input.city;

  const ld: JsonLd = {
    "@context": "https://schema.org",
    "@type": "MusicVenue",
    name: input.name,
    url: abs(`/${input.locale}/v/${input.id}`, input.siteUrl),
    address,
  };
  if (input.imagePath) ld.image = abs(input.imagePath, input.siteUrl);
  if (input.aliases.length > 0) ld.alternateName = [...input.aliases];
  if (input.aggregateRating) {
    ld.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: input.aggregateRating.ratingValue,
      ratingCount: input.aggregateRating.ratingCount,
      bestRating: input.aggregateRating.bestRating,
      worstRating: input.aggregateRating.worstRating,
    };
  }
  return ld;
}

export interface BreadcrumbLdInput {
  locale: string;
  siteUrl: string | URL;
  homeName: string;
  venueId: string;
  venueName: string;
  prefectureName?: string | undefined;
}

/** `BreadcrumbList`: Home → Prefecture (when known) → Venue. */
export function buildBreadcrumbLd(input: BreadcrumbLdInput): JsonLd {
  const itemListElement: JsonLd[] = [
    {
      "@type": "ListItem",
      position: 1,
      name: input.homeName,
      item: abs(`/${input.locale}/`, input.siteUrl),
    },
  ];

  if (input.prefectureName) {
    itemListElement.push({
      "@type": "ListItem",
      position: 2,
      name: input.prefectureName,
    });
  }

  itemListElement.push({
    "@type": "ListItem",
    position: itemListElement.length + 1,
    name: input.venueName,
    item: abs(`/${input.locale}/v/${input.venueId}`, input.siteUrl),
  });

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement,
  };
}

/** `WebSite` for the home page. No SearchAction (search is client-side only). */
export function buildWebsiteLd(
  siteUrl: string | URL,
  locale: string,
  name: string,
  description: string,
): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name,
    url: abs(`/${locale}/`, siteUrl),
    description,
    inLanguage: locale,
  };
}

/** `Organization` for the home page. */
export function buildOrganizationLd(
  siteUrl: string | URL,
  name: string,
): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name,
    url: abs("/", siteUrl),
    logo: abs("/logo-mark.png", siteUrl),
  };
}

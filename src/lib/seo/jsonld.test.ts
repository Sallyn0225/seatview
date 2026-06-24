import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildBreadcrumbLd,
  buildMusicVenueLd,
  buildOrganizationLd,
  buildVenuePhotosLd,
  buildWebsiteLd,
} from "./jsonld-core.ts";

describe("buildMusicVenueLd", () => {
  it("builds the required MusicVenue fields and address structure", () => {
    assert.deepEqual(
      buildMusicVenueLd({
        id: "ariake-arena",
        name: "有明竞技馆",
        aliases: ["Ariake Arena"],
        city: "江東区",
        imagePath: "/seatmaps/ariake-arena/default.webp",
        prefectureName: "东京都",
        locale: "zh",
        siteUrl: "https://seat.genchi.top",
      }),
      {
        "@context": "https://schema.org",
        "@type": "MusicVenue",
        name: "有明竞技馆",
        url: "https://seat.genchi.top/zh/v/ariake-arena",
        address: {
          "@type": "PostalAddress",
          addressCountry: "JP",
          addressRegion: "东京都",
          addressLocality: "江東区",
        },
        image: "https://seat.genchi.top/seatmaps/ariake-arena/default.webp",
        alternateName: ["Ariake Arena"],
      },
    );
  });
});

describe("buildMusicVenueLd aggregateRating", () => {
  const base = {
    id: "ariake-arena",
    name: "有明竞技馆",
    aliases: [] as string[],
    city: "江東区",
    locale: "zh",
    siteUrl: "https://seat.genchi.top",
  };

  it("attaches an AggregateRating when one is provided", () => {
    const ld = buildMusicVenueLd({
      ...base,
      aggregateRating: {
        ratingValue: 4.3,
        ratingCount: 12,
        bestRating: 5,
        worstRating: 1,
      },
    });
    assert.deepEqual(ld.aggregateRating, {
      "@type": "AggregateRating",
      ratingValue: 4.3,
      ratingCount: 12,
      bestRating: 5,
      worstRating: 1,
    });
  });

  it("omits aggregateRating entirely when not provided", () => {
    const ld = buildMusicVenueLd(base);
    assert.equal("aggregateRating" in ld, false);
  });
});

describe("buildBreadcrumbLd", () => {
  it("builds Home -> Prefecture -> Venue breadcrumbs when prefecture is known", () => {
    assert.deepEqual(
      buildBreadcrumbLd({
        locale: "zh",
        siteUrl: "https://seat.genchi.top",
        homeName: "首页",
        prefectureName: "东京都",
        venueName: "有明竞技馆",
        venueId: "ariake-arena",
      }),
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "首页",
            item: "https://seat.genchi.top/zh/",
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "东京都",
          },
          {
            "@type": "ListItem",
            position: 3,
            name: "有明竞技馆",
            item: "https://seat.genchi.top/zh/v/ariake-arena",
          },
        ],
      },
    );
  });
});

describe("buildVenuePhotosLd", () => {
  it("returns null when there are no photos", () => {
    assert.equal(
      buildVenuePhotosLd({
        name: "有明竞技馆",
        pageUrl: "https://seat.genchi.top/zh/v/ariake-arena",
        images: [],
      }),
      null,
    );
  });

  it("builds an ImageGallery of ImageObjects with caption + license", () => {
    const ld = buildVenuePhotosLd({
      name: "有明竞技馆",
      pageUrl: "https://seat.genchi.top/zh/v/ariake-arena",
      license: "https://creativecommons.org/licenses/by-nc/4.0/",
      images: [
        {
          contentUrl: "https://img.genchi.top/abc.webp",
          caption: "2階 A列 — ライブ · 2026-05-01",
          width: 1600,
          height: 1200,
        },
      ],
    });
    assert.equal(ld?.["@type"], "ImageGallery");
    assert.deepEqual(ld?.image, [
      {
        "@type": "ImageObject",
        contentUrl: "https://img.genchi.top/abc.webp",
        caption: "2階 A列 — ライブ · 2026-05-01",
        width: 1600,
        height: 1200,
        license: "https://creativecommons.org/licenses/by-nc/4.0/",
      },
    ]);
  });
});

describe("home page JSON-LD builders", () => {
  it("builds WebSite and Organization entities", () => {
    assert.equal(
      buildWebsiteLd(
        "https://seat.genchi.top",
        "zh",
        "SeatView",
        "Real seat views",
      )["@type"],
      "WebSite",
    );
    assert.deepEqual(
      buildOrganizationLd("https://seat.genchi.top", "SeatView"),
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "SeatView",
        url: "https://seat.genchi.top/",
        logo: "https://seat.genchi.top/logo-mark.png",
      },
    );
  });
});

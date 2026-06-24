import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildBreadcrumbLd,
  buildMusicVenueLd,
  buildOrganizationLd,
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

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  localeAlternatesForConfig,
  stripLocale,
  type HreflangConfig,
} from "./hreflang-core.ts";

const locales = ["zh", "ja", "en", "ko"] as const;
type TestLocale = (typeof locales)[number];

const config: HreflangConfig<TestLocale> = {
  locales,
  defaultLocale: "zh",
  hreflang: {
    zh: "zh-Hans",
    ja: "ja",
    en: "en",
    ko: "ko",
  },
  isLocale(value: string | undefined): value is TestLocale {
    return (
      value !== undefined && (locales as readonly string[]).includes(value)
    );
  },
};

describe("stripLocale", () => {
  it("strips locale-prefixed root and nested paths", () => {
    assert.equal(stripLocale("/zh/", config.isLocale), "/");
    assert.equal(stripLocale("/zh", config.isLocale), "/");
    assert.equal(
      stripLocale("/zh/v/k-arena-yokohama", config.isLocale),
      "/v/k-arena-yokohama",
    );
  });

  it("leaves unknown or unprefixed paths unchanged", () => {
    assert.equal(
      stripLocale("/fr/v/k-arena-yokohama", config.isLocale),
      "/fr/v/k-arena-yokohama",
    );
    assert.equal(
      stripLocale("/v/k-arena-yokohama", config.isLocale),
      "/v/k-arena-yokohama",
    );
  });
});

describe("localeAlternatesForConfig", () => {
  it("builds all locale alternates plus x-default for the root route", () => {
    assert.deepEqual(
      localeAlternatesForConfig("/zh/", "https://seat.genchi.top", config),
      [
        { hreflang: "zh-Hans", href: "https://seat.genchi.top/zh/" },
        { hreflang: "ja", href: "https://seat.genchi.top/ja/" },
        { hreflang: "en", href: "https://seat.genchi.top/en/" },
        { hreflang: "ko", href: "https://seat.genchi.top/ko/" },
        { hreflang: "x-default", href: "https://seat.genchi.top/zh/" },
      ],
    );
  });

  it("rebuilds equivalent locale paths for a venue route", () => {
    assert.deepEqual(
      localeAlternatesForConfig(
        "/ja/v/tokyo-dome",
        "https://seat.genchi.top",
        config,
      ),
      [
        {
          hreflang: "zh-Hans",
          href: "https://seat.genchi.top/zh/v/tokyo-dome",
        },
        { hreflang: "ja", href: "https://seat.genchi.top/ja/v/tokyo-dome" },
        { hreflang: "en", href: "https://seat.genchi.top/en/v/tokyo-dome" },
        { hreflang: "ko", href: "https://seat.genchi.top/ko/v/tokyo-dome" },
        {
          hreflang: "x-default",
          href: "https://seat.genchi.top/zh/v/tokyo-dome",
        },
      ],
    );
  });
});

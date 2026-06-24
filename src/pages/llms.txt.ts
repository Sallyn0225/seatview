// GET /llms.txt — context file for AI systems (llmstxt.org), R3.1.
//
// A plain-text overview an LLM can read without rendering: what SeatView is, the
// key entry pages, and the full venue list with canonical (zh) URLs. Generated
// from the static `venues` array so it stays current as venues are added.
import type { APIRoute } from "astro";
import { venues } from "@/data/venues";

export const prerender = false;

export const GET: APIRoute = ({ request }) => {
  const siteUrl =
    import.meta.env.PUBLIC_SITE_URL ?? new URL(request.url).origin;
  const url = (path: string) => new URL(path, siteUrl).href;

  const venueLines = venues
    .map((v) => `- ${v.name_zh} / ${v.name_romaji}: ${url(`/zh/v/${v.id}`)}`)
    .join("\n");

  const body = `# SeatView

> 日本の演唱会・ライブ会場の「実際の座席からの見え方」を集めた写真アトラス。
> A community-maintained photo atlas of real seat-view photos for Japanese
> concert and live venues. Each venue page maps audience-uploaded photos onto
> the seating chart, so you can see what a given seat actually sees before you
> buy or attend. Content is contributor-uploaded under CC BY-NC 4.0.

Languages: Simplified Chinese (zh, default), Japanese (ja), English (en), Korean (ko).
Every route is locale-prefixed, e.g. ${url("/zh/v/k-arena-yokohama")}.

## Key pages
- Home / intro: ${url("/zh/")}
- Suggest a venue (staging): ${url("/zh/staging")}
- Friend links: ${url("/zh/links")}
- Privacy: ${url("/zh/privacy")}
- Terms: ${url("/zh/terms")}
- Sitemap: ${url("/sitemap.xml")}

## Venues (${venues.length})
${venueLines}
`;

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
};

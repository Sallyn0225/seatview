// One-off generator for placeholder seating-chart SVGs.
//
// Real venue seating charts carry copyright risk, so during development every
// sub-map points at a locally-authored placeholder SVG under
// `public/seatmaps/<venue-id>/<sub-map-id>.svg`. This script reads every
// `data/venues/*.json` record and writes a placeholder for each sub-map whose
// `imageUrl` is a local `/seatmaps/...svg` path, sized to that sub-map's
// declared width/height so coordinate math stays consistent.
//
// Run with: node scripts/gen-placeholder-seatmaps.mjs
// It is idempotent and safe to re-run after adding venues.

import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const venuesDir = join(root, "data", "venues");
const publicDir = join(root, "public");

function escapeXml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Render a quiet, folio-paper placeholder: warm rice-paper field, a rounded
// "stage + tiered seating" silhouette, and the venue / sub-map label. Purely
// decorative — it only exists so the seatmap / masonry / lightbox have
// something to render locally before real charts are licensed.
function svg({ width, height, venueLabel, subMapLabel }) {
  const cx = width / 2;
  const stageW = width * 0.34;
  const stageX = cx - stageW / 2;
  const stageY = height * 0.12;
  const stageH = height * 0.08;

  // Three concentric tier arcs below the stage suggesting seating bowls.
  const tiers = [0.42, 0.62, 0.82].map((t, i) => {
    const ry = height * (0.18 + i * 0.12);
    const rx = width * (0.18 + i * 0.12);
    return `<ellipse cx="${cx}" cy="${height * t}" rx="${rx.toFixed(0)}" ry="${ry.toFixed(0)}" fill="none" stroke="#cdc6ba" stroke-width="2" />`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${escapeXml(venueLabel)} ${escapeXml(subMapLabel)} placeholder seating chart">
  <rect width="${width}" height="${height}" fill="#f4f1ea" />
  <rect x="16" y="16" width="${width - 32}" height="${height - 32}" fill="none" stroke="#cdc6ba" stroke-width="2" rx="12" />
  ${tiers.join("\n  ")}
  <rect x="${stageX.toFixed(0)}" y="${stageY.toFixed(0)}" width="${stageW.toFixed(0)}" height="${stageH.toFixed(0)}" rx="6" fill="#e6e1d6" stroke="#b7b0a2" stroke-width="2" />
  <text x="${cx}" y="${(stageY + stageH / 2 + 6).toFixed(0)}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="22" fill="#3a3631">STAGE</text>
  <text x="${cx}" y="${(height * 0.5).toFixed(0)}" text-anchor="middle" font-family="serif" font-size="40" fill="#2a2620">${escapeXml(venueLabel)}</text>
  <text x="${cx}" y="${(height * 0.5 + 44).toFixed(0)}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="24" fill="#6b655a">${escapeXml(subMapLabel)}</text>
  <text x="${cx}" y="${(height - 36).toFixed(0)}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="16" fill="#9a9384">placeholder seating chart · ${width}×${height}</text>
</svg>
`;
}

const files = (await readdir(venuesDir)).filter((f) => f.endsWith(".json"));
let written = 0;

for (const file of files) {
  const venue = JSON.parse(await readFile(join(venuesDir, file), "utf8"));
  for (const subMap of venue.subMaps) {
    if (!/^\/seatmaps\/.+\.svg$/.test(subMap.imageUrl)) continue;
    const outPath = join(publicDir, subMap.imageUrl);
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(
      outPath,
      svg({
        width: subMap.width,
        height: subMap.height,
        venueLabel: venue.name_romaji || venue.name_jp,
        subMapLabel: subMap.label_jp,
      }),
      "utf8",
    );
    written += 1;
  }
}

console.log(`Wrote ${written} placeholder seatmap SVG(s).`);

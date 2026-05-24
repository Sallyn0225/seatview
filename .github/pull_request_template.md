<!--
Thanks for contributing to SeatView! If you're adding a new venue, see
CONTRIBUTING.md for the step-by-step (no coding required) guide.
-->

## What does this PR do?

<!-- One or two sentences. e.g. "Adds the venue 横浜アリーナ (Yokohama Arena)." -->

## Type of change

- [ ] New venue (`data/venues/<venue-id>.json`)
- [ ] Edit to an existing venue
- [ ] Site code / docs change
- [ ] Other (describe below)

## Venue checklist (fill in for venue PRs)

- [ ] **Seating chart has no copyright risk.** Charts under `public/seatmaps/`
      are locally-authored placeholders or otherwise free of third-party
      copyright. I did NOT commit a real copyrighted seating chart.
- [ ] **All fields are complete.** `id`, `name_zh`, `name_jp`, `name_romaji`,
      `prefecture`, `city`, `aliases`, and at least one `subMaps[]` entry are
      present and match the `Venue` / `SubMap` types (see CONTRIBUTING.md).
- [ ] **`prefecture` uses a valid slug** from `src/data/prefectures.ts`
      (e.g. `tokyo`, `kanagawa`, `osaka`, `overseas`).
- [ ] **`id` is unique** across `data/venues/*.json` and is a url-safe slug
      (lowercase, hyphenated). The JSON filename equals `<id>.json`.
- [ ] **Each `subMaps[].imageUrl`** points at `public/seatmaps/<id>/<sub-map-id>.svg`
      (or another asset I committed), and `width` / `height` are the chart's
      actual pixel dimensions.
- [ ] **The build passes locally**: `npm run build` succeeds and
      `npm run typecheck` reports no errors.

## Notes for the maintainer

<!-- Anything else worth knowing (e.g. source of capacity numbers, sub-map layout). -->

# Frontend Development Guidelines

> Best practices for frontend development in this project.

---

## Overview

This directory contains guidelines for frontend development. Fill in each file with your project's specific conventions.

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | Module organization and file layout | To fill |
| [Component Guidelines](./component-guidelines.md) | Component patterns, props, composition | To fill |
| [Hook Guidelines](./hook-guidelines.md) | Custom hooks, data fetching patterns | To fill |
| [State Management](./state-management.md) | Local state, global state, server state | To fill |
| [Quality Guidelines](./quality-guidelines.md) | Code standards, forbidden patterns | To fill |
| [Type Safety](./type-safety.md) | Type patterns, validation | To fill |

---

## Stack & Accepted Conventions (as-built 2026-05-24)

The PRD/research predate implementation; these are the **actual** frontend
conventions. Do not "fix" them back toward the older docs without a deliberate
decision — each diverged for a verified reason.

- **UI is hand-written, NOT shadcn/ui**. `components.json` exists but
  `src/components/ui` is intentionally empty (no radix). All interactive pieces
  (Sheet, Date Picker, Dialog, Tabs, etc.) are hand-built React islands styled
  with the DESIGN.md Flat-Folio tokens. Reason: avoid radix defaults fighting
  the Flat-Folio look + an extra dependency tree. Match existing islands; do not
  introduce shadcn.
- **Tailwind v4 via the Vite plugin** (`@tailwindcss/vite`), NOT `@astrojs/tailwind`.
  There is **no `tailwind.config`** — design tokens are CSS variables in
  `src/styles/global.css` (OKLCH, No-Pure-Black-or-White; accent = 朱赤 used
  ≤10%, semantically reserved for seatmap selected pins + upload/staging submit
  + upload-sheet step ●).
- **`react-zoom-pan-pinch` is v3.7**, not v4. Use `setTransform` /
  `resetTransform` (there is no `zoomTo(x,y,scale)` in v3). Cluster
  zoom-to-explode is implemented with `setTransform` + computed centroid.
- **Cross-island shared state = vanilla pub/sub**, not React context. Islands
  are separate React roots and cannot share context. The `selectedPhotoId`
  signal lives in `src/lib/selected-photo.ts` (`useSyncExternalStore` via
  `useSelectedPhoto`); seatmap, photo grid, and Lightbox all subscribe. This is
  the convention for any future cross-island signal.
- **Photo grid renders at real aspect (no crop)**: `PhotoGrid` feeds
  `react-photo-album` the stored `width`/`height` from D1 and uses
  `object-contain`. Never derive a fake aspect ratio (the old `derivePhotoAspect`
  was removed).

---

## How to Fill These Guidelines

For each guideline file:

1. Document your project's **actual conventions** (not ideals)
2. Include **code examples** from your codebase
3. List **forbidden patterns** and why
4. Add **common mistakes** your team has made

The goal is to help AI assistants and new team members understand how YOUR project works.

---

**Language**: All documentation should be written in **English**.

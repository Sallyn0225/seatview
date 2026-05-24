# Component Guidelines

> How components are built in this project.

---

## Overview

<!--
Document your project's component conventions here.

Questions to answer:
- What component patterns do you use?
- How are props defined?
- How do you handle composition?
- What accessibility standards apply?
-->

(To be filled by the team)

---

## Component Structure

<!-- Standard structure of a component file -->

(To be filled by the team)

---

## Props Conventions

<!-- How props should be defined and typed -->

(To be filled by the team)

---

## Styling Patterns

Tailwind v4 (Vite plugin) + CSS-variable design tokens in `src/styles/global.css`
(there is no `tailwind.config`). Compose classes with the `cn()` helper
(`src/lib/utils.ts`).

### Overlay markers: center via inline `transform` ONLY — never Tailwind `-translate-*`

Markers overlaid on a zoom/pan surface (seatmap pins, the annotate dot) are
positioned with `left%`/`top%` and centered on that anchor while counter-scaling
so they keep a constant on-screen size:

```tsx
// Correct — centering + counter-scale live entirely in inline style.transform.
<button
  className="absolute grid size-11 place-items-center"   // NO -translate-* here
  style={{
    left: `${x * 100}%`,
    top: `${y * 100}%`,
    transform: `translate(-50%, -50%) scale(${1 / scale})`,
    transformOrigin: "center",
  }}
/>
```

> **Warning — Tailwind v4 transform stacking.** In Tailwind v4 the `-translate-x-*`,
> `translate-y-*`, `scale-*`, and `rotate-*` utilities emit the **independent CSS
> `translate` / `scale` / `rotate` properties** (not the legacy `transform`). They
> do NOT override an inline `style={{ transform: ... }}`; the browser applies BOTH
> the `translate` property AND the `transform` property. So `-translate-x-1/2
> -translate-y-1/2` STACKS on top of an inline `translate(-50%,-50%)`, shifting the
> element by -100% of its size instead of -50%. Keep centering in ONE place (the
> inline `transform`) and never add the Tailwind `-translate-*` classes alongside
> it. (This is how the main `Seatmap` pins are written; `AnnotateSeatmap` once had
> both and the dot landed 22px off the click.)

---

## Accessibility

<!-- A11y requirements and patterns -->

(To be filled by the team)

---

## Common Mistakes

### Marker/dot lands offset from the click (by half its own size)

**Symptom**: A click-to-place dot on a zoom/pan surface renders ~half the
element's size up-and-left of where you clicked (e.g. -22px on a 44px target), at
every zoom level.

**Cause**: The element has BOTH Tailwind `-translate-x-1/2 -translate-y-1/2`
classes AND an inline `style.transform` that also does `translate(-50%,-50%)`.
Tailwind v4 emits `-translate-*` as the separate CSS `translate` property, which
stacks with `transform` → double -50% shift.

**Fix / Prevention**: Center overlay markers via inline `transform` only; drop the
Tailwind `-translate-*` classes. See "Overlay markers" under Styling Patterns.

// Hand-drawn ink folio bookmark, the ONE self-drawn symbol the app allows
// (shape-upload-sheet.md §5.1 + §8): the upload-success "缝隙时刻". A small
// "folded folio leaf with a ribbon bookmark" stamp, single ink color via
// currentColor (so it tracks light/dark), ~40px tall. No icon library, no fill
// flourish — just a quiet drawn mark. Decorative, so aria-hidden.

interface SuccessBookmarkProps {
  className?: string;
}

export default function SuccessBookmark({ className }: SuccessBookmarkProps) {
  return (
    <svg
      viewBox="0 0 48 56"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden="true"
      role="presentation"
    >
      {/* Folio leaf with a dog-eared (folded) top-right corner. */}
      <path d="M9 4 h22 l8 8 v40 H9 Z" />
      {/* The fold itself. */}
      <path d="M31 4 v8 h8" />
      {/* Ribbon bookmark hanging from the top, ending in a notched tail. */}
      <path d="M19 4 v22 l4 -4 4 4 V4" fill="currentColor" fillOpacity={0.08} />
    </svg>
  );
}

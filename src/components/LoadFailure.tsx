// Shared inline load-failure (shape-error-pages.md §4 decision 2).
//
// The ONE place the "this content failed to load, retry" UI lives, so the photo
// grid, the seatmap point set, the Lightbox image and the staging list never
// drift on copy or behaviour (code-reuse-thinking-guide). It is an INLINE block
// that replaces the "content that should have been here" region inside its host
// container — it never takes over the full screen, never navigates, never pops a
// toast (shape-error-pages §4 / §6). The full-screen 404/500 shell is separate.
//
// Visuals (Restrained, error-pages decision): four neutral tones only, NO
// vermilion — the retry button is an ink outline (recovery, not a contribution).
// Folio Cream surfaces, no shimmer. Reduced-motion is respected by global CSS.

import type { Locale } from "@/i18n/config";
import { getMessages } from "@/i18n";
import { cn } from "@/lib/utils";

interface LoadFailureProps {
  locale: Locale;
  /** Re-run the host's data fetch. */
  onRetry: () => void;
  /** True while the retry request is in flight (button → disabled + "重试中…"). */
  retrying?: boolean;
  /** Stretch to fill the host box (e.g. inside the fixed-ratio seatmap frame). */
  fill?: boolean;
  className?: string;
}

/**
 * Inline "load failed + retry" block, localized. Hosts render this in place of
 * the content they could not load and wire `onRetry` to their fetch. The copy is
 * the single source of truth (i18n `loadFailure`); error-pages brief says these
 * strings win over any per-component wording.
 */
export default function LoadFailure({
  locale,
  onRetry,
  retrying = false,
  fill = false,
  className,
}: LoadFailureProps) {
  const t = getMessages(locale);
  return (
    <div
      role="alert"
      className={cn(
        "bg-card flex flex-col items-center justify-center gap-2 px-6 py-8 text-center",
        fill && "size-full",
        className,
      )}
    >
      <p className="text-foreground text-sm">{t.loadFailure.title}</p>
      <p className="text-muted-foreground text-[13px]">{t.loadFailure.body}</p>
      <button
        type="button"
        onClick={onRetry}
        disabled={retrying}
        aria-disabled={retrying}
        className={cn(
          "border-foreground text-foreground hover:bg-secondary mt-1 inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium",
          "transition-colors duration-150",
          "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        {retrying ? t.loadFailure.retrying : t.loadFailure.retry}
      </button>
    </div>
  );
}

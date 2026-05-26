// Upload Sheet (shape-upload-sheet.md) — the 6-step accumulative single-page
// contribution flow (R4 + R5 + R8.1 + R8.3-4 + R11).
//
// Container forms (shape §5): desktop ≥1024 = 480px right drawer; tablet =
// min(480, 80vw) right drawer; mobile <768 = 90vh bottom sheet. Ink overlay
// behind. The body is ONE scrolling column of accumulative step cards; the
// header (title + ✕) and footer (submit) are sticky.
//
// Step model (NOT a wizard, NOT one long form): completed steps fold to a
// one-line summary with a "改" button; the current step shows a 朱赤 ● ; future
// steps a Hairline ○. Editing a completed step re-collapses the steps after it
// (data kept, must re-confirm) — no confirm modal.
//
// Restrained: the ONLY two vermilion uses inside the Sheet are the current-step
// ● and the submit button tinted fill. Everything else is ink/paper/hairline.
// No box-shadow (Flat Folio). No modal anywhere — the unsaved-close confirm is
// an inline bar; Esc / ✕ / mobile pull-down all run the same close logic.
//
// All errors are inline at their step (shape §10 decision 3) — no toast, no
// full-screen error takeover.

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Check, Circle, X } from "lucide-react";
import type { Locale } from "@/i18n/config";
import { useLocale } from "@/hooks/useLocale";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { subMapLabel } from "@/i18n";
import type { SubMap, Venue } from "@/types";
import type { PhotoDto } from "@/lib/photos";
import { fillTemplate } from "@/lib/format";
import { compressToWebp, formatBytes } from "@/lib/image-compress";
import { signUpload, commitUpload, UploadError } from "@/lib/upload-client";
import { DESCRIPTION_MAX, SEAT_LABEL_MAX } from "@/lib/upload";
import { cn } from "@/lib/utils";
import AnnotateSeatmap, { type AnnotationPoint } from "./AnnotateSeatmap";
import FullscreenAnnotate from "./FullscreenAnnotate";
import DateField from "./DateField";
import TurnstileWidget from "./TurnstileWidget";
import SuccessBookmark from "./SuccessBookmark";

const CC_LICENSE_URL = "https://creativecommons.org/licenses/by-nc/4.0/";
const SHEET_ANIM_MS = 250;
/** Unsaved-close confirm bar auto-dismisses after this (shape §6). */
const CONFIRM_AUTODISMISS_MS = 3000;

type StepIndex = 1 | 2 | 3 | 4 | 5;
type StepStatus = "done" | "current" | "todo";

interface UploadSheetProps {
  locale: Locale;
  venue: Venue;
  /** The sub-map the upload is attributed to (R4.2 — current active sub-map). */
  subMap: SubMap;
  /** Called to close the Sheet (clean). */
  onClose: () => void;
  /** Called once with the created photo so the grid can prepend it (R3.9). */
  onUploaded: (photo: PhotoDto) => void;
}

type SubmitPhase =
  | { kind: "idle" }
  | { kind: "submitting"; attempt: number; total: number }
  | { kind: "error"; message: string; retryable: boolean };

export default function UploadSheet({
  locale,
  venue,
  subMap,
  onClose,
  onUploaded,
}: UploadSheetProps) {
  const { t } = useLocale(locale);
  const reducedMotion = usePrefersReducedMotion();
  const titleId = useId();

  // ── Step data ─────────────────────────────────────────────────────────────
  const [point, setPoint] = useState<AnnotationPoint | null>(null);
  const [pointConfirmed, setPointConfirmed] = useState(false);
  // Fullscreen marking overlay (Step 1). Shares `point` with the inline box.
  const [fullscreenOpen, setFullscreenOpen] = useState(false);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageBytes, setImageBytes] = useState<number>(0);
  // Intrinsic dimensions of the compressed WebP (real aspect ratio → masonry).
  const [imageDims, setImageDims] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [compressProgress, setCompressProgress] = useState(0);
  const [imageError, setImageError] = useState(false);

  const [seatLabel, setSeatLabel] = useState("");
  const [seatError, setSeatError] = useState(false);
  const [perfDate, setPerfDate] = useState<string | null>(null);
  const [eventName, setEventName] = useState("");
  const [description, setDescription] = useState("");
  const [metaConfirmed, setMetaConfirmed] = useState(false);

  const [consent, setConsent] = useState(false);

  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [submit, setSubmit] = useState<SubmitPhase>({ kind: "idle" });

  // The current step the user is editing (drives the ● marker + auto-scroll).
  const [activeStep, setActiveStep] = useState<StepIndex>(1);

  // Unsaved-close confirm bar.
  const [confirming, setConfirming] = useState(false);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Success page replaces the whole Sheet body.
  const [succeeded, setSucceeded] = useState(false);

  const stepRefs = useRef<Record<StepIndex, HTMLDivElement | null>>({
    1: null,
    2: null,
    3: null,
    4: null,
    5: null,
  });

  // Revoke the thumbnail object URL when it changes / on unmount.
  useEffect(() => {
    return () => {
      if (thumbUrl) URL.revokeObjectURL(thumbUrl);
    };
  }, [thumbUrl]);

  useEffect(
    () => () => {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    },
    [],
  );

  // ── Derived step completion ────────────────────────────────────────────────
  const step1Done = pointConfirmed && point != null;
  const step2Done = imageFile != null && !compressing;
  const step3Done = metaConfirmed && seatLabel.trim().length > 0;
  const step4Done = consent;
  const anyProgress =
    point != null || imageFile != null || seatLabel.length > 0;

  const statusOf = (step: StepIndex): StepStatus => {
    if (step === activeStep) return "current";
    const done =
      (step === 1 && step1Done) ||
      (step === 2 && step2Done) ||
      (step === 3 && step3Done) ||
      (step === 4 && step4Done);
    return done ? "done" : "todo";
  };

  // Smoothly scroll a step into view when it becomes active (shape §7).
  const focusStep = useCallback(
    (step: StepIndex) => {
      setActiveStep(step);
      requestAnimationFrame(() => {
        stepRefs.current[step]?.scrollIntoView({
          block: "nearest",
          behavior: reducedMotion ? "auto" : "smooth",
        });
      });
    },
    [reducedMotion],
  );

  // ── Close handling (Esc / ✕ / pull-down all funnel here) ────────────────────
  const requestClose = useCallback(() => {
    if (succeeded || !anyProgress) {
      onClose();
      return;
    }
    // Inline confirm bar (NOT a modal). Auto-dismiss after 3s.
    setConfirming(true);
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    confirmTimerRef.current = setTimeout(
      () => setConfirming(false),
      CONFIRM_AUTODISMISS_MS,
    );
  }, [succeeded, anyProgress, onClose]);

  // Esc → same close logic. Focus trap is provided by the sheet container.
  // While the fullscreen marking overlay is open, it owns Escape (collapses
  // itself first), so the Sheet skips its own close handler — same priority
  // technique as the Lightbox detail sheet.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (fullscreenOpen) return;
        e.stopPropagation();
        e.preventDefault();
        requestClose();
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [requestClose, fullscreenOpen]);

  // ── Step 1: annotate ────────────────────────────────────────────────────────
  const confirmPoint = useCallback(() => {
    if (!point) return;
    setPointConfirmed(true);
    focusStep(2);
  }, [point, focusStep]);

  const undoPoint = useCallback(() => {
    setPoint(null);
    setPointConfirmed(false);
  }, []);

  // ── Step 2: pick + compress ─────────────────────────────────────────────────
  const compressAbortRef = useRef<AbortController | null>(null);
  const handlePickFile = useCallback(
    async (file: File) => {
      setImageError(false);
      // Reset any prior image.
      if (thumbUrl) URL.revokeObjectURL(thumbUrl);
      setThumbUrl(null);
      setImageFile(null);
      setMetaConfirmed(false); // re-confirm later steps

      compressAbortRef.current?.abort();
      const controller = new AbortController();
      compressAbortRef.current = controller;

      setCompressing(true);
      setCompressProgress(0);
      try {
        const {
          file: webp,
          bytes,
          width,
          height,
        } = await compressToWebp(
          file,
          (p) => setCompressProgress(Math.round(p)),
          controller.signal,
        );
        if (controller.signal.aborted) return;
        setImageFile(webp);
        setImageBytes(bytes);
        setImageDims({ width, height });
        setThumbUrl(URL.createObjectURL(webp));
        setCompressing(false);
        focusStep(3);
      } catch {
        if (controller.signal.aborted) return;
        setCompressing(false);
        setImageError(true);
      }
    },
    [thumbUrl, focusStep],
  );

  const resetImage = useCallback(() => {
    compressAbortRef.current?.abort();
    if (thumbUrl) URL.revokeObjectURL(thumbUrl);
    setThumbUrl(null);
    setImageFile(null);
    setImageBytes(0);
    setImageDims(null);
    setImageError(false);
    setCompressing(false);
    setMetaConfirmed(false);
  }, [thumbUrl]);

  // ── Step 3: metadata ─────────────────────────────────────────────────────────
  const confirmMeta = useCallback(() => {
    if (seatLabel.trim().length === 0) {
      setSeatError(true);
      return;
    }
    setSeatError(false);
    setMetaConfirmed(true);
    focusStep(4);
  }, [seatLabel, focusStep]);

  // ── Step 4: consent ──────────────────────────────────────────────────────────
  const toggleConsent = useCallback(
    (checked: boolean) => {
      setConsent(checked);
      if (checked) focusStep(5);
      else {
        // Collapse step 5 + clear token so submit disables (shape §7).
        setTurnstileToken(null);
        setActiveStep(4);
      }
    },
    [focusStep],
  );

  // ── Submit (sign → commit, ADR-12 retry inside commitUpload) ─────────────────
  const canSubmit =
    step1Done &&
    step2Done &&
    step3Done &&
    step4Done &&
    turnstileToken != null &&
    submit.kind !== "submitting";

  const errorMessage = useCallback(
    (code: UploadError["code"]): { msg: string; retryable: boolean } => {
      switch (code) {
        case "turnstile_failed":
          return { msg: t.uploadSheet.step5.turnstileError, retryable: false };
        case "rate_limited_daily":
          return { msg: t.uploadSheet.step5.limitDaily, retryable: false };
        case "rate_limited_cooldown":
          return { msg: t.uploadSheet.step5.limitCooldown, retryable: false };
        case "network":
          return { msg: t.uploadSheet.step5.networkError, retryable: true };
        case "image_too_large":
          return { msg: t.uploadSheet.step2.failed, retryable: false };
        default:
          return { msg: t.uploadSheet.step5.serverError, retryable: true };
      }
    },
    [t],
  );

  const doSubmit = useCallback(async () => {
    if (!point || !imageFile || !imageDims || !turnstileToken) return;
    setSubmit({ kind: "submitting", attempt: 1, total: 3 });
    try {
      // 1. Sign (not retried): Turnstile + rate-limit + ticket.
      const { ticket } = await signUpload(
        {
          venueId: venue.id,
          subMapId: subMap.id,
          xPercent: point.x,
          yPercent: point.y,
          width: imageDims.width,
          height: imageDims.height,
          seatLabel: seatLabel.trim().slice(0, SEAT_LABEL_MAX),
          performanceDate: perfDate,
          eventName: eventName.trim() || null,
          description: description.trim() || null,
        },
        turnstileToken,
      );
      // 2. Commit (ADR-12 retry): bytes → R2 → D1.
      const { photo } = await commitUpload(ticket, imageFile, {
        onAttempt: (attempt, total) =>
          setSubmit({ kind: "submitting", attempt, total }),
      });
      onUploaded(photo);
      setSucceeded(true);
    } catch (err) {
      const code = err instanceof UploadError ? err.code : "server_error";
      const { msg, retryable } = errorMessage(code);
      setSubmit({ kind: "error", message: msg, retryable });
    }
  }, [
    point,
    imageFile,
    imageDims,
    turnstileToken,
    venue.id,
    subMap.id,
    seatLabel,
    perfDate,
    eventName,
    description,
    onUploaded,
    errorMessage,
  ]);

  // Reset everything for "再传一张" (keep the Sheet open).
  const uploadAnother = useCallback(() => {
    if (thumbUrl) URL.revokeObjectURL(thumbUrl);
    setPoint(null);
    setPointConfirmed(false);
    setImageFile(null);
    setImageBytes(0);
    setImageDims(null);
    setThumbUrl(null);
    setCompressing(false);
    setCompressProgress(0);
    setImageError(false);
    setSeatLabel("");
    setSeatError(false);
    setPerfDate(null);
    setEventName("");
    setDescription("");
    setMetaConfirmed(false);
    setConsent(false);
    setTurnstileToken(null);
    setSubmit({ kind: "idle" });
    setSucceeded(false);
    setActiveStep(1);
  }, [thumbUrl]);

  const subMapName = subMapLabel(subMap, locale);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      {/* Ink overlay (not a shadow — a layer of ink). Click to attempt close. */}
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        onClick={requestClose}
        className="absolute inset-0 cursor-default bg-[oklch(0.15_0.008_75_/_0.55)]"
        style={
          reducedMotion
            ? undefined
            : { animation: `seatview-overlay-in ${SHEET_ANIM_MS}ms ease-out` }
        }
      />

      {/* Panel: right drawer on ≥768, bottom sheet on mobile. The slide-in
          direction is chosen by CSS (right on ≥768, up on mobile) via the
          `seatview-sheet-panel` rule in global.css; reduced-motion disables it. */}
      <div
        className={cn(
          "bg-background border-border relative ml-auto flex flex-col border-l",
          // desktop/tablet right drawer
          "max-md:mt-auto max-md:ml-0 max-md:w-full max-md:rounded-t-xl max-md:border-l-0 max-md:border-t",
          "md:h-full md:w-[min(480px,80vw)] lg:w-[480px]",
          "max-md:h-[90vh]",
          !reducedMotion && "seatview-sheet-panel",
        )}
      >
        {/* Sticky header */}
        <div className="border-border bg-background sticky top-0 z-10 flex items-center justify-between border-b px-5 py-4 md:px-6">
          <h2 id={titleId} className="text-foreground text-lg font-medium">
            {succeeded ? "" : t.uploadSheet.title}
          </h2>
          <button
            type="button"
            onClick={requestClose}
            aria-label={t.uploadSheet.close}
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring -mr-1 grid size-9 place-items-center rounded-md focus-visible:ring-2 focus-visible:outline-none"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        {succeeded ? (
          <SuccessPage t={t} onAgain={uploadAnother} onBack={onClose} />
        ) : (
          <>
            {/* Scrolling step column */}
            <div className="flex-1 overflow-y-auto px-5 py-4 md:px-6">
              {/* Step 1 — annotate */}
              <StepCard
                ref={(el) => {
                  stepRefs.current[1] = el;
                }}
                index={1}
                status={statusOf(1)}
                title={t.uploadSheet.step1.title}
                summary={
                  step1Done && point
                    ? fillTemplate(t.uploadSheet.step1.summary, {
                        label: subMapName,
                        x: String(Math.round(point.x * 100)),
                        y: String(Math.round(point.y * 100)),
                      })
                    : undefined
                }
                editLabel={t.uploadSheet.edit}
                onEdit={() => {
                  setPointConfirmed(false);
                  focusStep(1);
                }}
                collapsed={statusOf(1) === "done"}
              >
                <div className="space-y-3 pt-1">
                  <AnnotateSeatmap
                    locale={locale}
                    subMap={subMap}
                    point={point}
                    onChange={setPoint}
                    onRequestFullscreen={() => setFullscreenOpen(true)}
                  />
                  <div className="flex items-center gap-4 text-sm">
                    <button
                      type="button"
                      onClick={undoPoint}
                      disabled={!point}
                      className="text-muted-foreground hover:text-foreground rounded-sm disabled:opacity-40 focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
                    >
                      {t.uploadSheet.step1.undo}
                    </button>
                    <button
                      type="button"
                      onClick={confirmPoint}
                      disabled={!point}
                      className="text-foreground ml-auto font-medium disabled:opacity-40 rounded-sm focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
                    >
                      {t.uploadSheet.step1.confirm}
                    </button>
                  </div>
                </div>
              </StepCard>

              {/* Step 2 — photo */}
              <StepCard
                ref={(el) => {
                  stepRefs.current[2] = el;
                }}
                index={2}
                status={statusOf(2)}
                title={t.uploadSheet.step2.title}
                summary={
                  step2Done
                    ? fillTemplate(t.uploadSheet.step2.summary, {
                        size: formatBytes(imageBytes),
                      })
                    : undefined
                }
                summaryThumb={step2Done ? thumbUrl : undefined}
                editLabel={t.uploadSheet.edit}
                onEdit={() => {
                  resetImage();
                  focusStep(2);
                }}
                collapsed={statusOf(2) === "done"}
              >
                <Step2Body
                  t={t}
                  compressing={compressing}
                  progress={compressProgress}
                  error={imageError}
                  onPick={handlePickFile}
                  onReset={resetImage}
                />
              </StepCard>

              {/* Step 3 — metadata */}
              <StepCard
                ref={(el) => {
                  stepRefs.current[3] = el;
                }}
                index={3}
                status={statusOf(3)}
                title={t.uploadSheet.step3.title}
                summary={step3Done ? seatLabel.trim() : undefined}
                editLabel={t.uploadSheet.edit}
                onEdit={() => {
                  setMetaConfirmed(false);
                  focusStep(3);
                }}
                collapsed={statusOf(3) === "done"}
              >
                <Step3Body
                  t={t}
                  locale={locale}
                  seatLabel={seatLabel}
                  setSeatLabel={(v) => {
                    setSeatLabel(v);
                    if (seatError && v.trim()) setSeatError(false);
                  }}
                  seatError={seatError}
                  perfDate={perfDate}
                  setPerfDate={setPerfDate}
                  eventName={eventName}
                  setEventName={setEventName}
                  description={description}
                  setDescription={setDescription}
                  onNext={confirmMeta}
                />
              </StepCard>

              {/* Step 4 — consent */}
              <StepCard
                ref={(el) => {
                  stepRefs.current[4] = el;
                }}
                index={4}
                status={statusOf(4)}
                title={t.uploadSheet.step4.title}
                editLabel={t.uploadSheet.edit}
                onEdit={() => focusStep(4)}
                collapsed={false}
              >
                <label className="flex cursor-pointer items-start gap-3 pt-1 text-sm leading-relaxed">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => toggleConsent(e.target.checked)}
                    className="accent-accent mt-0.5 size-4 shrink-0"
                  />
                  <span className="text-foreground/85">
                    {(() => {
                      const parts =
                        t.uploadSheet.step4.consent.split("{license}");
                      return (
                        <>
                          {parts[0]}
                          <a
                            href={CC_LICENSE_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-foreground underline underline-offset-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {t.uploadSheet.step4.license}
                          </a>
                          {parts[1]}
                        </>
                      );
                    })()}
                  </span>
                </label>
              </StepCard>

              {/* Step 5 — verify + submit (Turnstile renders only here) */}
              <StepCard
                ref={(el) => {
                  stepRefs.current[5] = el;
                }}
                index={5}
                status={statusOf(5)}
                title={t.uploadSheet.step5.title}
                collapsed={false}
              >
                {step4Done ? (
                  <div className="space-y-3 pt-1">
                    <TurnstileWidget onToken={setTurnstileToken} />
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      {t.uploadSheet.step5.turnstileNote}
                    </p>
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      {t.uploadSheet.step5.limitNote}
                    </p>
                  </div>
                ) : (
                  <p className="text-muted-foreground pt-1 text-xs">
                    {/* Hint while consent not yet given. */}
                  </p>
                )}
              </StepCard>
            </div>

            {/* Sticky footer: submit + inline submit error + close-confirm bar */}
            <div className="border-border bg-background sticky bottom-0 z-10 border-t px-5 py-4 md:px-6">
              {submit.kind === "error" && (
                <div className="mb-3 text-sm" role="alert">
                  <p className="text-destructive">{submit.message}</p>
                  {submit.retryable && (
                    <button
                      type="button"
                      onClick={doSubmit}
                      className="text-foreground mt-1 underline underline-offset-4 focus-visible:ring-ring rounded-sm focus-visible:ring-2 focus-visible:outline-none"
                    >
                      {t.uploadSheet.step5.tryAgain}
                    </button>
                  )}
                </div>
              )}

              {confirming ? (
                <div className="text-sm" role="alert">
                  <p className="text-foreground">
                    {t.uploadSheet.confirmClose.body}
                  </p>
                  <div className="mt-2 flex gap-4">
                    <button
                      type="button"
                      onClick={onClose}
                      className="text-destructive font-medium focus-visible:ring-ring rounded-sm focus-visible:ring-2 focus-visible:outline-none"
                    >
                      {t.uploadSheet.confirmClose.discard}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirming(false)}
                      className="text-foreground focus-visible:ring-ring rounded-sm focus-visible:ring-2 focus-visible:outline-none"
                    >
                      {t.uploadSheet.confirmClose.keep}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={doSubmit}
                  disabled={!canSubmit}
                  className={cn(
                    "inline-flex h-11 w-full items-center justify-center gap-2 rounded-md text-sm font-medium",
                    "bg-accent/10 text-foreground border-accent/30 border",
                    "transition-colors duration-150 hover:bg-accent/15 hover:border-accent/50",
                    "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                  )}
                >
                  {submit.kind === "submitting"
                    ? submit.attempt > 1
                      ? fillTemplate(t.uploadSheet.step5.retrying, {
                          n: String(submit.attempt),
                          total: String(submit.total),
                        })
                      : t.uploadSheet.step5.submitting
                    : t.uploadSheet.step5.submit}
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Fullscreen marking overlay (Step 1). Paints above the panel (z-[60]);
          shares `point` so place/drag here syncs the inline box. Confirm reuses
          confirmPoint() → closes overlay + completes Step 1 + scrolls to Step 2. */}
      <FullscreenAnnotate
        open={fullscreenOpen}
        locale={locale}
        subMap={subMap}
        point={point}
        onChange={setPoint}
        onUndo={undoPoint}
        onConfirm={() => {
          confirmPoint();
          setFullscreenOpen(false);
        }}
        onClose={() => setFullscreenOpen(false)}
      />
    </div>
  );
}

/* ── Step card shell ──────────────────────────────────────────────────────── */

interface StepCardProps {
  index: StepIndex;
  status: StepStatus;
  title: string;
  /** Summary line shown when collapsed (done). */
  summary?: string;
  /** Optional 40x40 thumb beside the summary (step 2). */
  summaryThumb?: string | null;
  editLabel?: string;
  onEdit?: () => void;
  collapsed: boolean;
  children: React.ReactNode;
  /** React 19 accepts `ref` as a plain prop on function components. */
  ref?: React.Ref<HTMLDivElement>;
}

function StepCard({
  status,
  title,
  summary,
  summaryThumb,
  editLabel,
  onEdit,
  collapsed,
  children,
  ref,
}: StepCardProps) {
  return (
    <div ref={ref} className="border-border border-b py-4 last:border-b-0">
      <div className="flex items-center gap-2">
        <StepMarker status={status} />
        <span
          className={cn(
            "text-sm font-medium",
            status === "todo" ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {title}
        </span>
        {collapsed && onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="text-muted-foreground hover:text-foreground ml-auto rounded-sm text-[13px] focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
          >
            {editLabel}
          </button>
        )}
      </div>

      {collapsed ? (
        <div className="mt-1 flex items-center gap-2 pl-6">
          {summaryThumb && (
            <img
              src={summaryThumb}
              alt=""
              className="size-10 shrink-0 rounded object-cover"
            />
          )}
          <span className="text-muted-foreground truncate text-sm [font-variant-numeric:tabular-nums]">
            {summary}
          </span>
        </div>
      ) : (
        <div className="pl-6">{children}</div>
      )}
    </div>
  );
}

/** Step marker (shape §11): done = Sumi ✓, current = 朱赤 ●, todo = Hairline ○. */
function StepMarker({ status }: { status: StepStatus }) {
  if (status === "done") {
    return <Check className="text-foreground size-3.5" aria-hidden="true" />;
  }
  if (status === "current") {
    return (
      <span
        className="bg-accent inline-block size-2 rounded-full"
        aria-hidden="true"
      />
    );
  }
  return <Circle className="text-border size-2" aria-hidden="true" />;
}

/* ── Step 2 body ──────────────────────────────────────────────────────────── */

function Step2Body({
  t,
  compressing,
  progress,
  error,
  onPick,
  onReset,
}: {
  t: ReturnType<typeof useLocale>["t"];
  compressing: boolean;
  progress: number;
  error: boolean;
  onPick: (file: File) => void;
  onReset: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  if (compressing) {
    return (
      <div className="pt-1" role="status" aria-live="polite">
        <p className="text-foreground text-sm [font-variant-numeric:tabular-nums]">
          {fillTemplate(t.uploadSheet.step2.progress, {
            percent: String(progress),
          })}
        </p>
        <div className="bg-card mt-2 h-1 w-full overflow-hidden rounded">
          <div
            className="bg-foreground h-full transition-[width] duration-150"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="pt-1">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) onPick(file);
        }}
        className={cn(
          "flex h-28 w-full flex-col items-center justify-center gap-1 rounded-md border border-dashed px-4 text-center",
          "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
          error
            ? "border-destructive/60 bg-card"
            : dragOver
              ? "border-foreground bg-card"
              : "border-border bg-background hover:bg-card",
        )}
      >
        <span className="text-foreground text-sm">
          {t.uploadSheet.step2.dropzone}
        </span>
        <span className="text-muted-foreground text-xs">
          {t.uploadSheet.step2.note}
        </span>
      </button>
      {error && (
        <div className="mt-2 text-sm" role="alert">
          <p className="text-destructive">{t.uploadSheet.step2.failed}</p>
          <button
            type="button"
            onClick={() => {
              onReset();
              inputRef.current?.click();
            }}
            className="text-foreground mt-1 underline underline-offset-4 focus-visible:ring-ring rounded-sm focus-visible:ring-2 focus-visible:outline-none"
          >
            {t.uploadSheet.step2.retry}
          </button>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPick(file);
          e.target.value = ""; // allow re-picking the same file
        }}
      />
    </div>
  );
}

/* ── Step 3 body ──────────────────────────────────────────────────────────── */

function Step3Body({
  t,
  locale,
  seatLabel,
  setSeatLabel,
  seatError,
  perfDate,
  setPerfDate,
  eventName,
  setEventName,
  description,
  setDescription,
  onNext,
}: {
  t: ReturnType<typeof useLocale>["t"];
  locale: Locale;
  seatLabel: string;
  setSeatLabel: (v: string) => void;
  seatError: boolean;
  perfDate: string | null;
  setPerfDate: (v: string | null) => void;
  eventName: string;
  setEventName: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  onNext: () => void;
}) {
  const seatRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    seatRef.current?.focus();
  }, []);

  return (
    <div className="space-y-4 pt-1">
      <div>
        <label className="text-muted-foreground mb-1 block text-xs">
          {t.uploadSheet.step3.seatLabel}
        </label>
        <input
          ref={seatRef}
          type="text"
          value={seatLabel}
          maxLength={SEAT_LABEL_MAX}
          onChange={(e) => setSeatLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onNext();
            }
          }}
          placeholder={t.uploadSheet.step3.seatPlaceholder}
          aria-invalid={seatError}
          className={cn(
            "bg-background text-foreground h-10 w-full rounded-md border px-3 text-sm",
            "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
            seatError ? "border-destructive" : "border-input",
          )}
        />
        {seatError && (
          <p className="text-destructive mt-1 text-xs" role="alert">
            {t.uploadSheet.step3.seatRequired}
          </p>
        )}
      </div>

      <DateField
        locale={locale}
        value={perfDate}
        onChange={setPerfDate}
        label={t.uploadSheet.step3.performanceDate}
        placeholder={t.uploadSheet.step3.datePlaceholder}
        clearLabel={t.uploadSheet.step3.dateClear}
      />

      <div>
        <label className="text-muted-foreground mb-1 block text-xs">
          {t.uploadSheet.step3.eventName}
        </label>
        <input
          type="text"
          value={eventName}
          maxLength={120}
          onChange={(e) => setEventName(e.target.value)}
          className="bg-background text-foreground border-input focus-visible:ring-ring h-10 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
        />
      </div>

      <div>
        <label className="text-muted-foreground mb-1 block text-xs">
          {t.uploadSheet.step3.description}
        </label>
        <textarea
          value={description}
          maxLength={DESCRIPTION_MAX}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="bg-background text-foreground border-input focus-visible:ring-ring w-full resize-none rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
        />
        <p className="text-muted-foreground mt-1 text-right text-xs [font-variant-numeric:tabular-nums]">
          {fillTemplate(t.uploadSheet.step3.descriptionCount, {
            n: String(description.length),
            max: String(DESCRIPTION_MAX),
          })}
        </p>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onNext}
          disabled={seatLabel.trim().length === 0}
          className="text-foreground font-medium text-sm disabled:opacity-40 rounded-sm focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
        >
          {t.uploadSheet.step3.next}
        </button>
      </div>
    </div>
  );
}

/* ── Success page ─────────────────────────────────────────────────────────── */

function SuccessPage({
  t,
  onAgain,
  onBack,
}: {
  t: ReturnType<typeof useLocale>["t"];
  onAgain: () => void;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 py-12 text-center">
      <SuccessBookmark className="text-foreground mb-6 h-12 w-auto" />
      {/* The ONLY place in the app allowed to use Serif Display (shape §5.1). */}
      <p className="text-foreground font-serif text-2xl leading-snug">
        {t.uploadSheet.success.title}
      </p>
      <p className="text-muted-foreground mt-3 max-w-xs text-sm leading-relaxed">
        {t.uploadSheet.success.body}
      </p>
      <div className="mt-8 flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={onAgain}
          className="text-foreground border-border hover:bg-secondary focus-visible:ring-ring inline-flex h-11 items-center rounded-md border px-6 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none"
        >
          {t.uploadSheet.success.again}
        </button>
        <button
          type="button"
          onClick={onBack}
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded-sm text-sm focus-visible:ring-2 focus-visible:outline-none"
        >
          {t.uploadSheet.success.back}
        </button>
      </div>
    </div>
  );
}

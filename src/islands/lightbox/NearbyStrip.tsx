import { useEffect, useRef } from "react";
import type { PhotoDto } from "@/lib/photos";
import { imageKeyToUrl } from "@/lib/photos";
import { fillTemplate } from "@/lib/format";
import { cn } from "@/lib/utils";

interface NearbyStripProps {
  items: PhotoDto[];
  currentId: string;
  onSelect: (photoId: string) => void;
  baseUrl?: string;
  label: string;
  thumbLabelTemplate: string;
  reducedMotion: boolean;
}

interface DragState {
  pointerId: number;
  startX: number;
  scrollLeft: number;
  moved: boolean;
}

export default function NearbyStrip({
  items,
  currentId,
  onSelect,
  baseUrl,
  label,
  thumbLabelTemplate,
  reducedMotion,
}: NearbyStripProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef(new Map<string, HTMLButtonElement>());
  const dragRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);

  useEffect(() => {
    const current = itemRefs.current.get(currentId);
    current?.scrollIntoView({
      block: "nearest",
      inline: "center",
      behavior: reducedMotion ? "auto" : "smooth",
    });
  }, [currentId, reducedMotion]);

  const focusItem = (index: number): void => {
    const next = items[index];
    if (!next) return;
    itemRefs.current.get(next.id)?.focus();
  };

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[5.25rem] z-[9] flex justify-center px-3 sm:bottom-[5.5rem] sm:px-6">
      <div
        ref={scrollerRef}
        role="region"
        aria-label={label}
        onWheel={(event) => {
          const el = scrollerRef.current;
          if (!el || el.scrollWidth <= el.clientWidth) return;
          if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
          el.scrollLeft += event.deltaY;
          event.preventDefault();
        }}
        onPointerDown={(event) => {
          if (event.pointerType !== "mouse" || event.button !== 0) return;
          const el = scrollerRef.current;
          if (!el || el.scrollWidth <= el.clientWidth) return;
          dragRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            scrollLeft: el.scrollLeft,
            moved: false,
          };
          el.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current;
          const el = scrollerRef.current;
          if (!drag || !el || drag.pointerId !== event.pointerId) return;
          const deltaX = event.clientX - drag.startX;
          if (Math.abs(deltaX) > 4) drag.moved = true;
          if (!drag.moved) return;
          el.scrollLeft = drag.scrollLeft - deltaX;
          event.preventDefault();
        }}
        onPointerUp={(event) => {
          const drag = dragRef.current;
          const el = scrollerRef.current;
          if (!drag || drag.pointerId !== event.pointerId) return;
          if (drag.moved) {
            suppressClickRef.current = true;
            window.setTimeout(() => {
              suppressClickRef.current = false;
            }, 0);
          }
          dragRef.current = null;
          if (el?.hasPointerCapture(event.pointerId)) {
            el.releasePointerCapture(event.pointerId);
          }
        }}
        onPointerCancel={(event) => {
          const el = scrollerRef.current;
          dragRef.current = null;
          if (el?.hasPointerCapture(event.pointerId)) {
            el.releasePointerCapture(event.pointerId);
          }
        }}
        onClickCapture={(event) => {
          if (!suppressClickRef.current) return;
          event.preventDefault();
          event.stopPropagation();
        }}
        className={cn(
          "pointer-events-auto max-w-full overflow-x-auto rounded-2xl",
          "border border-[oklch(0.8_0.006_86_/_0.22)] bg-[oklch(0.13_0.008_75_/_0.62)]",
          "px-2 py-2 [scrollbar-width:thin] [touch-action:pan-x]",
        )}
      >
        <div className="flex min-w-max items-center gap-2">
          {items.map((photo, index) => {
            const current = photo.id === currentId;
            return (
              <button
                key={photo.id}
                ref={(node) => {
                  if (node) itemRefs.current.set(photo.id, node);
                  else itemRefs.current.delete(photo.id);
                }}
                type="button"
                aria-current={current ? "true" : undefined}
                aria-label={fillTemplate(thumbLabelTemplate, {
                  label: photo.seatLabel,
                })}
                title={photo.seatLabel}
                onClick={() => {
                  if (!current) onSelect(photo.id);
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowRight") {
                    event.preventDefault();
                    focusItem(Math.min(items.length - 1, index + 1));
                  } else if (event.key === "ArrowLeft") {
                    event.preventDefault();
                    focusItem(Math.max(0, index - 1));
                  } else if (event.key === "Home") {
                    event.preventDefault();
                    focusItem(0);
                  } else if (event.key === "End") {
                    event.preventDefault();
                    focusItem(items.length - 1);
                  }
                }}
                className={cn(
                  "relative grid h-16 w-20 shrink-0 place-items-center overflow-hidden rounded-md",
                  "border border-[oklch(0.8_0.006_86_/_0.22)] bg-[oklch(0.16_0.008_75_/_0.78)]",
                  "transition-[border-color,opacity] duration-150 ease-out",
                  "hover:border-[oklch(0.8_0.006_86_/_0.46)] hover:opacity-100",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[oklch(0.8_0.006_86)] focus:outline-none",
                  current
                    ? "opacity-100 outline outline-2 outline-offset-1 outline-[oklch(0.93_0.006_88_/_0.9)]"
                    : "opacity-[0.72]",
                )}
              >
                <img
                  src={imageKeyToUrl(photo.imageKey, baseUrl)}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                  className="size-full select-none object-cover"
                />
                {current && (
                  <span
                    className="absolute bottom-1 left-1 h-1.5 w-1.5 rounded-full bg-[oklch(0.93_0.006_88)]"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

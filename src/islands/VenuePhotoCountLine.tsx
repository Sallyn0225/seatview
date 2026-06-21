import { useEffect, useState } from "react";
import type { Locale } from "@/i18n/config";
import { useLocale } from "@/hooks/useLocale";
import { fillTemplate } from "@/lib/format";
import {
  PHOTO_COUNT_CHANGE_EVENT,
  type PhotoCountChangeDetail,
  type VenuePhotoCountsDto,
} from "@/lib/photos";
import {
  resolveInitialSubMapId,
  SUBMAP_CHANGE_EVENT,
  type SubMapChangeDetail,
} from "@/lib/submap";
import type { SubMap } from "@/types";

interface VenuePhotoCountLineProps {
  locale: Locale;
  venueId: string;
  subMaps: SubMap[];
  initialSubMapId?: string;
  initialCounts?: VenuePhotoCountsDto;
}

function replaceSubMapCount(
  counts: VenuePhotoCountsDto,
  subMapId: string,
  count: number,
): VenuePhotoCountsDto {
  const nextCount = Math.max(0, count);
  const previousCount = counts.bySubMapId[subMapId] ?? 0;
  return {
    total: Math.max(0, counts.total - previousCount + nextCount),
    bySubMapId: { ...counts.bySubMapId, [subMapId]: nextCount },
  };
}

function addSubMapCount(
  counts: VenuePhotoCountsDto,
  subMapId: string,
  delta: number,
): VenuePhotoCountsDto {
  const previousCount = counts.bySubMapId[subMapId] ?? 0;
  const nextCount = Math.max(0, previousCount + delta);
  return {
    total: Math.max(0, counts.total + nextCount - previousCount),
    bySubMapId: { ...counts.bySubMapId, [subMapId]: nextCount },
  };
}

export default function VenuePhotoCountLine({
  locale,
  venueId,
  subMaps,
  initialSubMapId,
  initialCounts,
}: VenuePhotoCountLineProps) {
  const { t } = useLocale(locale);
  const [activeSubMapId, setActiveSubMapId] = useState<string | undefined>(() =>
    resolveInitialSubMapId(subMaps, initialSubMapId),
  );
  const [counts, setCounts] = useState<VenuePhotoCountsDto | undefined>(
    initialCounts,
  );

  useEffect(() => {
    function onSubMapChange(event: Event) {
      const detail = (event as CustomEvent<SubMapChangeDetail>).detail;
      if (detail?.subMapId) setActiveSubMapId(detail.subMapId);
    }

    window.addEventListener(SUBMAP_CHANGE_EVENT, onSubMapChange);
    return () =>
      window.removeEventListener(SUBMAP_CHANGE_EVENT, onSubMapChange);
  }, []);

  useEffect(() => {
    function onPhotoCountChange(event: Event) {
      const detail = (event as CustomEvent<PhotoCountChangeDetail>).detail;
      if (!detail || detail.venueId !== venueId) return;
      if (!Number.isFinite(detail.count) && !Number.isFinite(detail.delta)) {
        return;
      }

      setCounts((current) => {
        if (!current) return current;
        if (detail.count !== undefined) {
          return replaceSubMapCount(current, detail.subMapId, detail.count);
        }
        if (detail.delta !== undefined) {
          return addSubMapCount(current, detail.subMapId, detail.delta);
        }
        return current;
      });
    }

    window.addEventListener(PHOTO_COUNT_CHANGE_EVENT, onPhotoCountChange);
    return () =>
      window.removeEventListener(PHOTO_COUNT_CHANGE_EVENT, onPhotoCountChange);
  }, [venueId]);

  if (!counts) return null;

  const activeCount = activeSubMapId
    ? (counts.bySubMapId[activeSubMapId] ?? 0)
    : 0;
  const text =
    subMaps.length <= 1
      ? fillTemplate(t.venue.photoCountSingle, {
          count: String(counts.total),
        })
      : fillTemplate(t.venue.photoCountMulti, {
          subMapCount: String(activeCount),
          venueCount: String(counts.total),
        });

  return (
    <p className="text-muted-foreground mt-1 text-sm tabular-nums">{text}</p>
  );
}

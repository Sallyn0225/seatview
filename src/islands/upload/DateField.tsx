// Performance-date picker for the upload Sheet, Step 3 (R4.3.6: shadcn Date
// Picker). The project does NOT have shadcn/radix wired (src/components/ui is
// empty and no radix dep is installed), and the other islands hand-roll their
// UI against the same Tailwind tokens. So this is a small, self-contained
// calendar popover in the same Flat-Folio style (hairline border, no shadow,
// Folio Cream surface) rather than pulling in react-day-picker + radix-popover
// for one optional field. Behavior matches the brief: default no selection,
// today highlighted, emits an ISO `YYYY-MM-DD` string (the shape persisted in
// photos.performance_date) or null.

import { useEffect, useRef, useState } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";

interface DateFieldProps {
  locale: Locale;
  /** ISO `YYYY-MM-DD` or null. */
  value: string | null;
  onChange: (iso: string | null) => void;
  label: string;
  placeholder: string;
  clearLabel: string;
}

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseIso(iso: string | null): Date | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function formatDisplay(iso: string | null): string {
  const d = parseIso(iso);
  if (!d) return "";
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

const WEEKDAYS_JA = ["日", "月", "火", "水", "木", "金", "土"];
const WEEKDAYS_ZH = ["日", "一", "二", "三", "四", "五", "六"];

/** Popover drill-down level: pick a day, or jump by month / year first. */
type View = "days" | "months" | "years";

export default function DateField({
  locale,
  value,
  onChange,
  label,
  placeholder,
  clearLabel,
}: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("days");
  const selected = parseIso(value);
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(
    () => selected ?? new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on outside click / Esc (no modal — inline popover).
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const weekdays = locale === "ja" ? WEEKDAYS_JA : WEEKDAYS_ZH;
  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const isToday = (day: number) =>
    today.getFullYear() === year &&
    today.getMonth() === month &&
    today.getDate() === day;
  const isSelected = (day: number) =>
    selected != null &&
    selected.getFullYear() === year &&
    selected.getMonth() === month &&
    selected.getDate() === day;

  // ── Months / years view helpers ────────────────────────────────────────────
  const isSelectedMonth = (m: number) =>
    selected != null &&
    selected.getFullYear() === year &&
    selected.getMonth() === m;
  const isTodayMonth = (m: number) =>
    today.getFullYear() === year && today.getMonth() === m;
  const isSelectedYear = (y: number) =>
    selected != null && selected.getFullYear() === y;
  const isTodayYear = (y: number) => today.getFullYear() === y;

  // Year view paginates in fixed blocks of 12 (e.g. 2016–2027).
  const yearPageStart = year - (year % 12);

  // Header label (center) opens the next drill-up level.
  const headerLabel =
    view === "days"
      ? locale === "ja"
        ? "月を選択"
        : "选择月份"
      : locale === "ja"
        ? "年を選択"
        : "选择年份";

  // Prev/next arrows step by month (days view), year (months), or 12 years.
  const stepMonths = view === "days" ? 1 : 0;
  const stepYears = view === "months" ? 1 : view === "years" ? 12 : 0;
  const navPrevLabel =
    view === "days"
      ? locale === "ja"
        ? "前の月"
        : "上个月"
      : view === "months"
        ? locale === "ja"
          ? "前の年"
          : "上一年"
        : locale === "ja"
          ? "前の12年"
          : "前 12 年";
  const navNextLabel =
    view === "days"
      ? locale === "ja"
        ? "次の月"
        : "下个月"
      : view === "months"
        ? locale === "ja"
          ? "次の年"
          : "下一年"
        : locale === "ja"
          ? "次の12年"
          : "后 12 年";

  return (
    <div ref={rootRef} className="relative">
      <span className="text-muted-foreground mb-1 block text-xs">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setView("days");
            setOpen((v) => !v);
          }}
          aria-haspopup="dialog"
          aria-expanded={open}
          className={cn(
            "border-input bg-background text-foreground inline-flex h-10 flex-1 items-center gap-2 rounded-md border px-3 text-sm",
            "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
            !value && "text-muted-foreground",
          )}
        >
          <CalendarIcon className="size-4 shrink-0" aria-hidden="true" />
          <span className="[font-variant-numeric:tabular-nums]">
            {value ? formatDisplay(value) : placeholder}
          </span>
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded-sm px-1 text-xs focus-visible:ring-2 focus-visible:outline-none"
          >
            {clearLabel}
          </button>
        )}
      </div>

      {open && (
        <div
          role="dialog"
          className="border-border bg-popover absolute left-0 top-full z-30 mt-1 w-[18rem] rounded-md border p-3"
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() =>
                setViewMonth(new Date(year - stepYears, month - stepMonths, 1))
              }
              aria-label={navPrevLabel}
              className="hover:bg-secondary focus-visible:ring-ring grid size-8 place-items-center rounded focus-visible:ring-2 focus-visible:outline-none"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </button>
            {view === "years" ? (
              <span className="text-foreground text-sm font-medium [font-variant-numeric:tabular-nums]">
                {yearPageStart}–{yearPageStart + 11}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setView(view === "days" ? "months" : "years")}
                aria-label={headerLabel}
                className="text-foreground hover:bg-secondary focus-visible:ring-ring rounded px-2 py-1 text-sm font-medium [font-variant-numeric:tabular-nums] focus-visible:ring-2 focus-visible:outline-none"
              >
                {view === "days" ? `${year}年${month + 1}月` : `${year}年`}
              </button>
            )}
            <button
              type="button"
              onClick={() =>
                setViewMonth(new Date(year + stepYears, month + stepMonths, 1))
              }
              aria-label={navNextLabel}
              className="hover:bg-secondary focus-visible:ring-ring grid size-8 place-items-center rounded focus-visible:ring-2 focus-visible:outline-none"
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          </div>

          {view === "days" && (
            <>
              <div className="text-muted-foreground grid grid-cols-7 gap-0.5 text-center text-xs">
                {weekdays.map((w) => (
                  <span key={w} className="py-1">
                    {w}
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {cells.map((day, i) =>
                  day === null ? (
                    <span key={`e${i}`} />
                  ) : (
                    <button
                      key={day}
                      type="button"
                      onClick={() => {
                        onChange(toIso(new Date(year, month, day)));
                        setOpen(false);
                      }}
                      className={cn(
                        "grid size-8 place-items-center rounded text-sm [font-variant-numeric:tabular-nums]",
                        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                        isSelected(day)
                          ? "bg-foreground text-background"
                          : "hover:bg-secondary text-foreground",
                        !isSelected(day) &&
                          isToday(day) &&
                          "ring-border ring-1",
                      )}
                    >
                      {day}
                    </button>
                  ),
                )}
              </div>
            </>
          )}

          {view === "months" && (
            <div className="grid grid-cols-3 gap-1">
              {Array.from({ length: 12 }, (_, m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setViewMonth(new Date(year, m, 1));
                    setView("days");
                  }}
                  className={cn(
                    "h-9 rounded text-sm [font-variant-numeric:tabular-nums]",
                    "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                    isSelectedMonth(m)
                      ? "bg-foreground text-background"
                      : "hover:bg-secondary text-foreground",
                    !isSelectedMonth(m) &&
                      isTodayMonth(m) &&
                      "ring-border ring-1",
                  )}
                >
                  {m + 1}月
                </button>
              ))}
            </div>
          )}

          {view === "years" && (
            <div className="grid grid-cols-3 gap-1">
              {Array.from({ length: 12 }, (_, i) => yearPageStart + i).map(
                (y) => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => {
                      setViewMonth(new Date(y, month, 1));
                      setView("months");
                    }}
                    className={cn(
                      "h-9 rounded text-sm [font-variant-numeric:tabular-nums]",
                      "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                      isSelectedYear(y)
                        ? "bg-foreground text-background"
                        : "hover:bg-secondary text-foreground",
                      !isSelectedYear(y) &&
                        isTodayYear(y) &&
                        "ring-border ring-1",
                    )}
                  >
                    {y}
                  </button>
                ),
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

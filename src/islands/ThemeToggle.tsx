import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import type { Locale } from "@/i18n/config";
import { useLocale } from "@/hooks/useLocale";
import { STORAGE_KEYS, readStorage, writeStorage } from "@/lib/storage";
import { cn } from "@/lib/utils";

type ThemeChoice = "light" | "dark" | "system";

interface ThemeToggleProps {
  locale: Locale;
}

function isThemeChoice(value: string | null): value is ThemeChoice {
  return value === "light" || value === "dark" || value === "system";
}

/** Apply the resolved theme to <html> (mirrors the inline pre-paint script). */
function applyTheme(choice: ThemeChoice): void {
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = choice === "dark" || (choice === "system" && systemDark);
  document.documentElement.classList.toggle("dark", dark);
}

/**
 * Tri-state theme switch (R12): light / dark / system, default following the
 * system (`prefers-color-scheme`). The choice persists to localStorage and is
 * read pre-paint by the inline script in Layout.astro to avoid a flash.
 *
 * Rendered as a 3-button segmented control so every option is one tap (≥44px
 * touch target on the control as a whole) and reachable by keyboard.
 */
export default function ThemeToggle({ locale }: ThemeToggleProps) {
  const { t } = useLocale(locale);
  const [choice, setChoice] = useState<ThemeChoice>("system");

  useEffect(() => {
    const stored = readStorage(STORAGE_KEYS.theme);
    setChoice(isThemeChoice(stored) ? stored : "system");
  }, []);

  // Keep "system" choices reactive to OS theme changes.
  useEffect(() => {
    if (choice !== "system") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [choice]);

  function select(next: ThemeChoice) {
    setChoice(next);
    writeStorage(STORAGE_KEYS.theme, next);
    applyTheme(next);
  }

  const options: { value: ThemeChoice; label: string; Icon: typeof Sun }[] = [
    { value: "light", label: t.theme.light, Icon: Sun },
    { value: "dark", label: t.theme.dark, Icon: Moon },
    { value: "system", label: t.theme.system, Icon: Monitor },
  ];

  return (
    <div
      role="radiogroup"
      aria-label={t.theme.label}
      className="border-border inline-flex items-center rounded-md border p-0.5"
    >
      {options.map(({ value, label, Icon }) => {
        const active = choice === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => select(value)}
            className={cn(
              "flex size-7 items-center justify-center rounded-sm transition-colors duration-150",
              "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
              active
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}

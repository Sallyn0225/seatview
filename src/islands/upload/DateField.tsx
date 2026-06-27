import { useId } from "react";
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

export default function DateField({
  locale,
  value,
  onChange,
  label,
  placeholder,
  clearLabel,
}: DateFieldProps) {
  const inputId = useId();

  return (
    <div className="block">
      <label
        htmlFor={inputId}
        className="text-muted-foreground mb-1 block text-xs"
      >
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={inputId}
          type="date"
          lang={locale}
          value={value ?? ""}
          placeholder={placeholder}
          onChange={(event) => onChange(event.currentTarget.value || null)}
          className={cn(
            "border-input bg-background text-foreground h-10 flex-1 rounded-md border px-3 text-sm",
            "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
            !value && "text-muted-foreground",
          )}
        />
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
    </div>
  );
}

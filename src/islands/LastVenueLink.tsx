// Secondary "回到上次看的场馆 / 前回見ていた会場へ戻る" link on the error shell
// (shape-error-pages.md §8). SSR cannot know localStorage, so this renders
// nothing on the server and injects the link after hydration ONLY when a
// last-visited venue exists (R10.2). Plain client-side navigation; the primary
// "打开图鉴" recovery button stays a server-rendered <a> so the shell works
// without JS.

import { useEffect, useState } from "react";
import type { Locale } from "@/i18n/config";
import { STORAGE_KEYS, readStorage } from "@/lib/storage";

interface LastVenueLinkProps {
  locale: Locale;
  label: string;
}

export default function LastVenueLink({ locale, label }: LastVenueLinkProps) {
  const [venueId, setVenueId] = useState<string | null>(null);

  useEffect(() => {
    const last = readStorage(STORAGE_KEYS.lastVenue);
    if (last && /^[a-z0-9-]+$/.test(last)) setVenueId(last);
  }, []);

  if (!venueId) return null;

  return (
    <a
      href={`/${locale}/v/${venueId}`}
      className="text-muted-foreground hover:text-foreground focus-visible:ring-ring mt-3 inline-block rounded-sm text-sm underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
    >
      {label}
    </a>
  );
}

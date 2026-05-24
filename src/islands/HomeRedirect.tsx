// Home last-visited-venue redirect (R10.2, shape-home-explainer.md §8).
//
// The Worker ALWAYS SSRs the explainer (it cannot see localStorage). This tiny
// client:load island runs the redirect decision AFTER hydration:
//   • localStorage `seatview:last-venue` present → client-route straight to that
//     venue (no transition; feels SSR-equivalent, §8).
//   • absent → stay on the explainer (the SSR content is already painted).
//
// It renders nothing. The CTA / example-venue links are plain <a href> in the
// page so the explainer is fully usable with JS disabled (§7 fallback).

import { useEffect } from "react";
import type { Locale } from "@/i18n/config";
import { STORAGE_KEYS, readStorage } from "@/lib/storage";

interface HomeRedirectProps {
  locale: Locale;
}

export default function HomeRedirect({ locale }: HomeRedirectProps) {
  useEffect(() => {
    const lastVenue = readStorage(STORAGE_KEYS.lastVenue);
    if (lastVenue && /^[a-z0-9-]+$/.test(lastVenue)) {
      // Replace so the explainer is not left in history between the user and
      // the venue they actually want (§8 — feels like a direct entry).
      window.location.replace(`/${locale}/v/${lastVenue}`);
    }
  }, [locale]);

  return null;
}

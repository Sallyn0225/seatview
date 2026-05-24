// Cloudflare Turnstile widget (R8.3). Rendered ONLY when Step 5 expands (shape
// §7: avoid consuming a token too early). Loads the CF script once, renders the
// managed widget, and hands the resulting token up via `onToken`. On expiry /
// error it clears the token so the submit button disables again.
//
// The site key comes from PUBLIC_TURNSTILE_SITE_KEY (build-time inlined). Local
// dev uses the always-pass test key 1x00000000000000000000AA (wrangler.jsonc).

import { useEffect, useId, useRef } from "react";

const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

interface TurnstileApi {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
      "timeout-callback"?: () => void;
      theme?: "light" | "dark" | "auto";
      appearance?: "always" | "execute" | "interaction-only";
    },
  ) => string;
  remove: (widgetId: string) => void;
  reset: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
    /** onload callback name the CF script invokes once ready. */
    [key: `onTurnstileLoad_${string}`]: (() => void) | undefined;
  }
}

const SITE_KEY = import.meta.env.PUBLIC_TURNSTILE_SITE_KEY;

/** Load the Turnstile script once; resolve when window.turnstile is ready. */
function loadTurnstileScript(): Promise<TurnstileApi> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("no window"));
  }
  if (window.turnstile) return Promise.resolve(window.turnstile);

  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src^="https://challenges.cloudflare.com/turnstile"]`,
    );
    const check = () => {
      if (window.turnstile) resolve(window.turnstile);
      else reject(new Error("turnstile unavailable"));
    };
    if (existing) {
      if (window.turnstile) resolve(window.turnstile);
      else existing.addEventListener("load", check, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", check, { once: true });
    script.addEventListener("error", () => reject(new Error("script error")), {
      once: true,
    });
    document.head.appendChild(script);
  });
}

interface TurnstileWidgetProps {
  /** Receives the token on success, or null on expiry/error/reset. */
  onToken: (token: string | null) => void;
  /** Light/dark to match the page theme (defaults auto). */
  theme?: "light" | "dark" | "auto";
}

export default function TurnstileWidget({
  onToken,
  theme = "auto",
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;
  const reactId = useId();

  useEffect(() => {
    let cancelled = false;
    loadTurnstileScript()
      .then((api) => {
        if (cancelled || !containerRef.current) return;
        widgetIdRef.current = api.render(containerRef.current, {
          sitekey: SITE_KEY,
          theme,
          appearance: "always",
          callback: (token) => onTokenRef.current(token),
          "expired-callback": () => onTokenRef.current(null),
          "error-callback": () => onTokenRef.current(null),
          "timeout-callback": () => onTokenRef.current(null),
        });
      })
      .catch(() => {
        if (!cancelled) onTokenRef.current(null);
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          /* widget already gone */
        }
        widgetIdRef.current = null;
      }
    };
    // Render once on mount (Step 5 expand). `theme` change would need a reset,
    // out of scope for the MVP single-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={containerRef} data-turnstile={reactId} className="min-h-[65px]" />
  );
}

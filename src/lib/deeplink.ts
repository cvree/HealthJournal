/* Opening the app somewhere other than the dashboard.
 *
 * The installed PWA declares Home Screen shortcuts ("Log today", "This week's
 * report") and those are plain URLs — `?screen=log`. Anything arriving from the
 * outside is untrusted, so this maps a query string onto a small allowlist of
 * screens and refuses everything else rather than letting a stray value reach
 * the screen router.
 */

export const DEEP_LINK_SCREENS = ["log", "food", "calendar", "export", "report", "gallery"] as const;
export type DeepLinkScreen = (typeof DEEP_LINK_SCREENS)[number];

/**
 * Extracts a safe starting screen from a URL's query string, or null when the
 * URL doesn't ask for one (the overwhelmingly common case — a normal launch).
 */
export function screenFromSearch(search: string): DeepLinkScreen | null {
  if (!search) return null;
  let value: string | null = null;
  try {
    value = new URLSearchParams(search).get("screen");
  } catch {
    return null;
  }
  if (!value) return null;
  const match = DEEP_LINK_SCREENS.find((s) => s === value.toLowerCase());
  return match ?? null;
}

/**
 * Drops the `screen` parameter from the address bar after it's been consumed,
 * so a refresh doesn't bounce the user back out of wherever they navigated to.
 * No-op outside a browser.
 */
export function clearDeepLink(): void {
  if (typeof window === "undefined" || !window.history?.replaceState) return;
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("screen")) return;
    url.searchParams.delete("screen");
    window.history.replaceState({}, "", url.pathname + (url.search || "") + url.hash);
  } catch { /* address-bar tidying is cosmetic */ }
}

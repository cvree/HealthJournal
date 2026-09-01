/* Handing a file to the person it belongs to.
 *
 * Everything this app produces for somebody to keep — the CSV, the spreadsheet,
 * the JSON backup, the appointment pack, the reminder calendar, the report
 * image, the raw file the recovery screen offers when a journal will not
 * open — left through one line:
 *
 *     const a = document.createElement("a"); a.download = name; a.click();
 *
 * That is the correct and only way to do it on the web, and it is the whole
 * mechanism behind the claim this app makes hardest: *your record is yours,
 * and you can take it anywhere*. It also does nothing at all inside a
 * WKWebView, which is where the packaged iOS build runs. No file, no share
 * sheet, no error — the button simply does not work, and the one promise the
 * app cannot afford to break is the one it breaks silently.
 *
 * So the anchor stays exactly where it was for the web, and native gets the
 * thing native has: the file is written to the app's own cache and handed to
 * the system share sheet, which is where "Save to Files", "Mail", "AirDrop"
 * and every other destination a phone has already live. The person chooses
 * where it goes, which is the same bargain the browser's download folder is —
 * and, as everywhere else here, nothing leaves the device unless they send it.
 *
 * Cache rather than Documents on purpose: this is a handoff, not a library the
 * app keeps. Once it is in Files or in a mail draft it belongs to that app,
 * and a second copy sitting in Bellwether's own folder is storage nobody asked
 * for, on the device of somebody who may be carrying two years of photographs.
 *
 * The plugins are imported dynamically and only on native, so a web build
 * never pulls a line of them.
 */

/** Where the file actually went, so a caller can say something true about it. */
export type SaveWhere = "download" | "share";

export interface SaveResult {
  ok: boolean;
  where: SaveWhere;
  /** Set when `ok` is false: short, and safe to show somebody. */
  error?: string;
}

/** True inside the packaged app, false in every browser. Read through the
    global the Capacitor runtime installs rather than importing @capacitor/core,
    which would pull the runtime into the web bundle for an answer that is
    statically "no" there. Mirrors lib/feedback's detection exactly. */
function isNative(): boolean {
  try {
    const cap = (globalThis as any).Capacitor;
    return !!cap && typeof cap.isNativePlatform === "function" && cap.isNativePlatform();
  } catch {
    return false;
  }
}

/** The browser's own download, unchanged from the day it was written. */
function webDownload(blob: Blob, filename: string): SaveResult {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  return { ok: true, where: "download" };
}

/** A blob as bare base64 — no data: prefix, which is what Filesystem wants.
    FileReader rather than a hand-rolled loop over an ArrayBuffer: a full photo
    backup is tens of megabytes and String.fromCharCode over that blows the
    argument limit long before it runs out of memory. */
function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error("unreadable"));
    reader.onload = () => {
      const out = String(reader.result || "");
      const comma = out.indexOf(",");
      resolve(comma >= 0 ? out.slice(comma + 1) : out);
    };
    reader.readAsDataURL(blob);
  });
}

/* A share sheet the person closed without picking anything. It is not a
   failure and must never be reported as one — "couldn't save your export"
   after somebody deliberately tapped Cancel is the app calling them wrong. */
function isCancellation(e: any): boolean {
  const msg = String(e?.message || e || "").toLowerCase();
  return msg.includes("cancel") || msg.includes("abort") || msg.includes("dismiss");
}

async function nativeShare(blob: Blob, filename: string): Promise<SaveResult> {
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([
    import("@capacitor/filesystem"),
    import("@capacitor/share"),
  ]);
  const data = await toBase64(blob);
  const { uri } = await Filesystem.writeFile({
    path: filename,
    data,
    directory: Directory.Cache,
  });
  try {
    await Share.share({ files: [uri] });
  } catch (e) {
    if (isCancellation(e)) return { ok: true, where: "share" };
    throw e;
  }
  return { ok: true, where: "share" };
}

/**
 * Put `blob` somewhere the person can keep it.
 *
 * Resolves rather than throws: every caller here is a button with a message
 * under it, and a rejected promise in the middle of an export handler is a
 * button that goes quiet — which is the exact failure this module exists to
 * end. On native, a share sheet that was cancelled resolves `ok`, because
 * cancelling is a choice and not an error.
 */
export async function saveFile(blob: Blob, filename: string): Promise<SaveResult> {
  if (!isNative()) {
    try {
      return webDownload(blob, filename);
    } catch (e: any) {
      return { ok: false, where: "download", error: String(e?.message || e) };
    }
  }
  try {
    return await nativeShare(blob, filename);
  } catch (e: any) {
    /* Falling back to the anchor is worth one line: on some native surfaces it
       does work, and a button that might do something beats one that certainly
       does not. */
    try {
      return webDownload(blob, filename);
    } catch {
      return { ok: false, where: "share", error: String(e?.message || e) };
    }
  }
}

/** What to call the thing that just happened, for a message under a button.
    "Downloaded" is a browser word and means nothing on a phone that just
    opened a share sheet. */
export const savedVerb = (where: SaveWhere): string =>
  where === "share" ? "Shared" : "Downloaded";

import { Capacitor, registerPlugin } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";

export interface WidgetSnapshot {
  streak: number;
  todayLogged: boolean;
  metricLabel: string;
  metricValue: string;
  trendLabel: string;
}

interface WidgetBridgePluginApi {
  saveSnapshot(snapshot: WidgetSnapshot): Promise<void>;
  clearSnapshot(): Promise<void>;
}

// Matches WidgetBridgePlugin.swift's `jsName`. Only resolves to a real
// implementation inside the native iOS shell (see ios/App/App/WidgetBridgePlugin.swift);
// plain web builds (including this site) never load a Capacitor runtime at all.
const WidgetBridge = registerPlugin<WidgetBridgePluginApi>("WidgetBridge");

/**
 * Pushes a small summary (streak, today's key metric, trend) into the iOS
 * App Group so the Home Screen widget can render it. No-ops everywhere
 * except the native iOS app - safe to call unconditionally from web code.
 */
export async function syncWidgetSnapshot(snapshot: WidgetSnapshot): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await WidgetBridge.saveSnapshot(snapshot);
  } catch {
    // best-effort only; the widget just keeps showing its last-known snapshot
  }
}

export async function clearWidgetSnapshot(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await WidgetBridge.clearSnapshot();
  } catch {
    /* ignore */
  }
}

/**
 * Fires `onLog` when the app is opened via the widget's `bellwether://log`
 * deep link (see .widgetURL in ios/BellwetherWidget/BellwetherWidget.swift
 * and the CFBundleURLTypes entry in ios/App/App/Info.plist). No-ops on web.
 * Returns a cleanup function.
 */
export function onWidgetDeepLink(onLog: () => void): () => void {
  if (!Capacitor.isNativePlatform()) return () => {};
  const handle = CapacitorApp.addListener("appUrlOpen", ({ url }) => {
    try {
      if (new URL(url).host === "log" || new URL(url).pathname.includes("log")) onLog();
    } catch {
      /* malformed url - ignore */
    }
  });
  return () => { handle.then((h) => h.remove()).catch(() => {}); };
}

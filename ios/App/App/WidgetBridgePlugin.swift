import Foundation
import Capacitor

/**
 * Bridges a small snapshot of journal state from the web app into the
 * App Group container so the WidgetKit extension (which can't run JS or
 * read IndexedDB) can render it. Only ever writes the tiny summary the
 * web side chooses to send - never the full journal.
 *
 * JS side: src/lib/widgetBridge.ts
 * Reader side: ios/BellwetherWidget/BellwetherWidget.swift
 *
 * Xcode setup (see WIDGET_SETUP.md):
 *  1. Add this file to the "App" target.
 *  2. Add the "App Groups" capability to the App target and create/select
 *     group.com.cvree.bellwether (must match APP_GROUP_ID below and the
 *     widget extension's own App Groups capability).
 */
@objc(WidgetBridgePlugin)
public class WidgetBridgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WidgetBridgePlugin"
    public let jsName = "WidgetBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "saveSnapshot", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearSnapshot", returnType: CAPPluginReturnPromise)
    ]

    // Must match the App Group ID configured in both targets' entitlements.
    static let appGroupId = "group.com.cvree.bellwether"
    static let snapshotKey = "hj_widget_snapshot"

    @objc func saveSnapshot(_ call: CAPPluginCall) {
        guard let defaults = UserDefaults(suiteName: WidgetBridgePlugin.appGroupId) else {
            call.reject("App Group \(WidgetBridgePlugin.appGroupId) is not configured for this app.")
            return
        }

        let snapshot: [String: Any] = [
            "streak": call.getInt("streak") ?? 0,
            "todayLogged": call.getBool("todayLogged") ?? false,
            "metricLabel": call.getString("metricLabel") ?? "",
            "metricValue": call.getString("metricValue") ?? "",
            "trendLabel": call.getString("trendLabel") ?? "",
            "updatedAt": ISO8601DateFormatter().string(from: Date())
        ]

        guard let json = try? JSONSerialization.data(withJSONObject: snapshot) else {
            call.reject("Could not serialize snapshot.")
            return
        }

        defaults.set(json, forKey: WidgetBridgePlugin.snapshotKey)
        defaults.synchronize()

        if #available(iOS 14.0, *) {
            #if canImport(WidgetKit)
            WidgetCenter.shared.reloadAllTimelines()
            #endif
        }

        call.resolve()
    }

    @objc func clearSnapshot(_ call: CAPPluginCall) {
        guard let defaults = UserDefaults(suiteName: WidgetBridgePlugin.appGroupId) else {
            call.reject("App Group \(WidgetBridgePlugin.appGroupId) is not configured for this app.")
            return
        }
        defaults.removeObject(forKey: WidgetBridgePlugin.snapshotKey)
        if #available(iOS 14.0, *) {
            #if canImport(WidgetKit)
            WidgetCenter.shared.reloadAllTimelines()
            #endif
        }
        call.resolve()
    }
}

#if canImport(WidgetKit)
import WidgetKit
#endif

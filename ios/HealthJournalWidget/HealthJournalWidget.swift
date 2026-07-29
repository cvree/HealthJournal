import WidgetKit
import SwiftUI

// Must match WidgetBridgePlugin.swift (App target) exactly.
private let appGroupId = "group.com.cvree.healthjournal"
private let snapshotKey = "hj_widget_snapshot"

struct JournalSnapshot: Decodable {
    let streak: Int
    let todayLogged: Bool
    let metricLabel: String
    let metricValue: String
    let trendLabel: String
    let updatedAt: String

    static let empty = JournalSnapshot(
        streak: 0, todayLogged: false,
        metricLabel: "Open the app", metricValue: "—", trendLabel: "",
        updatedAt: ""
    )

    static func load() -> JournalSnapshot {
        guard
            let defaults = UserDefaults(suiteName: appGroupId),
            let data = defaults.data(forKey: snapshotKey),
            let snapshot = try? JSONDecoder().decode(JournalSnapshot.self, from: data)
        else { return .empty }
        return snapshot
    }
}

struct JournalEntry: TimelineEntry {
    let date: Date
    let snapshot: JournalSnapshot
}

struct JournalTimelineProvider: TimelineProvider {
    func placeholder(in context: Context) -> JournalEntry {
        JournalEntry(date: Date(), snapshot: .empty)
    }

    func getSnapshot(in context: Context, completion: @escaping (JournalEntry) -> Void) {
        completion(JournalEntry(date: Date(), snapshot: JournalSnapshot.load()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<JournalEntry>) -> Void) {
        let entry = JournalEntry(date: Date(), snapshot: JournalSnapshot.load())
        // The app pushes a fresh snapshot (and calls WidgetCenter.reloadAllTimelines())
        // on every save, so this refresh is just a safety net for e.g. day rollover.
        let nextRefresh = Calendar.current.date(byAdding: .hour, value: 4, to: Date()) ?? Date().addingTimeInterval(4 * 3600)
        completion(Timeline(entries: [entry], policy: .after(nextRefresh)))
    }
}

struct HealthJournalWidgetView: View {
    @Environment(\.widgetFamily) var family
    let entry: JournalEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("Health Journal")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundStyle(.secondary)
                Spacer()
                if entry.snapshot.streak > 0 {
                    Label("\(entry.snapshot.streak)", systemImage: "flame.fill")
                        .font(.caption)
                        .foregroundStyle(.orange)
                }
            }

            Spacer(minLength: 0)

            Text(entry.snapshot.metricValue)
                .font(.system(size: 34, weight: .bold, design: .rounded))
            Text(entry.snapshot.metricLabel)
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(1)

            if family != .systemSmall, !entry.snapshot.trendLabel.isEmpty {
                Text(entry.snapshot.trendLabel)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }

            Spacer(minLength: 0)

            Text(entry.snapshot.todayLogged ? "Logged today ✓" : "Tap to log today")
                .font(.caption2)
                .fontWeight(.medium)
                .foregroundStyle(entry.snapshot.todayLogged ? .green : .accentColor)
        }
        .padding()
        // Deep link back into the app; healthjournal:// must match capacitor.config.ts /
        // the URL scheme registered in Info.plist. Route it to the Log screen in App.tsx.
        .widgetURL(URL(string: "healthjournal://log"))
        .containerBackground(for: .widget) { Color(.systemBackground) }
    }
}

struct HealthJournalWidget: Widget {
    let kind = "HealthJournalWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: JournalTimelineProvider()) { entry in
            HealthJournalWidgetView(entry: entry)
        }
        .configurationDisplayName("Health Journal")
        .description("Your streak and today's key metric, at a glance.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

#Preview(as: .systemSmall) {
    HealthJournalWidget()
} timeline: {
    JournalEntry(date: .now, snapshot: JournalSnapshot(
        streak: 12, todayLogged: false,
        metricLabel: "Overall skin severity", metricValue: "4", trendLabel: "▼ 0.6 improving",
        updatedAt: ISO8601DateFormatter().string(from: .now)
    ))
}

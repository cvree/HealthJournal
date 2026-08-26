/* What the app is allowed to do without being asked.

   Every feature in this journal so far has had the same shape: a person decides
   something happened, and the app writes it down. Automation breaks that shape.
   The app decides something happened. That is a genuinely different kind of
   power, and in a health record it is a dangerous one — the whole value of six
   months of data is that somebody can look at a bad fortnight and trust what it
   says. An automation that guesses wrong does not lose a data point; it puts a
   plausible fiction in the middle of the evidence, and there is no way to tell
   afterwards which rows were guesses.

   So automations here run under one contract, and every entry in the registry
   below has to satisfy all five clauses:

   1. **It only concludes things the device actually observed.** Not "you
      probably ate lunch at one" — the app does not know that. "Your phone
      stopped seeing satellites" is an observation; what it implies is stated as
      an implication.

   2. **Whatever it writes is labelled as its own, permanently.** A session the
      app ended carries `estimated: true` for the rest of its life, and every
      surface that draws it says so. Confirming it does not launder it into a
      measurement.

   3. **It asks once, and taking no notice is a valid answer.** The question is
      one tap with a correction behind it. Ignoring it forever leaves a labelled
      estimate, which is a fine thing for a record to contain. Nothing nags, and
      nothing is deleted for want of an answer.

   4. **It is switchable, individually, in a list that names what it watches.**
      Not one "smart features" toggle. A person who wants their sun sessions to
      close themselves and wants nothing else inferred can have exactly that.

   5. **It never sends anything anywhere.** Every automation here runs on the
      device against data the device already has. The only outbound request in
      this app remains the daily weather one, under its own consent, and no
      automation may add to it.

   The fifth clause is why this file is a registry rather than a framework.
   There is no scheduler, no rules engine, no queue. Each automation is a pure
   function living beside the feature it belongs to; this module exists so there
   is one place that lists them, one place that stores whether each is on, and
   one place where the contract above is written down for the next person who
   wants to add one. */

/* ---------- the catalogue ---------- */

/** What a given automation needs before it can run at all. Rendered next to it
    in Settings, so an automation that cannot work on this device says why
    rather than sitting there switched on and doing nothing. */
export type Requirement = "location" | "daylight" | "foreground";

export const REQUIREMENT_LABEL: Record<Requirement, string> = {
  location: "Daily context switched on, so the app has your position",
  daylight: "Daytime, and a sun that is actually up",
  foreground: "The app open — a web app is not given a background position watch",
};

export type AutomationId = "sun-auto-end" | "sun-resume" | "sun-auto-start";

export interface Automation {
  id: AutomationId;
  label: string;
  /** One line, in the second person, saying what it does. */
  what: string;
  /** What signal it reads. Named concretely — "the accuracy of your position
      fixes" rather than "your location" — because the difference is the whole
      privacy argument and a vague word would throw it away. */
  watches: string;
  /** What lands in the journal because of it. */
  writes: string;
  /** How somebody undoes it. Every automation has to have an answer here; one
      that could not be undone would not be shippable. */
  reversible: string;
  requires: Requirement[];
  /** Whether it starts switched on. Only the two that cannot invent a record
      do — see the note on `sun-auto-start`. */
  defaultOn: boolean;
}

export const AUTOMATIONS: Automation[] = [
  {
    id: "sun-auto-end",
    label: "End sun sessions when you head in",
    what:
      "A session closes itself when your phone stops seeing open sky, at the time it stopped rather than the time the app worked it out.",
    watches:
      "The accuracy your phone reports for its own position while a session is running. No coordinates are read or stored by this.",
    writes:
      "The sun session you had already started, ended at an estimated time and marked as an estimate until you confirm it.",
    reversible:
      "Confirm the time, correct it with one slider, or delete the session. It is an ordinary session on your timeline either way.",
    requires: ["location", "foreground"],
    defaultOn: false,
  },
  {
    id: "sun-resume",
    label: "Keep a running session when you close the app",
    what:
      "A session you started is still running when you come back, however long you were away, until you end it.",
    watches: "Nothing. It stores the session you started on this device.",
    writes:
      "Nothing on its own. A session left running for more than six hours is closed at the app's best guess and asks you about it.",
    reversible: "End the session, or discard it, exactly as you would have.",
    requires: [],
    defaultOn: true,
  },
  {
    id: "sun-auto-start",
    label: "Offer to start a session when you go outside",
    what:
      "When the sun screen is open and your phone starts seeing open sky, it offers to start a session backdated to when you went out. It offers; it never starts one.",
    watches: "The same position accuracy as above, while the sun screen is open.",
    writes: "Nothing unless you accept the offer.",
    reversible: "Ignore the offer, or finish the session and delete it.",
    requires: ["location", "daylight", "foreground"],
    defaultOn: false,
  },
];

export const automationById = (id: AutomationId): Automation | undefined =>
  AUTOMATIONS.find((a) => a.id === id);

/* ---------- the switches ----------

   Stored on the profile beside the other standing preferences, so they travel
   with a backup and a sync — unlike the position watch itself, which is a
   per-device capability. A person who has decided their sun sessions should
   close themselves has decided that about their journal, not about one phone. */

export type AutomationSettings = Partial<Record<AutomationId, boolean>>;

export function sanitizeAutomationSettings(v: unknown): AutomationSettings | undefined {
  if (!v || typeof v !== "object") return undefined;
  const r = v as Record<string, unknown>;
  const out: AutomationSettings = {};
  for (const a of AUTOMATIONS) {
    if (typeof r[a.id] === "boolean") out[a.id] = r[a.id] as boolean;
  }
  return Object.keys(out).length ? out : undefined;
}

/** Is this automation on? An automation nobody has expressed a view about falls
    back to its default, which is how a new automation can ship switched off
    without needing a migration to say so. */
export function automationOn(settings: AutomationSettings | undefined, id: AutomationId): boolean {
  const explicit = settings?.[id];
  if (typeof explicit === "boolean") return explicit;
  return automationById(id)?.defaultOn ?? false;
}

/** Has this person ever been asked about this one? Drives the single in-context
    offer — the app gets to raise an automation once, at the moment it would
    obviously help, and then never again. */
export const automationDecided = (settings: AutomationSettings | undefined, id: AutomationId): boolean =>
  typeof settings?.[id] === "boolean";

export function setAutomation(
  settings: AutomationSettings | undefined,
  id: AutomationId,
  on: boolean
): AutomationSettings {
  return { ...(settings || {}), [id]: on };
}

/** Which requirements this device and this moment cannot meet. Empty means the
    automation will actually run; anything else is what Settings prints under
    the switch instead of leaving somebody to wonder why nothing happens. */
export function unmetRequirements(
  a: Automation,
  ctx: { hasLocation: boolean; isDaylight?: boolean }
): Requirement[] {
  const out: Requirement[] = [];
  if (a.requires.includes("location") && !ctx.hasLocation) out.push("location");
  if (a.requires.includes("daylight") && ctx.isDaylight === false) out.push("daylight");
  return out;
}

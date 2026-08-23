// @ts-nocheck — this file is the migrated single-file artifact, written as
// untyped JS. Incremental typing is planned (see README roadmap); new code in
// src/lib and src/components is fully typechecked.
import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useId } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, CartesianGrid, ComposedChart, Area, Cell,
} from "recharts";
import * as XLSX from "xlsx";
import { initSmoothScroll, scrollToTop, animateScreenIn, animateScreenChange, animateStepIn, animateFinish, flingCard, promoteCard, initReportReveal, slideFrom, prefersReducedMotion, lockPageScroll } from "./lib/motion";
import { ThumbNav, EdgeBack } from "./components/ThumbNav";
import {
  ROOT, applyHand, canGoBack, destinationsFor, navBack, navGo, navParent, navTop,
  onHandChange, onSystemBack, otherHand, readHand, reachDrop, screenLabel, setHand,
} from "./lib/oneHanded";
import AmbientBackdrop from "./components/AmbientBackdrop";
import AppearancePanel from "./components/AppearancePanel";
import RecoveryScreen from "./components/RecoveryScreen";
import ViewerLanding from "./components/ViewerLanding";
import LockScreen from "./components/LockScreen";
import { sanitizeCustomField } from "./lib/questions";
import { validateDatabase } from "./lib/validate";
import {
  serialize, csvEscape, toCSV, buildWideTable, metaCols as metaColsTyped,
  buildFoodTable, buildBowelTable, buildRoutineTable, buildRoutineItemsTable, logsInRange,
  buildLabsTable, buildSunTable, buildContextTable,
} from "./lib/exports";
import { playSound, setSoundEnabled, suspendSound, resumeSound } from "./lib/sound";
import {
  feedback, place, pulse, hapticsSupported, scaleHaptic, setFeedbackPrefs, getFeedbackPrefs,
  HAPTIC_PATTERNS, HAPTIC_SCALE, HAPTIC_LEVELS,
} from "./lib/feedback";
import { syncWidgetSnapshot, onWidgetDeepLink } from "./lib/widgetBridge";
import { createPinRecord, verifyPin } from "./lib/lock";
import {
  DEFAULT_REMINDER_TIME, isValidTime, formatTime, msUntilNext, buildReminderICS,
  notificationPermission, requestNotificationPermission, showReminderNotification,
  readReminders, sortReminders, nextReminderDue, newReminder, reminderMessage,
  buildRemindersICS, REMINDER_PRESETS,
} from "./lib/reminders";
import {
  storageStatus, requestPersistentStorage, backupNudge, describeBackupAge,
  isIOSWebBrowser, isStandalone,
} from "./lib/durability";
import { screenFromSearch, clearDeepLink } from "./lib/deeplink";
import { SyncEngine } from "./lib/sync/engine";
import { SupabaseBackend } from "./lib/sync/supabase";
import { syncConfig, syncAvailable, setDeviceConfig, clearDeviceConfig } from "./lib/sync/config";
import { ratePassphrase, suggestPassphrase } from "./lib/sync/crypto";
import { addTombstone } from "./lib/sync/project";
import { sweepTombstones } from "./lib/sync/merge";
import { IDLE_STATUS } from "./lib/sync/types";
import { C, readableInk, getTheme, onThemeChange, setBackdrop } from "./lib/theme";
import MetricPicker from "./components/MetricPicker";
import Rail from "./components/Rail";
import {
  MAX_IMPORT_IMAGES, applyImport, countKinds, describeAdded, groupByDate, readNotes,
  summariseImportRequest,
} from "./lib/import";
import YearHeatmap from "./components/YearHeatmap";
import ScoreDistribution from "./components/ScoreDistribution";
import EpisodeTimeline from "./components/EpisodeTimeline";
import MetricComparison, { ChartBands } from "./components/MetricComparison";
import ChartViewControls from "./components/ChartViewControls";
import { avgKeyOf, chartViewSummary, sanitizeChartView } from "./lib/chartView";
import RelationshipExplorer from "./components/RelationshipExplorer";
import LongTermView from "./components/LongTermView";
import { distribution, hardLabel, calmLabel, pct } from "./lib/distribution";
import { RELATIONSHIP_COPY } from "./lib/relationships";
import { buildHeatmap } from "./lib/heatmap";
import {
  sanitizeEpisodes, newEpisode, startFlare, endFlare, updateEpisode, removeEpisode,
  openEpisode, sortEpisodes, isOpen as episodeIsOpen, lastDay as episodeLastDay,
  episodeStats, episodeYear, compareEpisodeYears, episodeBands, episodeOn,
  daySpan, datesBetween, durationLabel, episodeWhen,
} from "./lib/episodes";
import {
  MEALS, mealLabel, mealForTime, UNITS, BRISTOL, bristolLabel, BOWEL_COLORS,
  BOWEL_CONSISTENCY, BOWEL_AMOUNTS, SEVERITY_0_3, severityLabel,
  NUTRIENTS, NUTRIENT_KEYS, nutrientDef, formatNutrient,
  newFoodLog, newBowelLog, resolveNutrient, effectiveNutrition, hasAiValues,
  hasUserEdits, acceptEstimate, discardEstimate,
  foodOn, bowelOn, dayTotals, foodSummary, bowelSummary,
  sanitizeFoodLogs, sanitizeBowelLogs, sanitizeFoodItems, sanitizeGoals,
  localTime, prettyTime, localDate,
  newFoodItem, rememberFood, logFromFoodItem, scaleNutrition,
  browseFoods, toggleFavorite, goalProgress, hasGoals,
  bowelSuggestion, applyBowelSuggestion, aiFilledBowelFields,
} from "./lib/tracking";
import {
  DERIVED_METRICS, derivedMetric, isDerivedKey, availableDerivedMetrics, metricCtx,
} from "./lib/metrics";
import AppointmentPackView from "./components/AppointmentPackView";
import FirstRun from "./components/FirstRun";
import {
  answerHabits, askQueue, followUps, isOneTap, pulseState, scoreWord, surveyProgress,
} from "./lib/pulse";
import {
  noteUse, rankIds, repeatSuggestions, sanitizeActionStats,
} from "./lib/quickActions";
import {
  moveItem, slotAt, shiftOffsets, applyVisibleOrder, describeMove,
} from "./lib/dragOrder";
import {
  PACK_SECTIONS, sanitizePackPrefs, buildAppointmentPack,
  candidateNotes, rangeOfDays, rangeSinceAppointment, rangeCustom, pageLabel,
  coverageLabel,
} from "./lib/appointmentPack";
import {
  ROUTINE_KINDS, ROUTINE_TIMES, kindDef, kindLabel, timeLabel, slotForTime,
  newRoutineItem, logFromItem, bumpItemUse,
  routineOn, routineChecklist, routineProgress, asNeededItems, scheduledItems,
  routineSummary, itemSummary, logLine, searchItems,
  sanitizeRoutineItems, sanitizeRoutineLogs,
} from "./lib/routine";
import {
  hasStoredKey, loadConnection, saveConnection, clearKey, maskKey, testConnection,
  buildAnalysisInput, summariseInput, runPatternAnalysis, strengthLabel, looksLikeKey,
  PROVIDERS, providerOf, OPENAI_NOTE,
  analyseFood, analyseBowelPhoto, summariseFoodRequest,
} from "./lib/ai";
/* ---------- the 1.21 systems ----------

   Five new modules, all pure or nearly so, all sanitised on load like every
   other collection here. The screens they drive live in ./components; this
   file owns the data, the routing and the one piece of glue that makes them
   feel like one product rather than five features: `lit`, the set of dates a
   finding is currently illuminating everywhere at once. */
import {
  dayLight, nextVitaminDWindow, durationLabel as minutesLabel,
} from "./lib/solar";
import { sanitizeSunProfile, sanitizeSunSessions, sunDay } from "./lib/sun";
import { EXPOSURE_LEVELS, SKIN_TYPES } from "./lib/solar";
import {
  DEFAULT_CONSENT, coarse, contextLine, contextObservations, contextOn, fetchContext,
  formatTemp, mergeContexts, needsRefresh, sanitizeConsent, sanitizeContexts,
} from "./lib/context";
import {
  labSeries, labSummaryLine, newLabResult, sanitizeLabResults, testsHeld,
} from "./lib/labs";
import {
  availableStarters, highlightDates, newExperiment, runAll, sanitizeExperiments,
  suggestExperiments,
} from "./lib/experiments";
import { variables as seriesVariables } from "./lib/series";
import SunScreen from "./components/SunScreen";
import ExperimentsScreen from "./components/ExperimentsScreen";
import EvidenceMeter from "./components/EvidenceMeter";
import LabsScreen from "./components/LabsScreen";
import { ContextStrip, ContextWash, SkyGlyph, TempTrace, washScale } from "./components/DayContext";

/* ============================================================
   Health Journal
   Private, mobile-first, local-first health tracking. The journal lives on the
   device; the four things that can reach the network (sync, AI, daily weather,
   note import) are each off until switched on and each say what they send.
   Not medical advice. Tracks possible patterns only.
   ============================================================ */

/* The name users see. Backup files still carry the original app string as
   their magic value (see BACKUP_APP_IDS) so journals exported before the
   rename keep restoring. */
export const APP_NAME = "Health Journal";
export const APP_VERSION = "1.23.0";

const DISCLAIMER =
  "This app is a personal tracking tool and is not medical advice. It does not diagnose, treat, cure, or prevent any condition. For medical concerns, symptoms, medication changes, restrictive diets, fainting, allergic reactions, abnormal labs, or major health changes, consult a qualified healthcare professional.";

const PATTERN_NOTE =
  "Possible pattern in your own logs — not proof of cause. May be worth noticing or discussing with a healthcare professional.";

/* Severity ramp, theme-aware. `colorFor` returns a value that is legible as
   *text* on a page background; `fillFor` is the same step as a solid swatch,
   with `readableInk` supplying whatever label sits on top of it. Keeping the
   two apart is what stops a green "2" from disappearing into a light card. */
const SEVERITY_STEPS = () => [C.good, C.warn, C.alert, C.bad];

/* ---------- small utils ---------- */

const uid = () =>
  Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

function localDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
const todayStr = () => localDateStr(new Date());

function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return localDateStr(new Date(y, m - 1, d + n));
}
function fmtShort(dateStr) {
  const [, m, d] = dateStr.split("-").map(Number);
  return `${m}/${d}`;
}
function fmtNice(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short", month: "short", day: "numeric",
  });
}
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const clampR = (v) => clamp(Math.round(v), 1, 10);
const fmt1 = (x) => (x == null ? "–" : (Math.round(x * 10) / 10).toString());

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Severity color ramp. dir "sym": high = worse. dir "pos": high = better. */
function colorFor(value, dir) {
  if (value == null) return C.sub;
  const bad = dir === "pos" ? 11 - value : value;
  const steps = SEVERITY_STEPS();
  if (bad <= 3) return steps[0];
  if (bad <= 5) return steps[1];
  if (bad <= 7) return steps[2];
  return steps[3];
}

/* ---------- field builders ---------- */

const F = {
  scale: (k, label, o = {}) => ({ k, label, type: "scale", dir: "sym", quick: false, ...o }),
  pos: (k, label, o = {}) => ({ k, label, type: "scale", dir: "pos", quick: false, ...o }),
  toggle: (k, label, o = {}) => ({ k, label, type: "toggle", quick: false, ...o }),
  chips: (k, label, options, o = {}) => ({ k, label, type: "chips", options, quick: false, ...o }),
  num: (k, label, unit, min, max, step, base, o = {}) =>
    ({ k, label, type: "number", unit, min, max, step, base, dir: "neutral", quick: false, ...o }),
  text: (k, label, o = {}) => ({ k, label, type: "text", quick: false, ...o }),
  photo: (k, label, o = {}) => ({
    k, label, type: "photo", quick: false, dir: "sym",
    category: "skin", bodyPart: "", side: "", angle: "",
    rated: true, scaleMax: 10, autoRate: false, requiredInSession: true, linkedTo: null, captionFrom: null, ...o,
  }),
};

const PHOTO_CATEGORIES = [["skin", "Skin"], ["progress", "Progress"], ["custom", "Other"]];
const PHOTO_SIDES = ["", "Left", "Right"];
const PHOTO_ANGLES = ["", "Front", "Side", "Back"];

/* ---------- templates ---------- */

const TEMPLATES = {
  eczema: {
    label: "Eczema / Skin",
    color: "#0E8578",
    keyMetric: "overall_skin_severity",
    chartMetrics: ["overall_skin_severity", "itch", "dryness", "redness", "sleep_quality", "stress"],
    pairs: [
      ["sleep_quality", "itch"],
      ["stress", "overall_skin_severity"],
      ["sweat_level", "itch"],
      ["sleep_quality", "overall_skin_severity"],
    ],
    fields: [
      F.scale("overall_skin_severity", "Overall skin severity", { quick: true, sec: "Skin today" }),
      F.scale("itch", "Itch", { quick: true, sec: "Skin today" }),
      F.scale("dryness", "Dryness", { quick: true, sec: "Skin today" }),
      F.scale("redness", "Redness", { quick: true, sec: "Skin today" }),
      F.scale("neck_severity", "Neck", { quick: true, sec: "Body areas" }),
      F.scale("scalp_severity", "Scalp", { quick: true, sec: "Body areas" }),
      F.scale("left_hand_severity", "Left hand", { quick: true, sec: "Body areas" }),
      F.scale("right_hand_severity", "Right hand", { quick: true, sec: "Body areas" }),
      F.scale("face_severity", "Face", { sec: "Body areas" }),
      F.scale("arms_severity", "Arms", { sec: "Body areas" }),
      F.scale("legs_severity", "Legs", { sec: "Body areas" }),
      F.scale("torso_severity", "Torso", { sec: "Body areas" }),
      F.photo("photo_left_hand", "Left hand photo", { sec: "Photos", bodyPart: "Hands", side: "Left", linkedTo: "left_hand_severity" }),
      F.photo("photo_right_hand", "Right hand photo", { sec: "Photos", bodyPart: "Hands", side: "Right", linkedTo: "right_hand_severity" }),
      F.pos("sleep_quality", "Sleep quality", { quick: true, sec: "Lifestyle" }),
      F.scale("stress", "Stress", { quick: true, sec: "Lifestyle" }),
      F.scale("sweat_level", "Sweat today", { quick: true, sec: "Lifestyle" }),
      F.pos("mood", "Mood", { sec: "Lifestyle" }),
      F.pos("energy", "Energy", { sec: "Lifestyle" }),
      F.num("sleep_hours", "Sleep", "h", 0, 14, 0.5, 8, { sec: "Lifestyle" }),
      F.toggle("moisturized_today", "Moisturized today", { quick: true, sec: "Care" }),
      F.toggle("treatment_used", "Treatment used", { quick: true, sec: "Care" }),
      F.text("treatment_detail", "Which treatment or product?", { dependsOn: "treatment_used", sec: "Care" }),
      F.toggle("showered_today", "Showered", { sec: "Care" }),
      F.chips("shower_temp", "Shower temperature", ["Hot", "Warm", "Cool"], { sec: "Care", single: true }),
      F.toggle("new_product_today", "New product today", { sec: "Care" }),
      F.chips("possible_triggers", "Possible triggers noticed",
        ["Sweat", "Stress", "New product", "Dairy", "Gluten", "Heat", "Dry air", "Chlorine", "Unknown"],
        { quick: true, sec: "Possible triggers" }),
      F.chips("food_tags", "Foods eaten",
        ["Dairy", "Gluten / wheat", "Eggs", "Nuts", "Soy", "Seafood", "Spicy", "High sugar", "Processed", "Caffeine"],
        { sec: "Possible triggers" }),
    ],
  },

  carnivore: {
    label: "Carnivore / Diet",
    color: C.dangerInk,
    keyMetric: "diet_adherence",
    chartMetrics: ["diet_adherence", "weight", "energy", "digestion_comfort", "cravings", "sleep_quality"],
    pairs: [
      ["diet_adherence", "cravings"],
      ["diet_adherence", "digestion_comfort"],
      ["diet_adherence", "energy"],
      ["sleep_quality", "energy"],
    ],
    fields: [
      F.pos("diet_adherence", "Diet adherence", { quick: true, sec: "Diet" }),
      F.toggle("non_carnivore_foods", "Any off-plan foods", { quick: true, sec: "Diet" }),
      F.text("offplan_detail", "What was off-plan?", { dependsOn: "non_carnivore_foods", sec: "Diet" }),
      F.chips("foods", "Main foods",
        ["Beef", "Steak", "Ground beef", "Pork", "Chicken", "Fish", "Eggs", "Cheese", "Butter", "Organ meat", "Bone broth", "Coffee"],
        { quick: true, sec: "Diet" }),
      F.chips("offplan_tags", "Off-plan tags",
        ["Added sugar", "Fruit", "Vegetables", "Grains", "Alcohol", "Sweeteners", "Sauces", "Fast food", "Restaurant", "Processed meat"],
        { sec: "Diet" }),
      F.num("weight", "Weight", "lb", 0, 600, 0.1, 200, { quick: true, sec: "Body" }),
      F.num("waist", "Waist", "in", 0, 80, 0.25, 34, { sec: "Body" }),
      F.photo("progress_photo_front", "Progress photo — front", { sec: "Progress photos", category: "progress", bodyPart: "Full body", angle: "Front", rated: false, captionFrom: "weight" }),
      F.photo("progress_photo_side", "Progress photo — side", { sec: "Progress photos", category: "progress", bodyPart: "Full body", angle: "Side", rated: false, captionFrom: "weight" }),
      F.photo("progress_photo_back", "Progress photo — back", { sec: "Progress photos", category: "progress", bodyPart: "Full body", angle: "Back", rated: false, captionFrom: "weight" }),
      F.pos("energy", "Energy", { quick: true, sec: "How you feel" }),
      F.pos("mood", "Mood", { quick: true, sec: "How you feel" }),
      F.scale("cravings", "Cravings", { quick: true, sec: "How you feel" }),
      F.scale("hunger", "Hunger", { quick: true, sec: "How you feel" }),
      F.pos("digestion_comfort", "Digestion comfort", { quick: true, sec: "Digestion" }),
      F.scale("bloating", "Bloating", { sec: "Digestion" }),
      F.scale("gas", "Gas", { sec: "Digestion" }),
      F.scale("nausea", "Nausea", { sec: "Digestion" }),
      F.toggle("bowel_movement", "Bowel movement today", { sec: "Digestion" }),
      F.pos("sleep_quality", "Sleep quality", { quick: true, sec: "Sleep & activity" }),
      F.num("sleep_hours", "Sleep", "h", 0, 14, 0.5, 8, { sec: "Sleep & activity" }),
      F.pos("activity", "Activity level", { sec: "Sleep & activity" }),
      F.num("water_intake", "Water", "cups", 0, 25, 1, 8, { quick: true, sec: "Hydration" }),
      F.toggle("salt_electrolytes", "Salt / electrolytes", { quick: true, sec: "Hydration" }),
    ],
  },

  pots: {
    label: "POTS / Dysautonomia",
    color: "#4A5BC0",
    keyMetric: "overall_symptom_severity",
    chartMetrics: ["overall_symptom_severity", "dizziness", "fatigue", "brain_fog", "standing_tolerance", "water_intake"],
    pairs: [
      ["water_intake", "overall_symptom_severity"],
      ["water_intake", "dizziness"],
      ["sleep_hours", "fatigue"],
      ["sleep_quality", "overall_symptom_severity"],
    ],
    fields: [
      F.scale("overall_symptom_severity", "Overall symptoms", { quick: true, sec: "Symptoms" }),
      F.scale("dizziness", "Dizziness / lightheaded", { quick: true, sec: "Symptoms" }),
      F.scale("palpitations", "Palpitations", { quick: true, sec: "Symptoms" }),
      F.scale("fatigue", "Fatigue", { quick: true, sec: "Symptoms" }),
      F.scale("brain_fog", "Brain fog", { quick: true, sec: "Symptoms" }),
      F.scale("nausea", "Nausea", { quick: true, sec: "Symptoms" }),
      F.scale("headache", "Headache", { sec: "Symptoms" }),
      F.scale("heat_intolerance", "Heat intolerance", { quick: true, sec: "Symptoms" }),
      F.pos("standing_tolerance", "Standing tolerance", { quick: true, sec: "Tolerance" }),
      F.pos("exercise_tolerance", "Exercise tolerance", { sec: "Tolerance" }),
      F.num("time_upright", "Time upright", "h", 0, 18, 0.5, 6, { sec: "Tolerance" }),
      F.num("resting_hr", "Resting heart rate", "bpm", 30, 220, 1, 70, { quick: true, sec: "Vitals" }),
      F.num("standing_hr", "Standing heart rate", "bpm", 30, 250, 1, 100, { quick: true, sec: "Vitals" }),
      F.text("blood_pressure", "Blood pressure (e.g. 110/70)", { sec: "Vitals" }),
      F.num("water_intake", "Water", "cups", 0, 25, 1, 8, { quick: true, sec: "Hydration" }),
      F.toggle("salt_electrolytes", "Salt / electrolytes", { quick: true, sec: "Hydration" }),
      F.pos("sleep_quality", "Sleep quality", { sec: "Lifestyle" }),
      F.num("sleep_hours", "Sleep", "h", 0, 14, 0.5, 8, { sec: "Lifestyle" }),
      F.scale("stress", "Stress", { sec: "Lifestyle" }),
      F.pos("activity", "Activity level", { sec: "Lifestyle" }),
      F.toggle("flare_day", "Flare day", { quick: true, sec: "Flare" }),
      F.chips("possible_triggers", "Possible triggers noticed",
        ["Heat", "Dehydration", "Low sleep", "Stress", "Illness", "Heavy activity", "Skipped meals"],
        { sec: "Flare" }),
    ],
  },
  ibs: {
    label: "IBS / Digestion",
    color: "#B07A2A",
    keyMetric: "overall_gut_severity",
    chartMetrics: ["overall_gut_severity", "abdominal_pain", "bloating", "stress", "sleep_quality"],
    pairs: [
      ["stress", "overall_gut_severity"],
      ["sleep_quality", "overall_gut_severity"],
      ["stress", "abdominal_pain"],
      ["water_intake", "overall_gut_severity"],
    ],
    fields: [
      F.scale("overall_gut_severity", "Overall gut symptoms", { quick: true, sec: "Gut today" }),
      F.scale("abdominal_pain", "Abdominal pain / cramping", { quick: true, sec: "Gut today" }),
      F.scale("bloating", "Bloating", { quick: true, sec: "Gut today" }),
      F.scale("gas", "Gas", { sec: "Gut today" }),
      F.scale("nausea", "Nausea", { sec: "Gut today" }),
      F.scale("urgency", "Urgency", { quick: true, sec: "Bathroom" }),
      F.num("bowel_movements", "Bowel movements", "", 0, 12, 1, 1, { quick: true, sec: "Bathroom" }),
      F.chips("stool_type", "Stool consistency", ["Hard", "Firm", "Normal", "Soft", "Loose", "Watery"], { quick: true, sec: "Bathroom", single: true }),
      F.pos("digestion_comfort", "Digestion comfort", { sec: "Gut today" }),
      F.chips("food_tags", "Foods eaten",
        ["Dairy", "Gluten / wheat", "Eggs", "Nuts", "Soy", "Seafood", "Spicy", "High sugar", "Processed", "Caffeine"],
        { sec: "Food" }),
      F.toggle("ate_out", "Ate out / takeaway", { sec: "Food" }),
      F.scale("stress", "Stress", { quick: true, sec: "Lifestyle" }),
      F.pos("sleep_quality", "Sleep quality", { quick: true, sec: "Lifestyle" }),
      F.num("water_intake", "Water", "cups", 0, 25, 1, 8, { sec: "Lifestyle" }),
      F.chips("possible_triggers", "Possible triggers noticed",
        ["Dairy", "Gluten", "Spicy", "Caffeine", "Alcohol", "High fat", "Stress", "Poor sleep", "Unknown"],
        { quick: true, sec: "Possible triggers" }),
    ],
  },

  migraine: {
    label: "Migraine / Headache",
    color: "#7A4AC0",
    keyMetric: "headache_severity",
    chartMetrics: ["headache_severity", "light_sensitivity", "sleep_quality", "stress", "water_intake"],
    pairs: [
      ["sleep_quality", "headache_severity"],
      ["stress", "headache_severity"],
      ["water_intake", "headache_severity"],
      ["screen_time", "headache_severity"],
    ],
    fields: [
      F.scale("headache_severity", "Headache / migraine severity", { quick: true, sec: "Head today" }),
      F.toggle("migraine_today", "Migraine attack today", { quick: true, sec: "Head today" }),
      F.num("headache_hours", "Headache duration", "h", 0, 24, 0.5, 2, { sec: "Head today" }),
      F.scale("aura", "Aura / visual symptoms", { sec: "Head today" }),
      F.scale("light_sensitivity", "Light sensitivity", { quick: true, sec: "Head today" }),
      F.scale("sound_sensitivity", "Sound sensitivity", { sec: "Head today" }),
      F.scale("nausea", "Nausea", { quick: true, sec: "Head today" }),
      F.scale("neck_tension", "Neck tension", { sec: "Head today" }),
      F.toggle("medication_taken", "Relief medication taken", { quick: true, sec: "Relief" }),
      F.text("medication_detail", "Which medication?", { dependsOn: "medication_taken", sec: "Relief" }),
      F.pos("med_effect", "Relief effectiveness", { sec: "Relief" }),
      F.num("water_intake", "Water", "cups", 0, 25, 1, 8, { quick: true, sec: "Lifestyle" }),
      F.pos("sleep_quality", "Sleep quality", { quick: true, sec: "Lifestyle" }),
      F.num("sleep_hours", "Sleep", "h", 0, 14, 0.5, 8, { sec: "Lifestyle" }),
      F.scale("stress", "Stress", { quick: true, sec: "Lifestyle" }),
      F.num("screen_time", "Screen time", "h", 0, 16, 0.5, 6, { sec: "Lifestyle" }),
      F.chips("possible_triggers", "Possible triggers noticed",
        ["Poor sleep", "Skipped meals", "Dehydration", "Screens", "Stress", "Alcohol", "Caffeine", "Weather", "Hormonal", "Strong smells", "Unknown"],
        { quick: true, sec: "Possible triggers" }),
    ],
  },

  allergy: {
    label: "Allergy / MCAS / Histamine",
    color: "#C04A6B",
    keyMetric: "overall_allergy_severity",
    chartMetrics: ["overall_allergy_severity", "itching_hives", "flushing", "congestion", "sleep_quality"],
    pairs: [
      ["stress", "overall_allergy_severity"],
      ["sleep_quality", "overall_allergy_severity"],
      ["stress", "itching_hives"],
    ],
    fields: [
      F.scale("overall_allergy_severity", "Overall reaction severity", { quick: true, sec: "Reactions today" }),
      F.scale("itching_hives", "Itching / hives", { quick: true, sec: "Reactions today" }),
      F.scale("flushing", "Flushing", { quick: true, sec: "Reactions today" }),
      F.scale("congestion", "Congestion / sneezing", { quick: true, sec: "Reactions today" }),
      F.scale("eye_irritation", "Eye irritation", { sec: "Reactions today" }),
      F.scale("gi_upset", "Stomach upset", { sec: "Reactions today" }),
      F.scale("headache", "Headache", { sec: "Reactions today" }),
      F.toggle("antihistamine_taken", "Antihistamine taken", { quick: true, sec: "Relief" }),
      F.text("antihistamine_detail", "Which antihistamine?", { dependsOn: "antihistamine_taken", sec: "Relief" }),
      F.toggle("new_food_today", "New / unusual food today", { sec: "Food" }),
      F.chips("food_tags", "Foods eaten",
        ["Dairy", "Gluten / wheat", "Eggs", "Nuts", "Soy", "Seafood", "Spicy", "High sugar", "Processed", "Caffeine"],
        { sec: "Food" }),
      F.chips("possible_triggers", "Possible triggers noticed",
        ["High-histamine food", "Leftovers", "Fermented food", "Alcohol", "Pollen", "Dust", "Heat", "Exercise", "Stress", "Unknown"],
        { quick: true, sec: "Possible triggers" }),
      F.scale("stress", "Stress", { sec: "Lifestyle" }),
      F.pos("sleep_quality", "Sleep quality", { quick: true, sec: "Lifestyle" }),
    ],
  },

  fatigue: {
    label: "Fatigue / Long COVID",
    color: C.chart3,
    keyMetric: "fatigue",
    chartMetrics: ["fatigue", "brain_fog", "energy", "activity", "sleep_quality"],
    pairs: [
      ["activity", "fatigue"],
      ["sleep_quality", "fatigue"],
      ["sleep_hours", "fatigue"],
      ["activity", "pem"],
    ],
    fields: [
      F.scale("fatigue", "Fatigue", { quick: true, sec: "Symptoms" }),
      F.scale("brain_fog", "Brain fog", { quick: true, sec: "Symptoms" }),
      F.scale("pem", "Post-exertional worsening", { quick: true, sec: "Symptoms" }),
      F.scale("breathlessness", "Breathlessness", { sec: "Symptoms" }),
      F.scale("palpitations", "Palpitations", { sec: "Symptoms" }),
      F.scale("headache", "Headache", { sec: "Symptoms" }),
      F.scale("muscle_aches", "Muscle aches", { sec: "Symptoms" }),
      F.pos("energy", "Energy", { quick: true, sec: "Capacity" }),
      F.pos("activity", "Activity level", { quick: true, sec: "Capacity" }),
      F.num("time_upright", "Time upright", "h", 0, 18, 0.5, 6, { sec: "Capacity" }),
      F.toggle("crash_day", "Crash day", { quick: true, sec: "Capacity" }),
      F.toggle("paced_today", "Paced activity today", { sec: "Capacity" }),
      F.pos("sleep_quality", "Sleep quality", { quick: true, sec: "Lifestyle" }),
      F.num("sleep_hours", "Sleep", "h", 0, 14, 0.5, 8, { sec: "Lifestyle" }),
      F.scale("stress", "Stress", { sec: "Lifestyle" }),
    ],
  },

  autoimmune: {
    label: "Autoimmune / Inflammation",
    color: "#9A5A3C",
    keyMetric: "overall_symptom_severity",
    chartMetrics: ["overall_symptom_severity", "joint_pain", "fatigue", "stiffness_morning", "sleep_quality"],
    pairs: [
      ["sleep_quality", "overall_symptom_severity"],
      ["stress", "overall_symptom_severity"],
      ["activity", "joint_pain"],
    ],
    fields: [
      F.scale("overall_symptom_severity", "Overall symptoms", { quick: true, sec: "Symptoms" }),
      F.scale("joint_pain", "Joint pain", { quick: true, sec: "Symptoms" }),
      F.scale("swelling", "Joint swelling", { sec: "Symptoms" }),
      F.scale("stiffness_morning", "Morning stiffness", { quick: true, sec: "Symptoms" }),
      F.num("stiffness_minutes", "Morning stiffness duration", "min", 0, 240, 5, 30, { sec: "Symptoms" }),
      F.scale("fatigue", "Fatigue", { quick: true, sec: "Symptoms" }),
      F.scale("rash", "Skin / rash", { sec: "Symptoms" }),
      F.scale("brain_fog", "Brain fog", { sec: "Symptoms" }),
      F.toggle("flare_day", "Flare day", { quick: true, sec: "Flare" }),
      F.toggle("medication_taken", "Medication taken as planned", { quick: true, sec: "Care" }),
      F.text("medication_detail", "Which medication?", { dependsOn: "medication_taken", sec: "Care" }),
      F.pos("sleep_quality", "Sleep quality", { quick: true, sec: "Lifestyle" }),
      F.scale("stress", "Stress", { quick: true, sec: "Lifestyle" }),
      F.pos("activity", "Activity level", { sec: "Lifestyle" }),
      F.chips("possible_triggers", "Possible triggers noticed",
        ["Poor sleep", "Stress", "Overexertion", "Illness", "Weather", "Certain foods", "Missed medication", "Unknown"],
        { sec: "Flare" }),
    ],
  },

  thyroid: {
    label: "Thyroid / Metabolic",
    color: "#3C8A9A",
    keyMetric: "energy",
    chartMetrics: ["energy", "fatigue", "weight", "resting_hr", "sleep_quality"],
    pairs: [
      ["sleep_quality", "energy"],
      ["sleep_hours", "fatigue"],
      ["stress", "anxiety"],
    ],
    fields: [
      F.pos("energy", "Energy", { quick: true, sec: "How you feel" }),
      F.pos("mood", "Mood", { quick: true, sec: "How you feel" }),
      F.scale("fatigue", "Fatigue", { quick: true, sec: "How you feel" }),
      F.scale("brain_fog", "Brain fog", { sec: "How you feel" }),
      F.scale("anxiety", "Anxiety / jitteriness", { sec: "How you feel" }),
      F.scale("cold_intolerance", "Cold intolerance", { sec: "Symptoms" }),
      F.scale("heat_intolerance", "Heat intolerance", { sec: "Symptoms" }),
      F.scale("palpitations", "Palpitations", { sec: "Symptoms" }),
      F.scale("hair_skin", "Hair / skin changes", { sec: "Symptoms" }),
      F.num("weight", "Weight", "lb", 0, 600, 0.1, 200, { quick: true, sec: "Body" }),
      F.num("resting_hr", "Resting heart rate", "bpm", 30, 220, 1, 70, { sec: "Body" }),
      F.toggle("medication_taken", "Thyroid medication taken", { quick: true, sec: "Care" }),
      F.text("medication_detail", "Which medication?", { dependsOn: "medication_taken", sec: "Care" }),
      F.pos("sleep_quality", "Sleep quality", { quick: true, sec: "Lifestyle" }),
      F.num("sleep_hours", "Sleep", "h", 0, 14, 0.5, 8, { sec: "Lifestyle" }),
      F.scale("stress", "Stress", { sec: "Lifestyle" }),
    ],
  },

  joint: {
    label: "Joint Pain / Mobility",
    color: "#6B8A3C",
    keyMetric: "overall_pain",
    chartMetrics: ["overall_pain", "stiffness", "mobility", "activity", "sleep_quality"],
    pairs: [
      ["activity", "overall_pain"],
      ["sleep_quality", "overall_pain"],
      ["stress", "overall_pain"],
    ],
    fields: [
      F.scale("overall_pain", "Overall joint pain", { quick: true, sec: "Joints today" }),
      F.scale("stiffness", "Stiffness", { quick: true, sec: "Joints today" }),
      F.scale("swelling", "Swelling", { sec: "Joints today" }),
      F.chips("pain_areas", "Painful areas",
        ["Knees", "Hips", "Hands", "Wrists", "Shoulders", "Elbows", "Ankles", "Feet", "Back", "Neck"],
        { quick: true, sec: "Joints today" }),
      F.pos("mobility", "Ease of movement", { quick: true, sec: "Movement" }),
      F.num("stiffness_minutes", "Morning stiffness duration", "min", 0, 240, 5, 30, { sec: "Movement" }),
      F.pos("activity", "Activity level", { quick: true, sec: "Movement" }),
      F.toggle("exercised_today", "Exercise / physio done", { quick: true, sec: "Movement" }),
      F.toggle("pain_relief_taken", "Pain relief taken", { sec: "Care" }),
      F.text("pain_relief_detail", "What did you take?", { dependsOn: "pain_relief_taken", sec: "Care" }),
      F.pos("sleep_quality", "Sleep quality", { quick: true, sec: "Lifestyle" }),
      F.scale("stress", "Stress", { sec: "Lifestyle" }),
      F.chips("possible_triggers", "Possible triggers noticed",
        ["Overuse", "Long sitting", "Cold / damp weather", "Poor sleep", "New activity", "Carrying / lifting", "Unknown"],
        { sec: "Possible triggers" }),
    ],
  },

  wellness: {
    label: "General Wellness / Custom",
    color: "#33685A",
    keyMetric: "wellbeing",
    chartMetrics: ["wellbeing", "mood", "energy", "stress", "sleep_quality"],
    pairs: [
      ["sleep_quality", "mood"],
      ["activity", "energy"],
      ["stress", "mood"],
      ["sleep_quality", "energy"],
    ],
    fields: [
      F.pos("wellbeing", "Overall wellbeing", { quick: true, sec: "Today" }),
      F.pos("mood", "Mood", { quick: true, sec: "Today" }),
      F.pos("energy", "Energy", { quick: true, sec: "Today" }),
      F.scale("stress", "Stress", { quick: true, sec: "Today" }),
      F.scale("anxiety", "Anxiety", { sec: "Today" }),
      F.pos("focus", "Focus", { sec: "Today" }),
      F.pos("sleep_quality", "Sleep quality", { quick: true, sec: "Habits" }),
      F.num("sleep_hours", "Sleep", "h", 0, 14, 0.5, 8, { sec: "Habits" }),
      F.pos("activity", "Activity level", { quick: true, sec: "Habits" }),
      F.num("water_intake", "Water", "cups", 0, 25, 1, 8, { sec: "Habits" }),
      F.toggle("exercised_today", "Exercise done", { sec: "Habits" }),
      F.toggle("time_outdoors", "Time outdoors", { sec: "Habits" }),
      F.toggle("social_time", "Social time", { sec: "Habits" }),
      F.text("gratitude", "One good thing today", { sec: "Reflection" }),
    ],
  },

  wearable: {
    label: "Wearable / Fitbit (import)",
    color: "#4A5FA5",
    keyMetric: "sleep_score",
    chartMetrics: ["steps", "sleep_duration_min", "sleep_score", "resting_hr", "avg_hr", "active_minutes", "weight"],
    pairs: [
      ["sleep_duration_min", "overall_skin_severity"], ["sleep_duration_min", "itch"],
      ["sleep_score", "overall_skin_severity"], ["steps", "energy"],
      ["resting_hr", "fatigue"], ["sleep_duration_min", "overall_symptom_severity"],
      ["avg_hr", "fatigue"], ["steps", "fatigue"],
    ],
    fields: [
      F.num("steps", "Steps", "steps", 0, 100000, 100, 8000, { sec: "Wearable (imported)", dir: "pos", detailed: false }),
      F.num("resting_hr", "Resting heart rate", "bpm", 30, 150, 1, 65, { sec: "Wearable (imported)", dir: "sym", detailed: false }),
      F.num("avg_hr", "Average heart rate", "bpm", 30, 220, 1, 75, { sec: "Wearable (imported)", dir: "neutral", detailed: false }),
      F.num("sleep_duration_min", "Sleep duration", "min", 0, 1200, 5, 420, { sec: "Wearable (imported)", dir: "pos", detailed: false }),
      F.num("sleep_score", "Sleep score", "/100", 0, 100, 1, 75, { sec: "Wearable (imported)", dir: "pos", detailed: false }),
      F.num("active_minutes", "Active minutes", "min", 0, 600, 5, 30, { sec: "Wearable (imported)", dir: "pos", detailed: false }),
      F.num("weight", "Weight", "lb", 0, 600, 0.1, 200, { sec: "Wearable (imported)", dir: "neutral", detailed: false }),
    ],
  },
};



/* Question packs used to each carry their own tint, which meant the interface
   changed hue depending on which packs someone had enabled. One accent reads
   as a considered product; ten read as ten products. The `color` key stays on
   every template so existing call sites keep working — it just resolves to the
   live theme accent instead of a frozen hex, which also means a theme switch
   repaints it without invalidating any cached template. */
function liveTint(target) {
  Object.defineProperty(target, "color", {
    get: () => C.accent,
    enumerable: true,
    configurable: true,
  });
  return target;
}
for (const t of Object.values(TEMPLATES)) liveTint(t);

const BODY_AREAS = ["Face", "Scalp", "Neck", "Chest", "Back", "Arms", "Hands", "Abdomen", "Legs", "Feet", "Full body", "Other"];

const getField = (tpl, k) => tpl.fields.find((f) => f.k === k);

/* Days of logged history that would lose their questions if module `mk` were
   turned off — counts entries with an answer (or photo) on a field only `mk`
   provides among the currently enabled modules. */
function packHistoryDays(mk, enabledModules, entries) {
  const t = TEMPLATES[mk];
  if (!t) return 0;
  const otherKeys = new Set();
  for (const om of enabledModules) {
    if (om === mk || !TEMPLATES[om]) continue;
    for (const f of TEMPLATES[om].fields) otherKeys.add(f.k);
  }
  const unique = t.fields.filter((f) => !otherKeys.has(f.k));
  if (!unique.length) return 0;
  let n = 0;
  for (const e of entries) {
    if (unique.some((f) => (f.type === "photo" ? e.photos?.[f.k]?.photoId : e.answers?.[f.k] != null))) n++;
  }
  return n;
}

/* Merge a profile's enabled modules + custom questions into one virtual template.
   Fields are de-duped by key (first module wins) so e.g. "sleep_quality" is asked once
   even if it exists in two modules. profile.disabledFields hides individual questions. */
function orderFields(fields, order) {
  if (!order || !order.length) return fields;
  const idx = new Map(order.map((k, i) => [k, i]));
  return [...fields].sort((a, b) => (idx.has(a.k) ? idx.get(a.k) : 999) - (idx.has(b.k) ? idx.get(b.k) : 999));
}

/* ---------- question categories ----------

   Packs are how questions arrive; categories are how people think about them.
   Someone hunting for "how do I stop being asked about my knees" is looking
   for Pain, not for "Joint Pain / Mobility pack, third row". So the editor
   groups by subject, and the pack a question came from stays visible on the
   row itself.

   The mapping is an explicit key list rather than a clever inference, because
   a question landing in a surprising drawer is worse than a long constant. The
   `sec`/type fallbacks below only catch anything a future pack forgets to
   register, so nothing can ever vanish from the editor. */

const CATEGORY_ORDER = [
  "symptoms", "pain", "sleep", "mood", "energy", "digestion", "food", "bowel",
  "hydration", "activity", "meds", "vitals", "skincare", "triggers", "photos", "custom", "other",
];

const CATEGORY_META = {
  symptoms: { label: "Symptoms", icon: "warn", color: "#C2643F" },
  pain:     { label: "Pain", icon: "target", color: "#B4504F" },
  sleep:    { label: "Sleep", icon: "moon", color: "#6E63C8" },
  mood:     { label: "Mood", icon: "spark", color: "#8A63C8" },
  energy:   { label: "Energy", icon: "sunrise", color: "#C79A3F" },
  digestion:{ label: "Digestion", icon: "snack", color: "#4E8F6E" },
  food:     { label: "Food", icon: "food", color: "#3F8FC2" },
  bowel:    { label: "Bowel movements", icon: "bowel", color: "#8A7A5E" },
  hydration:{ label: "Hydration", icon: "drink", color: "#3FA8C2" },
  activity: { label: "Activity", icon: "trends", color: "#5B9E4F" },
  meds:     { label: "Medications & supplements", icon: "pill", color: "#7A6FD0" },
  vitals:   { label: "Vitals & body", icon: "device", color: "#C25B7A" },
  skincare: { label: "Skin care & products", icon: "sun", color: "#0E8578" },
  triggers: { label: "Triggers & environment", icon: "search", color: "#9A7B4F" },
  photos:   { label: "Photos", icon: "camera", color: "#5B63E8" },
  custom:   { label: "Your own questions", icon: "plus", color: "#8A63C8" },
  other:    { label: "Other", icon: "sliders", color: "#7C8497" },
};

/* key -> category. Grouped by destination so it reads as the taxonomy it is. */
const FIELD_CATEGORY = {};
const _cat = (cat, keys) => keys.forEach((k) => { FIELD_CATEGORY[k] = cat; });

_cat("symptoms", [
  "overall_symptom_severity", "overall_skin_severity", "overall_gut_severity", "overall_allergy_severity",
  "itch", "dryness", "redness", "rash", "hair_skin", "swelling", "flare_day",
  "neck_severity", "scalp_severity", "left_hand_severity", "right_hand_severity",
  "face_severity", "arms_severity", "legs_severity", "torso_severity",
  "brain_fog", "breathlessness", "dizziness", "palpitations", "cold_intolerance", "heat_intolerance",
  "aura", "light_sensitivity", "sound_sensitivity", "migraine_today",
  "congestion", "eye_irritation", "flushing", "itching_hives",
]);
_cat("pain", [
  "overall_pain", "joint_pain", "muscle_aches", "abdominal_pain", "pain_areas",
  "headache", "headache_severity", "headache_hours", "neck_tension",
  "stiffness", "stiffness_morning", "stiffness_minutes",
]);
_cat("sleep", ["sleep_quality", "sleep_hours", "sleep_duration_min", "sleep_score"]);
_cat("mood", ["mood", "stress", "anxiety", "wellbeing", "focus", "gratitude"]);
_cat("energy", ["energy", "fatigue", "pem", "crash_day", "paced_today", "exercise_tolerance", "standing_tolerance", "time_upright"]);
_cat("digestion", ["digestion_comfort", "bloating", "gas", "nausea", "gi_upset"]);
_cat("food", [
  "foods", "food_tags", "offplan_tags", "offplan_detail", "diet_adherence",
  "non_carnivore_foods", "ate_out", "new_food_today", "hunger", "cravings",
]);
_cat("bowel", ["bowel_movement", "bowel_movements", "stool_type", "urgency"]);
_cat("hydration", ["water_intake", "salt_electrolytes"]);
_cat("activity", ["activity", "exercised_today", "mobility", "steps", "active_minutes", "screen_time", "time_outdoors", "social_time"]);
_cat("meds", [
  "medication_taken", "medication_detail", "med_effect",
  "antihistamine_taken", "antihistamine_detail",
  "pain_relief_taken", "pain_relief_detail",
  "treatment_used", "treatment_detail",
]);
_cat("vitals", ["weight", "waist", "blood_pressure", "resting_hr", "standing_hr", "avg_hr"]);
_cat("skincare", ["moisturized_today", "showered_today", "shower_temp", "new_product_today"]);
_cat("triggers", ["possible_triggers", "sweat_level"]);

/* `sec` is a decent second guess for anything unregistered — packs name their
   sections in the same language the categories use. */
const SEC_CATEGORY = {
  "Symptoms": "symptoms", "Skin today": "symptoms", "Head today": "symptoms",
  "Body areas": "symptoms", "Reactions today": "symptoms", "Joints today": "pain",
  "Gut today": "digestion", "Digestion": "digestion", "Bathroom": "bowel",
  "Diet": "food", "Food": "food", "Hydration": "hydration",
  "Movement": "activity", "Sleep & activity": "activity", "Capacity": "energy", "Tolerance": "energy",
  "Relief": "meds", "Care": "meds", "Vitals": "vitals", "Body": "vitals",
  "Photos": "photos", "Progress photos": "photos",
  "Possible triggers": "triggers", "Habits": "activity",
  "How you feel": "mood", "Today": "mood", "Reflection": "mood", "Lifestyle": "mood",
  "Wearable (imported)": "activity", "Custom": "custom",
};

/** Which drawer a question lives in. Photos and custom questions win outright —
    they are how people look for those two, whatever the question is about. */
function categoryOf(field) {
  if (!field) return "other";
  if (field.custom) return "custom";
  if (field.type === "photo") return "photos";
  return FIELD_CATEGORY[field.k] || SEC_CATEGORY[field.sec] || "other";
}

/* Profile objects are replaced immutably on every edit, so a WeakMap keyed on
   the object itself is a correct (and GC-safe) memo — every screen calls this
   on each render. */
const _tplCache = new WeakMap();
function getProfileTemplate(profile) {
  const hit = _tplCache.get(profile);
  if (hit) return hit;
  const tpl = computeProfileTemplate(profile);
  _tplCache.set(profile, tpl);
  return tpl;
}

function computeProfileTemplate(profile) {
  const modules = (profile.modules && profile.modules.length ? profile.modules : [profile.templateType])
    .filter((m) => TEMPLATES[m]);
  const disabled = new Set(profile.disabledFields || []);
  const overrides = profile.fieldOverrides || {};
  const multi = modules.length > 1;
  const seen = new Set();
  let fields = [];
  for (const mk of modules) {
    const t = TEMPLATES[mk];
    for (const f of t.fields) {
      if (seen.has(f.k)) continue;
      seen.add(f.k);
      if (disabled.has(f.k)) continue;
      fields.push(multi ? { ...f, sec: `${t.label} — ${f.sec}` } : f);
    }
  }
  for (const rawCq of profile.customQuestions || []) {
    const cq = sanitizeCustomField(rawCq); // malformed custom questions degrade safely (or drop)
    if (!cq || disabled.has(cq.k) || seen.has(cq.k)) continue;
    seen.add(cq.k);
    fields.push(cq);
  }
  fields = fields.map((f) => (overrides[f.k] ? { ...f, ...overrides[f.k] } : f));
  fields = orderFields(fields, profile.fieldOrder);

  const primary = TEMPLATES[modules[0]] || Object.values(TEMPLATES)[0];
  const candidateMetrics = [];
  for (const mk of modules) {
    for (const cm of TEMPLATES[mk].chartMetrics) {
      if (fields.find((f) => f.k === cm) && !candidateMetrics.includes(cm)) candidateMetrics.push(cm);
    }
  }
  for (const cq of profile.customQuestions || []) {
    if (cq.type === "scale" && fields.find((f) => f.k === cq.k) && !candidateMetrics.includes(cq.k) && candidateMetrics.length < 8) {
      candidateMetrics.push(cq.k);
    }
  }
  const chartMetrics = candidateMetrics.filter((k) => fields.find((f) => f.k === k)?.chart !== false);
  const dashboardMetrics = candidateMetrics.filter((k) => fields.find((f) => f.k === k)?.dashboard !== false);
  const pairs = [];
  for (const mk of modules) {
    for (const pr of TEMPLATES[mk].pairs) {
      if (fields.find((f) => f.k === pr[0]) && fields.find((f) => f.k === pr[1]) && !pairs.some((p) => p[0] === pr[0] && p[1] === pr[1])) {
        pairs.push(pr);
      }
    }
  }
  /* The one number this journal is about. The person picks it during setup —
     "which of these matters most?" is a question only they can answer, and a
     pack's own idea of its key metric is a default, not a diagnosis. It is
     honoured only while it still names a real 1–10 question in the setup, so
     switching a pack off can never leave the app pointed at nothing. */
  const chosen = profile.keyMetric
    && fields.find((f) => f.k === profile.keyMetric && f.type === "scale" && f.dashboard !== false)
    ? profile.keyMetric : null;
  const keyMetric = chosen
    || (fields.find((f) => f.k === primary.keyMetric && f.dashboard !== false)
      ? primary.keyMetric
      : (dashboardMetrics[0] || chartMetrics[0] || fields.find((f) => f.type === "scale")?.k || null));
  const label = modules.length ? modules.map((mk) => TEMPLATES[mk].label).join(" + ") : "Custom setup";
  return liveTint({
    label, keyMetric,
    chartMetrics: chartMetrics.length ? chartMetrics : [keyMetric].filter(Boolean),
    dashboardMetrics: dashboardMetrics.length ? dashboardMetrics : [keyMetric].filter(Boolean),
    pairs, fields,
  });
}

/* ---------- sample data ---------- */

/* ---------- feedback & atmosphere defaults ----------

   Sound and the moving backdrop ship **on**. They are most of what makes the
   app feel like a place rather than a form, and an off-by-default delight is a
   delight almost nobody ever sees. Both are one switch away in Settings, both
   are remembered, and both stand down on their own: the backdrop never runs
   under prefers-reduced-motion, and audio only ever exists after a real tap.

   `prefsVersion` is what keeps this from being rude. A journal saved before
   these defaults changed ran with sound and backdrop off, and that silence was
   the app's promise, not an unset field — so LEGACY_PREFS is what an old
   install gets backfilled with, and anything already chosen is never touched.

   v3 raises the floor on feedback: sound on, and the vibration motor driven at
   its top setting rather than the polite one. */
const DEFAULT_PREFS = {
  sound: true, haptics: true, hapticStrength: "vivid", backdrop: true, prefsVersion: 3,
};
const LEGACY_PREFS = {
  sound: false, haptics: true, hapticStrength: "vivid", backdrop: false, prefsVersion: 1,
};

/* One-way door: an install that had explicitly switched the old backdrop off
   keeps a plain surface, but only until the device store has an opinion of its
   own. After that the chooser owns the setting and this never fires again. */
const BACKDROP_MIGRATED_KEY = "fhj_backdrop_migrated_v1";
function migrateBackdropPref(prefs) {
  try {
    if (typeof localStorage === "undefined") return;
    if (localStorage.getItem(BACKDROP_MIGRATED_KEY)) return;
    localStorage.setItem(BACKDROP_MIGRATED_KEY, "1");
    if (prefs?.backdrop === false) setBackdrop("off");
  } catch {
    /* storage blocked — the default backdrop is still a fine backdrop */
  }
}

/** Age in whole years, from the birth year the setup stored.

    The setup asks "how old are you" and writes down the year that implies,
    which is the only version of this that survives contact with time: an age
    typed in 2026 and printed unchanged in 2029 is a wrong number on the one
    page whose entire job is to be handed to a clinician. */
function profileAge(profile) {
  const y = profile?.birthYear;
  if (typeof y !== "number" || !Number.isFinite(y)) return null;
  const age = new Date().getFullYear() - y;
  return age >= 0 && age < 130 ? age : null;
}

function blankProfile() {
  const now = new Date().toISOString();
  return { id: "p_self", name: "", modules: [], disabledFields: [], customQuestions: [],
    fieldOrder: [], fieldOverrides: {}, photoBaselines: {}, cameraTimer: 3,
    prefs: { ...DEFAULT_PREFS }, createdAt: now, updatedAt: now };
}

/* Ships with one example setup: Eczema/Skin + a few Carnivore/Diet questions.
   (A Carnivore-only setup, or a POTS-only setup, are just other configurations
   a single user could choose in Edit Setup — not separate profiles.) */
function genSampleData() {
  const t0 = todayStr();
  const iso = (ds) => new Date(ds + "T20:00:00").toISOString();
  const nowIso = new Date().toISOString();
  const profile = {
    id: "p_self", name: "Connor", modules: ["eczema", "carnivore"],
    disabledFields: ["waist", "energy", "mood", "cravings", "hunger", "digestion_comfort",
      "bloating", "gas", "nausea", "bowel_movement", "activity", "water_intake", "salt_electrolytes", "offplan_tags"],
    customQuestions: [], fieldOrder: [], fieldOverrides: {}, photoBaselines: {}, cameraTimer: 3,
    prefs: { ...DEFAULT_PREFS }, createdAt: nowIso, updatedAt: nowIso,
  };
  const entries = [];
  const push = (date, answers, notes, detailed) =>
    entries.push({
      id: uid(), profileId: profile.id, date, answers, notes: notes || "",
      quickLogCompleted: true, detailedLogCompleted: !!detailed,
      createdAt: iso(date), updatedAt: iso(date),
    });

  const rng = mulberry32(11);
  const noteBank = ["Neck was worse after mowing the lawn.", "Tried the new fragrance-free lotion.", "Scratched in sleep again.", "Calmer day, skin felt less tight."];
  for (let i = 34; i >= 1; i--) {
    if (rng() < 0.08) continue;
    const date = addDays(t0, -i);
    const prog = (34 - i) / 34;
    const base = 7.4 - 3.4 * prog;
    const sleep = clamp(Math.round(4 + rng() * 5.5), 1, 10);
    const stress = clamp(Math.round(3 + rng() * 5), 1, 10);
    const sweat = clamp(Math.round(2 + rng() * 6), 1, 10);
    const itch = clampR(base + (7 - sleep) * 0.45 + sweat * 0.12 + (rng() * 2 - 1));
    const a = {
      overall_skin_severity: clampR(base + stress * 0.1 + (rng() * 2 - 1)),
      itch,
      dryness: clampR(base + (rng() * 2 - 1)),
      redness: clampR(base - 1 + (rng() * 2 - 1)),
      neck_severity: clampR(base + 1 + (rng() * 2 - 1)),
      scalp_severity: clampR(base + (rng() * 2 - 1)),
      left_hand_severity: clampR(base - 1 + (rng() * 2 - 1)),
      right_hand_severity: clampR(base - 0.5 + (rng() * 2 - 1)),
      sleep_quality: sleep,
      stress,
      sweat_level: sweat,
      moisturized_today: rng() < 0.8,
      treatment_used: rng() < 0.4,
    };
    if (a.treatment_used) a.treatment_detail = ["Hydrocortisone 1%", "CeraVe cream", "Tacrolimus ointment"][Math.floor(rng() * 3)];
    if (rng() < 0.35) a.possible_triggers = [["Sweat", "Stress", "Heat", "Dry air", "Dairy"][Math.floor(rng() * 5)]];
    if (rng() < 0.7) {
      a.diet_adherence = clamp(Math.round(5 + rng() * 4), 1, 10);
      a.non_carnivore_foods = rng() < 0.5;
      if (a.non_carnivore_foods) a.offplan_detail = ["Chips at a party", "Slice of pizza", "Dessert after dinner"][Math.floor(rng() * 3)];
      a.foods = ["Beef", "Eggs"].concat(rng() < 0.4 ? ["Cheese"] : []);
    }
    a.weight = Math.round((201 - prog * 4.5 + (rng() * 1.4 - 0.7)) * 10) / 10;
    const detailed = rng() < 0.3;
    if (detailed) { a.sleep_hours = Math.round((5.5 + rng() * 3.5) * 2) / 2; a.mood = clampR(8 - a.overall_skin_severity * 0.4 + rng() * 2); a.energy = clampR(sleep - 1 + rng() * 3); }
    push(date, a, rng() < 0.18 ? noteBank[Math.floor(rng() * noteBank.length)] : "", detailed);
  }

  /* A routine Connor would plausibly have: the cream he is tracking, the
     steroid he only uses on a flare, and two supplements. The logs run over
     the last fortnight with the odd gap, because a demo where every box is
     ticked every day teaches the wrong thing about what this is for. */
  const routineItems = [
    newRoutineItem({ id: "ri_demo_cerave", name: "CeraVe moisturising cream", kind: "topical",
      dose: "2 pumps", times: ["morning", "bed"], daily: true, useCount: 22 }),
    newRoutineItem({ id: "ri_demo_vitd", name: "Vitamin D3", kind: "supplement",
      dose: "2000 IU", times: ["morning"], daily: true, useCount: 12 }),
    newRoutineItem({ id: "ri_demo_omega", name: "Fish oil", kind: "supplement",
      dose: "2 capsules", times: ["evening"], daily: true, useCount: 9 }),
    newRoutineItem({ id: "ri_demo_hc", name: "Hydrocortisone 1%", kind: "med",
      dose: "thin layer", times: [], daily: false, useCount: 4 }),
  ];
  const routine = [];
  /* Stops at yesterday, like the entries above: the demo journal opens with
     today still to do, which is the state the app is actually for. */
  for (let i = 14; i >= 1; i--) {
    const date = addDays(t0, -i);
    const at = (time, item, slot, extra) => routine.push({
      id: `rl_demo_${date}_${slot}_${item.id}`, date, time,
      itemId: item.id, name: item.name, kind: item.kind, dose: item.dose, slot,
      createdAt: iso(date), updatedAt: iso(date), ...extra,
    });
    if (rng() < 0.92) at("07:40", routineItems[0], "morning");
    if (rng() < 0.85) at("07:41", routineItems[1], "morning");
    if (rng() < 0.7) at("19:20", routineItems[2], "evening");
    if (rng() < 0.8) at("22:30", routineItems[0], "bed", rng() < 0.12 ? { skipped: true } : undefined);
    if (rng() < 0.2) at("21:00", routineItems[3], undefined);
  }

  return { profile, entries, routineItems, routine, ack: false };
}

/* ---------- persistence (window.storage with in-memory fallback) ---------- */

const SKEY = "fhj_v1";
// Deliberately its own key, never included in profile/entries — so the PIN
// record never rides along in an exported JSON backup or the Fitbit-style
// data model. See src/lib/lock.ts.
const LOCK_KEY = "fhj_lock_v1";
const mem = {};
const store = {
  async get(k) {
    if (typeof window !== "undefined" && window.storage) {
      try { const r = await window.storage.get(k); return r ? r.value : null; }
      catch (e) { return null; }
    }
    return mem[k] ?? null;
  },
  async set(k, v) {
    if (typeof window !== "undefined" && window.storage) {
      try { await window.storage.set(k, v); return; } catch (e) { /* keep in memory */ }
    }
    mem[k] = v;
  },
  async del(k) {
    if (typeof window !== "undefined" && window.storage) {
      try { await window.storage.delete(k); return; } catch (e) { /* fall through */ }
    }
    delete mem[k];
  },
};

/* ---------- photo storage (one blob per key, metadata index) ---------- */

const PHOTO_KEY = (id) => `fhj_photo:${id}`;
const THUMB_KEY = (id) => `fhj_thumb:${id}`;
const PHOTO_INDEX_KEY = "fhj_photoIndex";

async function loadPhotoIndex() {
  const raw = await store.get(PHOTO_INDEX_KEY);
  if (!raw) return {};
  try { return JSON.parse(raw); } catch (e) { return {}; }
}

/* Transactional: writes full+thumb blobs for every item, then the index, in one
   pass. If ANY write fails partway (e.g. storage quota), every blob written
   during this call is rolled back before the error is rethrown — guarantees
   zero orphan blobs on failure. Callers can safely skip cleanup on catch. */
async function savePhotos(items) {
  // items: [{ id, full, thumb, fieldKey, date, takenAt }]
  const written = [];
  try {
    for (const it of items) {
      await store.set(PHOTO_KEY(it.id), it.full);
      written.push(it.id);
      await store.set(THUMB_KEY(it.id), it.thumb);
    }
    const ix = await loadPhotoIndex();
    for (const it of items) {
      ix[it.id] = { fieldKey: it.fieldKey, date: it.date, takenAt: it.takenAt, bytes: it.full.length + it.thumb.length };
    }
    await store.set(PHOTO_INDEX_KEY, JSON.stringify(ix));
  } catch (e) {
    for (const id of written) { await store.del(PHOTO_KEY(id)); await store.del(THUMB_KEY(id)); }
    throw e;
  }
}
/* The live sync engine, if there is one. Module-level for the same reason the
   theme tokens and the feedback layer are: photo deletion happens from half a
   dozen call sites spread across several thousand lines, and threading a
   reference to every one of them to close one gap would be its own bug. */
let SYNC_ENGINE = null;

async function deletePhotos(ids) {
  if (!ids.length) return;
  const ix = await loadPhotoIndex();
  for (const id of ids) { await store.del(PHOTO_KEY(id)); await store.del(THUMB_KEY(id)); delete ix[id]; }
  await store.set(PHOTO_INDEX_KEY, JSON.stringify(ix));
  /* Deleting a photo has to mean deleting it. Removing the local blob and
     leaving the uploaded copy sitting in a bucket would be the quietest
     possible way for this app to break its own promise. No-op when sync is
     off, and retried on the normal loop when the network is not there. */
  SYNC_ENGINE?.notePhotoDeleted?.(ids);
}
async function loadPhotoData(id) {
  return id ? await store.get(PHOTO_KEY(id)) : null;
}
async function loadThumbData(id) {
  return id ? await store.get(THUMB_KEY(id)) : null;
}

/* Draws a decoded source (Image or video element) twice: a 1024px-edge JPEG
   for detail view (~80–200KB) and a 160px-edge thumbnail (~3–8KB). Shared by
   file uploads and live-camera frame grabs. */
function makeShot(source, srcW, srcH, opts = {}) {
  const { fullEdge = 1024, fullQ = 0.6, thumbEdge = 160, thumbQ = 0.5 } = opts;
  const draw = (edge, q) => {
    const s = Math.min(1, edge / Math.max(srcW, srcH));
    const w = Math.max(1, Math.round(srcW * s)), h = Math.max(1, Math.round(srcH * s));
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    c.getContext("2d").drawImage(source, 0, 0, w, h);
    return c.toDataURL("image/jpeg", q);
  };
  return { full: draw(fullEdge, fullQ), thumb: draw(thumbEdge, thumbQ) };
}

/* Decodes an uploaded file once, then produces {full, thumb}. */
function processImage(file, opts = {}) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      let result;
      try { result = makeShot(img, img.width, img.height, opts); }
      catch (err) { URL.revokeObjectURL(url); reject(err); return; }
      URL.revokeObjectURL(url);
      resolve(result);
    };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

const CAMERA_TIMERS = [[0, "Off"], [3, "3s"], [5, "5s"], [10, "10s"]];

/* Most recent saved photo for a field before `date` (fallback: same day) — used
   as framing ghost and as `comparedTo` reference. */
function prevPhotoFor(entries, fieldKey, date) {
  const sorted = [...entries].sort((a, b) => (a.date > b.date ? -1 : 1));
  const before = sorted.find((e) => e.date < date && e.photos?.[fieldKey]?.photoId);
  if (before) return { ...before.photos[fieldKey], date: before.date };
  const same = sorted.find((e) => e.date === date && e.photos?.[fieldKey]?.photoId);
  return same ? { ...same.photos[fieldKey], date: same.date } : null;
}

/* ---------- derived stats ---------- */

function entriesFor(db) {
  return [...db.entries].sort((a, b) => (a.date < b.date ? -1 : 1));
}
function entryOn(entries, date) {
  return entries.find((e) => e.date === date) || null;
}
function calcStreak(entries) {
  // Entries auto-created by a data import (e.auto) don't count toward the streak.
  const set = new Set(entries.filter((e) => !e.auto).map((e) => e.date));
  let d = todayStr(), s = 0;
  if (!set.has(d)) d = addDays(d, -1);
  while (set.has(d)) { s++; d = addDays(d, -1); }
  return s;
}
function avgWindow(entries, key, days, endOffset = 0) {
  const end = addDays(todayStr(), -endOffset);
  const start = addDays(end, -(days - 1));
  const vals = entries
    .filter((e) => e.date >= start && e.date <= end)
    .map((e) => e.answers[key])
    .filter((v) => typeof v === "number");
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}
function trendFor(entries, key, dir) {
  const a = avgWindow(entries, key, 7, 0);
  const b = avgWindow(entries, key, 7, 7);
  if (a == null) return { a, b, delta: null, status: "nodata" };
  if (b == null) return { a, b, delta: null, status: "nodata" };
  const delta = a - b;
  if (dir === "neutral") return { a, b, delta, status: "neutral" };
  if (Math.abs(delta) < 0.4) return { a, b, delta, status: "stable" };
  const improving = dir === "pos" ? delta > 0 : delta < 0;
  return { a, b, delta, status: improving ? "improving" : "worsening" };
}
function weeklyAverages(entries, key, weeks = 6) {
  const t0 = todayStr();
  const out = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const end = addDays(t0, -(w * 7));
    const start = addDays(end, -6);
    const vals = entries.filter((e) => e.date >= start && e.date <= end)
      .map((e) => e.answers[key]).filter((v) => typeof v === "number");
    out.push({
      d: fmtShort(end), n: vals.length,
      v: vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null,
    });
  }
  return out;
}

/** The same shape by calendar month, for people whose "how has it been going"
    is a longer question than six weeks can answer. Bars carry `n` so the
    tooltip can say how many days are behind each one — a month averaged from
    three days and one averaged from thirty should not read alike. */
function monthlyBars(entries, key, months = 6) {
  const t0 = todayStr();
  const [y0, m0] = t0.split("-").map(Number);
  const out = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(y0, m0 - 1 - i, 1);
    const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const vals = entries.filter((e) => e.date.slice(0, 7) === stamp)
      .map((e) => e.answers[key]).filter((v) => typeof v === "number");
    out.push({
      d: d.toLocaleDateString(undefined, { month: "short" }), n: vals.length,
      v: vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null,
    });
  }
  return out;
}

/* Cautious pattern insights: median-split factor, compare symptom averages. */
function computeInsights(tpl, entries) {
  const t0 = todayStr();
  return computeInsightsWindow(tpl, entries, addDays(t0, -29), t0);
}
function computeInsightsWindow(tpl, entries, start, end) {
  const recent = entries.filter((e) => e.date >= start && e.date <= end);
  const cards = [];
  for (const [fk, sk] of tpl.pairs) {
    const ff = getField(tpl, fk), sf = getField(tpl, sk);
    if (!ff || !sf) continue;
    const pts = recent
      .map((e) => [e.answers[fk], e.answers[sk]])
      .filter(([a, b]) => typeof a === "number" && typeof b === "number");
    if (pts.length < 6) continue;
    const sorted = [...pts].sort((a, b) => a[0] - b[0]);
    const half = Math.floor(sorted.length / 2);
    const low = sorted.slice(0, half), high = sorted.slice(sorted.length - half);
    if (low.length < 3 || high.length < 3) continue;
    if (low[low.length - 1][0] === high[0][0]) continue; // no real split
    const mean = (arr) => arr.reduce((s, p) => s + p[1], 0) / arr.length;
    const lo = mean(low), hi = mean(high);
    const diff = hi - lo;
    if (Math.abs(diff) < 0.8) continue;
    cards.push({
      id: fk + "_" + sk,
      title: `${sf.label} may move with ${ff.label.toLowerCase()}`,
      detail: `On days when ${ff.label.toLowerCase()} was higher, ${sf.label.toLowerCase()} averaged ${fmt1(hi)} — vs ${fmt1(lo)} on lower days (${pts.length} logged days in this window).`,
      strength: Math.abs(diff),
    });
  }
  return cards.sort((a, b) => b.strength - a.strength).slice(0, 4);
}

/* ============================================================
   UI primitives
   ============================================================ */

function Icon({ name, size = 20, color = "currentColor" }) {
  const p = { fill: "none", stroke: color, strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };
  const paths = {
    home: <path {...p} d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
    log: <path {...p} d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17zM13.5 6.5l3 3" />,
    trends: <path {...p} d="M4 19V5M4 19h16M7 15l4-5 3 3 5-7" />,
    calendar: <path {...p} d="M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM4 9.5h16M8 3v4M16 3v4" />,
    download: <path {...p} d="M12 4v11m0 0 4-4m-4 4-4-4M5 20h14" />,
    gear: <path {...p} d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm7.5-3a7.5 7.5 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7.6 7.6 0 0 0-2-1.2L14.7 3h-4l-.4 2.6a7.6 7.6 0 0 0-2 1.2l-2.3-.9-2 3.4 2 1.5a7.5 7.5 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-.9a7.6 7.6 0 0 0 2 1.2l.4 2.6h4l.4-2.6a7.6 7.6 0 0 0 2-1.2l2.3.9 2-3.4-2-1.5c.06-.4.1-.8.1-1.2z" />,
    left: <path {...p} d="M14 6l-6 6 6 6" />,
    right: <path {...p} d="M10 6l6 6-6 6" />,
    up: <path {...p} d="M6 15l6-6 6 6" />,
    down: <path {...p} d="M6 9l6 6 6-6" />,
    /* Six dots — the universal "this can be moved" mark, and the one icon in
       this set that describes a gesture rather than a thing. */
    grip: <g>{[8, 12, 16].flatMap((y) => [9, 15].map((x) => (
      <circle key={`${x}-${y}`} cx={x} cy={y} r="1.35" fill={color} stroke="none" />
    )))}</g>,
    sliders: <g><path {...p} d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="2.2" fill={color} stroke="none" /><circle cx="15" cy="17" r="2.2" fill={color} stroke="none" /></g>,
    check: <path {...p} d="M5 12.5l4.5 4.5L19 7" />,
    plus: <path {...p} d="M12 5v14M5 12h14" />,
    x: <path {...p} d="M6 6l12 12M18 6L6 18" />,
    print: <g><path {...p} d="M7 9V4h10v5M7 18H5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2" /><path {...p} d="M7 15h10v5H7z" /></g>,
    /* A four-point star rather than the usual AI "sparkles" cluster — one mark
       reads as a label, three read as decoration. */
    spark: <path {...p} d="M12 3.5l2.1 5.2a2 2 0 0 0 1.2 1.2l5.2 2.1-5.2 2.1a2 2 0 0 0-1.2 1.2L12 20.5l-2.1-5.2a2 2 0 0 0-1.2-1.2L3.5 12l5.2-2.1a2 2 0 0 0 1.2-1.2z" />,
    info: <g><circle {...p} cx="12" cy="12" r="8.5" /><path {...p} d="M12 11v5M12 7.8v.4" /></g>,
    refresh: <path {...p} d="M20 12a8 8 0 1 1-2.6-5.9M20 4v4h-4" />,
    trash: <path {...p} d="M5 7h14M10 7V5h4v2M8.5 7l.6 12h5.8l.6-12M11 10.5v5M13 10.5v5" />,
    eye: <g><path {...p} d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12z" /><circle {...p} cx="12" cy="12" r="2.8" /></g>,
    sun: <g><circle {...p} cx="12" cy="12" r="4" /><path {...p} d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4L17 7M7 17l-1.6 1.6" /></g>,
    moon: <path {...p} d="M20 13.4A8.2 8.2 0 0 1 10.6 4a8.4 8.4 0 1 0 9.4 9.4z" />,
    device: <g><path {...p} d="M3.5 5.5h17a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-17a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z" /><path {...p} d="M8 19h8" /></g>,
    key: <g><circle {...p} cx="8" cy="12" r="3.5" /><path {...p} d="M11.5 12H21M18 12v3M15 12v2.2" /></g>,
    warn: <g><path {...p} d="M12 4.5 21 19.5H3z" /><path {...p} d="M12 10v4M12 16.6v.4" /></g>,
    /* "Opens somewhere else" — the arrow leaving the box is the convention
       people already read without being told. */
    link: <g><path {...p} d="M14 4h6v6" /><path {...p} d="M20 4l-8.5 8.5" /><path {...p} d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></g>,
    /* Food: a fork and knife, the one food glyph nobody has to decode. */
    food: <g><path {...p} d="M7 3v8m0 0v10M5 3v4a2 2 0 0 0 4 0V3" /><path {...p} d="M17 21v-8a4 4 0 0 1 0-8v0c1.5 0 2 1.5 2 4s-.5 4-2 4" /></g>,
    /* Bowel: the app's own mark rather than the obvious one — a rounded form
       with a motion arc. Sits in a health journal without being a joke. */
    bowel: <g><path {...p} d="M8.5 20h7a3 3 0 0 0 .6-5.9 3.4 3.4 0 0 0-2.6-4.4A3.2 3.2 0 0 0 8 8.6a3 3 0 0 0-.8 5.6A3 3 0 0 0 8.5 20z" /><path {...p} d="M12 3v2.6" /></g>,
    /* The routine set. A capsule, a supplement bottle, a drop for anything
       spread on skin, and a squeezed tube for the rest — four silhouettes that
       are told apart at 13px in a list, which is the only size that matters. */
    pill: <g><path {...p} d="M8.2 4.6a4.5 4.5 0 0 1 6.4 6.4l-3.6 3.6a4.5 4.5 0 0 1-6.4-6.4z" /><path {...p} d="M6.6 6.2 12.4 12" /></g>,
    bottle: <g><path {...p} d="M9.5 3h5v3l1.6 1.8a3 3 0 0 1 .9 2.1V19a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9.9a3 3 0 0 1 .9-2.1L8.5 6V3z" /><path {...p} d="M7 12h10" /></g>,
    drop: <g><path {...p} d="M12 3.5s5.5 6 5.5 9.6a5.5 5.5 0 0 1-11 0C6.5 9.5 12 3.5 12 3.5z" /><path {...p} d="M9.6 14.4a2.6 2.6 0 0 0 2.6 2.4" /></g>,
    tube: <g><path {...p} d="M10 3h4v2.5h-4z" /><path {...p} d="M8.6 5.5h6.8L17 19a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2z" /><path {...p} d="M9.4 10h5.2" /></g>,
    sunrise: <g><path {...p} d="M12 4v3M5.6 9.6 7 11M18.4 9.6 17 11M3 17h18M6.5 17a5.5 5.5 0 0 1 11 0" /><path {...p} d="M9.5 6.5 12 4l2.5 2.5" /></g>,
    snack: <g><circle {...p} cx="12" cy="12" r="8.5" /><path {...p} d="M9 10.5v.4M15 10.5v.4M8.8 15a4.2 4.2 0 0 0 6.4 0" /></g>,
    drink: <g><path {...p} d="M6 4h12l-1.4 15.2a2 2 0 0 1-2 1.8H9.4a2 2 0 0 1-2-1.8z" /><path {...p} d="M6.6 10h10.8" /></g>,
    camera: <g><path {...p} d="M4 8h3l1.4-2h7.2L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" /><circle {...p} cx="12" cy="13.5" r="3.4" /></g>,
    clock: <g><circle {...p} cx="12" cy="12" r="8.5" /><path {...p} d="M12 7.2V12l3.2 2" /></g>,
    note: <path {...p} d="M6 3h8l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM14 3v5h5M8.5 13h7M8.5 16.5h4.5" />,
    edit: <path {...p} d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17zM13.5 6.5l3 3" />,
    minus: <path {...p} d="M5 12h14" />,
    star: <path {...p} d="M12 4.2l2.35 4.76 5.25.77-3.8 3.7.9 5.23L12 16.2l-4.7 2.46.9-5.23-3.8-3.7 5.25-.77z" />,
    starFilled: <path d="M12 4.2l2.35 4.76 5.25.77-3.8 3.7.9 5.23L12 16.2l-4.7 2.46.9-5.23-3.8-3.7 5.25-.77z" fill={color} stroke={color} strokeWidth="1.6" strokeLinejoin="round" />,
    bell: <g><path {...p} d="M6 9a6 6 0 0 1 12 0c0 3.5.8 5.2 1.6 6.2.4.5 0 1.3-.7 1.3H5.1c-.7 0-1.1-.8-.7-1.3C5.2 14.2 6 12.5 6 9z" /><path {...p} d="M10 20a2 2 0 0 0 4 0" /></g>,
    target: <g><circle {...p} cx="12" cy="12" r="8.5" /><circle {...p} cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1.6" fill={color} stroke="none" /></g>,
    search: <g><circle {...p} cx="11" cy="11" r="6.5" /><path {...p} d="M16 16l4.5 4.5" /></g>,
    /* A heart with its own trace running through it. POTS is measured in the
       jump between two heart rates, so the app needed a mark for one. */
    heart: <g><path {...p} d="M12 20.5S3.5 15.2 3.5 9.4A4.4 4.4 0 0 1 12 7.4a4.4 4.4 0 0 1 8.5 2c0 5.8-8.5 11.1-8.5 11.1z" /><path {...p} d="M6.5 12h2.2l1.4-2.6L12 14l1.3-2h3.4" /></g>,
    /* The delete key, drawn as the key it is — an arrow-ended tag with an x in
       it. A bare chevron here reads as "go back a screen", which on a keypad
       is exactly the wrong promise. */
    backspace: <g><path {...p} d="M9 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6-7z" /><path {...p} d="M12.5 9.5l4 5M16.5 9.5l-4 5" /></g>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

/* ---------- shared primitives ----------
   These carry the design system. Screens compose them rather than restating
   padding, radius, and hover behaviour inline — which is how the app drifted
   into eleven slightly different button shapes in the first place. */

function Card({ children, className = "", style = {}, tappable = false, ...rest }) {
  return (
    <div className={"fhj-card p-4 " + (tappable ? "fhj-card-tap " : "") + className}
      style={style} {...rest}>
      {children}
    </div>
  );
}

/** A section heading: display face, weighted, with a small tinted bar to its
    left. `cat` picks the bar's hue from the category classes in index.css, so
    a food section and a symptom section are told apart before either is read. */
function SectionTitle({ children, action, cat = "fhj-cat-symptom" }) {
  return (
    <div className={`fhj-section mt-7 ${cat}`}>
      <h2 className="fhj-section-title">{children}</h2>
      {action}
    </div>
  );
}

/** One button, five intents. `variant` picks the intent; everything else —
    height, radius, press feel, focus ring, disabled treatment — is shared. */
function Button({
  variant = "primary", size = "md", block = false, icon, iconRight,
  className = "", children, ...rest
}) {
  const cls = [
    "fhj-btn", `fhj-btn-${variant}`,
    size === "sm" ? "fhj-btn-sm" : "",
    block ? "fhj-btn-block" : "",
    className,
  ].filter(Boolean).join(" ");
  const iconColor =
    variant === "primary" ? C.onAccent :
    variant === "danger" ? C.dangerInk :
    variant === "outline" ? C.accentText : C.sub;
  return (
    <button type="button" className={cls} {...rest}>
      {icon && <Icon name={icon} size={size === "sm" ? 15 : 17} color={iconColor} />}
      {children}
      {iconRight && <Icon name={iconRight} size={size === "sm" ? 15 : 17} color={iconColor} />}
    </button>
  );
}

/** Radio-group semantics, pill presentation. Used for theme, log mode, report
    period — anywhere exactly one of a short list is active. */
function Segmented({ options, value, onChange, label }) {
  return (
    <div className="fhj-segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button key={o.value} type="button" role="radio" aria-checked={active}
            onClick={() => onChange(o.value)}
            className={"fhj-segment" + (active ? " is-active" : "")}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Label + optional description on the left, switch on the right. The whole
    row is the target, which matters a lot on a phone. */
function SwitchRow({ on, onChange, label, desc, disabled = false }) {
  return (
    <button type="button" role="switch" aria-checked={!!on} disabled={disabled}
      onClick={() => onChange(!on)}
      className="fhj-switch-row"
      style={disabled ? { opacity: 0.5, cursor: "not-allowed" } : undefined}>
      <span className="min-w-0">
        <span className="text-sm font-medium block">{label}</span>
        {desc && <span className="text-[11.5px] leading-relaxed block mt-0.5" style={{ color: C.subtle }}>{desc}</span>}
      </span>
      <span className={"fhj-switch" + (on ? " is-on" : "")} aria-hidden="true" />
    </button>
  );
}

function Badge({ tone = "neutral", children, ...rest }) {
  return <span className={`fhj-badge fhj-badge-${tone}`} {...rest}>{children}</span>;
}

/** A short, genuinely ordered scale as one row of equal targets.

    `options` is [{ value, label, desc }]. The row is the control; the name of
    whatever is selected prints underneath it, which is what lets seven Bristol
    descriptions occupy one line instead of seven rows. Tapping the active step
    clears it, the same as every other selection in this app. */
function StepScale({ options, value, onChange, label, tint, lowLabel, highLabel }) {
  const mark = tint || C.accent;
  const current = options.find((o) => o.value === value);
  return (
    <div>
      <div className="fhj-steps" role="group" aria-label={label}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <button key={o.value} type="button" aria-pressed={on}
              aria-label={`${label}: ${o.label}`}
              onClick={() => { feedback("select"); onChange(on ? undefined : o.value); }}
              className={"fhj-step" + (on ? " is-active" : "")}
              style={on ? { background: mark, borderColor: mark, color: readableInk(mark) } : undefined}>
              {o.short ?? o.value}
            </button>
          );
        })}
      </div>
      {(lowLabel || highLabel) && (
        <div className="flex justify-between mt-1.5 text-[10.5px]" style={{ color: C.subtle }}>
          <span>{lowLabel}</span>
          <span>{highLabel}</span>
        </div>
      )}
      {/* Reserved height, so picking a step doesn't shunt everything below it
          down by a line the first time. */}
      <div className="text-[12.5px] leading-snug mt-1.5" style={{ minHeight: "2.25rem" }}>
        {current ? (
          <>
            <span className="font-semibold" style={{ color: C.ink }}>{current.label}</span>
            {current.desc && <span style={{ color: C.subtle }}> — {current.desc}</span>}
          </>
        ) : (
          <span style={{ color: C.muted }}>Not recorded</span>
        )}
      </div>
    </div>
  );
}

/** Progressive disclosure. Closed, the row says what is inside it — the
    `summary` is the answers themselves, not the word "details" — so folding a
    section away never hides information, only the controls for changing it. */
function Disclosure({ label, summary, children, defaultOpen = false, className = "" }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = React.useId();
  return (
    <div className={className}>
      <button type="button" className="fhj-disclose" aria-expanded={open} aria-controls={id}
        onClick={() => { feedback("tap"); setOpen((o) => !o); }}>
        <span className="flex-1 min-w-0">
          <span className="block text-[13px] font-semibold" style={{ color: C.ink }}>{label}</span>
          {summary && (
            <span className="block text-[11.5px] truncate mt-0.5" style={{ color: C.subtle }}>{summary}</span>
          )}
        </span>
        <span className="fhj-disclose-chev" aria-hidden="true">
          <Icon name="down" size={15} color="currentColor" />
        </span>
      </button>
      {open && <div id={id} className="fhj-disclose-panel">{children}</div>}
    </div>
  );
}

/** Drag-to-dismiss for a bottom sheet.

    Downward drags move the panel and, past a threshold — or on a quick flick
    regardless of distance — close it. Upward drags are clamped to zero rather
    than ignored, so the sheet stays put under a thumb pulling the wrong way
    instead of jumping when the direction changes.

    The offset is written to a custom property rather than React state: a
    dismiss gesture would otherwise re-render the whole sheet on every
    pointermove, which on a form the size of the food sheet is the difference
    between a gesture that tracks the thumb and one that stutters behind it. */
function useSheetDrag(panelRef, onClose) {
  const drag = useRef(null);

  const set = (px) => {
    const el = panelRef.current;
    if (el) el.style.setProperty("--fhj-sheet-drag", `${px}px`);
  };

  const onPointerDown = (e) => {
    if (!onClose || e.button > 0) return;
    /* The heading area is a drag surface too — reaching for the little grabber
       specifically is a precision ask, and the whole top of a sheet is what a
       thumb actually lands on. Controls inside it are not: a pointerdown on
       Close is a press, not the start of a gesture. */
    if (e.target instanceof Element && e.target.closest("button, a, input, select, textarea")) return;
    drag.current = { id: e.pointerId, startY: e.clientY, y: e.clientY, t: Date.now() };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const el = panelRef.current;
    if (el) el.style.transition = "none";
  };

  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    d.y = e.clientY;
    set(Math.max(0, e.clientY - d.startY));
  };

  const finish = (e) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    const el = panelRef.current;
    const dist = Math.max(0, d.y - d.startY);
    const velocity = dist / Math.max(1, Date.now() - d.t); // px/ms
    if (el) el.style.transition = "";
    if (dist > 110 || velocity > 0.5) {
      feedback("tap");
      onClose?.();
      return;
    }
    /* Springs back rather than snapping: a gesture that didn't quite make it
       should read as "not far enough", not as a glitch. */
    if (el) {
      el.style.transition = "transform 240ms cubic-bezier(0.22,1,0.36,1)";
      set(0);
      setTimeout(() => { if (el) el.style.transition = ""; }, 260);
    }
  };

  return { onPointerDown, onPointerMove, onPointerUp: finish, onPointerCancel: finish };
}

/** Bottom sheet on a phone, centred dialog on a laptop. Closes on Escape, on a
    backdrop click, and on a downward drag of the grabber.

    `footer` is the reason this component is shaped the way it is. Anything
    passed there is pinned to the bottom edge of the sheet and never scrolls,
    so Save sits under the thumb from the moment the sheet opens — on the long
    forms (food, bowel) that used to mean scrolling past a dozen fields to find
    the button that ends the task. */
/* `labelledBy` is generated per instance rather than fixed. Two modals can be
   on screen at once — a confirmation sheet over the form it is asking about —
   and a shared id meant the inner dialog announced the outer one's heading. */
function Modal({ title, children, onClose, labelledBy, footer, eyebrow }) {
  const autoId = React.useId();
  const titleId = labelledBy || `fhj-modal-title-${autoId}`;
  const panelRef = useRef(null);
  const dragHandlers = useSheetDrag(panelRef, onClose);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && onClose) onClose(); };
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  /* While this is open the page underneath does not move. Without it, a wheel
     or a flick anywhere over the sheet scrolls the dashboard behind it —
     Lenis owns the document scroller and has no idea the dialog is there.
     Mounted once per dialog, and reference-counted, so a sheet stacked on a
     sheet unlocks only when the last one closes. */
  useEffect(() => lockPageScroll(), []);
  return (
    <div className="fhj-scrim" onClick={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}>
      {/* data-lenis-prevent is Lenis's opt-out for a nested scroller: wheel
          events that land in here scroll *this*, natively, and never reach the
          smooth-scroll driver. */}
      <div ref={panelRef} className="fhj-sheet" role="dialog" aria-modal="true" data-lenis-prevent
        aria-labelledby={title ? titleId : undefined} tabIndex={-1} style={{ outline: "none" }}>
        {/* Presentational for a screen reader — Escape and the Close button are
            the accessible ways out; this one is for the thumb. */}
        <div className="fhj-sheet-grab" aria-hidden="true" {...dragHandlers} />
        {title ? (
          <div className="fhj-sheet-head" {...dragHandlers}>
            <div className="min-w-0">
              {eyebrow && <div className="fhj-eyebrow mb-0.5">{eyebrow}</div>}
              <h2 id={titleId} className="font-display text-xl leading-snug">{title}</h2>
            </div>
            {onClose && (
              <button type="button" onClick={onClose} aria-label="Close"
                className="fhj-icon-btn shrink-0" style={{ width: "2.5rem", height: "2.5rem" }}>
                <Icon name="x" size={16} color={C.sub} />
              </button>
            )}
          </div>
        ) : <div />}
        <div className="fhj-sheet-body">{children}</div>
        {footer ? <div className="fhj-sheet-actions">{footer}</div> : null}
      </div>
    </div>
  );
}

/* What a dashed outline means, said once per screen — not once per question.

   This is the entire replacement for the "tap to confirm — same as usual"
   banner that used to sit above every scale. The app still remembers where you
   were; it marks the spot and stops talking about it. Printing the explanation
   under all forty fields would have been the same mistake in a smaller font:
   a legend is a thing you read once and then stop seeing, which is exactly
   what this should be. */
function RecentLegend({ className = "" }) {
  return (
    <span className={"fhj-legend " + className}>
      <span className="fhj-legend-swatch" aria-hidden="true" />
      your recent answer
    </span>
  );
}

/* Signature control: the 1–10 tap scale.

   The rungs carry their numerals. They used to be ten blank tiles, which works
   on a phone where the thumb is already on the one it wants and the big number
   to the right reads back what it landed on — and does not work at all with a
   mouse on a laptop, where the pointer is somewhere else entirely and the row
   is a bar chart with no axis. Ten numerals cost nothing and answer "which one
   am I about to click" without moving the eye.

   `ghost` is the recent value for this question. It is drawn as a dashed rung
   and nothing else: no banner, no confirm step, no sentence asking whether
   today was the same as usual. It marks where the user has been. Tapping it is
   how it gets accepted, exactly like tapping any other number. */
/* `hideLabel` is for the sheets that already have the question as their
   title — the label stays in the group's accessible name, it just isn't
   printed twice. */
function ScaleInput({ field, value, onChange, ghost = null, hideLabel = false }) {
  const lowLbl = field.dir === "pos" ? "1 · low" : "1 · none";
  const highLbl = field.dir === "pos" ? "10 · great" : "10 · severe";
  const set = (n) => {
    if (value === n) { feedback("erase"); onChange(null); return; }
    place("scale", n, 10);
    onChange(n);
  };
  return (
    <div className="py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
      <div className={`flex items-baseline gap-3 mb-2 ${hideLabel ? "justify-end" : "justify-between"}`}>
        {!hideLabel && <span className="text-sm font-medium">{field.label}</span>}
        <span className="font-display text-2xl leading-none shrink-0"
          style={{ color: value != null ? colorFor(value, field.dir) : C.muted }}>
          {value != null ? value : "–"}
        </span>
      </div>
      <div className="fhj-scale" role="group" aria-label={field.label}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
          const filled = value != null && n <= value;
          const isGhost = value == null && ghost === n;
          return (
            <button key={n} type="button"
              aria-label={`${field.label} ${n}`}
              aria-pressed={value === n}
              onClick={() => set(n)}
              className={"fhj-scale-rung" + (filled ? " is-filled" : "") + (value === n ? " is-picked" : "") + (isGhost ? " is-recent" : "")}
              style={filled ? { "--fhj-rung": colorFor(value, field.dir) } : undefined}
            >
              {n}
            </button>
          );
        })}
      </div>
      <div className="flex justify-between mt-1 text-[10px]" style={{ color: C.sub }}>
        <span>{lowLbl}</span>
        <span className="opacity-70">{value != null ? "tap again to clear" : ""}</span>
        <span>{highLbl}</span>
      </div>
    </div>
  );
}

function ToggleInput({ field, value, onChange, tint, hideLabel = false }) {
  const opt = (label, val) => {
    const active = value === val;
    return (
      <button type="button"
        onClick={() => onChange(active ? null : val)}
        className="px-4 py-1.5 rounded-full text-sm font-medium transition-colors"
        style={{
          background: active ? (val ? tint : C.subtle) : C.faint,
          color: active ? readableInk(val ? tint : C.subtle) : C.sub,
        }}>
        {label}
      </button>
    );
  };
  return (
    <div className={"py-3 flex items-center " + (hideLabel ? "justify-end" : "justify-between")}
      style={{ borderBottom: `1px solid ${C.line}` }}>
      {!hideLabel && <span className="text-sm font-medium">{field.label}</span>}
      <div className="flex gap-1.5">{opt("No", false)}{opt("Yes", true)}</div>
    </div>
  );
}

function ChipsInput({ field, value, onChange, tint, hideLabel = false }) {
  const sel = Array.isArray(value) ? value : [];
  const toggle = (opt) => {
    if (field.single) { onChange(sel.includes(opt) ? [] : [opt]); return; }
    onChange(sel.includes(opt) ? sel.filter((o) => o !== opt) : [...sel, opt]);
  };
  return (
    <div className="py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
      {!hideLabel && <div className="text-sm font-medium mb-2">{field.label}</div>}
      <div className="flex flex-wrap gap-1.5">
        {field.options.map((opt) => {
          const active = sel.includes(opt);
          return (
            <button key={opt} type="button" onClick={() => toggle(opt)}
              className="px-3 py-1.5 rounded-full text-sm transition-colors"
              style={{
                background: active ? tint : C.faint,
                color: active ? readableInk(tint) : C.ink,
              }}>
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- number entry ----------

   A weight is 196.1, and 196.1 used to cost eleven presses of a `+` button
   whose step is 0.1 — or a hunt for the fact that the number between the two
   buttons happened to be a text input. Nothing said so: it had no border, no
   caret until focused, and on a phone tapping it summoned the OS keyboard over
   the field it was meant to edit.

   So the number *is* the control now. It is a button, it looks like one, and
   it opens this: the value at reading size, one pad, and nothing else. The
   plus and minus keep their place for a nudge of one step, because "a pound
   heavier than yesterday" is a different gesture from "196.1".

   `digits` is derived from the field's own step, so a weight takes one decimal
   and a step count takes none — the pad never offers a decimal point the field
   can't hold. */

function decimalsFor(field) {
  const s = field?.step || 1;
  if (s >= 1) return 0;
  // 0.1 -> 1, 0.01 -> 2. Rounded because 0.1 is not 0.1 in binary.
  return Math.min(3, Math.max(0, Math.round(-Math.log10(s))));
}

/** The pad itself. Draft is a string, so a half-typed "19" and "19." are both
    representable — a number can't tell you the user is mid-decimal. */
function NumberPadSheet({ field, value, ghost, onCommit, onClose }) {
  const decimals = decimalsFor(field);
  const unit = field.unit || "";
  const min = field.min ?? -Infinity;
  const max = field.max ?? Infinity;
  const [draft, setDraft] = useState(value != null ? String(value) : "");
  /* Opening on an existing value and typing a digit should *replace* it, the
     way selecting the contents of a field would. Backspace is what turns that
     off — at that point the user is editing, not starting over. */
  const [fresh, setFresh] = useState(value != null);

  const parsed = draft === "" || draft === "." || draft === "-" ? null : parseFloat(draft);
  const outOfRange = parsed != null && (parsed < min || parsed > max);
  const canSave = draft === "" || (parsed != null && !isNaN(parsed) && !outOfRange);

  const digit = (d) => {
    setDraft((prev) => {
      const base = fresh ? "" : prev;
      if (d === ".") {
        if (!decimals || base.includes(".")) return base;
        return (base || "0") + ".";
      }
      // Don't grow past the precision the field actually stores.
      const dot = base.indexOf(".");
      if (dot >= 0 && base.length - dot - 1 >= decimals) return base;
      if (base === "0") return d;
      if (base.length >= 9) return base;
      return base + d;
    });
    setFresh(false);
    // Digits climb the ladder, so typing a number reads as a little run.
    place("key", d === "." ? 10 : Number(d) + 1, 11);
  };

  const back = () => {
    setFresh(false);
    setDraft((prev) => prev.slice(0, -1));
    feedback("erase");
  };

  const bump = (dir) => {
    const step = field.step || 1;
    const cur = parsed ?? ghost ?? field.base ?? field.min ?? 0;
    const next = clamp(Math.round((cur + dir * step) * 1000) / 1000, min, max);
    setFresh(false);
    setDraft(next.toFixed(decimals));
    feedback("select");
  };

  const save = () => {
    if (!canSave) return;
    onCommit(draft === "" ? null : Math.round(parsed * 1000) / 1000);
    feedback("save");
    onClose();
  };

  /* A physical keyboard should drive this too — it is a dialog on a laptop as
     often as a sheet on a phone, and retyping a weight with the mouse would be
     a worse experience than the input this replaced. */
  const onKeyDown = (e) => {
    if (e.key >= "0" && e.key <= "9") { e.preventDefault(); digit(e.key); }
    else if (e.key === "." || e.key === ",") { e.preventDefault(); digit("."); }
    else if (e.key === "Backspace") { e.preventDefault(); back(); }
    else if (e.key === "Enter") { e.preventDefault(); save(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); bump(1); }
    else if (e.key === "ArrowDown") { e.preventDefault(); bump(-1); }
  };

  const shown = draft === "" ? (ghost != null ? String(ghost) : "–") : draft;
  const isPlaceholder = draft === "";

  const key = (label, onPress, opts = {}) => (
    <button type="button" key={label} onClick={onPress} aria-label={opts.aria || label}
      className="fhj-pad-key" data-variant={opts.variant || "digit"}>
      {opts.node || label}
    </button>
  );

  return (
    <Modal title={field.label} eyebrow={field.sec} onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={() => { setDraft(""); setFresh(false); feedback("clear"); }}>
            Clear
          </Button>
          <Button block onClick={save} disabled={!canSave}>Save</Button>
        </>
      }>
      <div onKeyDown={onKeyDown} className="fhj-pad">
        <div className="fhj-pad-readout" aria-live="polite">
          <span className="fhj-pad-value" style={{ color: isPlaceholder ? C.muted : C.ink }}>
            {shown}
            {/* A caret only while there is something being typed — a blinking
                bar under a greyed-out suggestion would claim it was the value. */}
            {!isPlaceholder && <i className="fhj-pad-caret" aria-hidden="true" />}
          </span>
          {unit && <span className="fhj-pad-unit">{unit}</span>}
        </div>

        <div className="fhj-pad-nudge">
          <button type="button" onClick={() => bump(-1)} aria-label={`down ${field.step || 1}`}>−{field.step || 1}</button>
          {ghost != null && draft !== String(ghost) && (
            <button type="button" className="fhj-pad-recall"
              onClick={() => { setFresh(false); setDraft(String(ghost)); feedback("select"); }}>
              Last {ghost}{unit ? " " + unit : ""}
            </button>
          )}
          <button type="button" onClick={() => bump(1)} aria-label={`up ${field.step || 1}`}>+{field.step || 1}</button>
        </div>

        <div className="fhj-pad-keys" role="group" aria-label={`${field.label} keypad`}>
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => key(d, () => digit(d)))}
          {decimals > 0
            ? key(".", () => digit("."), { aria: "decimal point" })
            : <span aria-hidden="true" />}
          {key("0", () => digit("0"))}
          {key("back", back, {
            variant: "action", aria: "delete last digit",
            node: <Icon name="backspace" size={20} color={C.sub} />,
          })}
        </div>

        {outOfRange && (
          <div className="fhj-note mt-3" role="status">
            <Icon name="info" size={14} color={C.sub} />
            <span>
              {field.label} is recorded between {min} and {max}{unit ? " " + unit : ""}.
            </span>
          </div>
        )}
      </div>
    </Modal>
  );
}

/** The number as it sits in a form row: label, nudge buttons, and a value that
    is itself the way to type one. */
function NumberInput({ field, value, onChange, ghost = null, hideLabel = false }) {
  const [pad, setPad] = useState(false);
  const step = field.step || 1;
  const decimals = decimalsFor(field);
  const bump = (dir) => {
    const cur = typeof value === "number" ? value : ghost ?? field.base ?? field.min ?? 0;
    const next = Math.round((cur + dir * step) * 1000) / 1000;
    feedback("select");
    onChange(clamp(next, field.min ?? -Infinity, field.max ?? Infinity));
  };
  const shown = value != null ? Number(value).toFixed(decimals) : ghost != null ? Number(ghost).toFixed(decimals) : "–";
  return (
    <div className={"py-3 flex items-center gap-2 " + (hideLabel ? "justify-end" : "justify-between")}
      style={{ borderBottom: `1px solid ${C.line}` }}>
      {!hideLabel && <span className="text-sm font-medium">{field.label}</span>}
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={() => bump(-1)} aria-label={`decrease ${field.label}`}
          className="w-9 h-9 rounded-full flex items-center justify-center text-lg font-medium shrink-0"
          style={{ background: C.faint, color: C.ink }}>−</button>
        <button type="button" onClick={() => { feedback("sheetOpen"); setPad(true); }}
          aria-label={`edit ${field.label}`}
          className={"fhj-numtap" + (value == null ? " is-empty" : "")}>
          <span className="font-display text-xl">{shown}</span>
          {field.unit && <span className="fhj-numtap-unit">{field.unit}</span>}
        </button>
        <button type="button" onClick={() => bump(1)} aria-label={`increase ${field.label}`}
          className="w-9 h-9 rounded-full flex items-center justify-center text-lg font-medium shrink-0"
          style={{ background: C.faint, color: C.ink }}>+</button>
      </div>
      {pad && (
        <NumberPadSheet field={field} value={value} ghost={ghost}
          onCommit={onChange} onClose={() => { feedback("sheetClose"); setPad(false); }} />
      )}
    </div>
  );
}

function TextField({ field, value, onChange }) {
  return (
    <div className="py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
      <div className="text-sm font-medium mb-2">{field.label}</div>
      <input value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}
        className="w-full rounded-xl px-3 py-2 text-sm outline-none"
        style={{ background: C.faint, border: `1px solid ${C.line}` }} />
    </div>
  );
}

function DateTimeInput({ field, value, onChange }) {
  return (
    <div className="py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${C.line}` }}>
      <span className="text-sm font-medium">{field.label}</span>
      <input type={field.type} value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}
        className="rounded-lg px-2.5 py-1.5 text-sm outline-none"
        style={{ background: C.faint, border: `1px solid ${C.line}` }} />
    </div>
  );
}

/* `hideLabel` is for the one caller that has already asked the question in its
   own type — the Daily Pulse's next-question card. Everywhere else the input
   names itself, because everywhere else it is one row in a list of forty. */
function FieldInput({ field, value, onChange, tint, ghost = null, hideLabel = false }) {
  if (field.type === "scale") return <ScaleInput field={field} value={value} onChange={onChange} ghost={ghost} hideLabel={hideLabel} />;
  if (field.type === "toggle") return <ToggleInput field={field} value={value} onChange={onChange} tint={tint} hideLabel={hideLabel} />;
  if (field.type === "chips") return <ChipsInput field={field} value={value} onChange={onChange} tint={tint} hideLabel={hideLabel} />;
  if (field.type === "number") return <NumberInput field={field} value={value} onChange={onChange} ghost={ghost} hideLabel={hideLabel} />;
  if (field.type === "text") return <TextField field={field} value={value} onChange={onChange} />;
  if (field.type === "time" || field.type === "date") return <DateTimeInput field={field} value={value} onChange={onChange} />;
  return null; // photo handled by PhotoInlineField / PhotoSession
}

/* ============================================================
   Photo tracking — capture, inline field, guided session
   ============================================================ */

/* undefined = still loading, null = definitively missing, string = data URL.
   Both falsy states render the same for existing callers; the distinction only
   drives loading shimmers vs "photo missing" placeholders. */
function usePhoto(id, kind = "full") {
  const [src, setSrc] = useState(undefined);
  useEffect(() => {
    let live = true;
    if (!id) { setSrc(null); return; }
    setSrc(undefined);
    (kind === "thumb" ? loadThumbData(id) : loadPhotoData(id)).then((d) => { if (live) setSrc(d || null); });
    return () => { live = false; };
  }, [id, kind]);
  return src;
}

function photoCaption(f) {
  return [f.bodyPart, f.side, f.angle].filter(Boolean).join(" · ");
}

/* Label of the field a photo's rating is linked to, if any. */
function linkedLabel(f, tpl) {
  if (!f.linkedTo) return null;
  return tpl.fields.find((x) => x.k === f.linkedTo)?.label || f.linkedTo;
}

/* Compact grouping label used for gallery filter chips, e.g. "Left · Hands"
   or "Full body · Front" — distinguishes angle when side isn't set. */
function bodyPartLabel(f) {
  return [f.side, f.bodyPart, f.angle].filter(Boolean).join(" · ") || null;
}

/* A photo field can caption itself with another answer from the same day
   (e.g. progress photos captioned with that day's weight) — display only,
   never a second place the value is stored. */
function captionFieldFor(field, tpl) {
  if (!field.captionFrom) return null;
  return tpl.fields.find((x) => x.k === field.captionFrom) || null;
}
function formatCaptionValue(field, tpl, answers) {
  const cf = captionFieldFor(field, tpl);
  if (!cf) return null;
  const v = answers?.[cf.k];
  if (v == null) return null;
  return `${v}${cf.unit ? " " + cf.unit : ""}`;
}

/* Flattens every (entry, photo field) pair with a saved photo into one list,
   newest first. Rating is read live from the linked answer when linked —
   never a second stored copy. */
function buildPhotoItems(tpl, entries) {
  const photoFields = tpl.fields.filter((f) => f.type === "photo");
  const items = [];
  for (const e of entries) {
    for (const f of photoFields) {
      const p = e.photos?.[f.k];
      if (!p?.photoId) continue;
      items.push({
        photoId: p.photoId, field: f, date: e.date,
        rating: f.linkedTo ? (e.answers?.[f.linkedTo] ?? null) : (p.rating ?? null),
        note: p.note || "",
        captionVal: formatCaptionValue(f, tpl, e.answers),
      });
    }
  }
  return items.sort((a, b) => (a.date < b.date ? 1 : -1));
}
/* One item per field, most recent first — for dashboard preview thumbnails. */
function latestPerField(items) {
  const seen = new Set(), out = [];
  for (const it of items) {
    if (seen.has(it.field.k)) continue;
    seen.add(it.field.k); out.push(it);
  }
  return out;
}

function GalleryThumb({ id }) {
  const src = usePhoto(id, "thumb");
  return (
    <div className={"w-full h-full flex items-center justify-center" + (src === undefined ? " fhj-shimmer" : "")} style={{ background: C.faint }}>
      {src && <img src={src} alt="" className="w-full h-full object-cover" />}
    </div>
  );
}

/* Minimal hand-rolled sparkline — no axes/tooltip, just the shape of the trend. */
function Sparkline({ points, color = C.accent, height = 40 }) {
  if (!points || points.length < 2) return null;
  const w = 280;
  const min = Math.min(...points), max = Math.max(...points), range = max - min || 1;
  const stepX = w / (points.length - 1);
  const xy = (v, i) => [i * stepX, height - ((v - min) / range) * (height - 6) - 3];
  const coords = points.map((v, i) => xy(v, i).join(",")).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} preserveAspectRatio="none">
      <polyline points={coords} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((v, i) => { const [x, y] = xy(v, i); return <circle key={i} cx={x} cy={y} r="2.5" fill={color} />; })}
    </svg>
  );
}

function RatingChips({ max = 10, dir = "sym", value, onChange, tint }) {
  return (
    <div className="flex flex-wrap gap-1.5 justify-center">
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => {
        const active = value === n;
        return (
          <button key={n} onClick={() => onChange(active ? null : n)}
            className="w-9 h-9 rounded-xl text-sm font-semibold transition-all"
            style={(() => {
              const fill = colorFor(Math.round((n / max) * 10) || 1, dir);
              return { background: active ? fill : C.faint, color: active ? readableInk(fill) : C.ink };
            })()}>
            {n}
          </button>
        );
      })}
    </div>
  );
}

/* In-app camera using getUserMedia — the ONLY way to support a countdown
   auto-shutter (the native file/camera picker is a separate OS UI the page
   can't drive). If the camera can't be opened (permission denied, or the
   sandbox/webview doesn't allow it), we bail to onFallback so the caller can
   open the native picker — capture never breaks. */
function CameraModal({ timer, onCapture, onFallback, onClose, tint }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const [phase, setPhase] = useState("init"); // init | live | counting | captured | error
  const [count, setCount] = useState(timer);
  const [shot, setShot] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; try { await videoRef.current.play(); } catch (e) {} }
        setPhase("live");
      } catch (e) {
        setPhase("error");
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(timerRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const grab = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) { setPhase("live"); return; }
    setShot(makeShot(v, v.videoWidth, v.videoHeight));
    setPhase("captured");
  };

  const startCountdown = () => {
    if (!timer) { grab(); return; }
    setPhase("counting");
    let c = timer; setCount(c);
    const tick = () => {
      c -= 1;
      if (c <= 0) { setCount(0); grab(); }
      else { setCount(c); timerRef.current = setTimeout(tick, 1000); }
    };
    timerRef.current = setTimeout(tick, 1000);
  };

  const cancelCountdown = () => { clearTimeout(timerRef.current); setPhase("live"); setCount(timer); };

  if (phase === "error") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: "rgba(0,0,0,0.6)" }}>
        <div className="rounded-2xl p-5 max-w-xs" style={{ background: C.card }}>
          <div className="font-display text-lg mb-1">In-app camera unavailable</div>
          <p className="text-sm mb-4" style={{ color: C.sub }}>
            This device or browser didn't allow the in-app camera, so the countdown timer can't run here. You can still take the photo with your device camera.
          </p>
          <button onClick={onFallback} className="fhj-btn fhj-btn-primary fhj-btn-block">
            Open device camera
          </button>
          <button onClick={onClose} className="w-full mt-2 py-2.5 rounded-xl text-sm font-medium" style={{ background: C.faint }}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "#000" }}>
      <div className="relative flex-1 flex items-center justify-center overflow-hidden">
        {phase === "captured" && shot ? (
          <img src={shot.full} alt="captured" className="max-h-full max-w-full object-contain" />
        ) : (
          <video ref={videoRef} playsInline muted className="max-h-full max-w-full object-contain" />
        )}
        {phase === "counting" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="font-display text-white" style={{ fontSize: 96, textShadow: "0 2px 16px rgba(0,0,0,0.6)" }}>{count}</div>
          </div>
        )}
        {phase === "init" && (
          <div className="absolute inset-0 flex items-center justify-center text-white text-sm">Starting camera…</div>
        )}
        <button onClick={onClose} aria-label="close camera"
          className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "rgba(0,0,0,0.5)" }}>
          <Icon name="x" size={18} color="#fff" />
        </button>
      </div>

      <div className="p-4 pb-8 flex flex-col gap-2" style={{ background: "#000" }}>
        {phase === "captured" ? (
          <div className="flex gap-2">
            <button onClick={() => { setShot(null); setPhase("live"); }}
              className="flex-1 py-3.5 rounded-xl text-sm font-semibold" style={{ background: "#333", color: "#fff" }}>Retake</button>
            <button onClick={() => onCapture(shot)}
              className="fhj-btn fhj-btn-primary flex-[1.4]">Use photo</button>
          </div>
        ) : phase === "counting" ? (
          <button onClick={cancelCountdown} className="w-full py-3.5 rounded-xl text-sm font-semibold" style={{ background: "#333", color: "#fff" }}>
            Cancel timer
          </button>
        ) : (
          <div className="flex gap-2">
            {timer > 0 && (
              <button onClick={startCountdown} disabled={phase !== "live"}
                className="flex-1 py-3.5 rounded-xl text-sm font-semibold disabled:opacity-40" style={{ background: "#333", color: "#fff" }}>
                Start {timer}s timer
              </button>
            )}
            <button onClick={grab} disabled={phase !== "live"}
              className="fhj-btn fhj-btn-primary flex-1">
              Capture now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* Capture entry point. With a timer set AND an in-app camera available, opens
   the countdown camera; otherwise (or on failure) opens the native picker,
   which is always reliable but can't run a countdown. */
function CaptureButton({ onPick, label = "Take photo", tint, timer = 0, variant = "primary", icon }) {
  const inputRef = useRef(null);
  const [showCam, setShowCam] = useState(false);
  const [note, setNote] = useState("");
  const camAvailable = typeof navigator !== "undefined" && navigator.mediaDevices && navigator.mediaDevices.getUserMedia;

  const openNative = () => inputRef.current?.click();
  const onClick = () => {
    setNote("");
    if (timer > 0 && camAvailable) setShowCam(true);
    else openNative();
  };

  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          try { onPick(await processImage(file)); }
          catch (err) { window.alert("Could not read that photo — please try again."); }
        }} />
      <Button variant={variant} block icon={icon} onClick={onClick}>{label}</Button>
      {note && <div className="text-[11px] mt-1 text-center" style={{ color: C.sub }}>{note}</div>}
      {showCam && (
        <CameraModal timer={timer} tint={tint}
          onCapture={(shot) => { setShowCam(false); onPick(shot); }}
          onFallback={() => { setShowCam(false); setNote("Countdown timer needs in-app camera access, which isn't available here — opened your device camera instead."); openNative(); }}
          onClose={() => setShowCam(false)} />
      )}
    </>
  );
}

/* Inline photo field for the Detailed Log (autosaves like other fields). When
   linkedTo is set, the rating lives on the linked scale field (answered as its
   own row elsewhere in this same log) — shown read-only here to avoid asking
   for the same rating twice. */
function PhotoInlineField({ field, meta, date, answers, tpl, entries, baselines, onSetBaseline, timer, onSave, tint }) {
  const src = usePhoto(meta?.photoId);
  const [busy, setBusy] = useState(false);
  const lbl = linkedLabel(field, tpl);
  const captionVal = formatCaptionValue(field, tpl, answers);

  const capture = async ({ full, thumb }) => {
    setBusy(true);
    const oldId = meta?.photoId;
    const id = uid();
    const takenAt = new Date().toISOString();
    const prev = prevPhotoFor(entries, field.k, date);
    try {
      await savePhotos([{ id, full, thumb, fieldKey: field.k, date, takenAt }]);
      if (oldId) await deletePhotos([oldId]);
      onSave({ ...(meta || {}), photoId: id, takenAt, comparedTo: baselines?.[field.k] || prev?.photoId || undefined });
      if (!baselines?.[field.k] && !prev) onSetBaseline(field.k, id); // first-ever photo for this field
    } catch (e) {
      window.alert("Saving the photo failed — storage may be full. Nothing was changed.");
    }
    setBusy(false);
  };
  const remove = async () => {
    if (!meta?.photoId) return;
    if (!window.confirm("Remove this photo?")) return;
    await deletePhotos([meta.photoId]);
    onSave(null);
  };

  return (
    <div className="py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium">{field.label}</span>
        {meta?.photoId && (
          <button onClick={remove} className="text-xs underline" style={{ color: C.sub }}>remove</button>
        )}
      </div>
      {(photoCaption(field) || captionVal) && (
        <div className="text-[11px] mb-2" style={{ color: C.sub }}>
          {[photoCaption(field), captionVal].filter(Boolean).join(" · ")}
        </div>
      )}
      {meta?.photoId && (
        <div className="relative mb-2">
          {src
            ? <img src={src} alt={field.label} className="w-full rounded-xl object-cover" style={{ maxHeight: 220 }} />
            : <div className="w-full rounded-xl flex items-center justify-center" style={{ height: 140, background: C.faint, color: C.sub }}>loading…</div>}
          <div className="absolute top-2 left-2 px-2 py-1 rounded-full flex items-center gap-1 text-[11px] font-semibold" style={{ background: C.good, color: readableInk(C.good) }}>
            <Icon name="check" size={12} color={readableInk(C.good)} /> Photo saved
          </div>
        </div>
      )}
      <CaptureButton tint={tint} timer={timer} label={busy ? "Saving…" : meta?.photoId ? "Retake photo" : "Take photo"} onPick={capture} />
      {meta?.photoId && field.rated !== false && (
        field.linkedTo ? (
          <div className="mt-2.5 text-[11px] text-center" style={{ color: C.sub }}>
            Rating tracked via the "{lbl}" question{answers?.[field.linkedTo] != null ? ` — currently ${answers[field.linkedTo]}` : " (not answered yet)"}.
          </div>
        ) : (
          <div className="mt-3">
            <div className="text-[11px] mb-1.5 text-center" style={{ color: C.sub }}>Your rating (optional)</div>
            <RatingChips max={field.scaleMax || 10} dir={field.dir} value={meta.rating ?? null} tint={tint}
              onChange={(r) => onSave({ ...meta, rating: r, ratingSource: r == null ? undefined : "user" })} />
          </div>
        )
      )}
      {meta?.photoId && (
        <input value={meta.note ?? ""} placeholder="Photo note (optional)"
          onChange={(e) => onSave({ ...meta, note: e.target.value || undefined })}
          className="w-full mt-2 rounded-lg px-2.5 py-2 text-sm outline-none"
          style={{ background: C.faint, border: `1px solid ${C.line}` }} />
      )}
    </div>
  );
}

/* Guided multi-photo session — PERSIST ON CAPTURE. Each photo is written to
   storage the moment it's taken (blob + entry.photos[key] metadata), so it
   survives navigating between steps, finishing, and a full page refresh. The
   UI reflects real saved state: thumbnail, "Photo saved", a running count, and
   Retake/Delete. There is no separate "commit" step — the final screen is just
   a summary, and "exit" never discards anything.

   A small in-memory cache (justCaptured) holds the full-res data URL of photos
   taken this session so we can show them instantly without re-reading storage.

   Linked ratings: a photo field with linkedTo writes its rating straight to the
   linked scale answer (onSetAnswer) — if that question was already answered
   today (e.g. in Quick Log) the step shows it pre-filled and auto-advances. */
function PhotoSession({ tpl, entries, date, photos, answers, timer, onSetAnswer, baselines, onSetBaseline, onSavePhoto, onDone }) {
  const fields = useMemo(
    () => tpl.fields.filter((f) => f.type === "photo" && f.requiredInSession !== false),
    [tpl]
  );
  const [step, setStep] = useState(0); // 0..fields.length-1 capture, fields.length = summary
  const [cache, setCache] = useState({}); // photoId -> full dataUrl (this session only)
  const [busy, setBusy] = useState(false);
  const advanceTimer = useRef(null);

  const f = fields[step];
  const meta = f ? photos?.[f.k] : null;
  const saved = !!meta?.photoId;
  const ghost = useMemo(() => (f && !saved ? prevPhotoFor(entries, f.k, date) : null), [entries, f, date, saved]);
  const ghostThumb = usePhoto(ghost?.photoId, "thumb");
  const savedFromStore = usePhoto(saved ? meta.photoId : null, "full");
  const savedSrc = saved ? (cache[meta.photoId] || savedFromStore) : null;
  const savedCount = useMemo(() => fields.filter((x) => photos?.[x.k]?.photoId).length, [fields, photos]);

  useEffect(() => () => clearTimeout(advanceTimer.current), []);
  useEffect(() => { clearTimeout(advanceTimer.current); }, [step]);

  if (!fields.length) return null;

  const scheduleAdvance = (ms) => { clearTimeout(advanceTimer.current); advanceTimer.current = setTimeout(() => setStep((s) => s + 1), ms); };
  const ratingValueFor = (fld) => (fld?.linkedTo ? (answers?.[fld.linkedTo] ?? null) : (photos?.[fld.k]?.rating ?? null));

  const capture = async (fld, { full, thumb }) => {
    setBusy(true);
    const oldId = photos?.[fld.k]?.photoId;
    const id = uid();
    const takenAt = new Date().toISOString();
    const prev = prevPhotoFor(entries, fld.k, date);
    try {
      await savePhotos([{ id, full, thumb, fieldKey: fld.k, date, takenAt }]); // durable immediately
      if (oldId) await deletePhotos([oldId]);
      setCache((c) => { const n = { ...c, [id]: full }; if (oldId) delete n[oldId]; return n; });
      onSavePhoto(fld.k, {
        ...(photos?.[fld.k] || {}),
        photoId: id, takenAt,
        comparedTo: baselines?.[fld.k] || prev?.photoId || undefined,
      });
      if (!baselines?.[fld.k] && !prev) onSetBaseline(fld.k, id); // first-ever photo becomes baseline
      const alreadyRated = fld.linkedTo ? answers?.[fld.linkedTo] != null : false;
      if (fld.rated === false || alreadyRated) scheduleAdvance(650); // nothing left to ask
    } catch (e) {
      window.alert("Saving the photo failed — storage may be full. Nothing was changed.");
    }
    setBusy(false);
  };

  const removePhoto = async (fld) => {
    const id = photos?.[fld.k]?.photoId;
    if (!id) return;
    if (!window.confirm("Delete this photo?")) return;
    clearTimeout(advanceTimer.current);
    await deletePhotos([id]);
    setCache((c) => { const n = { ...c }; delete n[id]; return n; });
    onSavePhoto(fld.k, null);
    if (baselines?.[fld.k] === id) onSetBaseline(fld.k, null);
  };

  const handleRate = (fld, value) => {
    if (fld?.linkedTo) onSetAnswer(fld.linkedTo, value);
    else onSavePhoto(fld.k, { ...(photos?.[fld.k] || {}), rating: value ?? undefined, ratingSource: value == null ? undefined : "user" });
    if (value != null) scheduleAdvance(320); else clearTimeout(advanceTimer.current);
  };

  /* ---- summary screen (everything already saved) ---- */
  if (step >= fields.length) {
    const savedKeys = fields.filter((x) => photos?.[x.k]?.photoId).map((x) => x.k);
    return (
      <div className="mt-2">
        <div className="flex items-center gap-2 mb-1">
          <Icon name="check" size={16} color={C.good} />
          <span className="text-sm font-semibold">{savedKeys.length} photo{savedKeys.length === 1 ? "" : "s"} saved</span>
        </div>
        <div className="text-xs mb-3" style={{ color: C.sub }}>
          All photos are saved to this device. You can retake or delete any of them here.
        </div>
        {savedKeys.length === 0 && (
          <Card><div className="text-sm" style={{ color: C.sub }}>No photos taken this session.</div></Card>
        )}
        {savedKeys.map((k) => {
          const fld = fields.find((x) => x.k === k);
          return <SummaryRow key={k} fld={fld} tpl={tpl} meta={photos[k]} answers={answers}
            cacheSrc={cache[photos[k].photoId]} rating={ratingValueFor(fld)}
            onRate={(r) => handleRate(fld, r)} onDelete={() => removePhoto(fld)} onGo={() => setStep(fields.indexOf(fld))} />;
        })}
        <div className="flex gap-2 mt-1">
          <button onClick={() => setStep(0)} className="flex-1 py-3 rounded-xl text-sm font-semibold" style={{ background: C.faint }}>Back to start</button>
          <button onClick={onDone} className="fhj-btn fhj-btn-primary flex-[1.4]">Done</button>
        </div>
        <p className="text-[11px] mt-3 leading-relaxed" style={{ color: C.sub }}>
          Photos stay on this device unless you hand one to the optional AI yourself.
          Ratings are personal tracking, not a medical assessment.
        </p>
      </div>
    );
  }

  /* ---- capture step ---- */
  const lbl = linkedLabel(f, tpl);
  const alreadyRated = f.linkedTo ? answers?.[f.linkedTo] != null : false;

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-1.5 text-xs font-medium" style={{ color: C.sub }}>
        <span>Photo {step + 1} of {fields.length} · {savedCount} saved</span>
        <button onClick={onDone} className="underline">done</button>
      </div>
      <div className="h-1.5 rounded-full mb-4 overflow-hidden" style={{ background: C.faint }}>
        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${(step / fields.length) * 100}%`, background: tpl.color }} />
      </div>

      <Card className="py-5 px-4 mb-3">
        <div className="font-display text-lg mb-1 leading-snug text-center">{f.label}</div>
        {photoCaption(f) && <div className="text-xs mb-1 text-center" style={{ color: C.sub }}>{photoCaption(f)}</div>}
        {captionFieldFor(f, tpl) && (
          <div className="text-xs mb-3 text-center" style={{ color: C.sub }}>
            {formatCaptionValue(f, tpl, answers) || `Log "${captionFieldFor(f, tpl).label}" today to caption this photo`}
          </div>
        )}

        {!saved && ghostThumb && (
          <div className="mb-3">
            <img src={ghostThumb} alt="previous" className="w-full rounded-xl object-cover opacity-70" style={{ maxHeight: 200 }} />
            <div className="text-[11px] mt-1 text-center" style={{ color: C.sub }}>
              Last photo · {fmtNice(ghost.date)} — same spot, same light if you can
            </div>
          </div>
        )}

        {saved ? (
          <>
            <div className="relative mb-3">
              {savedSrc
                ? <img src={savedSrc} alt="saved" className="w-full rounded-xl object-cover" style={{ maxHeight: 260 }} />
                : <div className="w-full rounded-xl flex items-center justify-center" style={{ height: 180, background: C.faint, color: C.sub }}>loading…</div>}
              <div className="absolute top-2 left-2 px-2 py-1 rounded-full flex items-center gap-1 text-[11px] font-semibold" style={{ background: C.good, color: readableInk(C.good) }}>
                <Icon name="check" size={12} color={readableInk(C.good)} /> Photo saved
              </div>
            </div>
            {f.rated !== false && (
              <div className="mb-3">
                <div className="text-[11px] mb-1.5 text-center" style={{ color: C.sub }}>
                  {lbl
                    ? (alreadyRated ? `Using today's "${lbl}" rating — tap to change` : `Rate "${lbl}" — saves to your survey too`)
                    : "Tap a rating — moves to the next photo automatically"}
                </div>
                <RatingChips max={f.scaleMax || 10} dir={f.dir} tint={tpl.color}
                  value={ratingValueFor(f)} onChange={(r) => handleRate(f, r)} />
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => removePhoto(f)}
                className="flex-1 py-3 rounded-xl text-sm font-semibold" style={{ background: C.dangerBg, color: C.dangerInk }}>Delete</button>
              <CaptureButtonInline label="Retake" tint={C.faint} textColor={C.ink} timer={timer} busy={busy}
                onPick={(shot) => capture(f, shot)} />
              <button onClick={() => { clearTimeout(advanceTimer.current); setStep(step + 1); }}
                className="fhj-btn fhj-btn-primary flex-[1.4]">
                {step === fields.length - 1 ? "Finish" : "Next photo"}
              </button>
            </div>
          </>
        ) : (
          <CaptureButton tint={tpl.color} timer={timer} label={busy ? "Saving…" : "Take photo"}
            onPick={(shot) => capture(f, shot)} />
        )}
      </Card>

      {!saved && (
        <div className="flex gap-2">
          <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}
            className="flex-1 py-3 rounded-xl text-sm font-semibold disabled:opacity-30" style={{ background: C.faint }}>Back</button>
          <button onClick={() => setStep(step + 1)} className="flex-1 py-3 rounded-xl text-sm font-semibold" style={{ background: C.faint }}>
            Skip this photo
          </button>
        </div>
      )}
    </div>
  );
}

/* Compact capture button variant that sits inline in a button row (used for
   "Retake"). Same timer-aware behavior as CaptureButton. */
function CaptureButtonInline({ onPick, label, tint, textColor, timer = 0, busy }) {
  const inputRef = useRef(null);
  const [showCam, setShowCam] = useState(false);
  const camAvailable = typeof navigator !== "undefined" && navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
  const openNative = () => inputRef.current?.click();
  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0]; e.target.value = "";
          if (!file) return;
          try { onPick(await processImage(file)); } catch (err) { window.alert("Could not read that photo — please try again."); }
        }} />
      <button onClick={() => (timer > 0 && camAvailable ? setShowCam(true) : openNative())} disabled={busy}
        className="flex-1 py-3 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ background: tint, color: textColor }}>
        {busy ? "…" : label}
      </button>
      {showCam && (
        <CameraModal timer={timer} tint={C.accent}
          onCapture={(shot) => { setShowCam(false); onPick(shot); }}
          onFallback={() => { setShowCam(false); openNative(); }}
          onClose={() => setShowCam(false)} />
      )}
    </>
  );
}

/* One row in the session summary — saved photo, reassign, rating, delete. */
function SummaryRow({ fld, tpl, meta, answers, cacheSrc, rating, onRate, onDelete, onGo }) {
  const fromStore = usePhoto(meta?.photoId, "thumb");
  const src = cacheSrc || fromStore;
  const lbl = linkedLabel(fld, tpl);
  return (
    <Card className="mb-2">
      <div className="flex gap-3">
        <button onClick={onGo} className="w-20 h-20 rounded-xl object-cover shrink-0 overflow-hidden" style={{ background: C.faint }}>
          {src && <img src={src} alt="" className="w-full h-full object-cover" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{fld.label}</div>
          {photoCaption(fld) && <div className="text-[11px]" style={{ color: C.sub }}>{photoCaption(fld)}</div>}
          {captionFieldFor(fld, tpl) && formatCaptionValue(fld, tpl, answers) && (
            <div className="text-[11px]" style={{ color: C.sub }}>{formatCaptionValue(fld, tpl, answers)}</div>
          )}
          <div className="flex items-center gap-1 mt-1 text-[11px]" style={{ color: C.good }}>
            <Icon name="check" size={12} color={C.good} /> saved
          </div>
        </div>
        <button onClick={onDelete} aria-label="delete photo" className="shrink-0 self-start">
          <Icon name="x" size={16} color={C.sub} />
        </button>
      </div>
      {fld?.rated !== false && (
        <div className="mt-2.5">
          <RatingChips max={fld?.scaleMax || 10} dir={fld?.dir} tint={tpl.color} value={rating} onChange={onRate} />
          {lbl && <div className="text-[10px] mt-1 text-center" style={{ color: C.sub }}>Synced with "{lbl}" — saves instantly</div>}
        </div>
      )}
    </Card>
  );
}

/* ============================================================
   Guided Quick Log — one question per card, big taps, auto-advance
   ============================================================ */

const QUICK_BATCH_SIZE = 4;

/* What the app remembers about each question: a 7-day median for scales,
   yesterday's answer for toggles, the last value for numbers. Both logging
   surfaces read this — the guided run and the long form — so "where you were
   last time" means the same thing whichever way you open the day.

   None of it is ever written. It is drawn, dashed, and waits to be tapped. */
function recentAnswers(fields, entries, date) {
  const g = {};
  for (const f of fields) {
    if (f.type === "scale") g[f.k] = medianDefaultFor(entries, f.k, date);
    else if (f.type === "toggle") g[f.k] = yesterdayToggleFor(entries, f.k, date);
    else if (f.type === "number") g[f.k] = lastValueFor(entries, f.k, date);
  }
  return g;
}

function QuickField({ f, v, set, tint, ghost, deps = [], depValues = {}, skipped, onSkip }) {
  const [pad, setPad] = useState(false);
  const tap = (k, val, kind = "tap") => { feedback(kind); set(k, val); };
  const bigBtn = (active, color) => ({
    background: active ? color : C.faint, color: active ? readableInk(color) : C.ink,
    boxShadow: active ? `0 0 0 3px ${color}33` : "none",
  });
  const followUpOpen = f.type === "toggle" && v === true && deps.length > 0;
  return (
    <Card className="py-5 px-4 mb-3">
      <div className="font-display text-lg mb-1 leading-snug text-center">{f.label}</div>
      {f.sec && <div className="text-xs mb-4 text-center" style={{ color: C.sub }}>{f.sec}</div>}

      {f.type === "scale" && (
        <>
          {/* No confirm banner. The recent value is *marked*, not asked about:
              a dashed ring on the number the user last gave, which is picked by
              tapping it like any other. The banner it replaces put a sentence
              ("same as usual?") in front of someone every single question of
              every single day, and a question they have to answer to dismiss is
              not a shortcut — it is one more question. */}
          <div className="grid grid-cols-5 gap-2 mb-2">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button key={n} aria-pressed={v === n}
                onClick={() => {
                  if (v === n) { feedback("erase"); set(f.k, null); return; }
                  place("scale", n, 10);
                  set(f.k, n);
                }}
                className={"aspect-square rounded-2xl font-display text-lg flex items-center justify-center transition-all" + (v == null && ghost === n ? " fhj-recent" : "")}
                style={bigBtn(v === n, colorFor(n, f.dir))}>{n}</button>
            ))}
          </div>
          <div className="flex justify-between text-[11px]" style={{ color: C.sub }}>
            <span>{f.dir === "pos" ? "1 · low" : "1 · none"}</span>
            <span>{f.dir === "pos" ? "10 · great" : "10 · severe"}</span>
          </div>
        </>
      )}

      {f.type === "toggle" && (
        <div className="flex gap-3">
          {[["No", false], ["Yes", true]].map(([lbl, val]) => (
            <button key={lbl} aria-pressed={v === val}
              onClick={() => tap(f.k, v === val ? null : val, v === val ? "erase" : "select")}
              className={"flex-1 py-5 rounded-2xl text-base font-semibold transition-all relative" + (v == null && ghost === val ? " fhj-recent" : "")}
              style={bigBtn(v === val, val ? tint : C.subtle)}>
              {lbl}
            </button>
          ))}
        </div>
      )}

      {f.type === "chips" && (
        <div className="flex flex-wrap justify-center gap-2">
          {f.options.map((opt) => {
            const sel = Array.isArray(v) ? v : [];
            const active = sel.includes(opt);
            return (
              <button key={opt} onClick={() => {
                feedback("tap");
                if (f.single) { set(f.k, active ? null : [opt]); return; }
                const next = active ? sel.filter((o) => o !== opt) : [...sel, opt];
                set(f.k, next.length ? next : null);
              }}
                className="px-4 py-2.5 rounded-full text-sm font-medium transition-colors"
                style={{ background: active ? tint : C.faint, color: active ? readableInk(tint) : C.ink }}>{opt}</button>
            );
          })}
        </div>
      )}

      {f.type === "number" && (
        <>
          {/* Same rule as the scale: the recent value is shown, greyed, in the
              slot it would occupy — not offered in a sentence above it. The
              minus and plus start from it, and tapping the number opens the pad
              already holding it. */}
          <div className="flex items-center justify-center gap-3">
            <button aria-label={`decrease ${f.label}`}
              onClick={() => tap(f.k, clamp(Math.round(((v ?? ghost ?? f.base ?? f.min ?? 0) - (f.step || 1)) * 1000) / 1000, f.min ?? -Infinity, f.max ?? Infinity), "select")}
              className="w-11 h-11 rounded-full text-xl font-medium shrink-0" style={{ background: C.faint }}>−</button>
            <button type="button" aria-label={`edit ${f.label}`}
              onClick={() => { feedback("sheetOpen"); setPad(true); }}
              className={"fhj-numtap is-lg" + (v == null ? " is-empty" : "")}>
              <span className="font-display text-2xl">
                {v ?? (ghost != null ? Number(ghost).toFixed(decimalsFor(f)) : "–")}
              </span>
              {f.unit && <span className="fhj-numtap-unit">{f.unit}</span>}
            </button>
            <button aria-label={`increase ${f.label}`}
              onClick={() => tap(f.k, clamp(Math.round(((v ?? ghost ?? f.base ?? f.min ?? 0) + (f.step || 1)) * 1000) / 1000, f.min ?? -Infinity, f.max ?? Infinity), "select")}
              className="w-11 h-11 rounded-full text-xl font-medium shrink-0" style={{ background: C.faint }}>+</button>
          </div>
          {pad && (
            <NumberPadSheet field={f} value={v} ghost={ghost}
              onCommit={(n) => set(f.k, n)}
              onClose={() => { feedback("sheetClose"); setPad(false); }} />
          )}
        </>
      )}

      {/* follow-up detail(s), revealed smoothly when the toggle is Yes */}
      {deps.length > 0 && (
        <div aria-hidden={!followUpOpen} style={{
          maxHeight: followUpOpen ? deps.length * 90 : 0, opacity: followUpOpen ? 1 : 0,
          overflow: "hidden", transition: "max-height 260ms ease, opacity 220ms ease",
        }}>
          {deps.map((d) => (
            <div key={d.k} className="mt-3">
              <div className="text-xs font-medium mb-1" style={{ color: C.sub }}>{d.label}</div>
              <input type="text" value={depValues[d.k] ?? ""}
                onChange={(e) => set(d.k, e.target.value || null)}
                placeholder="Optional — a few words is plenty"
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                style={{ background: C.faint, border: `1px solid ${C.line}` }} />
            </div>
          ))}
        </div>
      )}

      {/* honest out: skip this one question without guessing */}
      {onSkip && (
        v == null && !skipped ? (
          <button onClick={() => { feedback("tap"); onSkip(f.k); }}
            className="w-full mt-2 py-3 text-[12.5px] font-medium" style={{ color: C.sub }}>
            Skip this question
          </button>
        ) : skipped && v == null ? (
          <div className="w-full mt-3 py-1.5 text-xs text-center" style={{ color: C.sub }}>
            Skipped — tap any answer to change your mind
          </div>
        ) : null
      )}

      {(f.type === "text" || f.type === "time" || f.type === "date") && (
        <input type={f.type === "text" ? "text" : f.type} value={v ?? ""}
          onChange={(e) => set(f.k, e.target.value || null)}
          className="w-full text-center rounded-xl px-3 py-3 text-base outline-none"
          style={{ background: C.faint, border: `1px solid ${C.line}` }} />
      )}
    </Card>
  );
}

/* What "logged" means, in one place.

   Three surfaces need the same answer — the completion screen, the day-exists
   rule in `upsertEntry`, and anything that asks whether today has been
   written. A null answer is not a value: it is the survey's record that the
   question was asked and declined, which is worth keeping and is not worth
   celebrating. */
function patchHasContent(patch) {
  if (!patch) return false;
  if (Object.values(patch.answers || {}).some((v) => v != null)) return true;
  if (typeof patch.notes === "string" && patch.notes.trim()) return true;
  return Object.values(patch.photos || {}).some((p) => p?.photoId);
}

function entryValueCount(entry) {
  if (!entry) return 0;
  let n = Object.values(entry.answers || {}).filter((v) => v != null).length;
  if ((entry.notes || "").trim()) n += 1;
  n += Object.values(entry.photos || {}).filter((p) => p?.photoId).length;
  return n;
}

/* The other half of the celebration: what to show when there is nothing to
   celebrate.

   Skipping every question used to end in confetti and a streak count, which
   is the app congratulating somebody for a blank day — and worse, teaching
   them that the number on the front is not to be trusted. This says what
   happened, and offers the one tap that would make it untrue. There is no
   Undo here on purpose: nothing was written, so there is nothing to undo. */
function NothingLogged({ tpl, keyField, onSet, onBack }) {
  return (
    <div className="mt-2">
      <Card className="text-center py-7">
        <div className="fhj-eyebrow">Today</div>
        <div className="font-display text-2xl leading-tight mt-1.5">Nothing logged yet</div>
        <p className="text-sm leading-relaxed mt-2" style={{ color: C.sub }}>
          Every question was skipped, so there is nothing to save and nothing on the record for
          today. That is a perfectly good answer — but the day stays blank.
        </p>
      </Card>
      {keyField && keyField.type === "scale" && (
        <Card className="mt-2">
          <div className="fhj-eyebrow mb-1">One tap is enough</div>
          <div className="text-sm font-semibold mb-2.5">{keyField.label}</div>
          <PulseScale field={keyField} value={null} onSet={(n, el) => onSet(keyField.k, n, el)} />
        </Card>
      )}
      <button onClick={onBack} className="fhj-btn fhj-btn-secondary fhj-btn-block mt-3">
        Back to the questions
      </button>
    </div>
  );
}

function GuidedQuickLog({ profile, tpl, entries, date, onPatch, onDone, doneLabel = "Finish Quick Log" }) {
  const fields = useMemo(() => tpl.fields.filter((f) => f.quick !== false && f.type !== "photo" && !f.dependsOn), [tpl]);
  const chunks = useMemo(() => {
    const out = [];
    for (let i = 0; i < fields.length; i += QUICK_BATCH_SIZE) out.push(fields.slice(i, i + QUICK_BATCH_SIZE));
    return out;
  }, [fields]);
  const entry = entryOn(entries, date);
  const answers = entry?.answers || {};
  const [page, setPage] = useState(0); // 0..chunks.length-1 = batches, chunks.length = review
  const [notes, setNotes] = useState(entry?.notes || "");
  const [notesOpen, setNotesOpen] = useState(!!(entry?.notes));
  const [celebrating, setCelebrating] = useState(false);
  const [skippedKeys, setSkippedKeys] = useState(() => new Set()); // session-local "prefer not to answer"

  const ghosts = useMemo(() => recentAnswers(fields, entries, date), [fields, entries, date]);
  const noteChips = useMemo(() => recentNotes(entries), [entries]);

  if (fields.length === 0) {
    return (
      <Card className="mt-2">
        <div className="text-sm" style={{ color: C.sub }}>
          No quick questions are enabled for this setup yet. Add some in Edit Setup, or use Detailed Log.
        </div>
      </Card>
    );
  }

  const totalPages = chunks.length;
  const set = (k, v) => {
    if (v != null && skippedKeys.has(k)) {
      setSkippedKeys((prev) => { const n = new Set(prev); n.delete(k); return n; });
    }
    onPatch(profile.id, date, { answers: { [k]: v } }, "quick");
  };
  const skipField = (k) => setSkippedKeys((prev) => new Set(prev).add(k));
  const goNext = () => setPage((p) => Math.min(p + 1, totalPages));
  const goBack = () => { feedback("tap"); setPage((p) => Math.max(p - 1, 0)); };
  /* Skip means "don't ask me these", not "erase what is there". It used to
     write a null over every field in the batch, which quietly deleted an
     answer given on Today, or on an earlier visit to this same day — the one
     kind of data loss a journal must never do casually. Unanswered fields are
     marked skipped in session state; answered ones are left exactly as they
     are. */
  const skipBatch = () => {
    feedback("tap");
    for (const f of chunks[page]) if (answers[f.k] == null) skipField(f.k);
    goNext();
  };

  const cardRefs = useRef({});
  const actionsRef = useRef(null);
  const mountedAnswers = useRef(false);
  const chunk = page < totalPages ? chunks[page] : [];
  const isDone = (f) => answers[f.k] != null || skippedKeys.has(f.k);
  const batchDone = chunk.length > 0 && chunk.every(isDone);
  const remainingCount = chunks.slice(page).flat().filter((f) => !isDone(f)).length;
  const secondsLeft = Math.max(5, Math.round((remainingCount * 4) / 5) * 5);
  const chunkAnswerKey = chunk.map((f) => `${f.k}:${answers[f.k] == null ? (skippedKeys.has(f.k) ? "~" : "") : serialize(answers[f.k])}`).join("|");

  useEffect(() => {
    if (!mountedAnswers.current) { mountedAnswers.current = true; return; }
    const nextUnanswered = chunk.find((f) => !isDone(f));
    const target = nextUnanswered ? cardRefs.current[nextUnanswered.k] : actionsRef.current;
    if (target) target.scrollIntoView({ behavior: "smooth", block: "center" });
    // single-question batches advance on their own after a beat
    if (!nextUnanswered && chunk.length === 1 && page < totalPages - 1) {
      const t = setTimeout(() => { feedback("batch"); goNext(); }, 400);
      return () => clearTimeout(t);
    }
  }, [chunkAnswerKey]); // eslint-disable-line

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [page]);

  if (page >= totalPages) {
    if (celebrating) {
      /* Derived from the journal, on every render. Recording something from
         the "nothing logged" screen therefore turns it into the celebration
         the moment the value lands — which is the only moment it is true. */
      if (entryValueCount(entryOn(entries, date)) === 0) {
        return (
          <NothingLogged tpl={tpl} keyField={getField(tpl, tpl.keyMetric)}
            onSet={(k, v, el) => {
              feedback("quickadd", { el });
              place("scale", v, 10);
              set(k, v);
            }}
            onBack={() => { feedback("nav"); setCelebrating(false); setPage(0); }} />
        );
      }
      return <FinishCelebration streak={calcStreak(entries)} tint={tpl.color} onDone={onDone} />;
    }
    return (
      <div className="mt-2">
        <div className="text-sm font-semibold mb-2">Review before saving</div>
        <Card className="!p-0" style={{ padding: 0 }}>
          {fields.map((f, i) => {
            const v = answers[f.k];
            const detail = v === true
              ? depsFor(tpl, f.k).map((d) => answers[d.k]).filter(Boolean).join("; ")
              : "";
            return (
              <button key={f.k} onClick={() => setPage(Math.floor(i / QUICK_BATCH_SIZE))}
                className="w-full flex items-center justify-between px-4 py-3 text-left gap-3"
                style={{ borderTop: i > 0 ? `1px solid ${C.line}` : "none" }}>
                <span className="text-sm font-medium shrink-0">{f.label}</span>
                <span className="text-sm text-right" style={{ color: v != null ? C.ink : C.sub }}>
                  {v == null ? "Skipped" : serialize(v)}{detail ? <span style={{ color: C.sub }}> — {detail}</span> : ""}
                </span>
              </button>
            );
          })}
        </Card>
        {!notesOpen ? (
          <button onClick={() => { feedback("tap"); setNotesOpen(true); }}
            className="mt-2 px-4 py-2 rounded-full text-sm font-medium" style={{ background: C.faint }}>
            + Add a note
          </button>
        ) : (
          <Card className="mt-2">
            <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: C.sub }}>Notes (optional)</div>
            <textarea rows={2} value={notes}
              onChange={(e) => { setNotes(e.target.value); onPatch(profile.id, date, { notes: e.target.value }, "quick"); }}
              placeholder="Anything worth remembering about today…"
              className="w-full rounded-xl px-3 py-2 text-sm outline-none resize-none"
              style={{ background: C.faint, border: `1px solid ${C.line}` }} />
            {noteChips.length > 0 && !notes && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {noteChips.map((n) => (
                  <button key={n} onClick={() => { feedback("tap"); setNotes(n); onPatch(profile.id, date, { notes: n }, "quick"); }}
                    className="px-3 py-1.5 rounded-full text-xs" style={{ background: C.faint, color: C.sub }}>
                    “{n.length > 34 ? n.slice(0, 34) + "…" : n}”
                  </button>
                ))}
              </div>
            )}
          </Card>
        )}
        {/* The sound is part of the claim: a day with nothing in it does not
            get the save chime either. */}
        <button onClick={() => {
          const wrote = entryValueCount(entryOn(entries, date)) > 0;
          const s = calcStreak(entries);
          feedback(!wrote ? "tap" : s > 0 && s % 7 === 0 ? "milestone" : "save");
          setCelebrating(true);
        }} className="fhj-btn fhj-btn-primary fhj-btn-block mt-3">
          {doneLabel}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-1.5 text-xs font-medium" style={{ color: C.sub }}>
        <span>Step {page + 1} of {totalPages}</span>
        <span>{remainingCount === 0 ? "almost done" : `~${secondsLeft}s left`}</span>
      </div>
      <div className="flex gap-1 mb-2.5">
        {chunks.map((_, i) => (
          <div key={i} className="h-1.5 rounded-full flex-1 transition-all duration-300"
            style={{ background: i < page ? tpl.color : i === page ? `${tpl.color}66` : C.faint }} />
        ))}
      </div>
      {/* One legend for the run, above the questions, rather than a caption
          under each of the four cards on screen. */}
      {chunk.some((f) => ghosts[f.k] != null && answers[f.k] == null) && (
        <div className="mb-3 flex justify-center"><RecentLegend /></div>
      )}

      {chunk.map((f) => (
        <div key={f.k} ref={(el) => { cardRefs.current[f.k] = el; }}>
          <QuickField f={f} v={answers[f.k]} set={set} tint={tpl.color} ghost={ghosts[f.k]}
            deps={depsFor(tpl, f.k)} depValues={answers}
            skipped={skippedKeys.has(f.k)} onSkip={skipField} />
        </div>
      ))}

      <div ref={actionsRef} className="flex gap-2 mt-1">
        <button onClick={goBack} disabled={page === 0}
          className="flex-1 py-3 rounded-xl text-sm font-semibold disabled:opacity-30" style={{ background: C.faint }}>Back</button>
        <button onClick={skipBatch} className="flex-1 py-3 rounded-xl text-sm font-semibold" style={{ background: C.faint }}>Skip</button>
        <button onClick={() => { feedback(batchDone ? "batch" : "tap"); goNext(); }}
          className={"fhj-btn fhj-btn-primary flex-[1.4]" + (batchDone ? " fhj-pulse" : "")}>
          {page === totalPages - 1 ? "Review" : "Continue"}
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   Log screen (Quick / Detailed, any past date, autosaves)
   ============================================================ */

function LogScreen({ profile, entries, date, setDate, mode, setMode, onPatch, onFinishQuick, onSetBaseline, startPhotos = false }) {
  const tpl = getProfileTemplate(profile);
  const entry = entryOn(entries, date);
  const answers = entry?.answers || {};
  const fields = tpl.fields.filter((f) => f.detailed !== false && !f.dependsOn);
  const isToday = date === todayStr();
  const done = mode === "quick" ? entry?.quickLogCompleted : entry?.detailedLogCompleted;
  /* Quick Add's Photo tile says "Progress shot" and now means it: it opens the
     camera session directly rather than dropping the user at the top of the
     survey to find it. */
  const [photoPhase, setPhotoPhase] = useState(startPhotos);

  const sessionFields = tpl.fields.filter((f) => f.type === "photo" && f.requiredInSession !== false);
  const quickHasPhotos = sessionFields.some((f) => f.quick !== false);

  /* Grouped in the order the fields already come in, so a survey the user
     arranged themselves keeps its arrangement — this only draws the boundaries
     that `sec` was always describing. */
  const logSections = useMemo(() => {
    const out = [];
    for (const f of fields) {
      const sec = f.sec || "Other";
      let g = out.find((x) => x.sec === sec);
      if (!g) { g = { sec, fields: [] }; out.push(g); }
      g.fields.push(f);
    }
    return out;
  }, [fields]);
  const [folded, setFolded] = useState(() => new Set());

  /* The long form gets the same memory the guided one has: the recent answer
     for each question, marked but never filled in. */
  const ghosts = useMemo(() => recentAnswers(fields, entries, date), [fields, entries, date]);
  /* The legend earns its line only once there is something for it to explain —
     on day one there is no history, so no dashes, so nothing to say. */
  const hasRecent = useMemo(
    () => fields.some((f) => ghosts[f.k] != null && answers[f.k] == null),
    [fields, ghosts, answers]
  );

  const set = (k, v) => onPatch(profile.id, date, { answers: { [k]: v } }, mode);
  const setPhoto = (k, meta) => onPatch(profile.id, date, { photos: { [k]: meta } }, mode);

  return (
    <div className="px-4 pb-8">
      {/* The date pager lives in the app header now — it was a second title row
          under one that already said "Daily Log", and between the two of them
          plus the mode switch and the photo shortcut, the first question of a
          Quick Log started a third of the way down the screen.

          What is left here is the mode switch, at chip height rather than
          button height: it is a preference that most people set once. */}
      <div className="fhj-log-modes relative flex p-1 rounded-full mt-3 mb-2.5" style={{ background: C.faint }}>
        <span aria-hidden="true" className="absolute rounded-full"
          style={{
            top: 4, bottom: 4, width: "calc(50% - 6px)",
            left: 4, transform: mode === "quick" ? "translateX(0)" : "translateX(calc(100% + 4px))",
            background: C.card, border: `1px solid ${C.line}`,
            transition: "transform 300ms cubic-bezier(0.34, 1.4, 0.64, 1)",
            boxShadow: C.shadow,
          }} />
        {["quick", "detailed"].map((m) => (
          <button key={m} onClick={() => { feedback("tap"); setMode(m); }}
            className="relative flex-1 rounded-full text-[13.5px] font-semibold capitalize"
            style={{ minHeight: 40, color: mode === m ? C.ink : C.sub, background: "transparent" }}>
            {m} log
          </button>
        ))}
      </div>

      {photoPhase ? (
        <PhotoSession tpl={tpl} entries={entries} date={date} photos={entry?.photos} answers={answers}
          timer={profile.cameraTimer ?? 3} onSetAnswer={set}
          baselines={profile.photoBaselines} onSetBaseline={onSetBaseline}
          onSavePhoto={(k, meta) => setPhoto(k, meta)}
          onDone={() => { setPhotoPhase(false); if (mode === "quick") onFinishQuick(); }} />
      ) : mode === "quick" ? (
        <GuidedQuickLog key={profile.id + date} profile={profile} tpl={tpl} entries={entries} date={date}
          onPatch={onPatch}
          doneLabel={quickHasPhotos ? "Continue to photos" : "Finish Quick Log"}
          onDone={() => (quickHasPhotos ? setPhotoPhase(true) : onFinishQuick())} />
      ) : (
        <>
          {/* Quick Log reaches the camera at the end of its own run; the long
              form has no such moment, so it keeps a way in. */}
          {sessionFields.length > 0 && (
            <button onClick={() => { feedback("tap"); setPhotoPhase(true); }}
              className="w-full mb-2.5 py-2.5 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-1.5"
              style={{ border: `1.5px dashed ${C.lineStrong}`, color: C.sub }}>
              <Icon name="camera" size={15} color={C.sub} />
              Photo session ({sessionFields.length})
            </button>
          )}
          <div className="flex items-center justify-between flex-wrap gap-x-3 gap-y-1 text-xs mb-2" style={{ color: C.sub }}>
            <span className="flex items-center gap-3">
              {done ? "Logged for this day" : "Answer what applies — everything is optional"}
              {hasRecent && <RecentLegend />}
            </span>
            <span className="flex items-center gap-1" style={{ color: C.good }}>
              <Icon name="check" size={13} color={C.good} /> saves automatically
            </span>
          </div>

          {/* One card per section, in a grid that grows a column at a time.
              This used to be a single card holding every question in the
              survey — forty-odd rows, one continuous rule down the page, and
              the only structure a heading that scrolled away three questions
              in. On a phone that is merely long. On a laptop it was a 448px
              ribbon of it down the middle of a 1440px screen, so "where does
              Skin end and Diet begin" had no answer on screen at any moment.

              Sections are cards now: each one carries its own heading, its own
              answered count, and its own fold. The grid is one column at phone
              width and untouched there; from 900px it lays the cards out two
              or three across, which is the width the screen was always
              offering and the form was never taking. */}
          <div className="fhj-log-grid">
            {logSections.map((s) => {
              const open = !folded.has(s.sec);
              const filled = s.fields.filter((f) => (
                f.type === "photo" ? !!entry?.photos?.[f.k]?.photoId : answers[f.k] != null
              )).length;
              return (
                <Card key={s.sec} className="fhj-log-card !p-0">
                  <button type="button" className="fhj-log-head" aria-expanded={open}
                    onClick={() => {
                      feedback("expand");
                      setFolded((prev) => {
                        const next = new Set(prev);
                        next.has(s.sec) ? next.delete(s.sec) : next.add(s.sec);
                        return next;
                      });
                    }}>
                    <h2 className="fhj-section-title">{s.sec}</h2>
                    <span className="fhj-log-count">
                      {filled}/{s.fields.length}
                      <span className="fhj-log-chev" aria-hidden="true">
                        <Icon name="down" size={15} color={C.sub} />
                      </span>
                    </span>
                  </button>
                  <div className={"fhj-expand" + (open ? " is-open" : "")}>
                    <div>
                      <div className="fhj-log-body fhj-expand-body">
                        {s.fields.map((f) => (
                          f.type === "photo" ? (
                            <PhotoInlineField key={f.k} field={f} meta={entry?.photos?.[f.k]} date={date}
                              answers={answers} tpl={tpl}
                              entries={entries} baselines={profile.photoBaselines} onSetBaseline={onSetBaseline}
                              timer={profile.cameraTimer ?? 3}
                              onSave={(meta) => setPhoto(f.k, meta)} tint={tpl.color} />
                          ) : (
                            <React.Fragment key={f.k}>
                              <FieldInput field={f} value={answers[f.k]} ghost={ghosts[f.k]}
                                onChange={(v) => set(f.k, v)} tint={tpl.color} />
                              {(() => {
                                const deps = depsFor(tpl, f.k);
                                if (!deps.length) return null;
                                const depOpen = answers[f.k] === true;
                                return (
                                  <div aria-hidden={!depOpen} style={{
                                    maxHeight: depOpen ? deps.length * 84 : 0, opacity: depOpen ? 1 : 0,
                                    overflow: "hidden", transition: "max-height 260ms ease, opacity 220ms ease",
                                  }}>
                                    {deps.map((d) => (
                                      <div key={d.k} className="pb-3 pl-3" style={{ borderLeft: `2px solid ${C.line}` }}>
                                        <div className="text-xs font-medium mb-1" style={{ color: C.sub }}>{d.label}</div>
                                        <input type="text" value={answers[d.k] ?? ""}
                                          onChange={(e) => set(d.k, e.target.value || null)}
                                          placeholder="Optional — a few words is plenty"
                                          className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                                          style={{ background: C.faint, border: `1px solid ${C.line}` }} />
                                      </div>
                                    ))}
                                  </div>
                                );
                              })()}
                            </React.Fragment>
                          )
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}

            <Card className="fhj-log-card !p-0">
              <div className="fhj-log-head">
                <h2 className="fhj-section-title">Notes</h2>
              </div>
              <div className="fhj-log-body pb-4">
                <textarea rows={3} value={entry?.notes ?? ""} placeholder="Anything worth remembering about this day…"
                  onChange={(e) => onPatch(profile.id, date, { notes: e.target.value }, mode)}
                  className="w-full rounded-xl px-3 py-2 text-sm outline-none resize-none"
                  style={{ background: C.faint, border: `1px solid ${C.line}` }} />
              </div>
            </Card>
          </div>
        </>
      )}

      <p className="text-[11px] mt-3 leading-relaxed" style={{ color: C.sub }}>
        Ratings describe how the day felt — they are personal tracking, not a medical assessment.
      </p>
    </div>
  );
}

/* ============================================================
   Trends / Progress screen
   ============================================================ */

function TrendArrow({ trend, dir }) {
  if (trend.status === "nodata") return <span className="text-xs" style={{ color: C.sub }}>–</span>;
  const up = trend.delta > 0.05, down = trend.delta < -0.05;
  const arrow = up ? "▲" : down ? "▼" : "→";
  const color =
    trend.status === "improving" ? C.good :
    trend.status === "worsening" ? C.bad : C.sub;
  const word =
    trend.status === "improving" ? "improving" :
    trend.status === "worsening" ? "worsening" :
    trend.status === "stable" ? "steady" : "change";
  return (
    <span className="text-[11.5px] font-medium inline-flex items-center gap-1 whitespace-nowrap" style={{ color }}>
      <span aria-hidden="true">{arrow}</span>
      {trend.delta == null ? null : <span className="tabular-nums">{Math.abs(Math.round(trend.delta * 10) / 10)}</span>}
      {word}
    </span>
  );
}

/* Four series colours that stay distinguishable in both themes and don't
   collide with the severity ramp's meaning when they sit side by side. */
const CHART_PALETTE = (tint) => [tint || C.accent, C.chart2, C.chart3, C.chart4];

/* Recharts renders its tooltip on a hard-coded white panel, which reads as a
   hole punched in a dark screen. These are applied to every chart in the app
   so hovering feels like part of the same surface in either theme. */
const tooltipProps = () => ({
  cursor: { stroke: C.lineStrong, strokeWidth: 1 },
  contentStyle: {
    background: C.card,
    border: `1px solid ${C.lineStrong}`,
    borderRadius: 12,
    boxShadow: C.shadowLg,
    fontSize: 12,
    padding: "8px 10px",
  },
  labelStyle: { color: C.ink, fontWeight: 600, marginBottom: 2 },
  itemStyle: { color: C.sub, padding: 0 },
});
const axisTick = () => ({ fontSize: 10, fill: C.subtle });

/* Charts draw themselves in once, then hold still. The duration is long enough
   to read as a line being drawn and short enough that nobody waits for it —
   and it is zero when the user has asked for reduced motion, which recharts
   respects by simply rendering the final frame. */
const chartAnim = () => (prefersReducedMotion() ? { isAnimationActive: false } : {
  isAnimationActive: true, animationDuration: 620, animationEasing: "ease-out",
});

/* A soft vertical wash under the primary line. Quiet depth rather than a
   filled area chart: 22% at the line, nothing by the axis. */
function ChartFade({ id, color }) {
  return (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={color} stopOpacity={0.22} />
        <stop offset="100%" stopColor={color} stopOpacity={0} />
      </linearGradient>
    </defs>
  );
}

/* The empty state a chart falls back to. Shares the shape of the chart it
   replaces so the card doesn't resize when data arrives. */
function ChartEmpty({ title, height = 210 }) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-6 rounded-xl fhj-cat-symptom"
      style={{ height, background: C.faint, border: `1.5px dashed ${C.line}` }}>
      <Icon name="trends" size={22} color={C.muted} />
      <div className="text-sm mt-2" style={{ color: C.sub }}>{title}</div>
    </div>
  );
}

/* MultiMetricChart and MetricChart lived here. Both were fixed 30-day charts,
   and both were replaced when Insights gained a range selector:
   components/MetricComparison draws every pinned metric over any window, with
   flares shaded behind them, ratings sharing the one honest 1–10 axis and
   anything with its own unit on a chart of its own. `seriesFor` went with
   them; `seriesBetween` is its range-aware replacement. */


/** Six weeks, or six months — the same question at two lengths, because "is
    this better than it was" is a different question over a fortnight and over
    half a year, and only the person reading it knows which one they meant. */
function PeriodBars({ entries, field, color, bucket, onBucket, onFeedback }) {
  const data = bucket === "month"
    ? monthlyBars(entries, field.k, 6)
    : weeklyAverages(entries, field.k, 6);
  const isScale = field.type === "scale";
  const last = data.length - 1;
  const word = bucket === "month" ? "monthly" : "weekly";
  return (
    <>
      <div className="fhj-segmented mb-2.5" role="radiogroup" aria-label="Averaged into">
        {[["week", "Weeks"], ["month", "Months"]].map(([v, label]) => (
          <button key={v} type="button" role="radio" aria-checked={bucket === v}
            onClick={() => { onFeedback?.("select"); onBucket(v); }}
            className={"fhj-segment" + (bucket === v ? " is-active" : "")}>
            {label}
          </button>
        ))}
      </div>
      <div style={{ width: "100%", height: 118 }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 6, right: 8, left: -2, bottom: 0 }}>
            <XAxis dataKey="d" tick={axisTick()} axisLine={false} tickLine={false} tickMargin={6} />
            <YAxis domain={isScale ? [0, 10] : ["auto", "auto"]}
              tick={axisTick()} axisLine={false} tickLine={false} width={34} />
            <Tooltip formatter={(v, _n, p) => [
              field.unit ? `${v} ${field.unit}` : v,
              `${word} avg · ${p?.payload?.n ?? 0} ${p?.payload?.n === 1 ? "day" : "days"}`,
            ]} cursor={{ fill: C.faint }} {...tooltipProps()} />
            <Bar dataKey="v" radius={[6, 6, 2, 2]} {...chartAnim()}>
              {/* The current week is the one being asked about; the ones before
                  it are context, so they sit back a step. */}
              {data.map((_, i) => (
                <Cell key={i} fill={color} fillOpacity={i === last ? 1 : 0.42} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="fhj-caption mt-1.5">
        Touch a bar for how many days are behind it — an average of three days
        and an average of thirty look the same on a chart and are not the same
        thing.
      </div>
    </>
  );
}

/* ============================================================
   Possible patterns
   Two sources, always visually distinct:
   · locally calculated — median-split comparisons computed on this device,
     available with no key, no network, no opt-in;
   · AI-assisted — optional, off unless the user turned it on and supplied
     their own Gemini key.
   Neither is a diagnosis, and both say so.
   ============================================================ */

const AI_DISCLAIMER =
  "AI-written observations about your own logs. Not a diagnosis, not medical advice, and not proof that one thing caused another.";

function PatternSourceNote({ children }) {
  return (
    <p className="text-[11px] leading-relaxed mt-2" style={{ color: C.subtle }}>{children}</p>
  );
}

/** Shared card chrome for both kinds of pattern, so the only difference the
    eye picks up is the source badge — not the layout. */
function PatternCard({ badge, title, detail, footer, children }) {
  return (
    <Card>
      <div className="mb-2">{badge}</div>
      <div className="text-sm font-semibold leading-snug">{title}</div>
      <p className="text-sm mt-1.5 leading-relaxed" style={{ color: C.sub }}>{detail}</p>
      {children}
      {footer}
    </Card>
  );
}

function AiPatternCard({ pattern, onDismiss }) {
  const [open, setOpen] = useState(false);
  const strength = strengthLabel(pattern.strength);
  return (
    <PatternCard
      badge={
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="flex items-center gap-1.5">
            <Badge tone="accent">
              <Icon name="spark" size={11} color={C.accentText} /> AI observation
            </Badge>
            <Badge tone="neutral" title={strength.help}>{strength.label}</Badge>
          </span>
          <span className="text-[11px]" style={{ color: C.subtle }}>{pattern.range}</span>
        </div>
      }
      title={pattern.title}
      detail={pattern.detail}
    >
      {pattern.metrics.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {pattern.metrics.map((m) => (
            <span key={m} className="fhj-badge fhj-badge-neutral">{m}</span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 mt-3 pt-3" style={{ borderTop: `1px solid ${C.line}` }}>
        <Button variant="ghost" size="sm" icon="info" onClick={() => setOpen((v) => !v)}
          aria-expanded={open}>
          {open ? "Hide reasoning" : "Why this was suggested"}
        </Button>
        <span className="flex-1" />
        <Button variant="ghost" size="sm" onClick={() => onDismiss(pattern.id)}
          aria-label={`Hide the observation: ${pattern.title}`}>
          Hide
        </Button>
      </div>
      {open && (
        <div className="mt-3 p-3 rounded-xl text-[12.5px] leading-relaxed"
          style={{ background: C.faint, color: C.sub }}>
          <div className="fhj-eyebrow mb-1.5">What this is based on</div>
          {pattern.evidence || "The model didn't explain this one — treat it as a prompt to look at the days yourself."}
          <div className="mt-2 pt-2 text-[11px]" style={{ borderTop: `1px solid ${C.line}`, color: C.subtle }}>
            {strength.help} Days without an entry are simply absent from the comparison.
          </div>
        </div>
      )}
    </PatternCard>
  );
}

/** The confirmation step. Nothing leaves the device until this is accepted,
    and it spells out the payload rather than describing it in the abstract. */
/* The consent gate. Every outbound request in the app goes through this
   component first, which is what makes "never silently transmit health data" a
   structural property rather than a promise in the copy.

   Two shapes: `lines` for a single-item send (one meal, one photo), and the
   detailed journal-window disclosure when analysing patterns. Same rule
   either way — the request is described before it is made, and Cancel is as
   prominent as Send. */
function AiSendPreview({ summary, windowLabel, providerLabel, onCancel, onConfirm, title, lines }) {
  if (lines) {
    return (
      <Modal title={title || `Send this to ${providerLabel}?`} onClose={onCancel}>
        <p className="text-sm leading-relaxed" style={{ color: C.sub }}>
          This is the only part of {APP_NAME} that uses the internet. What's listed below is sent to
          {" "}{providerLabel} using your own key, and nothing else from your journal goes with it.
        </p>
        <div className="mt-4 rounded-xl p-3.5" style={{ background: C.faint }}>
          <div className="fhj-eyebrow mb-2.5">What gets sent</div>
          <ul className="text-sm leading-relaxed flex flex-col gap-1.5">
            {lines.map((l, i) => <li key={i}>· {l}</li>)}
          </ul>
          <div className="fhj-eyebrow mt-4 mb-2">What never gets sent</div>
          <ul className="text-sm leading-relaxed flex flex-col gap-1.5" style={{ color: C.sub }}>
            <li>· any other entry, photo, or note</li>
            <li>· your name, or anything that identifies you</li>
            <li>· your daily check-in answers</li>
          </ul>
        </div>
        <p className="text-[11px] leading-relaxed mt-4" style={{ color: C.subtle }}>
          Your provider's handling of API requests is governed by their terms, not by this app.
          The rest of {APP_NAME} works exactly the same without this.
        </p>
        <div className="flex gap-2 mt-5 sticky bottom-0 pt-3 pb-0.5"
          style={{ background: C.card, borderTop: `1px solid ${C.line}` }}>
          <Button variant="secondary" block onClick={onCancel}>Cancel</Button>
          <Button variant="primary" block onClick={onConfirm} icon="spark">Send</Button>
        </div>
      </Modal>
    );
  }
  return (
    <Modal title={`Send this to ${providerLabel}?`} onClose={onCancel}>
      <p className="text-sm leading-relaxed" style={{ color: C.sub }}>
        This is the only part of {APP_NAME} that uses the internet. Everything below is sent to
        {" "}{providerLabel} using the key you provided, analysed, and returned. Nothing else
        leaves this device.
      </p>
      <div className="mt-4 rounded-xl p-3.5" style={{ background: C.faint }}>
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="fhj-eyebrow">What gets sent</div>
          <span className="text-[11px]" style={{ color: C.subtle }}>{windowLabel}</span>
        </div>
        <ul className="text-sm leading-relaxed flex flex-col gap-1.5">
          <li>· <b>{summary.days}</b> logged day{summary.days === 1 ? "" : "s"} of numeric answers ({summary.values} values, about {summary.approxKB} KB)</li>
          <li>· the names of <b>{summary.metrics}</b> metric{summary.metrics === 1 ? "" : "s"} you track</li>
        </ul>
        <div className="fhj-eyebrow mt-4 mb-2">What never gets sent</div>
        <ul className="text-sm leading-relaxed flex flex-col gap-1.5" style={{ color: C.sub }}>
          <li>· your written notes</li>
          <li>· any photo</li>
          <li>· your name, or anything that identifies you</li>
          <li>· any entry outside {windowLabel}</li>
        </ul>
      </div>
      {summary.metricLabels.length > 0 && (
        <details className="mt-3">
          <summary className="text-sm font-medium cursor-pointer" style={{ color: C.accentText }}>
            See the exact metric names
          </summary>
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {summary.metricLabels.map((m) => (
              <span key={m} className="fhj-badge fhj-badge-neutral">{m}</span>
            ))}
          </div>
        </details>
      )}
      <p className="text-[11px] leading-relaxed mt-4" style={{ color: C.subtle }}>
        Your provider's handling of API requests is governed by their terms, not by this app. If
        you'd rather nothing left the device, the locally calculated patterns above keep working
        on their own.
      </p>
      {/* Sticky so the decision is always one tap away, however long the
          disclosure above runs on a short screen. */}
      <div className="flex gap-2 mt-5 sticky bottom-0 pt-3 pb-0.5"
        style={{ background: C.card, borderTop: `1px solid ${C.line}` }}>
        <Button variant="secondary" block onClick={onCancel}>Cancel</Button>
        <Button variant="primary" block onClick={onConfirm} icon="spark">Send</Button>
      </div>
    </Modal>
  );
}

/* ---------- guided setup ----------

   Turning this on used to mean: read a Settings card, flip a switch, leave the
   app to find Google AI Studio, work out which button on that page makes a
   key, come back, paste, pick a storage mode, save, navigate back to the
   dashboard, find the section again, press Analyse, then confirm. Ten steps
   across two screens and an external site, with nothing holding your place.

   This is the same work as one guided flow that never leaves the screen it
   started on. Each step does exactly one thing, Continue stays disabled until
   that thing is done, the key verifies itself the moment it is pasted, and the
   last step runs the analysis — so finishing setup and getting a result are
   the same action rather than two things to remember. */

const WIZARD_STEPS = [
  { id: "intro", label: "What it does" },
  { id: "provider", label: "Choose" },
  { id: "key", label: "Get a key" },
  { id: "paste", label: "Connect" },
  { id: "review", label: "Review" },
];

function WizardProgress({ index }) {
  return (
    <ol className="flex items-center gap-1.5 shrink-0" aria-label="Setup progress">
      {WIZARD_STEPS.map((s, i) => {
        const done = i < index;
        const current = i === index;
        return (
          <li key={s.id} aria-current={current ? "step" : undefined}>
            <span
              className="flex items-center justify-center rounded-full text-[10px] font-bold shrink-0"
              style={{
                width: 18, height: 18,
                background: done || current ? C.accent : C.faint,
                color: done || current ? C.onAccent : C.subtle,
                transition: "background-color 220ms ease, color 220ms ease",
              }}>
              {done ? <Icon name="check" size={10} color={C.onAccent} /> : i + 1}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Numbered, literal instructions for the one part of this that happens on
    someone else's website. Written as what you will see, not what to think.
    Each provider supplies its own, because "create an API key" looks different
    on every console and a generic instruction helps nobody. */
function AiStudioSteps({ steps }) {
  return (
    <ol className="flex flex-col gap-3 mt-4">
      {steps.map(([title, body], i) => (
        <li key={title} className="flex gap-3">
          <span className="flex items-center justify-center rounded-full text-[11px] font-bold shrink-0 mt-0.5"
            style={{ width: 22, height: 22, background: C.accentSoft, color: C.accentText }}>
            {i + 1}
          </span>
          <span className="min-w-0">
            <span className="text-sm font-semibold block">{title}</span>
            <span className="text-[12.5px] leading-relaxed block mt-0.5" style={{ color: C.sub }}>{body}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

function AiSetupWizard({ input, summary, windowLabel, onRun, onClose, setAi }) {
  const [step, setStep] = useState(0);
  const [providerId, setProviderId] = useState("gemini");
  const [draft, setDraft] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [mode, setMode] = useState("persist");
  // "idle" | "checking" | "ok" | "bad"
  const [check, setCheck] = useState({ state: "idle", message: "", model: null });
  const [overrode, setOverrode] = useState(false); // continued past a failed check
  const [existing, setExisting] = useState(null);  // { mask, provider } already on device
  const [opened, setOpened] = useState(false);     // the console was opened at least once
  const [canPaste, setCanPaste] = useState(false);
  const inputRef = useRef(null);
  const checkSeq = useRef(0);

  const provider = providerOf(providerId);
  const REVIEW = WIZARD_STEPS.length - 1;
  const PASTE = REVIEW - 1;

  /* Someone who already has a key should not be walked through getting one. */
  useEffect(() => {
    let live = true;
    loadConnection().then((conn) => {
      if (!live || !conn) return;
      setProviderId(conn.provider || "gemini");
      setExisting({ mask: maskKey(conn.key), provider: conn.provider || "gemini" });
      setCheck({ state: "ok", message: "Using the connection already on this device.", model: conn.model || null });
      setStep(REVIEW);
    });
    setCanPaste(typeof navigator !== "undefined" && !!navigator.clipboard?.readText);
    return () => { live = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  /* Verify as soon as there is something key-shaped to verify. Pressing a
     separate "Test" button was one more thing to know about, and skipping it
     was how people found out their key was wrong four steps later. */
  useEffect(() => {
    const key = draft.trim();
    setOverrode(false);
    if (!key) { setCheck({ state: "idle", message: "", model: null }); return; }
    if (!looksLikeKey(key)) {
      setCheck({ state: "bad", message: "That doesn't look like a full key yet — it should be one long line with no spaces.", model: null });
      return;
    }
    if (provider.needsBaseUrl && !baseUrl.trim()) {
      setCheck({ state: "idle", message: "", model: null });
      return;
    }
    const seq = ++checkSeq.current;
    setCheck({ state: "checking", message: `Checking with ${provider.label}…`, model: null });
    const t = setTimeout(async () => {
      /* Listing the models is the check: it proves the endpoint is reachable,
         the browser is allowed to call it, the key is accepted, *and* that
         something usable sits behind it. Verifying only the key is what let a
         retired model reach every new user as a 404. */
      const res = await testConnection({ provider: providerId, key, baseUrl: baseUrl.trim() || undefined });
      if (seq !== checkSeq.current) return; // a newer keystroke won
      setCheck(res.ok
        ? { state: "ok", message: `Connected. Using ${res.model}.`, model: res.model }
        : { state: "bad", message: res.message, model: null });
    }, 450);
    return () => clearTimeout(t);
  }, [draft, baseUrl, providerId]); // eslint-disable-line react-hooks/exhaustive-deps

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) { setDraft(text.trim()); inputRef.current?.focus(); }
    } catch {
      // Permission refused or unsupported — the field is right there.
      inputRef.current?.focus();
    }
  };

  const keyReady = existing || check.state === "ok" || overrode;
  const canContinue = step === PASTE ? keyReady : true;

  const advance = async () => {
    if (step === PASTE && !existing) {
      await saveConnection({
        provider: providerId,
        key: draft.trim(),
        baseUrl: baseUrl.trim() || undefined,
        model: check.model || undefined,
      }, mode);
      feedback("save");
    }
    setStep((s) => Math.min(REVIEW, s + 1));
  };

  const finish = async (andRun) => {
    setAi({ enabled: true });
    feedback("save");
    onClose();
    if (andRun && input) onRun(input);
  };

  const enoughDays = !!input && input.days.length >= 5;

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: C.bg }}
      role="dialog" aria-modal="true" aria-label="Set up AI observations">
      {/* header */}
      <div className="shrink-0 px-4 py-3 flex items-center gap-3"
        style={{ borderBottom: `1px solid ${C.line}` }}>
        <button onClick={onClose} aria-label="Close setup" className="fhj-icon-btn"
          style={{ width: "2.25rem", height: "2.25rem" }}>
          <Icon name="x" size={16} color={C.sub} />
        </button>
        <div className="flex-1 min-w-0">
          {/* The dots already say which step this is, so the text doesn't
              repeat the count — that prefix was what pushed the title into
              "Set up AI obser…" at 320px, which reads as a rendering bug.
              The full position is still announced, just not drawn twice. */}
          <div className="text-sm font-semibold truncate">AI observations</div>
          <div className="text-[11px] truncate" style={{ color: C.subtle }}>
            <span className="sr-only">Step {step + 1} of {WIZARD_STEPS.length}: </span>
            {WIZARD_STEPS[step].label}
          </div>
        </div>
        <WizardProgress index={step} />
      </div>

      {/* body */}
      <div className="flex-1 overflow-y-auto" style={{ overscrollBehavior: "contain" }}>
        <div className="max-w-md mx-auto px-4 py-6" key={step}>
          <div className="fhj-screen">

            {step === 0 && (
              <>
                <h2 className="font-display text-2xl leading-snug">
                  A second opinion on your own logs
                </h2>
                <p className="text-sm leading-relaxed mt-3" style={{ color: C.sub }}>
                  The patterns above are worked out on this device by comparing your higher days
                  against your lower ones. That catches pairs, and misses everything else.
                </p>
                <p className="text-sm leading-relaxed mt-2.5" style={{ color: C.sub }}>
                  An AI can read the same numbers and look for what that maths can't:
                  symptoms that keep turning up together, changes in the days after something,
                  sleep and mood relationships, recurring timing, and drifts from your own
                  baseline.
                </p>

                <div className="rounded-xl p-4 mt-5" style={{ background: C.faint }}>
                  <div className="fhj-eyebrow mb-2.5">Before you start, the honest version</div>
                  <ul className="flex flex-col gap-2.5">
                    {[
                      ["It's free, but it's your account", "You'll create an API key with a provider you choose — it takes about a minute and costs nothing at normal use. We'll walk you through it."],
                      ["Only numbers leave this device", "Your ratings and the names of what you track. Never your notes, never a photo, never your name."],
                      ["Nothing sends by itself", "You press a button, see exactly what's going, and confirm. Every single time."],
                      ["You can undo all of it", "Remove the key whenever you like and the app goes back to working entirely offline."],
                    ].map(([t, b]) => (
                      <li key={t} className="flex gap-2.5">
                        <span className="shrink-0 mt-0.5"><Icon name="check" size={14} color={C.good} /></span>
                        <span>
                          <span className="text-[13px] font-semibold block">{t}</span>
                          <span className="text-[12.5px] leading-relaxed block" style={{ color: C.sub }}>{b}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <p className="text-[11.5px] leading-relaxed mt-4" style={{ color: C.subtle }}>
                  Observations are things to notice, not findings. This is not a diagnosis and not
                  medical advice.
                </p>
              </>
            )}

            {step === 1 && (
              <>
                <h2 className="font-display text-2xl leading-snug">Which AI should read it?</h2>
                <p className="text-sm leading-relaxed mt-3" style={{ color: C.sub }}>
                  All of these are your own account and your own key. If you have no preference,
                  the first one is the shortest path.
                </p>

                <div className="flex flex-col gap-2.5 mt-5" role="radiogroup" aria-label="AI provider">
                  {Object.values(PROVIDERS).map((p) => {
                    const on = p.id === providerId;
                    return (
                      <button key={p.id} type="button" role="radio" aria-checked={on}
                        onClick={() => { setProviderId(p.id); setDraft(""); setBaseUrl(""); feedback("select"); }}
                        className="w-full text-left rounded-xl p-3.5"
                        style={{
                          background: on ? C.accentSoft : "transparent",
                          border: `1px solid ${on ? C.accentLine : C.line}`,
                          transition: "background-color 130ms ease, border-color 130ms ease",
                        }}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold">{p.label}</span>
                              {p.recommended && <Badge tone="accent">Easiest</Badge>}
                            </div>
                            <div className="text-[12.5px] leading-relaxed mt-1" style={{ color: C.sub }}>
                              {p.blurb}
                            </div>
                            <div className="text-[11.5px] mt-1.5" style={{ color: C.good }}>{p.free}</div>
                          </div>
                          <span className="w-[22px] h-[22px] rounded-full flex items-center justify-center shrink-0 mt-0.5"
                            style={on ? { background: C.accent } : { border: `1.5px solid ${C.lineStrong}` }}>
                            {on && <Icon name="check" size={13} color={C.onAccent} />}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Asked often enough that leaving it out just means people go
                    looking, try it, and hit an unexplained wall. */}
                <div className="rounded-xl p-3.5 mt-5" style={{ background: C.faint }}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <Icon name="info" size={14} color={C.subtle} />
                    <span className="text-[12px] font-semibold">What about ChatGPT?</span>
                  </div>
                  <p className="text-[11.5px] leading-relaxed" style={{ color: C.sub }}>{OPENAI_NOTE}</p>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <h2 className="font-display text-2xl leading-snug">
                  {provider.keyUrl ? "Get your free key" : "Get a key from your provider"}
                </h2>
                <p className="text-sm leading-relaxed mt-3" style={{ color: C.sub }}>
                  {provider.keyUrl
                    ? `This is the one part that happens on ${provider.keyUrlLabel}'s site. It opens in a new tab, so this page stays exactly where it is — nothing you've done so far is lost.`
                    : "Whichever service you're using, create a key on its own site and copy its endpoint address. Then come back here."}
                </p>

                {provider.keyUrl && (
                  <Button variant="primary" block className="mt-5" icon="link"
                    onClick={() => {
                      setOpened(true);
                      window.open(provider.keyUrl, "_blank", "noopener,noreferrer");
                    }}>
                    Open {provider.keyUrlLabel}
                  </Button>
                )}

                <AiStudioSteps steps={provider.steps} />

                {provider.keyUrl && (
                  <div className="rounded-xl p-3.5 mt-5" style={{ background: C.faint }}>
                    <p className="text-[12.5px] leading-relaxed" style={{ color: C.sub }}>
                      <b style={{ color: C.ink }}>Can't open a new tab?</b> Go to{" "}
                      <span style={{ color: C.accentText, wordBreak: "break-all" }}>
                        {provider.keyUrl.replace(/^https?:\/\//, "")}
                      </span>{" "}
                      on any device, then come back and paste the key on the next step.
                    </p>
                  </div>
                )}

                {opened && (
                  <p className="text-[12.5px] leading-relaxed mt-4" style={{ color: C.good }}>
                    Opened. Once you've copied the key, come back and press Continue.
                  </p>
                )}
              </>
            )}

            {step === 3 && (
              <>
                <h2 className="font-display text-2xl leading-snug">Paste it here</h2>
                <p className="text-sm leading-relaxed mt-3" style={{ color: C.sub }}>
                  We'll check it with {provider.label} as soon as you paste — including which
                  model your key can actually use — so you find out now rather than later.
                </p>

                {provider.needsBaseUrl && (
                  <>
                    <label className="fhj-eyebrow block mt-5 mb-2" htmlFor="fhj-wizard-base">
                      Endpoint address
                    </label>
                    <input
                      id="fhj-wizard-base"
                      type="url"
                      className="fhj-input"
                      value={baseUrl}
                      onChange={(e) => setBaseUrl(e.target.value)}
                      placeholder="https://api.example.com/v1"
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                    />
                    <p className="text-[11.5px] leading-relaxed mt-1.5" style={{ color: C.subtle }}>
                      {provider.baseUrlHint}
                    </p>
                  </>
                )}

                <label className="fhj-eyebrow block mt-5 mb-2" htmlFor="fhj-wizard-key">
                  Your {provider.label} API key
                </label>
                <input
                  id="fhj-wizard-key"
                  ref={inputRef}
                  type="password"
                  className="fhj-input"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={provider.id === "gemini" ? "AQ.…" : provider.id === "openrouter" ? "sk-or-…" : "your API key"}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  aria-describedby="fhj-wizard-key-status"
                />
                {canPaste && (
                  <Button variant="secondary" size="sm" block className="mt-2" onClick={pasteFromClipboard}>
                    Paste from clipboard
                  </Button>
                )}

                <p className="text-[11.5px] leading-relaxed mt-1.5" style={{ color: C.subtle }}>
                  {provider.keyHint}
                </p>

                <div id="fhj-wizard-key-status" role="status" className="mt-3 min-h-[1.25rem]">
                  {check.state === "checking" && (
                    <span className="flex items-center gap-2 text-[12.5px]" style={{ color: C.accentText }}>
                      <span className="fhj-dots" aria-hidden="true"><span /><span /><span /></span>
                      {check.message}
                    </span>
                  )}
                  {check.state === "ok" && (
                    <span className="flex items-center gap-1.5 text-[12.5px] font-medium" style={{ color: C.good }}>
                      <Icon name="check" size={14} color={C.good} /> {check.message}
                    </span>
                  )}
                  {check.state === "bad" && (
                    <div className="rounded-xl p-3 text-[12.5px] leading-relaxed"
                      style={{ background: C.dangerBg, color: C.dangerInk }}>
                      {check.message}
                      {/* A dead end here would strand someone over a flaky
                          connection or a fresh key Google hasn't propagated
                          yet, so there is always a way forward. */}
                      {looksLikeKey(draft.trim()) && !overrode && (
                        <button onClick={() => setOverrode(true)}
                          className="block mt-2 text-[12.5px] font-semibold underline"
                          style={{ color: C.dangerInk }}>
                          Use this key anyway
                        </button>
                      )}
                    </div>
                  )}
                  {overrode && (
                    <p className="text-[12px] leading-relaxed mt-2" style={{ color: C.subtle }}>
                      Saved without a successful check. If analysis fails later, come back to
                      Settings and replace the key.
                    </p>
                  )}
                </div>

                <div className="mt-6">
                  <div className="fhj-eyebrow mb-2">Should we remember it?</div>
                  <Segmented
                    label="How to store the key"
                    value={mode}
                    onChange={setMode}
                    options={[
                      { value: "persist", label: "Yes, on this device" },
                      { value: "session", label: "Just this visit" },
                    ]}
                  />
                  <p className="text-[12px] leading-relaxed mt-2.5" style={{ color: C.subtle }}>
                    {mode === "persist"
                      ? "Kept in this browser's storage, separate from your journal so it can never end up inside an exported backup. It is not encrypted — anyone who can use this browser profile could read it."
                      : "Held in memory only and forgotten when you close the tab. The right choice on a shared or borrowed computer."}
                  </p>
                </div>
              </>
            )}

            {step === 4 && (
              <>
                <h2 className="font-display text-2xl leading-snug">
                  {enoughDays ? "Here's exactly what gets sent" : "You're set up"}
                </h2>

                <div className="flex items-center gap-2.5 p-3 rounded-xl mt-4" style={{ background: C.faint }}>
                  <Icon name="key" size={16} color={C.good} />
                  <span className="min-w-0 flex-1">
                    <span className="text-sm font-medium block truncate">
                      {providerOf(existing?.provider || providerId).label}
                    </span>
                    <span className="text-[11.5px] block truncate" style={{ color: C.subtle }}>
                      {existing ? existing.mask : maskKey(draft)}
                      {check.model ? ` · ${check.model}` : ""}
                    </span>
                  </span>
                  <Badge tone="good">Ready</Badge>
                </div>

                {enoughDays ? (
                  <>
                    <p className="text-sm leading-relaxed mt-3" style={{ color: C.sub }}>
                      Nothing has left this device yet. Press the button below and this — and only
                      this — goes to {providerOf(existing?.provider || providerId).label}.
                    </p>
                    <div className="rounded-xl p-4 mt-4" style={{ background: C.faint }}>
                      <div className="flex items-center justify-between gap-2 mb-2.5">
                        <div className="fhj-eyebrow">Sending</div>
                        <span className="text-[11px]" style={{ color: C.subtle }}>{windowLabel}</span>
                      </div>
                      <ul className="text-sm leading-relaxed flex flex-col gap-1.5">
                        <li>· <b>{summary.days}</b> logged day{summary.days === 1 ? "" : "s"} of numeric answers ({summary.values} values, about {summary.approxKB} KB)</li>
                        <li>· the names of <b>{summary.metrics}</b> metric{summary.metrics === 1 ? "" : "s"} you track</li>
                      </ul>
                      <div className="fhj-eyebrow mt-4 mb-2">Not sending</div>
                      <ul className="text-sm leading-relaxed flex flex-col gap-1.5" style={{ color: C.sub }}>
                        <li>· your written notes</li>
                        <li>· any photo</li>
                        <li>· your name, or anything that identifies you</li>
                        <li>· any entry outside {windowLabel}</li>
                      </ul>
                    </div>
                    {summary.metricLabels.length > 0 && (
                      <details className="mt-3">
                        <summary className="text-sm font-medium cursor-pointer" style={{ color: C.accentText }}>
                          See the exact metric names
                        </summary>
                        <div className="flex flex-wrap gap-1.5 mt-2.5">
                          {summary.metricLabels.map((m) => (
                            <span key={m} className="fhj-badge fhj-badge-neutral">{m}</span>
                          ))}
                        </div>
                      </details>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-sm leading-relaxed mt-3" style={{ color: C.sub }}>
                      Your key is saved and AI observations are on. There{" "}
                      {input && input.days.length === 1 ? "is" : "are"}{" "}
                      <b style={{ color: C.ink }}>{input ? input.days.length : 0}</b> logged{" "}
                      {input && input.days.length === 1 ? "day" : "days"} in the last 90, and an
                      observation needs at least 5 before it means anything.
                    </p>
                    <p className="text-sm leading-relaxed mt-2.5" style={{ color: C.sub }}>
                      Keep logging. The Analyse button is waiting on your dashboard, and you'll
                      still see exactly what would be sent before it goes.
                    </p>
                  </>
                )}

                <p className="text-[11.5px] leading-relaxed mt-4" style={{ color: C.subtle }}>
                  Your provider's handling of API requests is governed by their terms, not by this
                  app. Only what you send them reaches them: an analysis you run, notes you paste
                  into Import, and — if you switch on AI auto-fill — a photo as you attach it.
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* sticky actions — the way forward is always in the same place */}
      <div className="shrink-0 px-4 pt-3"
        style={{
          borderTop: `1px solid ${C.line}`,
          background: C.bg,
          paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
        }}>
        <div className="max-w-md mx-auto flex gap-2">
          {step > 0 && !(step === REVIEW && existing) && (
            <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))}>Back</Button>
          )}
          {step < REVIEW ? (
            <Button variant="primary" block onClick={advance} disabled={!canContinue}>
              {step === 0 ? "Get started"
                : step === 1 ? `Use ${provider.label}`
                : step === 2 ? "I've copied my key"
                : "Save and continue"}
            </Button>
          ) : enoughDays ? (
            <Button variant="primary" block icon="spark" onClick={() => finish(true)}>
              Send and analyse
            </Button>
          ) : (
            <Button variant="primary" block onClick={() => finish(false)}>Done</Button>
          )}
        </div>
        {step === PASTE && !keyReady && (
          <p className="max-w-md mx-auto text-[11.5px] text-center mt-2" style={{ color: C.subtle }}>
            {provider.needsBaseUrl && !baseUrl.trim()
              ? "Enter the endpoint address and your key to continue"
              : "Paste your key to continue"}
          </p>
        )}
      </div>
    </div>
  );
}

function PatternsSection({ tpl, entries, insights, ai, setAi, goSettings, viewer, aiAutoRun = 0 }) {
  const [keyPresent, setKeyPresent] = useState(null); // null = still checking
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null); // { input, summary }
  const [wizard, setWizard] = useState(null);   // { input, summary, windowLabel }
  const [conn, setConn] = useState(null);       // stored connection, for labels
  const abortRef = useRef(null);

  const enabled = !viewer && ai?.enabled === true;
  const analysis = ai?.analysis || null;
  const dismissed = ai?.dismissed || [];

  useEffect(() => {
    let live = true;
    loadConnection().then((c) => { if (!live) return; setConn(c); setKeyPresent(!!c); });
    return () => { live = false; };
  }, [enabled]);

  const providerLabel = providerOf(conn?.provider).label;

  useEffect(() => () => abortRef.current?.abort(), []);

  /* The wizard's last step already showed the payload and said "send", so this
     runs straight away rather than asking for the same confirmation twice. */
  const ranFor = useRef(0);
  useEffect(() => {
    if (!aiAutoRun || aiAutoRun === ranFor.current) return;
    ranFor.current = aiAutoRun;
    setKeyPresent(true);
    run(buildInput());
  }, [aiAutoRun]); // eslint-disable-line react-hooks/exhaustive-deps

  const visible = (analysis?.patterns || []).filter((p) => !dismissed.includes(p.id));

  const start = addDays(todayStr(), -89); // a quarter is enough for "recurring"
  const buildInput = () => buildAnalysisInput(tpl.fields, entries, start, todayStr());

  /* The wizard needs the same payload the preview does, so both are built the
     same way — what someone is shown at the end of setup is byte-for-byte what
     the Analyse button would send. */
  const describe = (input) => ({
    input,
    summary: summariseInput(input),
    windowLabel: `${fmtNice(input.startDate)} – ${fmtNice(input.endDate)}`,
  });

  const openWizard = () => { setError(null); setWizard(describe(buildInput())); };

  const openPreview = () => {
    setError(null);
    const input = buildInput();
    if (input.days.length < 5) {
      setError({
        title: "Not enough logged days yet",
        body: `An observation needs at least 5 logged days to mean anything — there are ${input.days.length} in the last 90. Keep logging and try again.`,
      });
      return;
    }
    setPreview(describe(input));
  };

  const run = async (input) => {
    setPreview(null);
    setBusy(true);
    setError(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const active = await loadConnection();
      if (!active) {
        setKeyPresent(false);
        setError({ title: "No API key", body: "Set up an AI provider to run an analysis." });
        return;
      }
      setConn(active);
      const result = await runPatternAnalysis(active, input, { signal: controller.signal });
      setAi((prev) => ({ ...prev, analysis: result }));
      feedback("save");
    } catch (e) {
      if (e?.name === "AbortError") return;
      setError({
        title: e?.kind === "auth" ? "Google rejected the key"
          : e?.kind === "rate" ? "Rate limited"
          : e?.kind === "network" ? "Couldn't reach the provider"
          : "The analysis didn't come back",
        body: e?.message || "Something went wrong. Try again in a moment.",
        showSettings: e?.kind === "auth",
      });
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  return (
    <>
      <SectionTitle>Possible patterns</SectionTitle>

      {/* --- locally calculated --- */}
      <div className="flex flex-col gap-2">
        {insights.length === 0 ? (
          <Card>
            <Badge tone="neutral">
              <Icon name="device" size={11} color={C.sub} /> Calculated on this device
            </Badge>
            <p className="text-sm mt-2.5 leading-relaxed" style={{ color: C.sub }}>
              Nothing stands out yet. These appear once a few weeks of days share enough answers
              to compare — keep logging and they'll show up on their own.
            </p>
          </Card>
        ) : (
          insights.map((ins) => (
            <PatternCard key={ins.id}
              badge={
                <Badge tone="neutral">
                  <Icon name="device" size={11} color={C.sub} /> Calculated on this device
                </Badge>
              }
              title={ins.title}
              detail={ins.detail}
            />
          ))
        )}
      </div>
      <PatternSourceNote>{PATTERN_NOTE}</PatternSourceNote>

      {/* --- AI-assisted, only when switched on --- */}
      {!viewer && (
        <>
          <SectionTitle
            action={
              enabled && keyPresent && !busy ? (
                <Button variant="ghost" size="sm" icon="refresh" onClick={openPreview}>
                  {analysis ? "Regenerate" : "Analyse"}
                </Button>
              ) : null
            }
          >
            AI observations
          </SectionTitle>

          {!enabled ? (
            <Card>
              <Badge tone="accent"><Icon name="spark" size={11} color={C.accentText} /> Optional</Badge>
              <p className="text-sm mt-2.5 leading-relaxed" style={{ color: C.sub }}>
                You can have an AI of your choosing — Google Gemini, OpenRouter, or any
                OpenAI-compatible service — read a summary of your logged numbers and suggest
                longitudinal observations the on-device maths doesn't look for: things repeatedly
                appearing together, changes after certain days, sleep and mood relationships,
                recurring timing, and drifts from your own baseline.
              </p>
              <p className="text-sm mt-2 leading-relaxed" style={{ color: C.sub }}>
                {keyPresent
                  ? "It's switched off right now. Your key is still on this device, so turning it back on takes one tap."
                  : "It's off. Setup takes about a minute and walks you through every step, including getting the free Google key — you never have to work out what to do next."}
              </p>
              {keyPresent ? (
                <Button variant="primary" block className="mt-4" icon="spark"
                  onClick={() => { setAi({ enabled: true }); feedback("select"); }}>
                  Turn it back on
                </Button>
              ) : (
                <Button variant="primary" block className="mt-4" icon="spark" onClick={openWizard}>
                  Set it up — about a minute
                </Button>
              )}
              <p className="text-[11.5px] text-center mt-2.5" style={{ color: C.subtle }}>
                Nothing is sent until you've seen it and pressed send.
              </p>
            </Card>
          ) : keyPresent === false ? (
            <Card>
              <div className="flex items-center gap-2">
                <Icon name="key" size={16} color={C.warn} />
                <span className="text-sm font-semibold">No API key found</span>
              </div>
              <p className="text-sm mt-2 leading-relaxed" style={{ color: C.sub }}>
                AI observations are switched on, but there's no key stored on this device — a
                session-only key is forgotten when the tab closes.
              </p>
              <Button variant="primary" block className="mt-4" onClick={openWizard}>
                Add a key — guided, about a minute
              </Button>
            </Card>
          ) : busy ? (
            <Card>
              <div className="flex items-center gap-2.5" style={{ color: C.accentText }}>
                <span className="fhj-dots" aria-hidden="true"><span /><span /><span /></span>
                <span className="text-sm font-medium" role="status">Reading your last 90 days…</span>
              </div>
              <p className="text-sm mt-2.5 leading-relaxed" style={{ color: C.sub }}>
                Sent to {providerLabel}. This usually takes a few seconds.
              </p>
              <div className="mt-4 flex flex-col gap-2" aria-hidden="true">
                <div className="fhj-shimmer h-3 rounded-full" style={{ width: "72%" }} />
                <div className="fhj-shimmer h-3 rounded-full" style={{ width: "94%" }} />
                <div className="fhj-shimmer h-3 rounded-full" style={{ width: "58%" }} />
              </div>
              <Button variant="ghost" size="sm" className="mt-4"
                onClick={() => { abortRef.current?.abort(); setBusy(false); }}>
                Cancel
              </Button>
            </Card>
          ) : error ? (
            <Card style={{ borderColor: C.dangerInk }}>
              <div className="flex items-center gap-2">
                <Icon name="warn" size={16} color={C.dangerInk} />
                <span className="text-sm font-semibold">{error.title}</span>
              </div>
              <p className="text-sm mt-2 leading-relaxed" style={{ color: C.sub }}>{error.body}</p>
              <div className="flex gap-2 mt-4">
                {error.showSettings ? (
                  <Button variant="primary" block onClick={openWizard}>Fix my key</Button>
                ) : (
                  <Button variant="secondary" block onClick={openPreview}>Try again</Button>
                )}
              </div>
            </Card>
          ) : !analysis ? (
            <Card>
              <Badge tone="accent"><Icon name="spark" size={11} color={C.accentText} /> Ready</Badge>
              <p className="text-sm mt-2.5 leading-relaxed" style={{ color: C.sub }}>
                Nothing has been analysed yet. You'll see exactly what would be sent before
                anything leaves this device.
              </p>
              <Button variant="primary" block className="mt-4" icon="spark" onClick={openPreview}>
                Analyse my last 90 days
              </Button>
            </Card>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                {visible.length === 0 ? (
                  <Card>
                    <p className="text-sm leading-relaxed" style={{ color: C.sub }}>
                      {analysis.patterns.length === 0
                        ? (analysis.note || "Nothing stood out this time. That's a real answer — it usually means your days have been fairly consistent.")
                        : "You've hidden every observation from this run. Regenerate for a fresh look."}
                    </p>
                    {dismissed.length > 0 && (
                      <Button variant="ghost" size="sm" className="mt-3"
                        onClick={() => setAi((prev) => ({ ...prev, dismissed: [] }))}>
                        Show hidden observations ({dismissed.length})
                      </Button>
                    )}
                  </Card>
                ) : (
                  visible.map((p) => (
                    <AiPatternCard key={p.id} pattern={p}
                      onDismiss={(id) => setAi((prev) => ({
                        ...prev, dismissed: [...(prev.dismissed || []), id],
                      }))} />
                  ))
                )}
              </div>

              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <span className="text-[11px]" style={{ color: C.subtle }}>
                  {analysis.daysAnalysed} logged day{analysis.daysAnalysed === 1 ? "" : "s"} ·{" "}
                  {new Date(analysis.generatedAt).toLocaleString(undefined, {
                    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                  })}
                </span>
                <span className="flex-1" />
                {dismissed.length > 0 && visible.length > 0 && (
                  <Button variant="ghost" size="sm"
                    onClick={() => setAi((prev) => ({ ...prev, dismissed: [] }))}>
                    Unhide {dismissed.length}
                  </Button>
                )}
              </div>
              <PatternSourceNote>{AI_DISCLAIMER}</PatternSourceNote>
            </>
          )}
        </>
      )}

      {preview && (
        <AiSendPreview summary={preview.summary} windowLabel={preview.windowLabel}
          providerLabel={providerLabel}
          onCancel={() => setPreview(null)}
          onConfirm={() => run(preview.input)} />
      )}

      {wizard && (
        <AiSetupWizard
          input={wizard.input} summary={wizard.summary} windowLabel={wizard.windowLabel}
          setAi={setAi}
          onRun={(input) => { setKeyPresent(true); run(input); }}
          onClose={() => { setWizard(null); loadConnection().then((c) => { setConn(c); setKeyPresent(!!c); }); }} />
      )}
    </>
  );
}

/* ============================================================
   Insights — one question at a time, in the order people ask them
   ============================================================

   This screen used to be a pile: a headline number, a chart, some cards,
   patterns, reports, photos, entries. Everything on it was worth having and
   nothing on it was in an order, so the answer to "how am I doing" was
   somewhere in five screens of scrolling and the reader had to assemble it.

   It now runs down the questions in the order a person actually asks them:

     1. over what period?          — the range selector, which drives everything
     2. how am I right now?        — the hero
     3. how does that compare?     — four figures, no charts
     4. what has it been doing?    — one chart, the primary metric, flares shaded
     5. how bad were the bad bits? — episodes
     6. what does a year look like?— the heatmap, and the long view under it
     7. what kind of days are they?— the distribution
     8. does anything move with it?— honest small multiples
     9. is anything related?       — the explorer, with its floors

   One primary chart is visible at a time. Everything second-order — week by
   week, the years on top of each other, seasons, the scatter — is behind a
   labelled expansion control, so the page reads as nine short answers rather
   than as fourteen charts. */

const INSIGHT_RANGES = [
  /* `label` is the control; `prose` is the same window in a sentence. Without
     the second one every line in the screen reads "3 months average". */
  { value: "30", label: "30 days", prose: "last 30 days", days: 30 },
  { value: "90", label: "3 months", prose: "last 3 months", days: 90 },
  { value: "365", label: "12 months", prose: "last 12 months", days: 365 },
  { value: "all", label: "All", prose: "whole journal", days: null },
];

/** Turn the selected range into the two dates everything else works from. */
function insightRange(key, entries) {
  const end = todayStr();
  const preset = INSIGHT_RANGES.find((r) => r.value === key) || INSIGHT_RANGES[0];
  if (preset.days) {
    return {
      key, label: preset.label, prose: preset.prose,
      start: addDays(end, -(preset.days - 1)), end, days: preset.days,
    };
  }
  const first = entries.reduce((a, e) => (!a || e.date < a ? e.date : a), null) || addDays(end, -29);
  return { key, label: "All time", prose: "whole journal", start: first, end, days: daySpan(first, end) };
}

/** The same series shape the charts already understand, over any window. */
function seriesBetween(entries, key, start, end) {
  const byDate = new Map(entries.map((e) => [e.date, e]));
  const out = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const e = byDate.get(d);
    const v = e && typeof e.answers[key] === "number" ? e.answers[key] : null;
    out.push({ d, v, avg: null });
  }
  for (let i = 0; i < out.length; i++) {
    const win = out.slice(Math.max(0, i - 6), i + 1).map((p) => p.v).filter((v) => v != null);
    out[i].avg = win.length >= 2 ? Math.round((win.reduce((a, b) => a + b, 0) / win.length) * 10) / 10 : null;
  }
  return out;
}

/** Average of a metric between two dates, inclusive. */
function avgBetween(entries, key, start, end) {
  const vals = entries.filter((e) => e.date >= start && e.date <= end)
    .map((e) => e.answers[key]).filter((v) => typeof v === "number");
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

/** The line under the trend chart, which has to describe whatever the reader
    chose rather than the one shape the chart used to have. */
function chartNote(view, field, banded) {
  const bits = [];
  if (view.avg === "only") {
    bits.push("Every line is a 7-day average");
  } else {
    bits.push(
      view.shape === "dots" ? "One dot per logged day"
        : view.shape === "steps" ? "Each day held until the next one"
          : "Solid line: daily"
    );
    if (view.avg === "on") {
      bits.push(`dashed line: 7-day average of ${String(field.label).toLowerCase()}`);
    }
  }
  if (view.breakGaps) bits.push("gaps left where nothing was logged");
  if (banded) bits.push("shaded: a flare you marked");
  return bits.join(" · ");
}

/* MainTrendChart lived here. It drew the primary metric and nothing else,
   under a picker that let you pin four — so three of the four pins changed
   nothing you could see until you scrolled to a second card further down.
   components/MetricComparison draws all of them now, with the primary heaviest
   and its 7-day average dashed behind it, which is what this was for. */

/** One of the four figures under the hero. No chart, on purpose: these are the
    numbers you read before you look at anything. */
function SummaryCard({ label, value, unit, detail, tone, trend }) {
  return (
    <Card className="!p-3.5" style={{ padding: "0.875rem" }}>
      <div className="fhj-eyebrow leading-snug">{label}</div>
      <div className="flex items-baseline gap-1.5 mt-2">
        <span className="font-display text-[1.625rem] leading-none tabular-nums"
          style={{ color: tone || C.ink }}>{value}</span>
        {unit && <span className="text-[11px]" style={{ color: C.subtle }}>{unit}</span>}
      </div>
      {trend}
      {detail && (
        <div className="text-[11px] mt-1.5 leading-snug" style={{ color: C.subtle }}>{detail}</div>
      )}
    </Card>
  );
}

/** The flare controls, and what the year of them looks like. */
function EpisodesSection({
  tpl, metricField, episodes, entries, today, viewer, range,
  onStart, onEnd, onOpen, onFeedback,
}) {
  const [more, setMore] = useState(false);
  const dir = metricField.dir;
  const forMetric = useMemo(
    () => sortEpisodes(episodes.filter((e) => e.metric === metricField.k)),
    [episodes, metricField.k]
  );
  const stats = useMemo(
    () => forMetric.map((e) => episodeStats(e, { entries, today, dir, all: forMetric })),
    [forMetric, entries, today, dir]
  );
  const running = forMetric.find(episodeIsOpen) || null;
  const runningStats = running ? stats.find((s) => s.id === running.id) : null;
  const year = Number(today.slice(0, 4));
  const compare = useMemo(
    () => compareEpisodeYears(forMetric, year, { entries, today, dir }),
    [forMetric, entries, today, dir, year]
  );
  const y = compare.now;

  return (
    <>
      {running ? (
        <Card style={{ borderLeft: `3px solid ${C.alert}` }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Badge tone="accent">Flare in progress</Badge>
              <div className="text-sm font-semibold mt-2 truncate">{running.title}</div>
              <div className="text-[11.5px] mt-1" style={{ color: C.subtle }}>
                {episodeWhen(running, today)}
                {runningStats?.average != null && ` · averaging ${fmt1(runningStats.average)}`}
                {runningStats?.peak != null && ` · peak ${runningStats.peak}`}
              </div>
            </div>
            <div className="font-display text-[2rem] leading-none tabular-nums shrink-0"
              style={{ color: runningStats?.peak != null ? colorFor(runningStats.peak, dir) : C.muted }}>
              {runningStats?.peak ?? "–"}
            </div>
          </div>
          {!viewer && (
            <div className="flex gap-2 mt-4">
              <Button variant="primary" className="flex-1" onClick={() => onEnd(running.id)}>
                End flare
              </Button>
              <Button variant="secondary" className="flex-1" onClick={() => onOpen(running.id)}>
                Open
              </Button>
            </div>
          )}
        </Card>
      ) : (
        <Card>
          <div className="text-sm leading-relaxed" style={{ color: C.sub }}>
            {forMetric.length
              ? "Nothing marked right now. When the next bad stretch starts, mark it."
              : "Mark when a bad stretch starts and ends — the app does the rest: how long it ran, how bad it got, and how this year compares to last. Nothing is detected for you; a run of high scores is not always a flare, and you are the one who knows."}
          </div>
          {!viewer && (
            <Button variant="outline" block icon="plus" className="mt-4" onClick={onStart}>
              Start a flare today
            </Button>
          )}
        </Card>
      )}

      {stats.length > 0 && (
        <>
          <Card className="mt-2.5">
            <div className="flex items-baseline justify-between gap-3 mb-3">
              <div className="fhj-eyebrow">{year}</div>
              <span className="text-[11px] shrink-0" style={{ color: C.subtle }}>
                {y.count === 1 ? "1 flare" : `${y.count} flares`}
              </span>
            </div>
            <div className="fhj-dist-stats">
              <div className="fhj-dist-stat" style={{ background: C.faint }}>
                <div className="fhj-eyebrow leading-snug">Flare days</div>
                <div className="font-display text-[1.5rem] leading-none mt-1.5 tabular-nums">{y.flareDays}</div>
                <div className="text-[11px] mt-1.5" style={{ color: C.subtle }}>
                  {Math.round((y.flareDays / daySpan(`${year}-01-01`, today)) * 100)}% of the year so far
                </div>
              </div>
              <div className="fhj-dist-stat" style={{ background: C.faint }}>
                <div className="fhj-eyebrow leading-snug">Average length</div>
                <div className="font-display text-[1.5rem] leading-none mt-1.5 tabular-nums">
                  {y.avgDuration == null ? "–" : Math.round(y.avgDuration)}
                  {y.avgDuration != null && <span className="text-[0.75rem] font-sans ml-1" style={{ color: C.subtle }}>days</span>}
                </div>
                <div className="text-[11px] mt-1.5" style={{ color: C.subtle }}>
                  longest {y.longest ? durationLabel(y.longest.days) : "–"}
                </div>
              </div>
            </div>
            {compare.comparable && (
              <p className="text-[11.5px] leading-relaxed mt-2.5" style={{ color: C.subtle }}>
                {year - 1} had {compare.prev.count === 1 ? "1 flare" : `${compare.prev.count} flares`} and{" "}
                {compare.prev.flareDays} flare {compare.prev.flareDays === 1 ? "day" : "days"} —{" "}
                {compare.deltaFlareDays === 0
                  ? "the same number of days so far"
                  : `${Math.abs(compare.deltaFlareDays)} ${Math.abs(compare.deltaFlareDays) === 1 ? "day" : "days"} ${compare.deltaFlareDays > 0 ? "more" : "fewer"} this year so far`}.
              </p>
            )}
            <Disclosure className="mt-3" label="How bad they ran"
              summary={`Average ${fmt1(y.avgScore)} · average peak ${fmt1(y.avgPeak)}`}>
              <div className="fhj-dist-stats">
                <div className="fhj-dist-stat" style={{ background: C.faint }}>
                  <div className="fhj-eyebrow leading-snug">Average score</div>
                  <div className="font-display text-[1.5rem] leading-none mt-1.5 tabular-nums">{fmt1(y.avgScore)}</div>
                  <div className="text-[11px] mt-1.5" style={{ color: C.subtle }}>across this year's flares</div>
                </div>
                <div className="fhj-dist-stat" style={{ background: C.faint }}>
                  <div className="fhj-eyebrow leading-snug">Average peak</div>
                  <div className="font-display text-[1.5rem] leading-none mt-1.5 tabular-nums">{fmt1(y.avgPeak)}</div>
                  <div className="text-[11px] mt-1.5" style={{ color: C.subtle }}>the worst day of each</div>
                </div>
              </div>
              {compare.comparable && compare.prev.avgScore != null && (
                <p className="text-[11.5px] leading-relaxed mt-2.5" style={{ color: C.subtle }}>
                  {year - 1}: average {fmt1(compare.prev.avgScore)}, average peak {fmt1(compare.prev.avgPeak)},
                  average length {compare.prev.avgDuration == null ? "–" : Math.round(compare.prev.avgDuration)} days.
                </p>
              )}
            </Disclosure>
          </Card>

          <Card className="mt-2.5">
            <div className="fhj-eyebrow mb-2.5">Every flare · {range.label.toLowerCase()}</div>
            <EpisodeTimeline
              stats={stats.filter((s) => (s.end || today) >= range.start)}
              from={range.start} to={today}
              onOpen={onOpen} onFeedback={onFeedback}
              activeId={running?.id || null} />
          </Card>
        </>
      )}
    </>
  );
}

/* Environmental coincidences, in the app's own careful voice.

   `contextObservations` produces at most three, each a count of the person's
   own days, and every one of them is tappable — which is where the cross-
   feature promise gets kept. Tap "8 of your 10 hardest days were above 29°C"
   and you land on those eight days, in History, with their weather drawn
   behind them. That is the difference between an app that says something
   interesting and an app that shows you where it got it. */
function ContextSection({ entries, context = [], keyField, units, onHighlight }) {
  const observations = useMemo(
    () => (keyField && context.length
      ? contextObservations(
          entries,
          context,
          { key: keyField.k, label: keyField.label, dir: keyField.dir },
          units === "imperial" ? "imperial" : "metric",
          3
        )
      : []),
    [entries, context, keyField, units]
  );
  if (!observations.length) return null;

  return (
    <>
      <SectionTitle>What the weather was doing</SectionTitle>
      <div className="grid gap-2">
        {observations.map((o) => (
          <button key={o.id} type="button" className="w-full text-left"
            onClick={() => onHighlight?.(o.dates, o.headline)}>
            <Card tappable>
              <div className="text-[15px] leading-snug font-display">{o.headline}</div>
              <div className="text-[11.5px] leading-relaxed mt-1.5" style={{ color: C.sub }}>{o.detail}</div>
              <div className="text-[11px] mt-2 flex items-center gap-1" style={{ color: C.accentText }}>
                Light up {o.dates.length} {o.dates.length === 1 ? "day" : "days"}
                <Icon name="right" size={12} color={C.accentText} />
              </div>
            </Card>
          </button>
        ))}
      </div>
    </>
  );
}

function InsightsScreen({ profile, entries, episodes = [], openLog, goExport, goGallery, goReport, reports, openSavedReport, deleteSavedReport, goSetup, goSettings, viewer, ai, setAi, aiAutoRun, food = [], bowel = [], routine = [], routineItems = [], onStartFlare, onEndFlare, onOpenEpisode, onPinMetrics, onChartView, context = [], sun = [], labs = [], onHighlight, goSun, goLabs, goExperiments }) {
  const tpl = getProfileTemplate(profile);
  const keyField = getField(tpl, tpl.keyMetric);
  const t0 = todayStr();

  const [rangeKey, setRangeKey] = useState("30");
  const range = useMemo(() => insightRange(rangeKey, entries), [rangeKey, entries]);

  /* A derived metric has to look like a survey question to the chart, the
     picker and the axis formatter. This is the one place the two kinds meet;
     everything downstream just sees a field. */
  const fieldFor = (k) => {
    const f = getField(tpl, k);
    if (f) return f;
    const m = derivedMetric(k);
    return m ? { k: m.k, label: m.label, type: "number", dir: m.dir, unit: m.unit, sec: m.sec, derived: true } : null;
  };

  /* Pinned metrics are a saved preference, not screen state: the point of
     pinning is that the four things you care about are there tomorrow. */
  const [metrics, setMetrics] = useState(() => {
    const saved = (profile.pinnedMetrics || []).filter((k) => getField(tpl, k) || derivedMetric(k));
    return saved.length ? saved.slice(0, 4) : [tpl.chartMetrics[0]].filter(Boolean);
  });
  const pin = (next) => {
    setMetrics(next);
    if (!viewer) onPinMetrics?.(next);
  };

  /* How the chart is drawn is a saved preference for the same reason the pins
     are: somebody who reads their journal in steps with the gaps left open
     wants it that way tomorrow too. */
  const [bucket, setBucket] = useState("week");
  const [chartView, setChartView] = useState(() => sanitizeChartView(profile.chartView));
  const setView = (next) => {
    setChartView(next);
    if (!viewer) onChartView?.(next);
  };
  const selFields = metrics.map(fieldFor).filter(Boolean);
  const metricField = selFields[0] || keyField;
  const toggleMetric = (k) => pin(
    metrics.includes(k)
      ? (metrics.length > 1 ? metrics.filter((x) => x !== k) : metrics)  // keep at least one
      : (metrics.length >= 4 ? [...metrics.slice(0, 3), k] : [...metrics, k])
  );

  /* Meals, bowel movements and routine doses are many-per-day, so they reach
     the chart as derived daily metrics. Only the ones with real data behind
     them are offered — a picker full of permanently flat lines is worse than a
     short picker. Availability is checked over the last year at most: a
     five-year journal does not need five years of scanning to answer "is this
     worth offering". */
  const derivedDates = useMemo(() => {
    const n = Math.min(range.days, 365);
    const out = [];
    for (let i = n - 1; i >= 0; i--) out.push(addDays(t0, -i));
    return out;
  }, [range.days, t0]);
  const metricSource = useMemo(
    () => ({ food, bowel, routine, routineItems }),
    [food, bowel, routine, routineItems]
  );
  const derived = useMemo(
    () => availableDerivedMetrics(metricSource, derivedDates),
    [metricSource, derivedDates]
  );

  const metricOptions = useMemo(
    () => [
      ...tpl.chartMetrics.map((k) => {
        const f = getField(tpl, k);
        return f ? { k, label: f.label } : null;
      }),
      ...derived.map((m) => ({ k: m.k, label: m.label })),
    ]
      .filter(Boolean)
      .map((o) => {
        const idx = metrics.indexOf(o.k);
        return { ...o, dot: idx >= 0 && metrics.length > 1 ? CHART_PALETTE(tpl.color)[idx] : null };
      }),
    [tpl, metrics, derived]
  );

  /* Entries as the charts should see them: every logged day, plus any day that
     has food, bowel or routine data, with derived metrics folded in as
     answers. Kept separate from `entries` so streaks, the calendar and exports
     are unchanged by a day that only has a meal on it. */
  const chartEntries = useMemo(() => {
    if (!derived.length) return entries;
    const byDate = new Map(entries.map((e) => [e.date, e]));
    const dates = new Set([...entries.map((e) => e.date), ...derivedDates]);
    const out = [];
    for (const date of [...dates].sort()) {
      const base = byDate.get(date);
      const answers = { ...(base?.answers || {}) };
      let any = !!base;
      for (const m of derived) {
        const v = m.value(metricCtx(metricSource, date));
        if (v != null) { answers[m.k] = v; any = true; }
      }
      if (any) out.push({ ...(base || { id: `d_${date}`, date }), date, answers });
    }
    return out;
  }, [entries, derived, metricSource, derivedDates]);

  const today = entryOn(entries, t0);
  const streak = calcStreak(entries);
  const insights = useMemo(() => computeInsights(tpl, entries), [tpl, entries]);
  const recent = [...entries].reverse().slice(0, 5);
  const photoFields = useMemo(() => tpl.fields.filter((f) => f.type === "photo"), [tpl]);
  const photoItems = useMemo(() => buildPhotoItems(tpl, entries), [tpl, entries]);

  /* Everything the hero and the four figures are made of, over the selected
     range, for the metric at the top of the pins. */
  const primaryKey = metricField?.k;
  const heroToday = primaryKey ? today?.answers[primaryKey] : null;
  const dist = useMemo(
    () => distribution({ entries: chartEntries, key: primaryKey, dir: metricField?.dir, start: range.start, end: range.end }),
    [chartEntries, primaryKey, metricField, range.start, range.end]
  );
  const nowAvg = useMemo(
    () => avgBetween(chartEntries, primaryKey, range.start, range.end),
    [chartEntries, primaryKey, range.start, range.end]
  );
  const prevAvg = useMemo(() => {
    const prevEnd = addDays(range.start, -1);
    return avgBetween(chartEntries, primaryKey, addDays(prevEnd, -(range.days - 1)), prevEnd);
  }, [chartEntries, primaryKey, range.start, range.days]);
  const delta = nowAvg != null && prevAvg != null ? nowAvg - prevAvg : null;
  const improving = delta == null || metricField?.dir === "neutral" ? null
    : metricField?.dir === "pos" ? delta > 0 : delta < 0;

  const bands = useMemo(
    () => episodeBands(episodes, range.start, range.end, t0, primaryKey),
    [episodes, range.start, range.end, t0, primaryKey]
  );

  const heatMonths = useMemo(() => {
    if (!metricField || metricField.type !== "scale") return null;
    const byDate = new Map(entries.map((e) => [e.date, e]));
    return buildHeatmap({
      today: t0, months: 12,
      valueOn: (d) => {
        const v = byDate.get(d)?.answers[metricField.k];
        return typeof v === "number" ? v : null;
      },
      loggedOn: (d) => byDate.has(d),
    });
  }, [entries, metricField, t0]);

  /* One row per day in the window, every pinned metric on it, and each one's
     trailing 7-day average alongside it — the dashed line behind the primary,
     and every line at once when the reader asks for averages only. */
  const comparisonData = useMemo(() => {
    const byDate = new Map(chartEntries.map((e) => [e.date, e]));
    const rows = [];
    for (let d = range.start; d <= range.end; d = addDays(d, 1)) {
      const answers = byDate.get(d)?.answers || {};
      const row = { d };
      for (const f of selFields) {
        const v = answers[f.k];
        row[f.k] = typeof v === "number" ? v : null;
      }
      rows.push(row);
    }
    for (const f of selFields) {
      const ak = avgKeyOf(f.k);
      for (let i = 0; i < rows.length; i++) {
        const win = rows.slice(Math.max(0, i - 6), i + 1)
          .map((r) => r[f.k]).filter((v) => v != null);
        // Two days is the least that can average to something other than itself.
        rows[i][ak] = win.length >= 2
          ? Math.round((win.reduce((a, b) => a + b, 0) / win.length) * 10) / 10 : null;
      }
    }
    return rows;
  }, [chartEntries, selFields, range.start, range.end]);

  /* What the explorer is allowed to offer. Outcomes are 1–10 ratings only —
     "how did your steps relate to your weight" is a question this screen has no
     business answering. Factors are anything with a number in it. */
  const explorerFields = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const k of [...tpl.chartMetrics, ...derived.map((m) => m.k)]) {
      if (seen.has(k)) continue;
      seen.add(k);
      const f = fieldFor(k);
      if (f) out.push(f);
    }
    for (const f of tpl.fields) {
      if (seen.has(f.k)) continue;
      if (f.type !== "toggle" && f.type !== "number" && f.type !== "scale") continue;
      seen.add(f.k);
      out.push(f);
    }
    return out;
  }, [tpl, derived]);
  const outcomeFields = explorerFields.filter((f) => f.type === "scale");

  // Nobody else is holding a copy of this journal. Once it's big enough to
  // hurt losing, say so — quietly, once, and only while it's actually true.
  const nudge = viewer ? { show: false } : backupNudge({
    lastBackupAt: profile.lastBackupAt,
    entryCount: entries.length,
    entriesSinceBackup: profile.lastBackupAt
      ? entries.filter((e) => (e.createdAt || "") > profile.lastBackupAt).length
      : undefined,
  });

  if (!keyField || tpl.fields.length === 0) {
    return (
      <div className="px-4 pb-8 pt-3">
        <EmptyState icon="sliders" title="Nothing to show yet"
          text="No questions are enabled, so there's nothing to log or chart. Turn on a question pack or add your own question."
          actionLabel="Open Edit Setup" onAction={goSetup} />
      </div>
    );
  }

  return (
    <div className="px-4 pb-8 fhj-stagger">
      <div className="flex items-start justify-between gap-3 pt-5 pb-1">
        <div className="min-w-0">
          <div className="text-[12.5px] font-medium" style={{ color: C.subtle }}>
            {viewer ? "Read-only viewer" : tpl.label}
          </div>
          <h1 className="font-display text-[1.75rem] leading-tight mt-0.5">Insights</h1>
        </div>
        {!viewer && (
          <button onClick={goSettings} aria-label="settings" className="fhj-icon-btn shrink-0 mt-1">
            <Icon name="gear" size={19} color={C.sub} />
          </button>
        )}
      </div>

      {/* 1 — over what period. It sits above everything because it changes
          everything below it, and a control that moves would be worse. */}
      <div className="mt-3">
        <Segmented label="Range"
          options={INSIGHT_RANGES.map((r) => ({ value: r.value, label: r.label }))}
          value={rangeKey}
          onChange={(v) => { feedback("select"); setRangeKey(v); }} />
      </div>

      {/* 2 — how am I right now */}
      <Card className="!p-5 mt-2.5" style={{ padding: "1.25rem" }}>
        <div className="flex items-start justify-between gap-3">
          <div className="fhj-eyebrow min-w-0 leading-snug pt-0.5">Today · {metricField.label}</div>
          <Badge tone={streak > 0 ? "accent" : "neutral"}>
            {streak > 0 ? `${streak}-day streak` : "no streak yet"}
          </Badge>
        </div>
        {/* Until today is logged there is no today number, and a 3.25rem em-dash
            is a large, confident way of saying nothing. The card falls back to
            the range average — which is a real answer to "how am I doing" — and
            offers the tap that would fill the gap in. */}
        <div className="flex items-end justify-between gap-4 mt-2.5">
          <div className="min-w-0">
            <div className="font-display text-[3.25rem] leading-none tabular-nums"
              style={{ color: heroToday != null ? colorFor(heroToday, metricField.dir) : (nowAvg != null ? C.sub : C.muted) }}>
              {heroToday != null ? <CountUp value={heroToday} /> : (nowAvg != null ? fmt1(nowAvg) : "—")}
            </div>
            <div className="text-[11.5px] mt-2" style={{ color: C.subtle }}>
              {heroToday != null ? "logged today"
                : (nowAvg != null ? `average over the ${range.prose}` : "nothing logged yet")}
            </div>
          </div>
          <div className="text-right shrink-0 flex flex-col gap-1.5">
            {heroToday != null && (
              <div className="text-xs" style={{ color: C.subtle }}>
                7-day avg <b className="tabular-nums ml-0.5" style={{ color: C.ink }}>{fmt1(avgWindow(chartEntries, primaryKey, 7))}</b>
              </div>
            )}
            <div className="text-xs" style={{ color: C.subtle }}>
              {range.label} · avg <b className="tabular-nums ml-0.5" style={{ color: C.ink }}>{fmt1(nowAvg)}</b>
            </div>
          </div>
        </div>
        {heroToday == null && !viewer && (
          <Button variant="outline" block className="mt-4" onClick={() => openLog(t0)}>
            Log today
          </Button>
        )}
        <TodayNutritionStrip food={food} date={t0} />
      </Card>

      {/* 3 — four figures, no charts */}
      <div className="grid grid-cols-2 gap-2 mt-2.5">
        <SummaryCard label="Average" value={fmt1(nowAvg)}
          trend={delta != null && (
            <div className="flex items-center gap-1 mt-1.5 text-[11.5px]"
              style={{ color: improving == null ? C.subtle : improving ? C.good : C.alert }}>
              <span aria-hidden="true">{delta > 0 ? "▲" : delta < 0 ? "▼" : "•"}</span>
              <span className="tabular-nums">{Math.abs(delta) < 0.05 ? "level" : fmt1(Math.abs(delta))}</span>
              <span style={{ color: C.subtle }}>vs previous {range.label.toLowerCase()}</span>
            </div>
          )}
          detail={delta == null ? "no earlier period to compare with" : undefined} />
        <SummaryCard label="Days logged" value={dist.total} unit={`of ${range.days}`}
          detail={`${Math.round((dist.total / Math.max(1, range.days)) * 100)}% covered`} />
        <SummaryCard label="Hard days" value={dist.hardDays}
          tone={dist.hardDays ? C.bad : undefined}
          detail={`${hardLabel(metricField.dir)} · ${dist.total ? pct(dist.hardShare) : "–"}`} />
        <SummaryCard label="Calm days" value={dist.calmDays}
          tone={dist.calmDays ? C.good : undefined}
          detail={`${calmLabel(metricField.dir)} · ${dist.total ? pct(dist.calmShare) : "–"}`} />
      </div>

      {/* 4 — what has it been doing */}
      <SectionTitle>Trend</SectionTitle>
      <Card>
        <MetricPicker
          options={metricOptions}
          selected={metrics}
          onToggle={toggleMetric}
          max={4}
          label="Pinned metrics" />
        <div className="fhj-caption mb-2.5">
          Pinned for next time. The first one is what this screen is about.
        </div>
        {/* Every pinned metric, not just the first: ratings share the one
            honest 1–10 axis, anything with its own unit gets its own chart
            underneath, and one crosshair crosses all of them. */}
        <MetricComparison
          fields={selFields} data={comparisonData} palette={CHART_PALETTE(tpl.color)}
          primaryKey={primaryKey} view={chartView} mainHeight={214} bands={bands}
          tooltipProps={tooltipProps} axisTick={axisTick} chartAnim={chartAnim}
          fmtShort={fmtShort} fmtNice={fmtNice}
          renderEmpty={(title, height) => <ChartEmpty title={title} height={height} />}
          note={chartNote(chartView, metricField, bands.length > 0)} />
        <Disclosure className="mt-3.5" label="How it's drawn"
          summary={chartViewSummary(chartView)}>
          <ChartViewControls
            view={chartView} onChange={setView} onFeedback={feedback}
            hasRatings={selFields.some((f) => f.type === "scale")}
            ratingCount={selFields.filter((f) => f.type === "scale").length} />
        </Disclosure>
        <Disclosure className="mt-3.5"
          label={bucket === "month" ? "Month by month" : "Week by week"}
          summary={`The same metric, averaged into ${bucket === "month" ? "months" : "weeks"}`}>
          <PeriodBars entries={chartEntries} field={metricField} color={tpl.color}
            bucket={bucket} onBucket={setBucket} onFeedback={feedback} />
        </Disclosure>
      </Card>

      {/* 5 — how bad were the bad bits */}
      <SectionTitle>Flares</SectionTitle>
      <EpisodesSection
        tpl={tpl} metricField={metricField} episodes={episodes} entries={chartEntries}
        today={t0} viewer={viewer} range={range}
        onStart={onStartFlare} onEnd={onEndFlare} onOpen={onOpenEpisode}
        onFeedback={feedback} />

      {/* 6 — what does a year look like */}
      <SectionTitle>Your year</SectionTitle>
      <Card>
        <div className="flex items-baseline justify-between gap-3 mb-3.5">
          <div className="fhj-eyebrow min-w-0 leading-snug">{metricField.label}</div>
          <span className="text-[11px] shrink-0" style={{ color: C.subtle }}>Last 12 months</span>
        </div>
        {heatMonths ? (
          <YearHeatmap
            months={heatMonths}
            dir={metricField.dir}
            metricLabel={metricField.label}
            today={t0}
            onFeedback={feedback}
            onOpenDay={viewer ? undefined : openLog} />
        ) : (
          <ChartEmpty height={150}
            title={`The year block colours 1–10 ratings. “${metricField.label}” is measured in ${metricField.unit || "other units"} — pick a rating above to see its year.`} />
        )}
        <Disclosure className="mt-3.5" label="Go further back"
          summary="Every month on record, and the years side by side">
          <LongTermView
            entries={chartEntries} metricKey={metricField.k} metricLabel={metricField.label}
            dir={metricField.dir} today={t0} tint={tpl.color} palette={CHART_PALETTE(tpl.color)}
            tooltipProps={tooltipProps} axisTick={axisTick} chartAnim={chartAnim}
            onFeedback={feedback} />
        </Disclosure>
      </Card>

      {/* 7 — what kind of days are they */}
      <SectionTitle>Spread of days</SectionTitle>
      <Card>
        <div className="flex items-baseline justify-between gap-3 mb-3.5">
          <div className="fhj-eyebrow min-w-0 leading-snug">{metricField.label}</div>
          <span className="text-[11px] shrink-0" style={{ color: C.subtle }}>{range.label}</span>
        </div>
        {metricField.type === "scale" ? (
          <ScoreDistribution stats={dist} dir={metricField.dir} metricLabel={metricField.label}
            rangeDays={range.days} onFeedback={feedback} />
        ) : (
          <ChartEmpty height={150}
            title={`The spread is drawn over the 1–10 scale. “${metricField.label}” is measured in ${metricField.unit || "other units"}.`} />
        )}
      </Card>

      {/* 8 — is anything related.
          There used to be a "Side by side" card here, drawing the pinned
          metrics next to each other while Trend drew only the first one. Two
          cards, one chart's worth of information, and the one at the top of
          the screen was the one that answered nothing. Trend draws them all
          now, and this section goes back to being the only thing below it
          that asks a different question. */}
      <SectionTitle>{RELATIONSHIP_COPY.heading}</SectionTitle>
      <Card>
        <RelationshipExplorer
          entries={chartEntries}
          outcomes={outcomeFields}
          factors={explorerFields}
          start={range.start} end={range.end}
          tint={tpl.color}
          tooltipProps={tooltipProps} axisTick={axisTick}
          onFeedback={feedback} />
      </Card>

      {/* ---------- What the weather was doing ----------
          Coincidences between the person's key metric and the environment
          around it. Every one of them is a count of their own days, tappable,
          and lights those days up everywhere else in the app. */}
      <ContextSection
        entries={entries}
        context={context}
        keyField={keyField}
        units={profile.context?.units}
        onHighlight={onHighlight} />

      {/* ---------- Possible Patterns ----------
          The other half of the same idea: what the app noticed without being
          asked, plus optional AI observations. */}
      <PatternsSection tpl={tpl} entries={entries} insights={insights}
        ai={ai} setAi={setAi} goSettings={goSettings} viewer={viewer} aiAutoRun={aiAutoRun} />

      {/* reports entry points */}
      {(() => {
        const week = pickReportRange(entries, "week");
        const month = pickReportRange(entries, "month");
        if (!week && !month && (!reports || !reports.length)) return null;
        return (
          <>
            <SectionTitle>Reports</SectionTitle>
            <div className="flex flex-col gap-2">
              {week && (
                <button onClick={() => goReport("week")} className="w-full text-left">
                  <Card tappable className="!p-3.5" style={{ padding: "0.875rem", borderLeft: `3px solid ${C.accent}` }}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold">Your week is ready</div>
                        <div className="text-[11px] mt-1" style={{ color: C.subtle }}>{week.label}</div>
                      </div>
                      <Icon name="right" size={16} color={C.subtle} />
                    </div>
                  </Card>
                </button>
              )}
              {month && (
                <button onClick={() => goReport("month")} className="w-full text-left">
                  <Card tappable className="!p-3.5" style={{ padding: "0.875rem", borderLeft: `3px solid ${C.accent}` }}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold">Your month is ready</div>
                        <div className="text-[11px] mt-1" style={{ color: C.subtle }}>{month.label}</div>
                      </div>
                      <Icon name="right" size={16} color={C.subtle} />
                    </div>
                  </Card>
                </button>
              )}
            </div>
            <ReportHistoryList reports={reports} openSaved={openSavedReport} deleteSaved={deleteSavedReport} />
          </>
        );
      })()}

      {/* photo progress */}
      {photoFields.length > 0 && (
        <>
          <SectionTitle>Photo progress</SectionTitle>
          {photoItems.length === 0 ? (
            <Card>
              <div className="text-sm mb-3.5 leading-relaxed" style={{ color: C.sub }}>
                No photos yet — capture your first in today's log.
              </div>
              <Button variant="secondary" block onClick={() => openLog(t0)}>Go to today's log</Button>
            </Card>
          ) : (
            <button onClick={goGallery} className="w-full text-left" aria-label="Open photo progress">
              <Card tappable className="!p-3.5" style={{ padding: "0.875rem" }}>
                <div className="flex items-center justify-between mb-2.5 gap-2">
                  <div className="fhj-eyebrow">
                    {photoItems.length} photo{photoItems.length > 1 ? "s" : ""}
                  </div>
                  <div className="text-[11px] shrink-0" style={{ color: C.subtle }}>last · {fmtNice(photoItems[0].date)}</div>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {latestPerField(photoItems).slice(0, 4).map((it) => (
                    <div key={it.field.k} className="rounded-lg overflow-hidden aspect-square">
                      <GalleryThumb id={it.photoId} />
                    </div>
                  ))}
                </div>
              </Card>
            </button>
          )}
        </>
      )}

      {/* recent entries */}
      <SectionTitle>Recent entries</SectionTitle>
      <Card className="!p-0" style={{ padding: 0 }}>
        {recent.length === 0 && (
          <div className="p-5 text-sm leading-relaxed" style={{ color: C.sub }}>
            No entries yet. Your last five days will appear here once you start logging.
          </div>
        )}
        {recent.map((e, i) => {
          const v = e.answers[tpl.keyMetric];
          return (
            <button key={e.id} onClick={() => openLog(e.date)}
              className="fhj-row w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left"
              style={{ borderTop: i > 0 ? `1px solid ${C.line}` : "none" }}>
              <div className="min-w-0">
                <div className="text-sm font-medium">{fmtNice(e.date)}</div>
                {e.notes && <div className="text-xs truncate mt-0.5" style={{ color: C.subtle }}>{e.notes}</div>}
              </div>
              <div className="flex items-center gap-2">
                {v != null && (
                  <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ background: colorFor(v, keyField.dir), color: readableInk(colorFor(v, keyField.dir)) }}>{v}</span>
                )}
                <Icon name="right" size={16} color={C.sub} />
              </div>
            </button>
          );
        })}
      </Card>

      {/* backup nudge — the one thing this app can't do for you */}
      {nudge.show && (
        <Card className="mt-3" style={{ borderLeft: `3px solid ${C.accent}` }}>
          <div className="fhj-eyebrow mb-1.5">Keep a copy</div>
          <p className="text-sm leading-relaxed mb-4" style={{ color: C.sub }}>
            {nudge.reason === "never"
              ? `${entries.length} days are logged here and nowhere else. Save a backup file so a lost or wiped phone doesn't take them with it.`
              : `Your last backup was ${nudge.ageDays} days ago, and you've logged since. A fresh one takes a couple of seconds.`}
          </p>
          <Button variant="primary" block onClick={goSettings}>Back up now</Button>
        </Card>
      )}

      <Button variant="outline" block icon="download" className="mt-6" onClick={goExport}>
        Export data
      </Button>
    </div>
  );
}


/* ============================================================
   One flare, in full
   ============================================================

   The screen a person opens when they are trying to remember — or trying to
   describe to somebody else — what a particular bad stretch was actually like.

   Order matters here too. It opens with the shape of it: the numbers, then the
   chart with the flare shaded and a fortnight of context on either side, so
   "how far above normal was this" is answered by looking rather than by
   arithmetic. Then the things that make it a memory rather than a statistic —
   what you wrote, what you photographed, what you were taking, and the day-by-
   day record underneath.

   The context window is the reason this chart is not the one on Insights. A
   flare drawn from its own first day to its own last day always looks like a
   flare; drawn with the fortnight before it, it looks like what happened. */

function EpisodeStat({ label, value, unit, detail, tone }) {
  return (
    <div className="fhj-dist-stat" style={{ background: C.faint }}>
      <div className="fhj-eyebrow leading-snug">{label}</div>
      <div className="flex items-baseline gap-1 mt-1.5">
        <span className="font-display text-[1.5rem] leading-none tabular-nums"
          style={{ color: tone || C.ink }}>{value}</span>
        {unit && <span className="text-[11px]" style={{ color: C.subtle }}>{unit}</span>}
      </div>
      {detail && <div className="text-[11px] mt-1.5 leading-snug" style={{ color: C.subtle }}>{detail}</div>}
    </div>
  );
}

function EpisodeDetailScreen({
  profile, entries, episodes, episodeId, food = [], bowel = [], routine = [], routineItems = [],
  openLog, goBack, onEnd, onUpdate, onDelete, viewer, context = [], onHighlight,
}) {
  const tpl = getProfileTemplate(profile);
  const t0 = todayStr();
  const ep = episodes.find((e) => e.id === episodeId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => ({ title: ep?.title || "", notes: ep?.notes || "" }));

  if (!ep) {
    return (
      <div className="px-4 pb-8 pt-4">
        <EmptyState icon="calendar" title="That flare is gone"
          text="It was removed, or this link is from an older version of the journal."
          actionLabel="Back to Insights" onAction={goBack} />
      </div>
    );
  }

  const field = getField(tpl, ep.metric) || getField(tpl, tpl.keyMetric);
  const dir = field?.dir;
  const forMetric = sortEpisodes(episodes.filter((e) => e.metric === ep.metric));
  const s = episodeStats(ep, { entries, today: t0, dir, all: forMetric });
  const end = episodeLastDay(ep, t0);

  /* A fortnight either side, clipped to the journal's own edges. */
  const ctxStart = addDays(ep.start, -14);
  const ctxEnd = addDays(end, 14) > t0 ? t0 : addDays(end, 14);
  const chartData = seriesBetween(entries, ep.metric, ctxStart, ctxEnd);
  const bands = [{ id: ep.id, from: ep.start, to: end, open: episodeIsOpen(ep) }];

  const days = datesBetween(ep.start, end);
  const daySet = new Set(days);
  const rows = entries.filter((e) => daySet.has(e.date)).sort((a, b) => (a.date < b.date ? 1 : -1));
  const notes = rows.filter((e) => (e.notes || "").trim());
  const photos = buildPhotoItems(tpl, entries).filter((p) => daySet.has(p.date));
  const doses = routine.filter((r) => daySet.has(r.date) && !r.skipped);
  const doseTally = useMemo(() => {
    const by = new Map();
    for (const d of doses) {
      const k = d.itemId || d.name;
      const row = by.get(k) || { name: d.name, kind: d.kind, n: 0, days: new Set() };
      row.n += 1; row.days.add(d.date);
      by.set(k, row);
    }
    return [...by.values()].sort((a, b) => b.n - a.n);
  }, [doses.length, ep.id]);

  const save = () => {
    onUpdate(ep.id, { title: draft.title.trim() || "Flare", notes: draft.notes.trim() || undefined });
    setEditing(false);
    feedback("save");
  };

  return (
    <div className="px-4 pb-8 fhj-stagger">
      <div className="flex items-start justify-between gap-3 pt-1 pb-1">
        <div className="min-w-0">
          <div className="fhj-eyebrow">{field ? field.label : ep.metric}</div>
          <h1 className="font-display text-[1.625rem] leading-tight mt-1 break-words">{ep.title}</h1>
          <div className="text-[12px] mt-1.5" style={{ color: C.subtle }}>
            {fmtNice(ep.start)} – {ep.end ? fmtNice(ep.end) : "now"} · {durationLabel(s.days)}
            {s.open && " · ongoing"}
          </div>
        </div>
        {s.open && (
          <Badge tone="accent">Ongoing</Badge>
        )}
      </div>

      {!viewer && s.open && (
        <Button variant="primary" block className="mt-3" onClick={() => onEnd(ep.id)}>
          End this flare today
        </Button>
      )}

      {/* how it went */}
      <div className="fhj-dist-stats mt-3.5">
        <EpisodeStat label="Length" value={s.days} unit="days"
          detail={`${s.loggedDays} logged · ${Math.round(s.coverage * 100)}% covered`} />
        <EpisodeStat label="Peak" value={s.peak ?? "–"}
          tone={s.peak != null ? colorFor(s.peak, dir) : undefined}
          detail={s.peakDate ? fmtNice(s.peakDate) : "nothing logged yet"} />
        <EpisodeStat label="Average" value={fmt1(s.average)}
          detail={s.median != null ? `middle day ${fmt1(s.median)}` : "nothing rated yet"} />
        <EpisodeStat label="Hard days" value={s.hardDays}
          tone={s.hardDays ? C.bad : undefined}
          detail={s.loggedDays ? `${hardLabel(dir)} · of ${s.loggedDays} logged` : hardLabel(dir)} />
      </div>

      {/* A flare marked before the day is logged has a length and nothing else.
          Saying so — and offering the one tap that fixes it — beats four
          em-dashes and an explanation nobody reads. */}
      {s.loggedDays === 0 && !viewer && (
        <Card className="mt-2.5" style={{ borderLeft: `3px solid ${C.accent}` }}>
          <p className="text-sm leading-relaxed" style={{ color: C.sub }}>
            None of these days has a {field ? field.label.toLowerCase() : "rating"} yet, so there is
            nothing to average. Rate {s.open ? "today" : "one of them"} and this fills in.
          </p>
          <Button variant="outline" block className="mt-3.5"
            onClick={() => openLog(s.open ? t0 : ep.start)}>
            {s.open ? "Log today" : `Log ${fmtNice(ep.start)}`}
          </Button>
        </Card>
      )}

      {/* The flare's own weather, and the way into every other surface that
          draws these days. Tapping it is the same illuminate the coincidences
          and the experiments use — one set of days, one set of highlights, the
          whole way through the app. */}
      {(() => {
        const span = datesBetween(ep.start, end);
        const weather = context.filter((c) => c.date >= ep.start && c.date <= end);
        if (!span.length) return null;
        return (
          <Card className="mt-2.5">
            <div className="fhj-eyebrow mb-2">The days themselves</div>
            {weather.length > 3 && (
              <>
                <TempTrace rows={weather} markDate={ep.start} />
                <p className="text-[11.5px] leading-relaxed mt-1.5" style={{ color: C.subtle }}>
                  {contextLineFor(weather[Math.floor(weather.length / 2)], profile.context?.units)
                    || "The weather across these days."}
                </p>
              </>
            )}
            {onHighlight && (
              <Button variant="outline" block className={weather.length > 3 ? "mt-3" : ""}
                onClick={() => onHighlight(span, `${ep.title} — ${fmtNice(ep.start)} to ${fmtNice(end)}`)}>
                Light these {span.length} days up
              </Button>
            )}
          </Card>
        );
      })()}

      {(s.baseline != null || s.after != null || s.sincePrevious != null) && (
        <Card className="mt-2.5">
          <div className="fhj-eyebrow mb-2.5">In context</div>
          <div className="flex flex-col gap-2">
            {s.baseline != null && (
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[12.5px]" style={{ color: C.sub }}>
                  The fortnight before <span style={{ color: C.subtle }}>({s.baselineDays} logged)</span>
                </span>
                <span className="tabular-nums text-sm font-semibold shrink-0">{fmt1(s.baseline)}</span>
              </div>
            )}
            {s.average != null && (
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[12.5px]" style={{ color: C.sub }}>During</span>
                <span className="tabular-nums text-sm font-semibold shrink-0"
                  style={{ color: s.vsBaseline != null && s.vsBaseline > 0.4 ? C.alert : C.ink }}>
                  {fmt1(s.average)}
                  {s.vsBaseline != null && Math.abs(s.vsBaseline) >= 0.05 && (
                    <span className="text-[11px] font-normal ml-1.5" style={{ color: C.subtle }}>
                      {s.vsBaseline > 0 ? "+" : "−"}{fmt1(Math.abs(s.vsBaseline))}
                    </span>
                  )}
                </span>
              </div>
            )}
            {s.after != null && (
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[12.5px]" style={{ color: C.sub }}>
                  The fortnight after <span style={{ color: C.subtle }}>({s.afterDays} logged)</span>
                </span>
                <span className="tabular-nums text-sm font-semibold shrink-0">{fmt1(s.after)}</span>
              </div>
            )}
          </div>
          {s.sincePrevious != null && (
            <p className="text-[11.5px] leading-relaxed mt-3" style={{ color: C.subtle }}>
              {s.sincePrevious} clear {s.sincePrevious === 1 ? "day" : "days"} between the end of the
              last flare and the start of this one.
            </p>
          )}
        </Card>
      )}

      {/* the shape of it, with a fortnight either side */}
      <SectionTitle>{field ? field.label : "The metric"}</SectionTitle>
      <Card>
        <div className="fhj-cmp-plot" style={{ height: 200 }}>
          <ChartBands data={chartData} bands={bands} inset={{ left: 34, right: 8 }} />
          <ResponsiveContainer>
            <ComposedChart data={chartData} margin={{ top: 10, right: 8, left: -2, bottom: 0 }}>
              <ChartFade id="fhjEpFade" color={tpl.color} />
              <CartesianGrid stroke={C.grid} vertical={false} strokeDasharray="2 5" />
              <XAxis dataKey="d" tickFormatter={fmtShort} minTickGap={30}
                tick={axisTick()} axisLine={false} tickLine={false} tickMargin={8} />
              <YAxis domain={[1, 10]} ticks={[1, 4, 7, 10]}
                tick={axisTick()} axisLine={false} tickLine={false} width={34} />
              <Tooltip labelFormatter={(d) => fmtNice(d)}
                formatter={(v, name) => [v, name === "v" ? (field ? field.label : "value") : "7-day avg"]}
                {...tooltipProps()} />
              <Area type="monotone" dataKey="v" stroke="none" fill="url(#fhjEpFade)"
                tooltipType="none" connectNulls {...chartAnim()} />
              <Line type="monotone" dataKey="avg" stroke={C.avgLine} strokeWidth={1.5} strokeOpacity={0.85}
                strokeDasharray="4 5" dot={false} connectNulls {...chartAnim()} />
              <Line type="monotone" dataKey="v" stroke={tpl.color} strokeWidth={2.5}
                strokeLinecap="round" dot={{ r: 2, fill: tpl.color, strokeWidth: 0 }}
                activeDot={{ r: 5, fill: tpl.color, stroke: C.card, strokeWidth: 2.5 }}
                connectNulls {...chartAnim()} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="fhj-caption mt-2">
          Shaded: the flare. Either side of it, the fortnight before and after — so
          how far above normal it ran is something you can see.
        </div>
      </Card>

      {/* what you wrote */}
      <SectionTitle>Notes</SectionTitle>
      <Card>
        {editing ? (
          <>
            <label className="fhj-eyebrow block mb-1.5" htmlFor="fhj-ep-title">Title</label>
            <input id="fhj-ep-title" className="fhj-input" value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              placeholder="Flare" maxLength={120} />
            <label className="fhj-eyebrow block mb-1.5 mt-3.5" htmlFor="fhj-ep-notes">What was going on</label>
            <textarea id="fhj-ep-notes" className="fhj-input" rows={4} value={draft.notes}
              onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
              placeholder="What started it, what you tried, what your doctor said…" maxLength={4000} />
            <div className="flex gap-2 mt-3.5">
              <Button variant="primary" className="flex-1" onClick={save}>Save</Button>
              <Button variant="secondary" className="flex-1" onClick={() => {
                setDraft({ title: ep.title, notes: ep.notes || "" }); setEditing(false);
              }}>Cancel</Button>
            </div>
          </>
        ) : (
          <>
            {ep.notes ? (
              <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: C.sub }}>{ep.notes}</p>
            ) : (
              <p className="text-sm leading-relaxed" style={{ color: C.subtle }}>
                Nothing written about this one yet. A sentence now is worth a lot at the next appointment.
              </p>
            )}
            {!viewer && (
              <Button variant="outline" block className="mt-3.5" onClick={() => {
                setDraft({ title: ep.title, notes: ep.notes || "" }); setEditing(true);
              }}>
                {ep.notes ? "Edit" : "Write about this flare"}
              </Button>
            )}
          </>
        )}
        {notes.length > 0 && (
          <Disclosure className="mt-3.5" label="What you wrote on the days"
            summary={`${notes.length} ${notes.length === 1 ? "day has" : "days have"} a note`}>
            <div className="flex flex-col gap-3">
              {notes.map((e) => (
                <button key={e.id} onClick={() => openLog(e.date)} className="text-left">
                  <div className="text-[11px]" style={{ color: C.subtle }}>{fmtNice(e.date)}</div>
                  <div className="text-[13px] leading-relaxed mt-0.5" style={{ color: C.sub }}>{e.notes}</div>
                </button>
              ))}
            </div>
          </Disclosure>
        )}
      </Card>

      {photos.length > 0 && (
        <>
          <SectionTitle>Photos from these days</SectionTitle>
          <Card>
            <div className="grid grid-cols-3 gap-1.5">
              {photos.slice(0, 9).map((it) => (
                <div key={it.photoId} className="rounded-lg overflow-hidden aspect-square">
                  <GalleryThumb id={it.photoId} />
                </div>
              ))}
            </div>
            <div className="fhj-caption mt-2">
              {photos.length} {photos.length === 1 ? "photo" : "photos"} taken during this flare
              {photos.length > 9 && " · first nine shown"}
            </div>
          </Card>
        </>
      )}

      {doseTally.length > 0 && (
        <>
          <SectionTitle cat="fhj-cat-routine">What you were taking</SectionTitle>
          <Card className="!p-0" style={{ padding: 0 }}>
            {doseTally.slice(0, 12).map((r, i) => (
              <div key={r.name + i} className="flex items-center justify-between gap-3 px-4 py-3"
                style={{ borderTop: i > 0 ? `1px solid ${C.line}` : "none" }}>
                <span className="text-[13.5px] font-medium truncate">{r.name}</span>
                <span className="text-[11.5px] shrink-0 tabular-nums" style={{ color: C.subtle }}>
                  {r.days.size} of {s.days} days
                </span>
              </div>
            ))}
          </Card>
          <p className="text-[11.5px] leading-relaxed mt-2" style={{ color: C.subtle }}>
            What was logged during these days — not a claim that any of it helped or didn't.
          </p>
        </>
      )}

      {/* day by day */}
      <SectionTitle>Day by day</SectionTitle>
      <Card className="!p-0" style={{ padding: 0 }}>
        {rows.length === 0 && (
          <div className="p-5 text-sm leading-relaxed" style={{ color: C.sub }}>
            No days were logged during this flare.
          </div>
        )}
        {rows.map((e, i) => {
          const v = e.answers[ep.metric];
          return (
            <button key={e.id} onClick={() => openLog(e.date)}
              className="fhj-row w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
              style={{ borderTop: i > 0 ? `1px solid ${C.line}` : "none" }}>
              <div className="min-w-0">
                <div className="text-[13.5px] font-medium">{fmtNice(e.date)}</div>
                {e.notes && <div className="text-[11px] truncate mt-0.5" style={{ color: C.subtle }}>{e.notes}</div>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {typeof v === "number" && (
                  <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ background: colorFor(v, dir), color: readableInk(colorFor(v, dir)) }}>{v}</span>
                )}
                <Icon name="right" size={16} color={C.sub} />
              </div>
            </button>
          );
        })}
      </Card>

      {!viewer && (
        <Button variant="danger" block icon="trash" className="mt-6" onClick={() => onDelete(ep)}>
          Delete this flare
        </Button>
      )}
      <p className="text-[11.5px] leading-relaxed mt-2.5" style={{ color: C.subtle }}>
        Deleting the marker leaves every day's entry exactly as it is — it only stops
        these days being counted as one stretch.
      </p>
    </div>
  );
}

/* ============================================================
   Calendar screen
   ============================================================ */

function CalendarScreen({ profile, entries, openLog, embedded = false }) {
  const tpl = getProfileTemplate(profile);
  const keyField = getField(tpl, tpl.keyMetric);
  const [offset, setOffset] = useState(0);
  const now = new Date();
  const view = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const y = view.getFullYear(), m = view.getMonth();
  const firstDow = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const byDate = new Map(entries.map((e) => [e.date, e]));
  const t0 = todayStr();
  const monthLabel = view.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  if (entries.length === 0) {
    if (embedded) return null;
    return (
      <div className="px-4 pb-8 pt-4">
        <EmptyState icon="calendar" title="Nothing logged yet"
          text="Your calendar fills in as you log. Each day gets a colored dot from your key metric."
          actionLabel="Log today" onAction={() => openLog(todayStr())} />
      </div>
    );
  }

  return (
    <div className={embedded ? "pt-4" : "px-4 pb-8 pt-3"}>
      <Card>
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => { feedback("nav"); setOffset(offset - 1); }} aria-label="previous month"
            className="fhj-icon-btn" style={{ background: C.faint }}>
            <Icon name="left" size={17} />
          </button>
          <div className="font-display text-lg">{monthLabel}</div>
          <button onClick={() => { feedback("nav"); setOffset(offset + 1); }} disabled={offset >= 0} aria-label="next month"
            className="fhj-icon-btn" style={{ background: C.faint }}>
            <Icon name="right" size={16} />
          </button>
        </div>
        <div className="grid grid-cols-7 text-center text-[10px] font-semibold uppercase mb-1" style={{ color: C.sub }}>
          {["S", "M", "T", "W", "T2", "F", "S2"].map((d) => <div key={d}>{d[0]}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-y-1">
          {cells.map((d, i) => {
            if (d == null) return <div key={"e" + i} />;
            const ds = localDateStr(new Date(y, m, d));
            const future = ds > t0;
            const e = byDate.get(ds);
            const v = e?.answers[tpl.keyMetric];
            return (
              <button key={ds} disabled={future} onClick={() => openLog(ds)}
                className="flex flex-col items-center justify-center gap-1 py-1 rounded-xl disabled:opacity-30"
                style={{
                  minHeight: "var(--fhj-tap)",
                  outline: ds === t0 ? `1.5px solid ${tpl.color}` : "none", outlineOffset: -1,
                }}>
                <span className="text-xs">{d}</span>
                {e ? (
                  v != null ? (
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: colorFor(v, keyField.dir) }} />
                  ) : (
                    <span className="w-2.5 h-2.5 rounded-full" style={{ border: `1.5px solid ${C.sub}` }} />
                  )
                ) : (
                  <span className="w-2.5 h-2.5" />
                )}
              </button>
            );
          })}
        </div>
      </Card>
      <Card className="mt-3">
        <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: C.sub }}>
          Legend · {keyField.label}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: C.sub }}>
          {[[C.good, keyField.dir === "pos" ? "high (good)" : "low (mild)"],
            [C.warn, "moderate"],
            [C.alert, "elevated"],
            [C.bad, keyField.dir === "pos" ? "low" : "high (severe)"]].map(([c, l]) => (
            <span key={l} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: c }} />{l}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ border: `1.5px solid ${C.sub}` }} />logged, no rating
          </span>
        </div>
        <div className="text-xs mt-2" style={{ color: C.sub }}>Tap any past day to view or edit its entry.</div>
      </Card>
    </div>
  );
}

/* ============================================================
   History
   ============================================================

   The second of the two tabs. Today is what you are writing; this is
   everything you have written — the month at a glance, the last fortnight in
   words, and the two doors out of it: the trends, and the day-by-day diary.

   It exists because the five-tab bar was a filing cabinet. Calendar, Diary and
   Insights were three separate destinations that all answered one question —
   "what happened before now" — and asking somebody to remember which shelf a
   thing lived on is a tax charged on every single visit. */

function HistoryDayRow({ entry, tpl, keyField, food, bowel, routine, onOpen, ctx, washing, isLit }) {
  const v = keyField ? entry.answers?.[keyField.k] : null;
  const marks = [];
  if (food.some((f) => f.date === entry.date)) marks.push("meals");
  if (routine.some((r) => r.date === entry.date && !r.skipped)) marks.push("routine");
  if (bowel.some((b) => b.date === entry.date)) marks.push("bowel");
  if (entry.photos && Object.values(entry.photos).some((p) => p?.photoId)) marks.push("photo");
  if ((entry.notes || "").trim()) marks.push("note");
  const answered = Object.values(entry.answers || {}).filter((x) => x != null).length;

  return (
    <button type="button" onClick={() => { feedback("nav"); onOpen(entry.date); }}
      className={"fhj-hist-row" + (isLit ? " fhj-lit" : "")}
      style={{ position: "relative" }}>
      {/* The weather, living behind the day. It is drawn first, under
          everything, and its loudness comes from how unusual the day was —
          see contextWash in components/DayContext. */}
      <ContextWash ctx={ctx} scale={washing} />
      <span className="fhj-hist-dot" style={{
        background: v != null ? colorFor(v, keyField?.dir) : "transparent",
        border: v != null ? "none" : `1.5px solid ${C.lineStrong}`,
        color: v != null ? readableInk(colorFor(v, keyField?.dir)) : C.subtle,
      }}>
        {v != null ? v : "–"}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{fmtNice(entry.date)}</span>
        <span className="block text-[11.5px] truncate" style={{ color: C.subtle }}>
          {(entry.notes || "").trim()
            ? entry.notes.trim()
            : marks.length
              ? marks.join(" · ").replace(/^./, (c) => c.toUpperCase())
              : `${answered} ${answered === 1 ? "answer" : "answers"}`}
        </span>
      </span>
      {ctx && (
        <span className="fhj-hist-ctx" title={contextLineFor(ctx)}>
          <SkyGlyph code={ctx.weatherCode} size={14} />
          {ctx.tempMax !== undefined && <span>{Math.round(ctx.tempMax)}°</span>}
        </span>
      )}
      <Icon name="right" size={14} color={C.subtle} />
    </button>
  );
}

function HistoryScreen({
  profile, entries, food = [], bowel = [], routine = [],
  openLog, goInsights, goDiary, goExport, goGallery, goSettings, goSetup, goSun, goLabs,
  goExperiments, viewer, syncStatus, context = [], sun = [], labs = [], lit, onClearLit,
}) {
  const tpl = getProfileTemplate(profile);
  const keyField = getField(tpl, tpl.keyMetric);
  /* When a finding is illuminating a set of days, History shows those days
     rather than the last fortnight. That is the whole cross-feature promise:
     tapping "8 of your 10 hardest days were above 29°C" and arriving on the
     eight days themselves, in order, with their weather behind them. */
  const recent = useMemo(() => {
    const sorted = [...entries].sort((a, b) => (a.date < b.date ? 1 : -1));
    if (lit?.dates?.size) {
      const hits = sorted.filter((e) => lit.dates.has(e.date));
      if (hits.length) return hits.slice(0, 60);
    }
    return sorted.slice(0, 14);
  }, [entries, lit]);
  const washing = useMemo(() => washScale(context), [context]);
  const ctxByDate = useMemo(() => new Map(context.map((c) => [c.date, c])), [context]);
  const traceRows = useMemo(
    () => context.slice(-45),
    [context]
  );

  return (
    <div className="px-4 pb-10">
      {/* A tab screen draws its own header, and Settings lives in it — the
          fifth tab it used to occupy is gone, and a preference is not a
          destination somebody navigates to every day. */}
      <div className="flex items-start justify-between gap-3 pt-5 pb-1">
        <div className="min-w-0">
          <div className="text-[12.5px] font-medium" style={{ color: C.subtle }}>
            {entries.length} {entries.length === 1 ? "day" : "days"} on the record
          </div>
          <h1 className="font-display text-[1.75rem] leading-tight mt-0.5">History</h1>
        </div>
        <div className="flex items-center gap-2 shrink-0 mt-1">
          <SyncAlert status={syncStatus} onOpen={goSettings} />
          <button onClick={goSetup} aria-label="edit survey setup" className="fhj-icon-btn">
            <Icon name="sliders" size={18} color={C.sub} />
          </button>
          <button onClick={goSettings} aria-label="settings" className="fhj-icon-btn">
            <Icon name="gear" size={19} color={C.sub} />
          </button>
        </div>
      </div>

      {lit?.dates?.size ? (
        <div className="fhj-lit-bar mt-3" role="status" aria-label="Illuminated days">
          <span>
            <strong>{lit.dates.size} {lit.dates.size === 1 ? "day" : "days"} lit</strong> · {lit.label}
          </span>
          <button type="button" className="fhj-linkish" onClick={onClearLit}>Clear</button>
        </div>
      ) : null}

      {traceRows.length > 4 && (
        <div className="fhj-hist-trace mt-4">
          <div className="fhj-eyebrow">The weather behind your days</div>
          <TempTrace rows={traceRows} highlight={lit?.dates} markDate={todayStr()} />
        </div>
      )}

      {/* The things people come here to do that aren't "find a day". */}
      <div className="fhj-hist-doors mt-4">
        <button type="button" onClick={() => { feedback("nav"); goInsights(); }}
          className="fhj-hist-door fhj-pop fhj-cat-symptom">
          <span className="fhj-tile-icon"><Icon name="trends" size={18} color="currentColor" /></span>
          <span>
            <span className="fhj-tile-label block">Insights</span>
            <span className="fhj-tile-sub block">Trends and flares</span>
          </span>
        </button>
        <button type="button" onClick={() => { feedback("nav"); goDiary(); }}
          className="fhj-hist-door fhj-pop fhj-cat-food">
          <span className="fhj-tile-icon"><Icon name="food" size={18} color="currentColor" /></span>
          <span>
            <span className="fhj-tile-label block">Diary</span>
            <span className="fhj-tile-sub block">Meals and doses</span>
          </span>
        </button>
        <button type="button" onClick={() => { feedback("nav"); goSun(); }}
          className="fhj-hist-door fhj-pop fhj-cat-symptom">
          <span className="fhj-tile-icon" aria-hidden>☀</span>
          <span>
            <span className="fhj-tile-label block">Sun</span>
            <span className="fhj-tile-sub block">
              {sun.length ? `${sun.length} ${sun.length === 1 ? "session" : "sessions"}` : "Time outside"}
            </span>
          </span>
        </button>
        <button type="button" onClick={() => { feedback("nav"); goLabs(); }}
          className="fhj-hist-door fhj-pop fhj-cat-symptom">
          <span className="fhj-tile-icon" aria-hidden>◎</span>
          <span>
            <span className="fhj-tile-label block">Labs</span>
            <span className="fhj-tile-sub block">
              {labs.length ? `${testsHeld(labs).length} tracked` : "Blood work"}
            </span>
          </span>
        </button>
        <button type="button" onClick={() => { feedback("nav"); goExperiments(); }}
          className="fhj-hist-door fhj-pop fhj-cat-symptom">
          <span className="fhj-tile-icon" aria-hidden>⌁</span>
          <span>
            <span className="fhj-tile-label block">Experiments</span>
            <span className="fhj-tile-sub block">Ask a question</span>
          </span>
        </button>
      </div>

      <CalendarScreen profile={profile} entries={entries} openLog={openLog} embedded />

      {recent.length > 0 && (
        <>
          <div className="fhj-section mt-6 fhj-cat-symptom">
            <h2 className="fhj-section-title">{lit?.dates?.size ? "Lit days" : "Recent days"}</h2>
          </div>
          <Card className="!p-0 mt-1" style={{ padding: 0 }}>
            {recent.map((e, i) => (
              <div key={e.id || e.date} style={{ borderTop: i > 0 ? `1px solid ${C.line}` : "none" }}>
                <HistoryDayRow entry={e} tpl={tpl} keyField={keyField}
                  food={food} bowel={bowel} routine={routine} onOpen={openLog}
                  ctx={ctxByDate.get(e.date)} washing={washing} isLit={!!lit?.dates?.has(e.date)} />
              </div>
            ))}
          </Card>
        </>
      )}

      <div className="flex gap-2 mt-4">
        <Button variant="outline" block icon="camera" onClick={goGallery}>Photos</Button>
        <Button variant="outline" block icon="download" onClick={goExport}>Export</Button>
      </div>
    </div>
  );
}

/* ============================================================
   Export (CSV / XLSX / JSON)
   ============================================================ */

/* serialize / csvEscape / toCSV now live in src/lib/exports.ts (typed). */
function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/* metaCols / wideTable now live in src/lib/exports.ts (typed).
   Thin wrappers keep the historical signatures for all call sites. */
function metaCols(profile, e) {
  return metaColsTyped(profile, getProfileTemplate(profile), e);
}
function wideTable(profile, entries, food = [], routine = []) {
  return buildWideTable(getProfileTemplate(profile), profile, entries, food, routine);
}

/* ============================================================
   The Appointment Pack
   ============================================================

   Ten minutes with a specialist every few months is what this whole journal is
   for, and the question that opens it — "so how have you been?" — is the one
   memory answers worst. It reaches for the last bad week, because that is what
   memory does.

   So the pack is the first thing on the Export screen, above the three file
   formats, and it is one tap from a range to a printable page: what the average
   was and which way it moved, what the days were like, what the flares did,
   what changed, what is being taken, what it looks like, what happened, and —
   last, because it is the part that belongs to the person rather than the app —
   what they want to ask.

   The arithmetic lives in src/lib/appointmentPack.ts and the paper lives in
   src/components/AppointmentPackView.tsx. What is here is the wiring: which
   metrics the pack is allowed to talk about, which photos make a before and
   after, and the two pickers that keep both of those choices the user's. */

/** Everything numeric the person tracks, charted metrics first — that order is
    the one they already chose on Insights, so the three biggest changes come
    out of the metrics they care about rather than alphabetically. */
function packMetricsFor(tpl) {
  const out = [], seen = new Set();
  const add = (k) => {
    const f = getField(tpl, k);
    if (!f || seen.has(k)) return;
    if (f.type !== "scale" && f.type !== "number") return;
    seen.add(k);
    out.push({ key: f.k, label: f.label, dir: f.dir, unit: f.unit, scale: f.type === "scale" });
  };
  for (const k of tpl.chartMetrics) add(k);
  for (const k of tpl.dashboardMetrics) add(k);
  for (const f of tpl.fields) add(f.k);
  return out;
}

/** Every photo field that can show this range as a before and an after.

    "Before" is the last shot taken on or before the range starts, falling back
    to the earliest one inside it — a photo from the week before the last
    appointment is a truer "before" than the first one taken after it, and using
    the range's own first photo when there is nothing earlier is the honest
    second choice. Both dates are printed either way. */
function packPhotoPairs(tpl, entries, range) {
  const items = buildPhotoItems(tpl, entries); // newest first
  const groups = [];
  for (const f of tpl.fields.filter((x) => x.type === "photo")) {
    const mine = items.filter((it) => it.field.k === f.k)
      .slice().sort((a, b) => (a.date < b.date ? -1 : 1)); // oldest first
    const inRange = mine.filter((it) => it.date >= range.start && it.date <= range.end);
    const after = inRange[inRange.length - 1];
    if (!after) continue;
    const earlier = mine.filter((it) => it.date <= range.start);
    const before = earlier.length ? earlier[earlier.length - 1] : inRange[0];
    if (!before || before.photoId === after.photoId) continue;
    groups.push({
      fieldKey: f.k,
      label: f.label,
      spot: bodyPartLabel(f) || f.label,
      ratingLabel: linkedLabel(f, tpl),
      before: { photoId: before.photoId, date: before.date, rating: before.rating },
      after: { photoId: after.photoId, date: after.date, rating: after.rating },
      apart: daySpan(before.date, after.date) - 1,
    });
  }
  return groups;
}

function PackPhoto({ side }) {
  const src = usePhoto(side.photoId, "full");
  if (src === undefined) return <div className="fhj-shimmer rounded-xl" style={{ aspectRatio: "3 / 4", background: C.faint }} />;
  if (!src) {
    return (
      <div className="rounded-xl flex items-center justify-center text-[11px]"
        style={{ aspectRatio: "3 / 4", background: C.faint, color: C.sub }}>
        Photo missing
      </div>
    );
  }
  return <img src={src} alt={`${fmtNice(side.date)}`} />;
}

/* ---------- the pack screen ---------- */

function AppointmentPackScreen({ db, setDb, params, goBack, viewer }) {
  const profile = db.profile;
  const tpl = getProfileTemplate(profile);
  const entries = entriesFor(db);
  const t0 = todayStr();
  const range = params.range || rangeOfDays(30, t0);
  const prefs = useMemo(() => sanitizePackPrefs(profile.appointment), [profile.appointment]);
  const [picking, setPicking] = useState(null); // "notes" | "photo" | null
  const canEdit = !viewer && !!setDb;

  const savePrefs = (patch) => {
    if (!canEdit) return;
    setDb((prev) => ({
      ...prev,
      profile: {
        ...prev.profile,
        appointment: sanitizePackPrefs({ ...sanitizePackPrefs(prev.profile.appointment), ...patch }),
        updatedAt: new Date().toISOString(),
      },
    }));
  };

  const metrics = useMemo(() => packMetricsFor(tpl), [tpl]);
  const primary = useMemo(() => {
    const pinned = (profile.pinnedMetrics || [])[0];
    return metrics.find((m) => m.key === pinned)
      || metrics.find((m) => m.key === tpl.keyMetric)
      || metrics[0]
      || { key: tpl.keyMetric, label: "Key metric" };
  }, [metrics, profile.pinnedMetrics, tpl.keyMetric]);

  const pairs = useMemo(() => packPhotoPairs(tpl, entries, range), [tpl, entries, range.start, range.end]);
  const photo = useMemo(() => {
    if (prefs.photoField === "none") return null;
    return pairs.find((g) => g.fieldKey === prefs.photoField) || pairs[0] || null;
  }, [pairs, prefs.photoField]);

  const notes = useMemo(() => candidateNotes(entries, range), [entries, range.start, range.end]);

  const pack = useMemo(() => buildAppointmentPack({
    today: t0, range, entries, primary, metrics,
    episodes: db.episodes || [],
    routineItems: db.routineItems || [], routineLogs: db.routine || [],
    /* Two of the three things a clinician opens with are now in the journal:
       what the bloods said, and how much daylight somebody actually got. */
    labs: db.labs || [], sun: db.sun || [],
    sections: prefs.sections, noteDates: prefs.noteDates, questions: prefs.questions,
    photo,
  }), [t0, range.start, range.end, entries, primary, metrics, db.episodes, db.routineItems, db.routine, db.labs, db.sun, prefs, photo]);

  const onCount = PACK_SECTIONS.filter((sec) => pack.sections[sec.key] !== false).length;

  const toggleNote = (date) => {
    const has = prefs.noteDates.includes(date);
    feedback(has ? "nav" : "select");
    savePrefs({ noteDates: has ? prefs.noteDates.filter((d) => d !== date) : [...prefs.noteDates, date] });
  };

  return (
    <div className="pb-10">
      <div className="no-print px-4 pt-3">
        <Card className="fhj-pack-cta">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="fhj-eyebrow">Ready to print</div>
              <div className="font-display text-lg leading-tight mt-1">{range.label}</div>
              <div className="text-[11px] mt-1" style={{ color: C.sub }}>
                {range.start} to {range.end} · {pageLabel(pack).toLowerCase()}
              </div>
            </div>
            <button onClick={() => { feedback("save"); window.print(); }}
              className="fhj-btn fhj-btn-primary shrink-0">
              Print / PDF
            </button>
          </div>
        </Card>

        <Disclosure className="mt-2"
          label="Choose what's in it"
          summary={`${onCount} of ${PACK_SECTIONS.length} sections${pack.omitted.length ? ` · ${pack.omitted.length} with nothing to show` : ""}`}>
          {PACK_SECTIONS.map((sec) => {
            const why = pack.omitted.find((o) => o.key === sec.key);
            return (
              <SwitchRow key={sec.key}
                on={pack.sections[sec.key] !== false}
                disabled={!canEdit}
                onChange={(v) => {
                  feedback("select");
                  savePrefs({ sections: { ...prefs.sections, [sec.key]: v } });
                }}
                label={sec.label}
                desc={why && pack.sections[sec.key] !== false ? why.reason : sec.hint} />
            );
          })}
        </Disclosure>
      </div>

      <div className="px-4 pt-3">
        <AppointmentPackView
          pack={pack}
          meta={{
            name: profile.name, age: profileAge(profile), setup: tpl.label,
            appName: APP_NAME, version: APP_VERSION, printedOn: t0,
            disclaimer: DISCLAIMER, patternNote: PATTERN_NOTE,
          }}
          renderPhoto={(side) => <PackPhoto side={side} />}
          onQuestionsChange={canEdit ? ((questions) => savePrefs({ questions })) : undefined}
          onChooseNotes={canEdit && notes.length ? (() => setPicking("notes")) : undefined}
          onChoosePhoto={canEdit && pairs.length ? (() => setPicking("photo")) : undefined}
          onFeedback={feedback}
        />
      </div>

      <div className="no-print px-4">
        <Card className="mt-3">
          <div className="text-[13px] font-semibold mb-1">After the appointment</div>
          <p className="text-xs leading-relaxed mb-3" style={{ color: C.sub }}>
            Marking the date is what makes the next pack cover exactly the time since this visit —
            nothing else uses it.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => { feedback("save"); savePrefs({ lastAppointment: t0 }); toast({ text: "Saved — the next pack starts from today" }); }}
              disabled={!canEdit || prefs.lastAppointment === t0}
              className="fhj-btn fhj-btn-secondary">
              {prefs.lastAppointment === t0 ? "Today is marked" : "My appointment was today"}
            </button>
            <label className="flex items-center gap-2 text-[11px]" style={{ color: C.subtle }}>
              Another day
              <input type="date" value={prefs.lastAppointment || ""} max={t0} disabled={!canEdit}
                aria-label="Date of my last appointment"
                onChange={(e) => savePrefs({ lastAppointment: e.target.value || null })}
                className="fhj-input" style={{ width: "auto" }} />
            </label>
          </div>
        </Card>
        <button onClick={goBack} className="fhj-btn fhj-btn-ghost fhj-btn-block mt-2">Back to Export</button>
      </div>

      {picking === "notes" && (
        <Modal title="Pick the notes to print" onClose={() => setPicking(null)}
          eyebrow={`${prefs.noteDates.length} chosen · up to 6`}>
          <p className="text-xs leading-relaxed mb-3" style={{ color: C.sub }}>
            Nothing is chosen for you — these are your words, and which of them a doctor reads is
            your call.
          </p>
          <div className="flex flex-col">
            {notes.map((n) => {
              const on = prefs.noteDates.includes(n.date);
              return (
                <button key={n.date} onClick={() => toggleNote(n.date)}
                  aria-pressed={on} aria-label={`Include the note from ${fmtNice(n.date)}`}
                  className="text-left py-2.5 px-1"
                  style={{ borderTop: `1px solid ${C.line}` }}>
                  <div className="flex items-center gap-2">
                    <span className="fhj-check-box" aria-hidden="true"
                      style={{ background: on ? C.accent : "transparent", borderColor: on ? C.accent : C.line }}>
                      {on ? <Icon name="check" size={12} color={C.onAccent} /> : null}
                    </span>
                    <span className="text-[11px] font-semibold" style={{ color: C.sub }}>{fmtNice(n.date)}</span>
                  </div>
                  <div className="text-[13px] leading-snug mt-1">{n.text.slice(0, 220)}</div>
                </button>
              );
            })}
          </div>
        </Modal>
      )}

      {picking === "photo" && (
        <Modal title="Pick the before and after" onClose={() => setPicking(null)}>
          <div className="flex flex-col gap-2">
            {pairs.map((g) => (
              <button key={g.fieldKey}
                onClick={() => { feedback("select"); savePrefs({ photoField: g.fieldKey }); setPicking(null); }}
                className="text-left rounded-xl px-3 py-2.5"
                style={{
                  background: C.faint,
                  border: `1.5px solid ${(photo?.fieldKey === g.fieldKey) ? C.accent : C.line}`,
                }}>
                <div className="text-sm font-semibold">{g.spot}</div>
                <div className="text-[11px] mt-0.5" style={{ color: C.sub }}>
                  {fmtNice(g.before.date)} → {fmtNice(g.after.date)} · {g.apart} days apart
                </div>
              </button>
            ))}
            <button onClick={() => { feedback("nav"); savePrefs({ photoField: "none" }); setPicking(null); }}
              className="fhj-btn fhj-btn-ghost">No photos in this pack</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ---------- the entry point on Export ---------- */

function AppointmentPackCard({ db, setDb, goPack }) {
  const t0 = todayStr();
  const prefs = useMemo(() => sanitizePackPrefs(db.profile.appointment), [db.profile.appointment]);
  const [kind, setKind] = useState(prefs.lastAppointment ? "appt" : "30");
  const [from, setFrom] = useState(addDays(t0, -29));
  const [to, setTo] = useState(t0);

  const range = useMemo(() => {
    if (kind === "appt" && prefs.lastAppointment) return rangeSinceAppointment(prefs.lastAppointment, t0);
    if (kind === "90") return rangeOfDays(90, t0);
    if (kind === "custom") return rangeCustom(from, to);
    return rangeOfDays(30, t0);
  }, [kind, prefs.lastAppointment, from, to, t0]);

  const entries = entriesFor(db);
  const logged = entries.filter((e) => e.date >= range.start && e.date <= range.end).length;
  const flares = (db.episodes || []).filter((ep) => {
    const last = ep.end || t0;
    return !(ep.start > range.end || last < range.start);
  }).length;

  const setLast = (value) => {
    if (!setDb) return;
    setDb((prev) => ({
      ...prev,
      profile: {
        ...prev.profile,
        appointment: sanitizePackPrefs({ ...sanitizePackPrefs(prev.profile.appointment), lastAppointment: value || null }),
        updatedAt: new Date().toISOString(),
      },
    }));
    if (value) setKind("appt");
  };

  const chip = (active, label, onClick, disabled = false) => (
    <button key={label} onClick={() => { feedback("select"); onClick(); }} disabled={disabled}
      aria-pressed={active}
      className="px-3 py-1.5 rounded-full text-sm font-medium disabled:opacity-40"
      style={{ background: active ? C.accent : C.card, color: active ? C.onAccent : C.ink, border: `1px solid ${active ? C.accent : C.line}` }}>
      {label}
    </button>
  );

  return (
    <Card className="fhj-pack-cta">
      <div className="fhj-eyebrow">Bring this to your appointment</div>
      <h2 className="font-display text-xl leading-tight mt-1">Prepare an Appointment Pack</h2>
      <p className="text-sm leading-relaxed mt-1.5" style={{ color: C.sub }}>
        One or two printed pages that answer “how have you been?” — the average and which way it
        moved, your flares, what changed, your routine, and your own questions with room to write
        the answers.
      </p>

      <div className="flex flex-wrap gap-1.5 mt-3">
        {chip(kind === "appt", "Since my last appointment", () => setKind("appt"), !prefs.lastAppointment)}
        {chip(kind === "30", "Last 30 days", () => setKind("30"))}
        {chip(kind === "90", "Last 3 months", () => setKind("90"))}
        {chip(kind === "custom", "Custom dates", () => setKind("custom"))}
      </div>

      {/* The one range people actually want is the one this app cannot know on
          its own, so the field that unlocks it sits directly under the chip it
          unlocks rather than at the bottom of the card. */}
      {!prefs.lastAppointment && setDb && (
        <label className="flex flex-wrap items-center gap-2 mt-2.5 text-[11px]" style={{ color: C.subtle }}>
          When was your last appointment?
          <input type="date" value="" max={t0} aria-label="Date of my last appointment"
            onChange={(e) => setLast(e.target.value)} className="fhj-input" style={{ width: "auto" }} />
        </label>
      )}

      {kind === "custom" && (
        <div className="flex items-center gap-2 mt-3">
          <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)}
            aria-label="Pack start date" className="fhj-input" />
          <span className="text-xs" style={{ color: C.sub }}>to</span>
          <input type="date" value={to} min={from} max={t0} onChange={(e) => setTo(e.target.value)}
            aria-label="Pack end date" className="fhj-input" />
        </div>
      )}

      <div className="text-sm mt-3" style={{ color: C.sub }}>
        <b style={{ color: C.ink }}>{coverageLabel(logged, range.days)}</b> logged
        {flares ? ` · ${flares} flare${flares === 1 ? "" : "s"}` : ""}
      </div>

      <button onClick={() => { feedback("save"); goPack(range); }}
        className="fhj-btn fhj-btn-primary fhj-btn-block mt-3">
        Prepare the pack
      </button>

    </Card>
  );
}

function ExportScreen({ db, setDb, goPack }) {
  const profile = db.profile;
  const [range, setRange] = useState("30");
  const [from, setFrom] = useState(addDays(todayStr(), -29));
  const [to, setTo] = useState(todayStr());

  const bounds = useMemo(() => {
    if (range === "7") return { start: addDays(todayStr(), -6), end: todayStr(), label: "last 7 days" };
    if (range === "30") return { start: addDays(todayStr(), -29), end: todayStr(), label: "last 30 days" };
    if (range === "all") return { start: "0000-01-01", end: "9999-12-31", label: "all time" };
    return { start: from, end: to, label: `${from} to ${to}` };
  }, [range, from, to]);

  const inRange = entriesFor(db).filter((e) => e.date >= bounds.start && e.date <= bounds.end);
  const foodInRange = logsInRange(db.food || [], bounds.start, bounds.end);
  const bowelInRange = logsInRange(db.bowel || [], bounds.start, bounds.end);
  const routineInRange = logsInRange(db.routine || [], bounds.start, bounds.end);
  const labsInRange = logsInRange(db.labs || [], bounds.start, bounds.end);
  const sunInRange = logsInRange(db.sun || [], bounds.start, bounds.end);
  const contextInRange = logsInRange(db.context || [], bounds.start, bounds.end);
  const routineItems = db.routineItems || [];
  const count = inRange.length;
  const stamp = `${bounds.start === "0000-01-01" ? "all-time" : bounds.start + "_to_" + bounds.end}`;

  const exportCSV = () => {
    const { header, rows } = wideTable(profile, inRange, foodInRange, routineInRange);
    const csv = toCSV([header, ...rows]);
    download(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }),
      `health-journal_${stamp}.csv`);
  };

  const exportXLSX = () => {
    const wb = XLSX.utils.book_new();
    const readme = [
      [`${APP_NAME} — Export`],
      ["Export date", new Date().toISOString()],
      ["Setup", getProfileTemplate(profile).label],
      ["Date range", bounds.label],
      [],
      ["Disclaimer"], [DISCLAIMER],
      ["Pattern note"], [PATTERN_NOTE],
      [],
      ["Sheets"],
      ["Profile", "Your setup info"],
      ["Entries", "Daily entries — one row per logged day"],
      ["Insights", "Possible patterns computed from the last 30 days (not proof of cause)"],
      ["Reports", "Saved weekly/monthly report summaries in this date range"],
      ["Photos", "Photo legend — date, question, body part, and linked rating for each photo (images stay in the app / full backup)"],
      ["Food", "One row per meal. Every nutrient has a value column and a _source column: \"user\" is a number you entered, \"ai\" is an estimate"],
      ["Bowel", "One row per bowel movement. ai_* columns are what a model suggested from a photo, kept separate from what you recorded"],
      ["Routine", "One row per dose taken or skipped — medications, supplements, creams, products. Names and doses are what you wrote at the time"],
      ["Routine items", "What you track and how often it is asked for — the plan behind the Routine sheet"],
      ["Measurements", "Blood work and measurements somebody else took. lab_reference_* columns are the range your laboratory printed, not this app's"],
      ["Time outside", "One row per sun session. vitamin_d_estimated_iu_* is a research-model estimate of production, not a blood level — see the column that says so"],
      ["Weather", "One row per day of environmental context, if you switched it on. Coordinates are the coarse ones the app stored, rounded to about a kilometre"],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(readme), "README");

    const profRows = [{
      profile_id: profile.id, profile_name: profile.name,
      profile_age: profileAge(profile) ?? "",
      profile_template: getProfileTemplate(profile).label,
      created_at: profile.createdAt, updated_at: profile.updatedAt,
      entries_in_export: count,
    }];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(profRows), "Profile");

    const { header, rows } = wideTable(profile, inRange, foodInRange, routineInRange);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([header, ...rows]), "Entries");

    const tpl = getProfileTemplate(profile);
    const insightRows = computeInsights(tpl, entriesFor(db))
      .map((ins) => ({ title: ins.title, detail: ins.detail, note: PATTERN_NOTE }));
    XLSX.utils.book_append_sheet(wb,
      insightRows.length ? XLSX.utils.json_to_sheet(insightRows)
        : XLSX.utils.aoa_to_sheet([["No insights yet — not enough logged data."]]),
      "Insights");

    const reportRows = reportSummaryRows(db.reports, bounds.start, bounds.end);
    XLSX.utils.book_append_sheet(wb,
      reportRows.length ? XLSX.utils.json_to_sheet(reportRows)
        : XLSX.utils.aoa_to_sheet([["No saved reports in this date range. Save one from the Dashboard report view."]]),
      "Reports");

    const legendRows = photoLegendRows(tpl, inRange, bounds.start, bounds.end);
    XLSX.utils.book_append_sheet(wb,
      legendRows.length ? XLSX.utils.json_to_sheet(legendRows)
        : XLSX.utils.aoa_to_sheet([["No photos in this date range."]]),
      "Photos");

    const foodTbl = buildFoodTable(foodInRange);
    XLSX.utils.book_append_sheet(wb,
      foodTbl.rows.length ? XLSX.utils.aoa_to_sheet([foodTbl.header, ...foodTbl.rows])
        : XLSX.utils.aoa_to_sheet([["No food logged in this date range."]]),
      "Food");

    const bowelTbl = buildBowelTable(bowelInRange);
    XLSX.utils.book_append_sheet(wb,
      bowelTbl.rows.length ? XLSX.utils.aoa_to_sheet([bowelTbl.header, ...bowelTbl.rows])
        : XLSX.utils.aoa_to_sheet([["No bowel movements logged in this date range."]]),
      "Bowel");

    const routineTbl = buildRoutineTable(routineInRange, routineItems);
    XLSX.utils.book_append_sheet(wb,
      routineTbl.rows.length ? XLSX.utils.aoa_to_sheet([routineTbl.header, ...routineTbl.rows])
        : XLSX.utils.aoa_to_sheet([["Nothing from your routine logged in this date range."]]),
      "Routine");

    const routineItemsTbl = buildRoutineItemsTable(routineItems);
    XLSX.utils.book_append_sheet(wb,
      routineItemsTbl.rows.length ? XLSX.utils.aoa_to_sheet([routineItemsTbl.header, ...routineItemsTbl.rows])
        : XLSX.utils.aoa_to_sheet([["Nothing in your routine yet."]]),
      "Routine items");

    /* Three sheets rather than columns on Entries, because none of the three
       is one-value-per-day: several measurements can land on one date, so can
       several sun sessions, and the weather is a different *kind* of row from
       both. */
    const labsTbl = buildLabsTable(labsInRange);
    XLSX.utils.book_append_sheet(wb,
      labsTbl.rows.length ? XLSX.utils.aoa_to_sheet([labsTbl.header, ...labsTbl.rows])
        : XLSX.utils.aoa_to_sheet([["No measurements recorded in this date range."]]),
      "Measurements");

    const sunTbl = buildSunTable(sunInRange);
    XLSX.utils.book_append_sheet(wb,
      sunTbl.rows.length ? XLSX.utils.aoa_to_sheet([sunTbl.header, ...sunTbl.rows])
        : XLSX.utils.aoa_to_sheet([["No time outside recorded in this date range."]]),
      "Time outside");

    const contextTbl = buildContextTable(contextInRange);
    XLSX.utils.book_append_sheet(wb,
      contextTbl.rows.length ? XLSX.utils.aoa_to_sheet([contextTbl.header, ...contextTbl.rows])
        : XLSX.utils.aoa_to_sheet([["No daily context in this date range. It's off by default — turn it on in Settings."]]),
      "Weather");

    const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    download(new Blob([out], { type: "application/octet-stream" }),
      `health-journal_${stamp}.xlsx`);
  };

  const exportJSON = () => {
    const payload = {
      app: APP_NAME, exportedAt: new Date().toISOString(),
      dateRange: bounds.label, disclaimer: DISCLAIMER,
      profile, entries: inRange,
      food: foodInRange, bowel: bowelInRange,
      routine: routineInRange, routineItems,
      labs: labsInRange, sun: sunInRange, context: contextInRange,
      experiments: db.experiments || [],
      reports: (db.reports || []).filter((r) => !(r.range.start > bounds.end || r.range.end < bounds.start)),
    };
    download(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }),
      `health-journal_backup_${stamp}.json`);
    if (setDb) markBackedUp(setDb);
  };

  const chip = (active, label, onClick, key) => (
    <button key={key || label} onClick={onClick}
      className="px-3 py-1.5 rounded-full text-sm font-medium"
      style={{ background: active ? C.accent : C.faint, color: active ? C.onAccent : C.ink }}>
      {label}
    </button>
  );

  return (
    <div className="px-4 pb-8 pt-3">
      {/* First, and deliberately the loudest thing on the screen. Everything
          below this is a file for a spreadsheet; this is the thing somebody
          actually carries into a room and hands to a person. */}
      <AppointmentPackCard db={db} setDb={setDb} goPack={goPack} />

      <h2 className="fhj-section-title mt-5 mb-2">Raw data</h2>
      <p className="text-xs leading-relaxed mb-2" style={{ color: C.sub }}>
        Your logs as files — for a spreadsheet, another app, or your own records.
      </p>

      <Card>
        <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: C.sub }}>Date range</div>
        <div className="flex flex-wrap gap-1.5">
          {chip(range === "7", "Last 7 days", () => setRange("7"))}
          {chip(range === "30", "Last 30 days", () => setRange("30"))}
          {chip(range === "all", "All time", () => setRange("all"))}
          {chip(range === "custom", "Custom", () => setRange("custom"))}
        </div>
        {range === "custom" && (
          <div className="flex items-center gap-2 mt-3">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              className="flex-1 rounded-xl px-2 py-2 text-sm" style={{ background: C.faint, border: `1px solid ${C.line}` }} />
            <span className="text-xs" style={{ color: C.sub }}>to</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
              className="flex-1 rounded-xl px-2 py-2 text-sm" style={{ background: C.faint, border: `1px solid ${C.line}` }} />
          </div>
        )}
        <div className="text-sm mt-4" style={{ color: C.sub }}>
          <b style={{ color: C.ink }}>{count}</b> entr{count === 1 ? "y" : "ies"} selected · {bounds.label}
        </div>
      </Card>

      <div className="flex flex-col gap-2 mt-3">
        <Button variant="primary" block icon="download" onClick={exportCSV} disabled={!count}>
          Download CSV
        </Button>
        <Button variant="secondary" block icon="download" onClick={exportXLSX} disabled={!count}>
          Download Excel (.xlsx)
        </Button>
        <Button variant="secondary" block icon="download" onClick={exportJSON} disabled={!count}>
          Download JSON (data only)
        </Button>
        <p className="text-[11px] leading-relaxed px-1" style={{ color: C.sub }}>
          For a restorable backup that includes your photos, use <b>Settings → Backup &amp; storage → Full backup</b>.
        </p>
      </div>

      <Card className="mt-3">
        <div className="text-xs leading-relaxed" style={{ color: C.sub }}>
          Every row includes profile_id, profile_name, profile_template, date, entry_id, created_at, and updated_at.
          CSV/Excel are one row per logged day; only questions marked "exportable" in Edit Setup are included as columns.
          An imported_fields column lists which values came from a Fitbit import.
        </div>
      </Card>
      <p className="text-[11px] mt-3 leading-relaxed" style={{ color: C.sub }}>{DISCLAIMER}</p>
    </div>
  );
}

/* ============================================================
   Settings, Home, modals
   ============================================================ */

/* ============================================================
   Fitbit import (Google Takeout files — parsed on this device only)
   ============================================================ */

const FITBIT_METRIC_LABELS = {
  steps: "Steps", resting_hr: "Resting heart rate", sleep_duration_min: "Sleep duration (min)",
  sleep_score: "Sleep score", active_minutes: "Active minutes",
  avg_hr: "Average heart rate", weight: "Weight (lb)",
};
/* Known Takeout files we deliberately don't import (some are huge intraday logs). */
const FITBIT_SKIP_PREFIXES = ["heart_rate-", "calories", "distance", "altitude", "lightly_active",
  "sedentary_minutes", "exercise", "swim_lengths", "time_in_heart_rate", "demographic", "height",
  "badge", "food_logs", "water_logs", "estimated_oxygen"];

/* ---------- Google Fit / Google Health Takeout parsing ----------
   Google's automatic APIs are off the table for this app: the Fit REST API is
   deprecated and Health Connect is an on-device Android API that only native
   apps can read. Takeout files keep the data flowing while staying 100%
   on-device, which matches this app's privacy model. */

const kgToLb = (kg) => Math.round(kg * 2.20462 * 10) / 10;

/* Column sniffing for Google Fit CSVs (headers vary slightly between exports). */
const GF_COLS = [
  { match: "step count", metric: "steps", agg: "sum" },
  { match: "move minutes", metric: "active_minutes", agg: "sum" },
  { match: "average heart rate", metric: "avg_hr", agg: "avg" },
  { match: "average weight", metric: "weight", agg: "last", convert: kgToLb },
  { match: "sleep duration (ms)", metric: "sleep_duration_min", agg: "sum", convert: (ms) => Math.round(ms / 60000) },
];
const gfColIndex = (header) => GF_COLS
  .map((c) => ({ ...c, i: header.findIndex((h) => h.includes(c.match)) }))
  .filter((c) => c.i >= 0);

/* "Daily activity metrics.csv" — one row per date. */
function parseGoogleFitDailyCSV(text) {
  const { header, rows } = csvRows(text);
  const di = header.findIndex((h) => h === "date" || h.startsWith("date"));
  const cols = gfColIndex(header);
  if (di < 0 || !cols.length) return null;
  const out = {}; // metric → Map(date → {sum, n} | value)
  for (const r of rows) {
    const date = fbDateFrom(r[di]);
    if (!date) continue;
    for (const c of cols) {
      const raw = Number(r[c.i]);
      if (!isFinite(raw) || r[c.i] === "" || r[c.i] == null) continue;
      const v = c.convert ? c.convert(raw) : raw;
      const m = out[c.metric] || (out[c.metric] = new Map());
      m.set(date, v); // daily rows are already aggregates — last write wins
    }
  }
  return Object.keys(out).length ? out : null;
}

/* Per-day hourly file (e.g. "2024-01-15.csv") — has Start time/End time rows.
   Steps/minutes sum across the day; heart rate averages. */
function parseGoogleFitHourlyCSV(name, text) {
  const m = name.match(/(\d{4}-\d{2}-\d{2})\.csv$/i);
  if (!m) return null;
  const date = m[1];
  const { header, rows } = csvRows(text);
  if (!header.some((h) => h.includes("start time"))) return null;
  const cols = gfColIndex(header).filter((c) => c.metric !== "weight"); // weight from daily file only
  if (!cols.length) return null;
  const acc = {};
  for (const r of rows) {
    for (const c of cols) {
      const raw = Number(r[c.i]);
      if (!isFinite(raw) || r[c.i] === "" || r[c.i] == null) continue;
      const a = acc[c.metric] || (acc[c.metric] = { sum: 0, n: 0 });
      a.sum += c.convert ? c.convert(raw) : raw; a.n++;
    }
  }
  const out = {};
  for (const c of cols) {
    const a = acc[c.metric];
    if (!a || !a.n) continue;
    const v = c.agg === "avg" ? Math.round((a.sum / a.n) * 10) / 10 : Math.round(a.sum);
    out[c.metric] = new Map([[date, v]]);
  }
  return Object.keys(out).length ? out : null;
}

/* "All sessions" JSON — we only import sleep sessions (activity "sleep" /
   type 72), attributed to the wake-up date like Fitbit does. */
function parseGoogleFitSessionJSON(text) {
  let data;
  try { data = JSON.parse(text); } catch (e) { return null; }
  const sessions = Array.isArray(data) ? data : [data];
  const byDate = new Map();
  let sawSession = false;
  for (const s of sessions) {
    if (!s || typeof s !== "object") continue;
    const act = String(s.fitnessActivity || s.activityType || "").toLowerCase();
    const isSession = (s.startTime && s.endTime) || s.duration != null;
    if (!isSession) continue;
    sawSession = true;
    if (!(act.includes("sleep") || act === "72")) continue;
    let mins = null;
    if (s.startTime && s.endTime) {
      const ms = new Date(s.endTime) - new Date(s.startTime);
      if (isFinite(ms) && ms > 0) mins = Math.round(ms / 60000);
    } else if (typeof s.duration === "string") {
      const sec = parseFloat(s.duration);
      if (isFinite(sec) && sec > 0) mins = Math.round(sec / 60);
    }
    const date = fbDateFrom(s.endTime || s.startTime);
    if (mins && date) byDate.set(date, (byDate.get(date) || 0) + mins);
  }
  if (byDate.size) return { sleep_duration_min: byDate };
  return sawSession ? { __nonSleepSession: true } : null;
}

/* One Google Fit file → { multi, rank } | { skip } | null (not a Google Fit file).
   rank "daily" beats rank "hourly" so selecting a whole Takeout folder (which
   contains both) never double-counts a day. */
async function parseGoogleFitFile(file) {
  if (file.size > 30 * 1024 * 1024) return { name: file.name, error: "file too large" };
  const base = file.name.toLowerCase().split("/").pop();
  let text;
  try { text = await file.text(); } catch (e) { return { name: file.name, error: "could not read" }; }
  if (base.endsWith(".csv")) {
    const hourly = parseGoogleFitHourlyCSV(base, text);
    if (hourly) return { name: file.name, multi: hourly, rank: "hourly" };
    const daily = parseGoogleFitDailyCSV(text);
    if (daily) return { name: file.name, multi: daily, rank: "daily" };
    return null;
  }
  if (base.endsWith(".json")) {
    const sess = parseGoogleFitSessionJSON(text);
    if (sess && sess.__nonSleepSession) return { name: file.name, skip: true };
    if (sess) return { name: file.name, multi: sess, rank: "daily" };
    return null;
  }
  return null;
}

/* "MM/DD/YY hh:mm:ss", "MM/DD/YYYY…", or "YYYY-MM-DD…" → "YYYY-MM-DD" (else null). */
function fbDateFrom(s) {
  if (!s) return null;
  const t = String(s).trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    const y = m[3].length === 2 ? "20" + m[3] : m[3];
    return `${y}-${String(m[1]).padStart(2, "0")}-${String(m[2]).padStart(2, "0")}`;
  }
  return null;
}

function csvRows(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return { header: [], rows: [] };
  const split = (l) => l.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
  return { header: split(lines[0]).map((h) => h.toLowerCase()), rows: lines.slice(1).map(split) };
}

/* One Takeout file → { metric, points: Map(date → value) } | {skip} | {unknown} | {error}. */
async function parseFitbitFile(file) {
  const base = file.name.toLowerCase().split("/").pop();
  if (FITBIT_SKIP_PREFIXES.some((p) => base.startsWith(p))) return { name: file.name, skip: true };
  const metric =
    base.startsWith("steps") ? "steps" :
    base.startsWith("resting_heart_rate") ? "resting_hr" :
    base.startsWith("sleep_score") ? "sleep_score" :
    base.startsWith("sleep") ? "sleep_duration_min" :
    (base.startsWith("very_active_minutes") || base.startsWith("moderately_active_minutes")) ? "active_minutes" :
    null;
  if (!metric) {
    const g = await parseGoogleFitFile(file);
    return g || { name: file.name, unknown: true };
  }
  if (file.size > 30 * 1024 * 1024) return { name: file.name, error: "file too large" };
  const points = new Map();
  const add = (date, v, mode) => {
    if (!date || typeof v !== "number" || !isFinite(v)) return;
    if (mode === "sum") points.set(date, (points.get(date) || 0) + v);
    else if (mode === "max") points.set(date, Math.max(points.get(date) ?? -Infinity, v));
    else points.set(date, v);
  };
  // If the file matched a Fitbit name but isn't Fitbit-shaped (e.g. a Google
  // Fit sleep-session JSON also starts with "sleep"), fall back to Google
  // sniffing before reporting an error.
  const googleFallback = async (error) => (await parseGoogleFitFile(file)) || { name: file.name, error };
  try {
    const text = await file.text();
    if (metric === "sleep_score") {
      const { header, rows } = csvRows(text);
      const ti = header.indexOf("timestamp"), si = header.indexOf("overall_score");
      if (ti < 0 || si < 0) return await googleFallback("unexpected columns");
      for (const r of rows) add(fbDateFrom(r[ti]), Number(r[si]), "max");
    } else {
      const arr = JSON.parse(text);
      if (!Array.isArray(arr)) return await googleFallback("unexpected format");
      for (const row of arr) {
        if (metric === "sleep_duration_min") add(fbDateFrom(row.dateOfSleep), Number(row.minutesAsleep), "sum");
        else if (metric === "resting_hr") {
          const v = row.value && typeof row.value === "object" ? Number(row.value.value) : Number(row.value);
          if (v > 0) add(fbDateFrom((row.value && row.value.date) || row.dateTime), Math.round(v * 10) / 10, "last");
        } else add(fbDateFrom(row.dateTime), Number(row.value), "sum"); // steps + active-minute files
      }
    }
  } catch (e) {
    return await googleFallback("could not read");
  }
  if (points.size === 0) return await googleFallback("no usable rows");
  return { name: file.name, metric, points };
}

/* Many files → { byMetric: {metric: Map(date → value)}, report }. Fitbit values
   sum across files for count-style metrics (month files don't overlap; naps add
   up). Google Fit hourly files sum too, but a "daily" ranked value (the
   aggregate CSV) always replaces hourly sums for that date — a full Takeout
   folder contains both, and importing both must not double-count. */
async function parseFitbitFiles(files) {
  const byMetric = {};
  const dailyLock = {}; // metric → Set(date) already set from a daily-ranked file
  const report = { parsed: 0, skipped: 0, unknown: [], errors: [] };
  const applyPoint = (metric, d, v, mode, rank) => {
    const m = byMetric[metric] || (byMetric[metric] = new Map());
    const lock = dailyLock[metric] || (dailyLock[metric] = new Set());
    if (rank === "daily") { m.set(d, v); lock.add(d); return; }
    if (lock.has(d)) return; // an aggregate already covers this date
    if (mode === "sum") m.set(d, (m.get(d) || 0) + v);
    else m.set(d, v);
  };
  for (const f of files) {
    const r = await parseFitbitFile(f);
    if (r.skip) report.skipped++;
    else if (r.unknown) report.unknown.push(r.name);
    else if (r.error) report.errors.push(`${r.name} — ${r.error}`);
    else if (r.multi) {
      report.parsed++;
      for (const [metric, m] of Object.entries(r.multi)) {
        const sums = metric === "steps" || metric === "active_minutes" || metric === "sleep_duration_min";
        for (const [d, v] of m) applyPoint(metric, d, v, sums ? "sum" : "last", r.rank);
      }
    } else {
      report.parsed++;
      const sums = r.metric === "steps" || r.metric === "active_minutes" || r.metric === "sleep_duration_min";
      for (const [d, v] of r.points) applyPoint(r.metric, d, v, sums ? "sum" : "last", "fitbit");
    }
  }
  for (const k of ["steps", "active_minutes", "sleep_duration_min"]) {
    if (byMetric[k]) for (const [d, v] of byMetric[k]) byMetric[k].set(d, Math.round(v));
  }
  return { byMetric, report };
}

/* Dry-run summary: per-metric day counts + date range + conflicts with manual values. */
function fitbitSummary(byMetric, entries) {
  const byDate = new Map(entries.map((e) => [e.date, e]));
  const out = [];
  let conflicts = 0;
  for (const [metric, m] of Object.entries(byMetric)) {
    let min = null, max = null, c = 0;
    for (const [d, v] of m) {
      if (d > todayStr()) continue;
      if (min === null || d < min) min = d;
      if (max === null || d > max) max = d;
      const e = byDate.get(d);
      const existing = e && e.answers ? e.answers[metric] : null;
      const src = e && e.sources ? e.sources[metric] : null;
      if (existing != null && src !== "fitbit" && existing !== v) c++;
    }
    conflicts += c;
    out.push({ metric, label: FITBIT_METRIC_LABELS[metric], days: m.size, min, max, conflicts: c });
  }
  return { rows: out.sort((a, b) => b.days - a.days), conflicts };
}

/* Merge parsed data into the db. Manual values win unless overwrite=true.
   Days with no entry get an auto entry (excluded from streaks until edited). */
function mergeFitbitData(prev, byMetric, overwrite) {
  const now = new Date().toISOString();
  const byDate = new Map(prev.entries.map((e) => [e.date, e]));
  const touched = new Map();
  const stats = { updated: 0, created: 0, kept: 0, values: 0 };
  for (const [metric, m] of Object.entries(byMetric)) {
    for (const [date, v] of m) {
      if (date > todayStr()) continue;
      const e = byDate.get(date);
      const manual = e && e.answers && e.answers[metric] != null && (!e.sources || e.sources[metric] !== "fitbit");
      if (manual && !overwrite) { stats.kept++; continue; }
      const t = touched.get(date) || { answers: {}, sources: {} };
      t.answers[metric] = v; t.sources[metric] = "fitbit";
      touched.set(date, t); stats.values++;
    }
  }
  const entries = prev.entries.map((e) => {
    const t = touched.get(e.date);
    if (!t) return e;
    stats.updated++;
    return { ...e, answers: { ...e.answers, ...t.answers }, sources: { ...(e.sources || {}), ...t.sources }, updatedAt: now };
  });
  for (const [date, t] of touched) {
    if (byDate.has(date)) continue;
    stats.created++;
    entries.push({
      id: uid(), profileId: prev.profile.id, date, answers: t.answers, sources: t.sources,
      photos: {}, notes: "", auto: true, quickLogCompleted: false, detailedLogCompleted: false,
      createdAt: now, updatedAt: now,
    });
  }
  const modules = (prev.profile.modules || []).includes("wearable")
    ? prev.profile.modules : [...(prev.profile.modules || []), "wearable"];
  return {
    db: { ...prev, entries, profile: { ...prev.profile, modules, updatedAt: now } },
    stats,
  };
}

const FITBIT_STEPS = [
  ["Open Google Takeout", "Go to takeout.google.com and sign in with the Google account your Fitbit uses. (Shortcut: in the Fitbit app, tap your profile picture \u2192 Your Fitbit data.)"],
  ["Select only Fitbit", "Tap \u201cDeselect all\u201d, scroll down, tick Fitbit only, then Next step."],
  ["Create the export", "Choose \u201cExport once\u201d \u2192 Create export. Google emails you a download link \u2014 usually within minutes, sometimes hours."],
  ["Download and unzip", "Download the ZIP from the email and unzip it. Open the folder: Takeout \u2192 Fitbit."],
  ["Find the data files", "Folder names vary by account. Look in \u201cGlobal Export Data\u201d and/or \u201cPhysical Activity\u2026\u201d for files starting with steps\u2026, resting_heart_rate\u2026, sleep\u2026, very_active_minutes\u2026, moderately_active_minutes\u2026 \u2014 plus \u201cSleep Score/sleep_score.csv\u201d."],
  ["Upload them here", "Tap the button below and select the files \u2014 you can pick many at once (steps files are one per month, so grab them all). Skip the big heart_rate-\u2026 files; they aren\u2019t needed."],
];

const GFIT_STEPS = [
  ["Open Google Takeout", "Go to takeout.google.com and sign in with the account your Google Fit / Google Health data lives in."],
  ["Select only Fit", "Tap \u201cDeselect all\u201d, scroll down, tick \u201cFit\u201d only, then Next step."],
  ["Create the export", "Choose \u201cExport once\u201d \u2192 Create export, then download the ZIP from the email Google sends and unzip it."],
  ["Find the data files", "Open Takeout \u2192 Fit \u2192 \u201cDaily activity metrics\u201d. The single file \u201cDaily activity metrics.csv\u201d has your whole history (steps, move minutes, heart rate, weight) \u2014 that one file is usually all you need. Sleep sessions live in Takeout \u2192 Fit \u2192 \u201cAll sessions\u201d as small \u2026.json files."],
  ["Upload them here", "Tap the button below and select \u201cDaily activity metrics.csv\u201d (plus any sleep session JSONs if you want sleep). Selecting extra files is fine \u2014 duplicates never double-count, and unrelated files are just listed as skipped."],
];

/* ============================================================
   Import — somebody's own notes, read into their journal
   ============================================================

   The arithmetic, the prompt and the writing all live in src/lib/import.ts,
   including the reasons. This is the three-step surface over it, and the shape
   of the three steps is the whole safety argument:

     1. **Hand it over.** Paste the notes, or pick a screenshot of them.
     2. **See what goes.** Nothing leaves the device until this sheet has been
        read and accepted — it lists, in plain words, every part of the payload.
        This is the only feature in the app that sends free text, and it is not
        going to be coy about it.
     3. **Approve what lands.** Every proposed row, grouped by the day it would
        go on, next to the words it came from. Switch off anything wrong, fix
        any date, then one button writes what is left — with an Undo, like
        every other write in this app.

   The model is never between step 3 and the journal. `applyImport` takes the
   approved list and nothing else. */

function importRowIcon(kind) {
  return kind === "food" ? "food" : kind === "bowel" ? "bowel"
    : kind === "routine" ? "pill" : kind === "note" ? "note" : "target";
}
const IMPORT_ROW_CAT = {
  food: "fhj-cat-food", bowel: "fhj-cat-bowel", routine: "fhj-cat-routine",
  note: "fhj-cat-symptom", answer: "fhj-cat-symptom",
};

/** One proposed row: what it would write, where it came from, and a switch. */
function ImportRow({ item, on, onToggle, onDate }) {
  return (
    <div className={"fhj-import-row " + IMPORT_ROW_CAT[item.kind] + (on ? "" : " is-off")}>
      <button type="button" role="switch" aria-checked={on} onClick={onToggle}
        aria-label={`${on ? "Don't add" : "Add"} ${item.label}`}
        className="fhj-import-check">
        {on && <Icon name="check" size={13} color={C.onAccent} />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="fhj-import-head">
          <Icon name={importRowIcon(item.kind)} size={13} color="currentColor" />
          <span className="fhj-import-label">{item.label}</span>
          {/* Only the rows worth a second look are flagged. Badging every row
              the model had to interpret badges almost every row, and a badge
              on everything is a badge on nothing — what the model assumed is
              said in words underneath instead. */}
          {item.confidence === "low" && <span className="fhj-ai-badge">Unsure</span>}
        </div>
        {item.detail && <div className="fhj-import-detail">{item.detail}</div>}
        {/* The receipt. A wrong reading is obvious the moment it sits next to
            the words it claims to be a reading of. */}
        {item.source && <div className="fhj-import-src">“{item.source}”</div>}
        {item.note && <div className="fhj-import-note">{item.note}</div>}
        <label className="fhj-import-date">
          <span>Date</span>
          <input type="date" value={item.date} max={todayStr()}
            onChange={(e) => e.target.value && onDate(e.target.value)} />
          {item.dateGuessed && <span className="fhj-import-guess">assumed — the notes didn't say</span>}
        </label>
      </div>
    </div>
  );
}

/** A screenshot waiting to be read, with the way to change its mind about it. */
function ImportShot({ shot, index, total, onRemove }) {
  return (
    <div className="fhj-import-shot">
      <img src={shot.thumb} alt="" />
      {total > 1 && <span className="fhj-import-shot-n">{index + 1}</span>}
      <button type="button" onClick={onRemove} aria-label={`Remove screenshot ${index + 1}`}>
        <Icon name="x" size={12} color={C.ink} />
      </button>
    </div>
  );
}

function NoteImportScreen({ db, setDb, aiEnabled, goBack, goSettings, openLog }) {
  const conn = useAiConnection(aiEnabled);
  const tpl = getProfileTemplate(db.profile);
  const [text, setText] = useState("");
  const [shots, setShots] = useState([]);       // [{ full, thumb }]
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [plan, setPlan] = useState(null);
  const [off, setOff] = useState([]);           // ids the person switched off
  const [dates, setDates] = useState({});       // id -> corrected date
  const [confirm, setConfirm] = useState(false);
  const [done, setDone] = useState(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef(null);

  /* Structure only — see ImportVocabulary. The journal's *answers* are not in
     here, and are not needed to read a line of text. */
  const vocab = useMemo(() => ({
    today: todayStr(),
    fields: tpl.fields
      .filter((f) => f.type !== "photo")
      .map((f) => ({ k: f.k, label: f.label, type: f.type, unit: f.unit, options: f.options, single: f.single })),
    routineItems: (db.routineItems || [])
      .filter((r) => !r.archived)
      .map((r) => ({ id: r.id, name: r.name, kind: r.kind, dose: r.dose })),
    foods: (db.foods || []).map((f) => f.name).filter(Boolean),
  }), [tpl, db.routineItems, db.foods]);

  const input = useMemo(
    () => ({ text, images: shots.map((s) => dataUrlToImage(s.full)).filter(Boolean) }),
    [text, shots]
  );
  const outgoing = useMemo(() => summariseImportRequest(input, vocab), [input, vocab]);
  const ready = !!(text.trim() || shots.length);

  /* Screenshots are bigger and less compressed than a progress photo on
     purpose: this one has to stay *readable*, and 1024px at q0.6 turns a
     screenshot of small text into mush. */
  const addFiles = async (files) => {
    const list = [...(files || [])];
    if (!list.length) return;
    const room = MAX_IMPORT_IMAGES - shots.length;
    if (room <= 0) {
      setError(`That's the limit — ${MAX_IMPORT_IMAGES} screenshots at a time. Read these first; running it again afterwards costs nothing.`);
      return;
    }
    const next = [];
    let readText = "";
    for (const file of list.slice(0, room + list.length)) {
      /* A dropped .txt or .md is notes too, and asking somebody to open it and
         copy it out would be the app being precious about its own text box. */
      if (/^text\//.test(file.type) || /\.(txt|md|csv|log)$/i.test(file.name || "")) {
        readText += (readText ? "\n" : "") + (await file.text().catch(() => ""));
        continue;
      }
      if (!/^image\//.test(file.type)) continue;
      if (next.length >= room) continue;
      try { next.push(await processImage(file, { fullEdge: 1600, fullQ: 0.85 })); }
      catch { setError("Couldn't read one of those images — try another."); }
    }
    if (readText.trim()) setText((prev) => (prev.trim() ? `${prev.trim()}\n${readText.trim()}` : readText.trim()));
    if (next.length) {
      setError("");
      feedback("select");
      setShots((prev) => [...prev, ...next].slice(0, MAX_IMPORT_IMAGES));
    }
  };

  /* Ctrl+V a screenshot straight in. This is how people actually have their
     notes on a desktop — in the clipboard, one keystroke after the snip — and
     making them save a file first would be the whole feature's friction back
     again. */
  const onPaste = (e) => {
    const files = [...(e.clipboardData?.files || [])];
    if (!files.length) return; // ordinary text paste — let the box have it
    e.preventDefault();
    addFiles(files);
  };

  const run = async () => {
    setConfirm(false);
    setBusy(true);
    setError("");
    try {
      const result = await readNotes(conn, input, vocab);
      setPlan(result);
      setOff([]);
      setDates({});
      if (!result.items.length) {
        setError(result.unreadable
          ? "Nothing in there mapped onto a row this journal can hold."
          : "Nothing came back from that. Try pasting a bit more, or a clearer screenshot.");
      } else {
        feedback("save");
      }
    } catch (e) {
      setError(e?.message || "That didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  };

  /* What would actually be written: the rows still switched on, carrying any
     date the person corrected. Nothing else in the plan matters from here. */
  const approved = useMemo(
    () => (plan?.items || [])
      .filter((it) => !off.includes(it.id))
      .map((it) => (dates[it.id] ? { ...it, date: dates[it.id], dateGuessed: false } : it)),
    [plan, off, dates]
  );
  /* The list is drawn from every row the model proposed, switched on or not —
     a row that vanished when you switched it off would be a row you could not
     switch back on. */
  const shown = useMemo(
    () => (plan?.items || []).map((it) => (dates[it.id] ? { ...it, date: dates[it.id], dateGuessed: false } : it)),
    [plan, dates]
  );
  const groups = useMemo(() => groupByDate(shown), [shown]);
  const found = useMemo(() => (plan ? describeAdded(countKinds(plan.items)) : ""), [plan]);

  const setDay = (rows, on) => setOff((prev) => {
    const ids = rows.map((r) => r.id);
    return on ? prev.filter((id) => !ids.includes(id)) : [...new Set([...prev, ...ids])];
  });

  const commit = () => {
    const before = {
      entries: db.entries || [], food: db.food || [], foods: db.foods || [],
      bowel: db.bowel || [], routine: db.routine || [], routineItems: db.routineItems || [],
    };
    const { next, added, duplicates } = applyImport(before, approved);
    /* The earliest day touched is the one worth offering to open: it is the
       far end of what just arrived, and seeing it full is the moment this
       feature pays out. */
    const earliest = approved.reduce((min, it) => (!min || it.date < min ? it.date : min), null);
    setDb((prev) => ({ ...prev, ...next }));
    setDone({ added, duplicates, earliest });
    setPlan(null);
    feedback("save");
    toast({
      text: `${describeAdded(added)} imported`,
      cat: "fhj-cat-food",
      undo: () => setDb((prev) => ({ ...prev, ...before })),
    });
  };

  const startOver = () => {
    setPlan(null); setDone(null); setError(""); setText(""); setShots([]); setOff([]); setDates({});
  };

  /* ---------- the feature does not exist without a key ---------- */
  if (!aiEnabled || !conn) {
    return (
      <div className="px-4 pb-10 pt-3">
        <h2 className="font-display text-xl mb-3">Import your notes</h2>
        <Card>
          <p className="text-sm leading-relaxed" style={{ color: C.sub }}>
            This one needs the optional AI connection, because reading somebody's shorthand
            is the whole job — <b style={{ color: C.ink }}>“8.21 2acv premeal + 2 pepsin 12:30pm”</b> is
            two doses at half past twelve on the 21st, and no amount of parsing rules gets there.
          </p>
          <p className="text-sm leading-relaxed mt-2" style={{ color: C.sub }}>
            It is off until you turn it on, it uses your own key, and unlike everything else
            here it sends the notes themselves — which is why it asks, in plain words, every
            single time before it does.
          </p>
          <Button className="mt-3" block onClick={goSettings} icon="key">
            {aiEnabled ? "Finish setting up AI" : "Turn on AI in Settings"}
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="px-4 pb-10 pt-3"
      onDragOver={(e) => { e.preventDefault(); if (!plan && !done) setDragging(true); }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDragging(false); }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!plan && !done) addFiles([...(e.dataTransfer?.files || [])]);
      }}>
      <h2 className="font-display text-xl">Import your notes</h2>
      <p className="text-[12.5px] leading-relaxed mt-1 mb-3" style={{ color: C.subtle }}>
        Paste what you have been writing somewhere else — a notes file, a chat with yourself,
        a photo of a page. It gets read into meals, doses, numbers and notes, on the days the
        notes themselves say. You approve every row before anything is written.
      </p>

      {done ? (
        <Card>
          <div className="flex items-center gap-2">
            <span className="fhj-pulse-mark" style={{ background: C.accent }}>
              <Icon name="check" size={13} color={C.onAccent} />
            </span>
            <b className="text-[15px]">{describeAdded(done.added)} added</b>
          </div>
          {done.duplicates > 0 && (
            <p className="text-[12.5px] leading-relaxed mt-2" style={{ color: C.subtle }}>
              {done.duplicates} row{done.duplicates === 1 ? " was" : "s were"} already in your journal
              on that day and time, so {done.duplicates === 1 ? "it was" : "they were"} left alone.
            </p>
          )}
          {done.earliest && openLog && (
            <Button variant="secondary" block className="mt-3" iconRight="right"
              onClick={() => openLog(done.earliest)}>
              Open {fmtNice(done.earliest)}
            </Button>
          )}
          <div className="flex gap-2 mt-2">
            <Button variant="ghost" onClick={startOver} icon="plus">Import more</Button>
            <Button variant="ghost" onClick={goBack}>Done</Button>
          </div>
        </Card>
      ) : plan ? (
        <>
          <Card>
            <div className="fhj-eyebrow mb-1">Nothing is written yet</div>
            <p className="text-[13px] leading-relaxed" style={{ color: C.sub }}>
              <b style={{ color: C.ink }}>{found}</b>, on {groups.length} day
              {groups.length === 1 ? "" : "s"}. Switch off anything wrong and fix any date that
              landed badly — each row shows the words it came from.
            </p>
            {plan.unreadable && (
              <div className="fhj-import-left">
                <b>Couldn't place this:</b> {plan.unreadable}
              </div>
            )}
          </Card>

          {groups.map((g) => {
            const allOn = g.items.every((it) => !off.includes(it.id));
            return (
              <div key={g.date}>
                <div className="fhj-section mt-5 fhj-cat-symptom">
                  <h3 className="fhj-section-title">{fmtNice(g.date)}</h3>
                  <button type="button" className="text-[11px] font-semibold"
                    style={{ color: C.accentText }}
                    onClick={() => { feedback("tap"); setDay(g.items, !allOn); }}>
                    {allOn ? "None" : "All"} · {g.items.length}
                  </button>
                </div>
                <div className="flex flex-col gap-2">
                  {g.items.map((it) => (
                    <ImportRow key={it.id} item={it} on={!off.includes(it.id)}
                      onToggle={() => {
                        feedback("select");
                        setOff((prev) => (prev.includes(it.id) ? prev.filter((x) => x !== it.id) : [...prev, it.id]));
                      }}
                      onDate={(d) => setDates((prev) => ({ ...prev, [it.id]: d }))} />
                  ))}
                </div>
              </div>
            );
          })}

          <div className="fhj-import-commit">
            <Button block onClick={commit} disabled={!approved.length} icon="check">
              {approved.length
                ? `Add ${approved.length} row${approved.length === 1 ? "" : "s"} to my journal`
                : "Nothing selected"}
            </Button>
            <Button variant="ghost" block className="mt-2" onClick={startOver}>
              Throw this away and start again
            </Button>
          </div>
        </>
      ) : (
        <>
          <Card>
            <label className="fhj-eyebrow" htmlFor="fhj-import-text">Your notes</label>
            <textarea id="fhj-import-text" rows={10} value={text}
              onChange={(e) => setText(e.target.value)}
              onPaste={onPaste}
              placeholder={"8.21 weight 12pm 182\n8.21 food, 2.5 hamburger, havarti cheese\n2acv premeal + 2 pepsin combo 12:30pm\n8.21 4pm bowel movement, small firm sank\n8.21 Trazo 50mg STARTING NEW MED. Day 1"}
              className="w-full mt-2 rounded-xl px-3 py-2.5 text-sm outline-none resize-y leading-relaxed"
              style={{ background: C.faint, border: `1px solid ${C.line}`, color: C.ink, minHeight: "9rem" }} />
            <div className="text-[11px] mt-1.5" style={{ color: C.subtle }}>
              Shorthand is fine. Dates like “8.21”, “yesterday” or “Thu” are worked out against today.
              You can paste a screenshot straight in here too.
            </div>
          </Card>

          <Card className="mt-3">
            <div className="flex items-baseline justify-between gap-2 mb-2">
              <span className="fhj-eyebrow">Or screenshots of them</span>
              {shots.length > 0 && (
                <span className="text-[11px]" style={{ color: C.subtle }}>
                  {shots.length} of {MAX_IMPORT_IMAGES}
                </span>
              )}
            </div>
            {/* The list is copied out *before* the input is reset. `e.target.files`
                is live: clearing `value` to make re-picking the same file work
                empties the FileList too, and handing the emptied one on is a
                picker that silently does nothing. */}
            <input ref={fileRef} type="file" accept="image/*,text/plain,.txt,.md" multiple className="hidden"
              onChange={(e) => { const picked = [...(e.target.files || [])]; e.target.value = ""; addFiles(picked); }} />
            {shots.length > 0 && (
              <div className="fhj-import-shots">
                {shots.map((s, i) => (
                  <ImportShot key={i} shot={s} index={i} total={shots.length}
                    onRemove={() => setShots((prev) => prev.filter((_, j) => j !== i))} />
                ))}
              </div>
            )}
            {shots.length < MAX_IMPORT_IMAGES && (
              <Button variant="secondary" block icon="camera" onClick={() => fileRef.current?.click()}>
                {shots.length ? "Add another screenshot" : "Choose screenshots"}
              </Button>
            )}
            <div className="text-[11px] mt-1.5" style={{ color: C.subtle }}>
              {shots.length > 1
                ? "Read in this order, as one continuous set — so a date at the top of one still applies to the lines under it in the next."
                : `Up to ${MAX_IMPORT_IMAGES} at a time. Drop them anywhere on this screen, or a .txt file.`}
            </div>
          </Card>

          {error && <div className="fhj-import-error">{error}</div>}

          <Button className="mt-3" block disabled={!ready || busy} icon="spark"
            onClick={() => { feedback("tap"); setConfirm(true); }}>
            {busy ? "Reading…" : "Read my notes"}
          </Button>
          <p className="text-[11px] leading-relaxed mt-2 text-center" style={{ color: C.subtle }}>
            You'll see exactly what would be sent, and exactly what would be written, before either happens.
          </p>
        </>
      )}

      {dragging && (
        <div className="fhj-import-drop" aria-hidden="true">
          <Icon name="download" size={22} color={C.accentText} />
          <span>Drop screenshots or a text file</span>
        </div>
      )}

      {confirm && (
        <Modal title="This sends your notes" eyebrow="Before anything leaves this device"
          onClose={() => setConfirm(false)}
          footer={
            <>
              <Button variant="secondary" block onClick={() => setConfirm(false)}>Not now</Button>
              <Button block onClick={run} icon="spark">Send and read</Button>
            </>
          }>
          <p className="text-sm leading-relaxed" style={{ color: C.sub }}>
            Everything else in this app keeps your writing on this device. This one cannot —
            the words are the thing being read. Here is the whole payload:
          </p>
          <ul className="flex flex-col gap-2 mt-3">
            {outgoing.lines.map((line, i) => (
              <li key={i} className="flex gap-2 text-[13px] leading-relaxed">
                <span className="shrink-0 mt-1.5 rounded-full"
                  style={{ width: 5, height: 5, background: C.accent }} />
                <span>{line}</span>
              </li>
            ))}
          </ul>
          <p className="text-[12px] leading-relaxed mt-3" style={{ color: C.subtle }}>
            It goes to the provider you set up, with your own key. No photos from your journal,
            no answers you have already recorded, no name, and nothing about this device.
          </p>
        </Modal>
      )}
    </div>
  );
}

function FitbitImportScreen({ db, setDb, goBack }) {
  const [busy, setBusy] = useState(false);
  const [parsed, setParsed] = useState(null); // {byMetric, report, summary}
  const [overwrite, setOverwrite] = useState(false);
  const [done, setDone] = useState(null); // stats after merge
  const [showSteps, setShowSteps] = useState(true);
  const [guide, setGuide] = useState("gfit"); // which how-to is shown
  const inputRef = useRef(null);

  const onFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setBusy(true); setDone(null);
    try {
      const { byMetric, report } = await parseFitbitFiles(files);
      const summary = fitbitSummary(byMetric, entriesFor(db));
      setParsed({ byMetric, report, summary });
      setShowSteps(false);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const doImport = () => {
    const { db: next, stats } = mergeFitbitData(db, parsed.byMetric, overwrite);
    setDb(next);
    setDone(stats);
    setParsed(null);
  };

  const hasData = parsed && parsed.summary.rows.some((r) => r.days > 0);

  return (
    <div className="px-4 pb-10 pt-3">
      <div className="flex items-center gap-2 mb-3">
        <button onClick={goBack} aria-label="back" className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: C.card, border: `1px solid ${C.line}` }}>
          <Icon name="left" size={17} color={C.sub} />
        </button>
        <h2 className="font-display text-xl">Import wearable data</h2>
      </div>

      <Card>
        <div className="text-sm leading-relaxed" style={{ color: C.sub }}>
          Bring in daily <b style={{ color: C.ink }}>steps, heart rate, sleep, active minutes, and weight</b> from a
          <b style={{ color: C.ink }}> Google Fit / Google Health</b> or <b style={{ color: C.ink }}>Fitbit</b> Takeout
          export. Imported days chart, trend, feed possible patterns, and export exactly like your survey answers.
        </div>
        <div className="text-xs leading-relaxed mt-2 rounded-xl px-3 py-2" style={{ background: C.faint, color: C.sub }}>
          Files are read here on your device only — nothing is uploaded anywhere. There's no "connect account" sync on
          purpose: Google's automatic Fit API is being retired, and its replacement (Health Connect) only shares data with
          apps installed on your phone — a file export is the private, offline-friendly way in. Re-import whenever you
          want fresh data; duplicate days never double-count.
        </div>
      </Card>

      <Card className="mt-3">
        <button onClick={() => setShowSteps(!showSteps)} className="w-full flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: C.sub }}>
            How to get your files
          </span>
          <Icon name={showSteps ? "up" : "down"} size={14} color={C.sub} />
        </button>
        {showSteps && (
          <>
            <div className="flex gap-1.5 mt-2 mb-1">
              {[["gfit", "Google Fit / Health"], ["fitbit", "Fitbit"]].map(([v, l]) => (
                <button key={v} onClick={() => setGuide(v)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium"
                  style={{ background: guide === v ? C.accent : C.faint, color: guide === v ? C.onAccent : C.sub }}>
                  {l}
                </button>
              ))}
            </div>
            <ol className="mt-2 flex flex-col gap-2.5">
              {(guide === "gfit" ? GFIT_STEPS : FITBIT_STEPS).map(([title, body], i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5"
                    style={{ background: C.accentSoft, color: C.accentText }}>{i + 1}</span>
                  <span className="text-sm leading-relaxed">
                    <b>{title}.</b> <span style={{ color: C.sub }}>{body}</span>
                  </span>
                </li>
              ))}
            </ol>
          </>
        )}
      </Card>

      <input ref={inputRef} type="file" multiple accept=".json,.csv" className="hidden"
        onChange={(e) => onFiles(e.target.files)} />
      <button onClick={() => inputRef.current && inputRef.current.click()} disabled={busy}
        className="w-full py-3.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 mt-3 disabled:opacity-50"
        style={{ background: C.accent, color: C.onAccent }}>
        <Icon name="log" size={17} color={C.onAccent} /> {busy ? "Reading files…" : parsed ? "Choose different files" : "Choose Fitbit files"}
      </button>

      {parsed && (
        <Card className="mt-3">
          <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: C.sub }}>
            Ready to import — nothing saved yet
          </div>
          {parsed.summary.rows.length === 0 && (
            <div className="text-sm" style={{ color: C.sub }}>
              No usable data found in those files. Check step 5 above for the file names to look for.
            </div>
          )}
          {parsed.summary.rows.map((r) => (
            <div key={r.metric} className="flex items-center justify-between py-1.5" style={{ borderBottom: `1px solid ${C.line}` }}>
              <span className="text-sm">{r.label}</span>
              <span className="text-xs" style={{ color: C.sub }}>
                {r.days} day{r.days === 1 ? "" : "s"}{r.min ? ` · ${fmtShort(r.min)}–${fmtShort(r.max)}` : ""}
              </span>
            </div>
          ))}
          <div className="text-xs mt-2 leading-relaxed" style={{ color: C.sub }}>
            {parsed.report.parsed} file{parsed.report.parsed === 1 ? "" : "s"} read
            {parsed.report.skipped ? ` · ${parsed.report.skipped} skipped (not needed)` : ""}
            {parsed.report.unknown.length ? ` · ${parsed.report.unknown.length} not recognized` : ""}
          </div>
          {parsed.report.errors.length > 0 && (
            <div className="text-xs mt-1 leading-relaxed" style={{ color: C.dangerInk }}>
              Couldn't read: {parsed.report.errors.join("; ")}
            </div>
          )}
          {parsed.summary.conflicts > 0 && (
            <button onClick={() => setOverwrite(!overwrite)}
              className="w-full mt-3 px-3 py-2.5 rounded-xl text-left flex items-center justify-between"
              style={{ background: C.faint, border: `1px solid ${C.line}` }}>
              <span className="text-xs leading-snug pr-2">
                {parsed.summary.conflicts} day{parsed.summary.conflicts === 1 ? " has" : "s have"} a value you entered
                yourself. {overwrite ? "Fitbit values will replace them." : "Your values will be kept."}
              </span>
              <span className="w-9 h-5 rounded-full relative shrink-0" style={{ background: overwrite ? C.accent : C.lineStrong }}>
                <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all" style={{ left: overwrite ? 18 : 2 }} />
              </span>
            </button>
          )}
          {!(db.profile.modules || []).includes("wearable") && hasData && (
            <div className="text-xs mt-2" style={{ color: C.sub }}>
              The "Wearable / Fitbit" question pack will be turned on so this data shows in charts and exports.
            </div>
          )}
          <button onClick={doImport} disabled={!hasData}
            className="fhj-btn fhj-btn-primary fhj-btn-block mt-3">
            Import now
          </button>
        </Card>
      )}

      {done && (
        <Card className="mt-3">
          <div className="text-sm font-semibold mb-1" style={{ color: C.good }}>Import complete</div>
          <div className="text-sm leading-relaxed" style={{ color: C.sub }}>
            {done.values} values added — {done.updated} existing day{done.updated === 1 ? "" : "s"} updated,{" "}
            {done.created} new day{done.created === 1 ? "" : "s"} created{done.kept ? `, ${done.kept} of your own values kept` : ""}.
            Imported-only days don't count toward your streak until you log something on them yourself.
          </div>
          <button onClick={goBack} className="w-full py-2.5 rounded-xl text-sm font-medium mt-3" style={{ background: C.faint }}>
            Back to Settings
          </button>
        </Card>
      )}

      <p className="text-[11px] mt-3 leading-relaxed" style={{ color: C.sub }}>
        Tip: re-run an import any time after a new Takeout export — already-imported days are simply updated.
      </p>
    </div>
  );
}

/* ============================================================
   P2.5 — Data durability (all local, no cloud)
   Full backup with photo blobs, restore, storage meter,
   free-up-space, and the XLSX photo legend.
   ============================================================ */

/* Everything the app knows, photos included. Blobs are the stored JPEG data
   URLs, so a restored photo is bit-identical to the original. */
async function buildFullBackup(db) {
  const ix = await loadPhotoIndex();
  const photos = [];
  for (const [id, meta] of Object.entries(ix)) {
    const [full, thumb] = await Promise.all([loadPhotoData(id), loadThumbData(id)]);
    if (!full) continue; // orphaned index entry — skip rather than fail
    photos.push({ id, meta, full, thumb: thumb || null });
  }
  return {
    app: APP_NAME, kind: "full", schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(), disclaimer: DISCLAIMER,
    profile: db.profile, entries: db.entries, reports: db.reports || [],
    food: db.food || [], bowel: db.bowel || [], foods: db.foods || [],
    routine: db.routine || [], routineItems: db.routineItems || [],
    episodes: db.episodes || [],
    /* The 1.21 collections. Sun sessions, lab results and experiments are
       journal content and travel like everything above. The environmental
       context does too — it is a record of the days, and a restored journal
       whose weather had silently vanished would break every observation built
       on it. The *consent* rides along inside `profile`, which is right: it
       describes what this journal is allowed to hold, not what a device is
       allowed to send. */
    sun: db.sun || [], labs: db.labs || [], experiments: db.experiments || [],
    context: db.context || [],
    // Past AI observations travel with the journal, but the opt-in does not:
    // turning on a feature that talks to an external service is a decision
    // made per device, by the person holding it, not inherited from a file.
    // (The API key lives under its own storage key and is never in `db`, so
    // there is nothing here that could carry it either.)
    ai: { analysis: db.ai?.analysis || null, dismissed: db.ai?.dismissed || [] },
    photos,
  };
}

/* Stamp the moment a backup file actually reached the user's disk. This is the
   only signal the app has for "your data exists somewhere other than here", and
   the dashboard nudge reads it. Both the full backup and the JSON export count;
   CSV/XLSX deliberately do not, since neither can be restored from. */
function markBackedUp(setDb) {
  setDb((prev) => ({
    ...prev,
    profile: { ...prev.profile, lastBackupAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  }));
}

/* Pure: is this JSON one of ours, and what's inside? Accepts both full
   backups and the older data-only exports (which have no photos array).
   The app used to be called "Family Health Journal"; files written under that
   name have to keep opening, so both strings are recognised forever. */
const BACKUP_APP_IDS = ["Family Health Journal", "Health Journal"];
function validateBackup(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return { ok: false, error: "Not a valid backup file." };
  if (!BACKUP_APP_IDS.includes(obj.app)) return { ok: false, error: `This file isn't a ${APP_NAME} backup.` };
  if (!obj.profile || typeof obj.profile !== "object" || !Array.isArray(obj.entries)) {
    return { ok: false, error: "Backup is missing its setup or entries." };
  }
  const dates = obj.entries.map((e) => e && e.date).filter(Boolean).sort();
  const photos = Array.isArray(obj.photos) ? obj.photos.filter((p) => p && p.id && p.full) : [];
  return {
    ok: true,
    summary: {
      kind: photos.length ? "full" : "data",
      entries: obj.entries.length,
      photos: photos.length,
      reports: Array.isArray(obj.reports) ? obj.reports.length : 0,
      food: Array.isArray(obj.food) ? obj.food.length : 0,
      bowel: Array.isArray(obj.bowel) ? obj.bowel.length : 0,
      routine: Array.isArray(obj.routine) ? obj.routine.length : 0,
      sun: Array.isArray(obj.sun) ? obj.sun.length : 0,
      labs: Array.isArray(obj.labs) ? obj.labs.length : 0,
      from: dates[0] || null, to: dates[dates.length - 1] || null,
      name: (obj.profile.name || "").trim(),
      exportedAt: obj.exportedAt || null,
    },
  };
}

/* Restore order is deliberate: write the incoming photo blobs first (new ids
   can't collide with anything the user would miss), then swap the database,
   then clear out old blobs. A quota failure mid-photo-write rolls back inside
   savePhotos and leaves the current data untouched. */
async function restoreBackup(obj, setDb) {
  const photos = Array.isArray(obj.photos) ? obj.photos.filter((p) => p && p.id && p.full) : [];
  const oldIx = await loadPhotoIndex();
  const incoming = new Set(photos.map((p) => p.id));
  if (photos.length) {
    await savePhotos(photos.map((p) => ({
      id: p.id, full: p.full, thumb: p.thumb || p.full,
      fieldKey: p.meta?.fieldKey || "", date: p.meta?.date || "", takenAt: p.meta?.takenAt || "",
    })));
  }
  const next = migrateDb({
    profile: obj.profile, entries: obj.entries, reports: Array.isArray(obj.reports) ? obj.reports : [],
    food: obj.food, bowel: obj.bowel, foods: obj.foods,
    routine: obj.routine, routineItems: obj.routineItems,
    episodes: obj.episodes,
    // `enabled` is deliberately not restored — see buildFullBackup.
    ai: { ...DEFAULT_AI, analysis: obj.ai?.analysis ?? null, dismissed: Array.isArray(obj.ai?.dismissed) ? obj.ai.dismissed : [] },
    ack: true, onboarded: true,
  });
  setDb(next);
  const stale = Object.keys(oldIx).filter((id) => !incoming.has(id));
  if (stale.length) await deletePhotos(stale);
}

/* Pure: rough on-device footprint. Photo bytes come from the index (recorded
   at save time); the rest is the JSON itself. */
function storageUsage(db, photoIndex) {
  let photoBytes = 0, photoCount = 0;
  for (const meta of Object.values(photoIndex || {})) {
    photoBytes += meta.bytes || 0; photoCount++;
  }
  let dbBytes = 0;
  try { dbBytes = JSON.stringify(db).length; } catch (e) { /* leave 0 */ }
  return { dbBytes, photoBytes, photoCount, totalBytes: dbBytes + photoBytes };
}
const fmtBytes = (b) => b >= 1024 * 1024 ? `${(b / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;

/* Pure: which photos fall before the cutoff date, and how much they weigh. */
function photosOlderThan(photoIndex, cutoff) {
  const ids = [], bytes = { total: 0 };
  for (const [id, meta] of Object.entries(photoIndex || {})) {
    if ((meta.date || "") < cutoff) { ids.push(id); bytes.total += meta.bytes || 0; }
  }
  return { ids, bytes: bytes.total };
}

/* Pure: strip references to deleted photo ids from entries and baselines so
   nothing points at a blob that no longer exists. */
function scrubPhotoRefs(db, idSet) {
  const entries = db.entries.map((e) => {
    if (!e.photos) return e;
    const kept = Object.fromEntries(Object.entries(e.photos).filter(([, p]) => p && !idSet.has(p.photoId)));
    return Object.keys(kept).length === Object.keys(e.photos).length ? e : { ...e, photos: kept };
  });
  const baselines = Object.fromEntries(
    Object.entries(db.profile.photoBaselines || {}).filter(([, id]) => !idSet.has(id)));
  return { ...db, entries, profile: { ...db.profile, photoBaselines: baselines } };
}

/* Pure: one spreadsheet row per photo in range — the XLSX photo legend. */
function photoLegendRows(tpl, entries, start, end) {
  return buildPhotoItems(tpl, entries)
    .filter((it) => it.date >= start && it.date <= end)
    .slice().sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((it) => ({
      date: it.date,
      question: it.field.label,
      body_part: bodyPartLabel(it.field) || "",
      rating: it.rating != null ? it.rating : "",
      rating_from: it.field.linkedTo ? (linkedLabel(it.field, tpl) || "") : (it.rating != null ? "photo" : ""),
      caption: it.captionVal || "",
      note: it.note || "",
      photo_id: it.photoId,
    }));
}

/* ---------- daily reminder ---------- */

const DEFAULT_REMINDER = { enabled: false, time: DEFAULT_REMINDER_TIME, notify: false };
/* Settings card: a list of reminder times, then how the phone should say so.

   One time was never enough. A check-in belongs at the end of the day; meals
   belong at meal times, because the whole point of logging food is doing it
   while you eat rather than reconstructing dinner at 9pm.

   The calendar file is listed first on purpose — it is the only one of the two
   delivery routes that still works with the browser closed, and pretending
   otherwise would set people up to quietly stop logging. */
function ReminderCard({ profile, onSave }) {
  const reminders = sortReminders(readReminders(profile));
  const [perm, setPerm] = useState(() => notificationPermission());
  const [msg, setMsg] = useState(null);
  const [adding, setAdding] = useState(false);

  const commit = (next) => onSave(sortReminders(next));
  const patch = (id, p) => commit(reminders.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const remove = (id) => commit(reminders.filter((r) => r.id !== id));
  const add = (preset) => {
    setAdding(false);
    commit([...reminders, newReminder(preset)]);
  };

  const live = reminders.filter((r) => r.enabled);

  const addToCalendar = () => {
    try {
      const ics = buildRemindersICS(live);
      download(new Blob([ics], { type: "text/calendar;charset=utf-8" }), "health-journal-reminders.ics");
      reportResult(setMsg, {
        ok: true,
        text: `Calendar file saved with ${live.length} reminder${live.length === 1 ? "" : "s"} — open it to add them to your phone.`,
      });
    } catch (e) {
      reportResult(setMsg, { ok: false, text: "Couldn't build the calendar file on this device." });
    }
  };

  const enableNotifications = async () => {
    const result = await requestNotificationPermission();
    setPerm(result);
    if (result === "granted") {
      reportResult(setMsg, { ok: true, text: "Browser reminders on, for the days you leave the app open." });
    } else if (result === "denied") {
      reportResult(setMsg, { ok: false, text: "Your browser blocked notifications for this site. The calendar file above works regardless." });
    }
  };

  const used = new Set(reminders.map((r) => r.label.toLowerCase()));
  const presets = REMINDER_PRESETS.filter((p) => !used.has(p.label.toLowerCase()));

  return (
    <Card className="mt-3">
      <div className="fhj-eyebrow mb-1">Reminders</div>
      <p className="text-sm leading-relaxed mb-3" style={{ color: C.sub }}>
        A journal only helps if you write in it. Add as many times as suit your day — meals while
        you're eating, a check-in in the evening.
      </p>

      {reminders.length === 0 ? (
        <div className="fhj-empty fhj-cat-symptom" style={{ padding: "1.25rem 0.5rem" }}>
          <span className="fhj-empty-art" style={{ width: "2.75rem", height: "2.75rem" }}>
            <Icon name="bell" size={18} color="currentColor" />
          </span>
          <span className="fhj-empty-text">No reminders yet.</span>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden mb-3" style={{ border: `1px solid ${C.line}` }}>
          {reminders.map((r, i) => (
            <div key={r.id} className="flex items-center gap-2 px-3 py-2"
              style={{ borderTop: i > 0 ? `1px solid ${C.line}` : "none", opacity: r.enabled ? 1 : 0.5 }}>
              <button type="button" role="switch" aria-checked={r.enabled}
                aria-label={`${r.label} reminder`}
                onClick={() => patch(r.id, { enabled: !r.enabled })}
                className="shrink-0">
                <span className={"fhj-switch" + (r.enabled ? " is-on" : "")} />
              </button>
              <input
                value={r.label}
                onChange={(e) => patch(r.id, { label: e.target.value.slice(0, 60) })}
                aria-label={`name for the ${formatTime(r.time)} reminder`}
                className="flex-1 min-w-0 bg-transparent text-sm outline-none"
                style={{ color: C.ink }} />
              <input type="time" value={r.time}
                onChange={(e) => { if (isValidTime(e.target.value)) patch(r.id, { time: e.target.value }); }}
                aria-label={`time for ${r.label}`}
                className="px-2 py-1.5 rounded-lg text-sm font-medium shrink-0"
                style={{ background: C.faint, border: `1px solid ${C.line}`, color: C.ink }} />
              <button type="button" onClick={() => remove(r.id)} aria-label={`delete ${r.label} reminder`}
                className="w-8 h-8 flex items-center justify-center rounded-full shrink-0">
                <Icon name="x" size={14} color={C.subtle} />
              </button>
            </div>
          ))}
        </div>
      )}

      {adding ? (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {presets.map((p) => (
            <button key={p.label} type="button" onClick={() => add(p)} className="fhj-chip">
              {p.label} · {formatTime(p.time)}
            </button>
          ))}
          <button type="button" onClick={() => add({ label: "Reminder", time: DEFAULT_REMINDER_TIME })}
            className="fhj-chip">Custom</button>
          <button type="button" onClick={() => setAdding(false)} className="fhj-chip">Cancel</button>
        </div>
      ) : (
        <Button variant="secondary" block icon="plus" onClick={() => setAdding(true)}>Add a reminder</Button>
      )}

      {live.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          <Button variant="primary" block onClick={addToCalendar}>
            Add {live.length} reminder{live.length === 1 ? "" : "s"} to my calendar
          </Button>
          <p className="text-[11px] leading-relaxed" style={{ color: C.sub }}>
            Downloads a small calendar file that repeats daily. Your phone does the reminding, so it still
            works when the app is closed. Nothing is sent anywhere — the file never leaves your device
            unless you put it somewhere yourself.
          </p>
        </div>
      )}

      {perm !== "unsupported" && live.length > 0 && (
        <div className="mt-4 pt-3" style={{ borderTop: `1px solid ${C.line}` }}>
          {perm === "granted" ? (
            <p className="text-[11px] leading-relaxed" style={{ color: C.sub }}>
              Browser reminders are on. They only fire while the app is open or running in the
              background, which is why the calendar file above is the one that matters.
            </p>
          ) : (
            <button onClick={enableNotifications} disabled={perm === "denied"}
              className="w-full py-2.5 rounded-xl text-sm font-medium disabled:opacity-50" style={{ background: C.faint }}>
              {perm === "denied" ? "Notifications blocked in browser settings" : "Also allow browser notifications"}
            </button>
          )}
        </div>
      )}

      {msg && (
        <div className="mt-3 px-3 py-2 rounded-xl text-sm"
          style={{ background: msg.ok ? C.faint : C.dangerBg, color: msg.ok ? C.ink : C.dangerInk }}>
          {msg.text}
        </div>
      )}
    </Card>
  );
}

/* Optional daily nutrition targets. Blank means "no target", which is the
   default and stays the default — this app does not decide that someone ought
   to have a calorie goal, and an unset target shows no progress bar rather
   than a zero one. */
function GoalsCard({ goals, onSave }) {
  const [draft, setDraft] = useState(() => ({ ...(goals || {}) }));
  const set = (k, raw) => {
    const next = { ...draft };
    if (raw === "") delete next[k];
    else {
      const n = Number(raw);
      if (isFinite(n) && n >= 0) next[k] = n;
    }
    setDraft(next);
    onSave(sanitizeGoals(next));
  };
  return (
    <Card className="mt-3 fhj-cat-food">
      <div className="fhj-eyebrow mb-1">Daily nutrition targets</div>
      <p className="text-sm leading-relaxed mb-3" style={{ color: C.sub }}>
        Optional. Set only the ones you care about — leave the rest blank and the food diary just
        shows what you ate, with no target attached.
      </p>
      {NUTRIENTS.map((n) => (
        <label key={n.k} className="flex items-center gap-2.5 py-1.5">
          <span className="text-xs flex-1 min-w-0" style={{ color: C.sub }}>{n.label}</span>
          <input type="number" inputMode="numeric" className="fhj-input" placeholder="none"
            style={{ width: "6rem", minHeight: 38, padding: "0.375rem 0.5rem", textAlign: "right", fontVariantNumeric: "tabular-nums" }}
            aria-label={`daily ${n.label} target in ${n.unit}`}
            value={draft[n.k] == null ? "" : String(draft[n.k])}
            onChange={(e) => set(n.k, e.target.value)} />
          <span className="text-[11px] w-8 shrink-0" style={{ color: C.muted }}>{n.unit}</span>
        </label>
      ))}
      <p className="text-[10.5px] leading-relaxed mt-2" style={{ color: C.subtle }}>
        These are your numbers, not advice. Nothing here is checked against a guideline, and going
        over or under a target is never flagged as good or bad.
      </p>
    </Card>
  );
}


/* Settings card: storage meter, free-up-space, full backup, restore. */
function DataDurabilityCard({ db, setDb }) {
  const [usage, setUsage] = useState(null);
  const [ix, setIx] = useState({});
  const [busy, setBusy] = useState(null); // "backup" | "restore" | "free"
  const [msg, setMsg] = useState(null);
  const [persist, setPersist] = useState(null);
  const fileRef = useRef(null);

  const refresh = async () => {
    const index = await loadPhotoIndex();
    setIx(index);
    setUsage(storageUsage(db, index));
  };
  useEffect(() => { refresh(); }, [db.entries.length, Object.keys(db.profile.photoBaselines || {}).length]); // eslint-disable-line
  useEffect(() => { storageStatus().then(setPersist).catch(() => {}); }, []);

  const askPersist = async () => {
    const status = await requestPersistentStorage();
    setPersist(status);
    reportResult(setMsg, status.persisted
      ? { ok: true, text: "This browser will now keep your journal even when storage runs low." }
      : { ok: false, text: "The browser declined for now. Installing the app to your Home Screen usually earns it — and a downloaded backup protects you either way." });
  };

  const fullBackup = async () => {
    setBusy("backup"); setMsg(null);
    try {
      const payload = await buildFullBackup(db);
      download(new Blob([JSON.stringify(payload)], { type: "application/json" }),
        `health-journal_full-backup_${todayStr()}.json`);
      markBackedUp(setDb);
      reportResult(setMsg, { ok: true, text: `Full backup saved — ${payload.entries.length} entries, ${payload.photos.length} photos.` });
    } catch (e) {
      reportResult(setMsg, { ok: false, text: "Couldn't build the backup on this device." });
    }
    setBusy(null);
  };

  const onRestoreFile = async (fileList) => {
    const file = fileList && fileList[0];
    if (!file) return;
    setBusy("restore"); setMsg(null);
    try {
      const obj = JSON.parse(await file.text());
      const v = validateBackup(obj);
      if (!v.ok) { reportResult(setMsg, { ok: false, text: v.error }); setBusy(null); return; }
      const s = v.summary;
      const desc = `Restore this backup? It replaces your current setup, entries, photos, and saved reports.\n\n` +
        `Setup: ${s.name || "(unnamed)"}\nEntries: ${s.entries}${s.from ? ` (${s.from} to ${s.to})` : ""}\n` +
        `Photos: ${s.photos}${s.kind === "data" ? " (data-only backup — existing photos will be removed)" : ""}\n` +
        `Saved reports: ${s.reports}${s.exportedAt ? `\nExported: ${s.exportedAt.slice(0, 10)}` : ""}`;
      if (!window.confirm(desc)) { setBusy(null); return; }
      await restoreBackup(obj, setDb);
      reportResult(setMsg, { ok: true, text: `Restored ${s.entries} entries and ${s.photos} photos.` });
    } catch (e) {
      reportResult(setMsg, { ok: false, text: "Restore failed — your current data was not changed. The file may be corrupted or too large for this device's storage." });
    }
    setBusy(null);
    if (fileRef.current) fileRef.current.value = "";
    refresh();
  };

  const freeSpace = async (days, label) => {
    const cutoff = days === 0 ? "9999-12-31" : addDays(todayStr(), -days);
    const { ids, bytes } = photosOlderThan(ix, cutoff);
    // "photos older than 1 year" reads straight through; "photos all of them"
    // does not, so the all-photos case gets its own phrasing.
    const phrase = days === 0 ? "— every one of them" : label;
    if (!ids.length) { setMsg({ ok: true, text: `No photos ${phrase} to delete.` }); return; }
    if (!window.confirm(`Delete ${ids.length} photo${ids.length === 1 ? "" : "s"} ${phrase} (${fmtBytes(bytes)})? ` +
      "Ratings and entries stay — only the pictures are removed. This cannot be undone. " +
      "Consider saving a full backup first.")) return;
    setBusy("free"); setMsg(null);
    try {
      await deletePhotos(ids);
      setDb((prev) => scrubPhotoRefs(prev, new Set(ids)));
      reportResult(setMsg, { ok: true, text: `Freed ${fmtBytes(bytes)} — ${ids.length} photo${ids.length === 1 ? "" : "s"} removed.` });
    } catch (e) {
      reportResult(setMsg, { ok: false, text: "Couldn't delete some photos." });
    }
    setBusy(null);
    refresh();
  };

  const oldCounts = (days) => photosOlderThan(ix, days === 0 ? "9999-12-31" : addDays(todayStr(), -days));

  return (
    <Card className="mt-3">
      <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: C.sub }}>Backup & storage</div>
      <div className="flex items-center justify-between text-sm mb-3">
        <span style={{ color: C.sub }}>{describeBackupAge(db.profile.lastBackupAt)}</span>
        {db.profile.lastBackupAt && (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
            style={{ background: C.faint, color: C.sub }}>{db.profile.lastBackupAt.slice(0, 10)}</span>
        )}
      </div>
      {usage && (
        <div className="rounded-xl px-3 py-2.5 mb-3 text-sm" style={{ background: C.faint }}>
          <div className="flex justify-between"><span style={{ color: C.sub }}>On this device</span><b>{fmtBytes(usage.totalBytes)}</b></div>
          <div className="flex justify-between text-xs mt-1" style={{ color: C.sub }}>
            <span>Entries & setup</span><span>{fmtBytes(usage.dbBytes)}</span>
          </div>
          <div className="flex justify-between text-xs mt-0.5" style={{ color: C.sub }}>
            <span>{usage.photoCount} photo{usage.photoCount === 1 ? "" : "s"}</span><span>{fmtBytes(usage.photoBytes)}</span>
          </div>
        </div>
      )}
      <div className="flex flex-col gap-2">
        <button onClick={fullBackup} disabled={!!busy}
          className="fhj-btn fhj-btn-primary fhj-btn-block">
          {busy === "backup" ? "Building backup…" : "Full backup (entries + photos)"}
        </button>
        <button onClick={() => fileRef.current && fileRef.current.click()} disabled={!!busy}
          className="w-full py-2.5 rounded-xl text-sm font-medium disabled:opacity-50" style={{ background: C.faint }}>
          {busy === "restore" ? "Restoring…" : "Restore from backup file"}
        </button>
        <input ref={fileRef} type="file" accept=".json,application/json" className="hidden"
          onChange={(e) => onRestoreFile(e.target.files)} />
      </div>

      {/* Browsers evict site storage — Safari after 7 idle days, others under
          pressure. Say so plainly and offer the one lever the platform gives us. */}
      <div className="mt-4 pt-3" style={{ borderTop: `1px solid ${C.line}` }}>
        <div className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: C.sub }}>
          Keeping it on this device
        </div>
        {persist && persist.persisted ? (
          <p className="text-[12px] leading-relaxed" style={{ color: C.sub }}>
            <b style={{ color: C.good }}>Protected.</b> This browser has marked your journal as persistent —
            it won't be cleared to free up space. Clearing site data by hand still erases it, so keep a backup.
          </p>
        ) : (
          <>
            <p className="text-[12px] leading-relaxed mb-2" style={{ color: C.sub }}>
              Browsers can clear a site's storage on their own to reclaim space
              {isIOSWebBrowser() && !isStandalone() ? ", and Safari clears it after about a week without a visit" : ""}
              . Two things prevent that: asking the browser to keep it, and{" "}
              {isStandalone() ? "the downloaded backup above" : "adding the app to your Home Screen"}.
            </p>
            {persist && persist.supported && (
              <button onClick={askPersist}
                className="w-full py-2.5 rounded-xl text-sm font-medium" style={{ background: C.faint }}>
                Ask this browser to keep my journal
              </button>
            )}
          </>
        )}
      </div>
      {usage && usage.photoCount > 0 && (
        <>
          <div className="text-xs font-semibold uppercase tracking-wider mt-4 mb-1.5" style={{ color: C.sub }}>Free up space</div>
          <div className="flex flex-col gap-1.5">
            {[[180, "older than 6 months"], [365, "older than 1 year"], [0, "all of them"]].map(([days, label]) => {
              const { ids, bytes } = oldCounts(days);
              if (!ids.length) return null;
              return (
                <button key={days} onClick={() => freeSpace(days, label)} disabled={!!busy}
                  className="w-full py-2.5 px-3.5 rounded-xl text-left flex items-center justify-between gap-3 disabled:opacity-50"
                  style={{ background: C.faint }}>
                  <span className="text-[13px] font-medium min-w-0">Delete photos {label}</span>
                  <span className="text-[11.5px] shrink-0 tabular-nums whitespace-nowrap" style={{ color: C.subtle }}>
                    {ids.length} · {fmtBytes(bytes)}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-[11px] mt-1.5 leading-relaxed" style={{ color: C.sub }}>
            Deleting photos keeps your entries and ratings — only the pictures go. Back up first if you might want them later.
          </p>
        </>
      )}
      {msg && (
        <div className="mt-3 px-3 py-2 rounded-xl text-sm"
          style={{ background: msg.ok ? C.faint : C.dangerBg, color: msg.ok ? C.ink : C.dangerInk }}>
          {msg.text}
        </div>
      )}
    </Card>
  );
}

/* ---------- appearance ----------
   The preference is kept in localStorage rather than in the journal, because
   it has to be readable synchronously before the first paint (see the inline
   script in index.html) — otherwise every cold start flashes white. */
function AppearanceCard() {
  return (
    <Card className="mt-3">
      <div className="fhj-eyebrow mb-2.5">Appearance</div>
      <AppearancePanel onChoice={() => feedback("select")} />
    </Card>
  );
}

/* ---------- optional AI ----------
   Everything here is inert until someone deliberately turns it on. The key is
   held outside the journal object so it cannot be exported, and the copy is
   honest about what "stored locally" does and does not buy you. */
function AiSettingsCard({ ai, setAi, db, onSetupComplete }) {
  const [conn, setConn] = useState(null); // null = nothing stored
  const [status, setStatus] = useState(null);         // { ok, message }
  const [testing, setTesting] = useState(false);
  const [wizard, setWizard] = useState(null);

  const enabled = ai?.enabled === true;
  const configured = enabled && !!conn;

  const refresh = () => loadConnection().then((c) => setConn(c));
  useEffect(() => { refresh(); }, []);

  /* Setup — including replacing a key — always runs through the guided flow.
     Keeping a second, subtly different inline form here is how two paths drift
     apart, and the wizard is the one that explains itself. */
  const openWizard = () => {
    setStatus(null);
    const tpl = getProfileTemplate(db.profile);
    const input = buildAnalysisInput(tpl.fields, entriesFor(db), addDays(todayStr(), -89), todayStr());
    setWizard({
      input,
      summary: summariseInput(input),
      windowLabel: `${fmtNice(input.startDate)} – ${fmtNice(input.endDate)}`,
    });
  };

  const test = async () => {
    setTesting(true);
    setStatus(null);
    try {
      const active = await loadConnection();
      if (!active) { setStatus({ ok: false, message: "There's no key to test yet." }); return; }
      const res = await testConnection(active);
      setStatus(res.ok
        ? { ok: true, message: `Connected. Using ${res.model}.` }
        : { ok: false, message: res.message });
    } finally {
      setTesting(false);
    }
  };

  const remove = async () => {
    if (!window.confirm("Remove the API key from this device? AI observations will stop until you add one again.")) return;
    await clearKey();
    setStatus({ ok: true, message: "Key removed from this device." });
    await refresh();
  };

  return (
    <Card className="mt-3">
      <div className="flex items-center justify-between gap-3 mb-1">
        <div className="fhj-eyebrow">AI observations</div>
        <Badge tone={configured ? "good" : "neutral"}>{configured ? "On" : "Optional"}</Badge>
      </div>

      <p className="text-sm leading-relaxed mt-2" style={{ color: C.sub }}>
        Off by default. When it's on, the Possible Patterns section gains a button that sends a
        minimal summary of your logged <i>numbers</i> — no notes, no photos, no name — to{" "}
        an AI provider you choose, using your own API key, and shows what it noticed. You see exactly what
        would be sent, and confirm, every single time.
      </p>

      {!configured ? (
        <>
          <p className="text-sm leading-relaxed mt-2" style={{ color: C.sub }}>
            {enabled
              ? "It's switched on, but there's no key on this device yet."
              : "Setup is a short guided walkthrough — it gets you the free Google key, checks it works, and explains each step as it goes."}
          </p>
          <Button variant="primary" block className="mt-4" icon="spark" onClick={openWizard}>
            {enabled ? "Add a key — guided" : "Set it up — about a minute"}
          </Button>
          {enabled && (
            <Button variant="ghost" block className="mt-2"
              onClick={() => { setAi({ enabled: false }); feedback("select"); }}>
              Turn AI observations off
            </Button>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center gap-2.5 p-3 rounded-xl mt-4" style={{ background: C.faint }}>
            <Icon name="key" size={16} color={C.good} />
            <span className="min-w-0 flex-1">
              <span className="text-sm font-medium block truncate">{providerOf(conn?.provider).label}</span>
              <span className="text-[11.5px] block truncate" style={{ color: C.subtle }}>
                {conn ? maskKey(conn.key) : ""}{conn?.model ? ` · ${conn.model}` : ""}
              </span>
            </span>
            <Badge tone="good">Connected</Badge>
          </div>
          <div className="flex flex-wrap gap-2 mt-2.5">
            <Button variant="secondary" size="sm" onClick={test} disabled={testing}>
              {testing ? "Testing…" : "Test key"}
            </Button>
            <Button variant="secondary" size="sm" onClick={openWizard}>Replace</Button>
            <Button variant="danger" size="sm" icon="trash" onClick={remove}>Remove</Button>
          </div>

          <div className="mt-3 pt-1" style={{ borderTop: `1px solid ${C.line}` }}>
            <SwitchRow
              on={enabled}
              onChange={(on) => { setAi({ enabled: on }); feedback("select"); }}
              label="Enable AI observations"
              desc="The analysis button appears on the dashboard. It still asks before sending anything." />
          </div>

          {/* The one switch in this app that trades a confirmation for speed.
              It is worth offering — a photo answers four form questions at
              once and typing them out is the reason people stop logging — but
              it is not worth sliding past anyone. The description says exactly
              what changes, in the plainest words available, and the switch is
              off until someone reads it and decides. */}
          {enabled && (
            <div className="mt-1 pt-1" style={{ borderTop: `1px solid ${C.line}` }}>
              <SwitchRow
                on={ai?.auto === true}
                onChange={(on) => { setAi({ auto: on }); feedback("select"); }}
                label="Let AI fill in the log for you"
                desc={
                  "When you attach a photo to a meal or a bowel entry, it is sent for a reading straight away — " +
                  "without the confirm-before-sending step — and the answers it can work out (type, amount, colour, " +
                  "consistency, calories and the rest) are filled in for you. Your own answers are never overwritten, " +
                  "and you can change anything it wrote."
                } />
            </div>
          )}
        </>
      )}

      {status && (
        <div className="mt-3 p-3 rounded-xl text-[12.5px] leading-relaxed" role="status"
          style={{
            background: status.ok ? C.goodSoft : C.dangerBg,
            color: status.ok ? C.good : C.dangerInk,
          }}>
          {status.message}
        </div>
      )}

      {/* The honest part. A local-first app cannot promise a vault, so it
          shouldn't imply one. */}
      {configured && (
        <div className="mt-3.5 p-3 rounded-xl" style={{ background: C.faint }}>
          <div className="flex items-center gap-2 mb-1.5">
            <Icon name="warn" size={14} color={C.warn} />
            <span className="text-[12px] font-semibold">What "stored locally" really means</span>
          </div>
          <p className="text-[11.5px] leading-relaxed" style={{ color: C.sub }}>
            A key saved here sits in this browser's storage on this device. That keeps it out of
            your backups and away from any server — but it is <b>not encrypted</b>, and it can't
            be: there's no password in this app to encrypt it with that an attacker holding your
            unlocked device wouldn't also have. Anyone who can use this browser profile can read
            it. Whatever you choose, you can revoke the key at Google at any time, and that
            revocation is what actually stops it working.
          </p>
        </div>
      )}

      {wizard && (
        <AiSetupWizard
          input={wizard.input} summary={wizard.summary} windowLabel={wizard.windowLabel}
          setAi={setAi}
          onRun={onSetupComplete}
          onClose={() => { setWizard(null); refresh(); }} />
      )}
    </Card>
  );
}

/* ---------- cross-device sync ----------

   The product decision this UI encodes: **Local Only is not a downgrade.** It
   is the default, it needs no account, and everything below is an option
   someone may never take. So the card leads with which of the two states the
   journal is in, in two words, and nothing here ever nags.

   The other decision: the word "Supabase" appears nowhere a normal user can
   see it, and neither do "database", "bucket", "token", or "row". Someone
   turning this on is answering two questions — what's your email, and what
   passphrase should encrypt this — and the rest is the app's problem. The one
   place infrastructure surfaces is the self-hosting panel, which is folded
   away and addressed to a different person entirely.

   ============================================================ */

/* Sync is on when it is on. The only moments that earn a sound are the ones a
   person caused: finishing setup, and a failure that needs them. Everything
   else — a laptop picking up a change made on a phone an hour ago — happens
   without a word, which is what "invisible" has to mean. */

function SyncBadge({ status }) {
  const { phase, pending } = status;
  const tone =
    phase === "idle" ? "good" :
    phase === "syncing" ? "neutral" :
    phase === "offline" ? "neutral" :
    phase === "off" ? "neutral" : "warn";
  const label =
    phase === "off" ? "Local only" :
    phase === "idle" ? "Synced" :
    phase === "syncing" ? "Syncing…" :
    phase === "offline" ? (pending ? `${pending} waiting` : "Offline") :
    phase === "blocked" ? "Needs you" : "Retrying";
  return <Badge tone={tone}>{label}</Badge>;
}

/** The one sentence under the badge. Never alarming, never a lie, and always
    the same shape: what is true, then what happens next. */
function syncLine(status) {
  const { phase, pending, lastSyncedAt } = status;
  if (phase === "off") {
    return "Saved on this device. No account, nothing uploaded.";
  }
  if (phase === "blocked" || phase === "error") return status.message;
  if (phase === "offline") {
    return pending
      ? `${pending} ${pending === 1 ? "change is" : "changes are"} saved here and will sync when you're back online.`
      : "Offline. Everything here is saved on this device.";
  }
  if (pending) {
    return `${pending} ${pending === 1 ? "change" : "changes"} saved on this device, sending now.`;
  }
  if (!lastSyncedAt) return "Saved on this device and synced across your devices.";
  const mins = Math.round((Date.now() - Date.parse(lastSyncedAt)) / 60000);
  const when =
    !Number.isFinite(mins) ? "" :
    mins < 1 ? " Last synced just now." :
    mins < 60 ? ` Last synced ${mins} min ago.` :
    ` Last synced ${new Date(lastSyncedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}.`;
  return `Saved on this device and synced across your devices.${when}`;
}

/**
 * The only place sync appears outside Settings, and it appears for exactly one
 * reason: something is stuck and the app cannot unstick it alone.
 *
 * Not a status light. A permanent "synced" pill would be a small anxiety
 * generator on a screen someone opens to record how much pain they are in, and
 * a spinner on every save would advertise a network the app has spent its whole
 * design not depending on. Working, offline, retrying and syncing are all
 * states where the right thing to do is nothing — so this renders nothing.
 */
function SyncAlert({ status, onOpen }) {
  if (!status || !status.action || status.action === "retry") return null;
  return (
    <button type="button" onClick={() => { feedback("nav"); onOpen(); }}
      className="fhj-badge fhj-badge-warn shrink-0"
      style={{ gap: "0.3rem", cursor: "pointer" }}
      title={status.message}>
      <Icon name="warn" size={11} color="currentColor" />
      Sync
    </button>
  );
}

/* ---------- the guided flow ---------- */

const SYNC_STEPS = ["What this does", "Sign in", "Passphrase", "Done"];

function SyncFlowProgress({ index }) {
  return (
    <div className="flex gap-1.5 mb-4" aria-hidden="true">
      {SYNC_STEPS.map((label, i) => (
        <div key={label} className="flex-1 rounded-full" style={{
          height: 3,
          background: i <= index ? C.accent : C.line,
          transition: "background-color 200ms ease",
        }} />
      ))}
    </div>
  );
}

function PassphraseMeter({ verdict }) {
  const tone = verdict.score >= 4 ? C.good : verdict.score >= 3 ? C.accent : verdict.score >= 2 ? C.warn : C.alert;
  return (
    <div className="mt-2">
      <div className="flex gap-1" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex-1 rounded-full" style={{
            height: 3, background: i < verdict.score ? tone : C.line,
          }} />
        ))}
      </div>
      <p className="text-[11.5px] leading-relaxed mt-1.5" style={{ color: verdict.ok ? C.subtle : C.alert }}>
        <span className="font-semibold" style={{ color: tone }}>{verdict.label}.</span> {verdict.hint}
      </p>
    </div>
  );
}

/**
 * Explain → Sign in → Passphrase → Done.
 *
 * Four screens, one job each, and every one of them survivable: closing at any
 * point leaves the journal exactly as it was, because nothing is uploaded until
 * the last step and the local copy is never the thing being changed.
 */
function SyncSetupFlow({ engine, onClose, onFinished }) {
  const [step, setStep] = useState("explain");
  const [email, setEmail] = useState(engine?.getEmail?.() || "");
  const [code, setCode] = useState("");
  const [pass, setPass] = useState("");
  const [existing, setExisting] = useState(false);
  const [photos, setPhotos] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [summary, setSummary] = useState(null);
  const index = { explain: 0, email: 1, code: 1, passphrase: 2, done: 3 }[step] ?? 0;

  const bodyRef = useRef(null);
  const fail = (e) => {
    setErr(String(e?.message || e || "Something went wrong.").replace(/^session: /, ""));
    /* A wrong code and a wrong passphrase are the two things people will
       actually hit here, and both are worth answering in the same breath they
       were made — the shake lands before the sentence is read. */
    feedback("error", { el: bodyRef.current });
  };

  const sendCode = async () => {
    setErr(null); setBusy(true);
    try {
      await engine.requestCode(email);
      feedback("select");
      setStep("code");
    } catch (e) { fail(e); } finally { setBusy(false); }
  };

  const verify = async () => {
    setErr(null); setBusy(true);
    try {
      await engine.verifyCode(email, code);
      /* Which question the next screen asks depends entirely on this: a journal
         that has been set up before needs the passphrase it already has, and
         asking someone to "choose" one there would silently lock them out of
         everything they have already synced. */
      setExisting(await engine.hasRemoteMeta());
      feedback("save");
      setStep("passphrase");
    } catch (e) { fail(e); } finally { setBusy(false); }
  };

  const finish = async () => {
    setErr(null); setBusy(true);
    try {
      const before = engine.countLocal();
      await engine.unlock(pass);
      await engine.enable({ photos });
      await engine.settle();
      setSummary({ before, after: engine.countLocal() });
      feedback("complete");
      setStep("done");
    } catch (e) { fail(e); } finally { setBusy(false); }
  };

  const body = {
    explain: (
      <>
        <p className="text-sm leading-relaxed mb-3" style={{ color: C.sub }}>
          Turn this on and your journal stays on every device you use it on. Log a meal on your
          phone, open your laptop, and it's already there.
        </p>
        <ul className="flex flex-col gap-2.5 mb-3">
          {[
            ["device", "Nothing changes about how it feels", "Saving stays instant and works with no signal. Syncing happens quietly afterwards."],
            ["key", "Encrypted before it leaves this device", "Your entries are locked with a passphrase you choose in a moment. It never leaves your device, so the server only ever holds unreadable data."],
            ["download", "Still yours", "Exports, backups and offline use all work exactly as they do now. You can switch this off any time and keep everything."],
          ].map(([icon, title, text]) => (
            <li key={title} className="flex gap-2.5">
              <span className="fhj-icon-btn shrink-0" style={{ width: "1.9rem", height: "1.9rem", pointerEvents: "none" }}>
                <Icon name={icon} size={14} color={C.accentText} />
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold">{title}</span>
                <span className="block text-[11.5px] leading-relaxed" style={{ color: C.subtle }}>{text}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="text-[11px] leading-relaxed" style={{ color: C.subtle }}>
          Worth knowing: because the app is delivered over the web, encryption in the browser can't
          protect you from someone who controls the site itself. It does mean the sync server never
          receives anything readable. This is not a medical-records service and makes no compliance
          claim.
        </p>
      </>
    ),
    email: (
      <>
        <p className="text-sm leading-relaxed mb-3" style={{ color: C.sub }}>
          Your devices need one thing in common to find each other. We'll email you a six-digit
          code — there's no password to invent or remember.
        </p>
        <label className="fhj-label" htmlFor="fhj-sync-email">Email</label>
        <input id="fhj-sync-email" className="fhj-input" type="email" inputMode="email"
          autoComplete="email" placeholder="you@example.com"
          value={email} onChange={(e) => setEmail(e.target.value)} />
      </>
    ),
    code: (
      <>
        <p className="text-sm leading-relaxed mb-3" style={{ color: C.sub }}>
          We sent a code to <span className="font-semibold" style={{ color: C.ink }}>{email}</span>.
          It may take a minute, and it's worth checking spam.
        </p>
        <label className="fhj-label" htmlFor="fhj-sync-code">Six-digit code</label>
        <input id="fhj-sync-code" className="fhj-input" inputMode="numeric" autoComplete="one-time-code"
          maxLength={8} placeholder="123456"
          style={{ letterSpacing: "0.3em", fontSize: "1.1rem" }}
          value={code} onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ""))} />
        <button type="button" className="text-[12px] font-semibold mt-2.5"
          style={{ color: C.accentText }}
          onClick={() => { feedback("tap"); setCode(""); setStep("email"); }}>
          Use a different email
        </button>
      </>
    ),
    passphrase: (
      <>
        <p className="text-sm leading-relaxed mb-3" style={{ color: C.sub }}>
          {existing
            ? "This journal is already encrypted. Enter the same passphrase you used on your other device to unlock it here."
            : "Choose a passphrase. It encrypts your journal before it's uploaded, and it never leaves your device — which also means nobody, including us, can reset it for you."}
        </p>
        <label className="fhj-label" htmlFor="fhj-sync-pass">Sync passphrase</label>
        <input id="fhj-sync-pass" className="fhj-input" type="password"
          autoComplete={existing ? "current-password" : "new-password"}
          placeholder={existing ? "Your passphrase" : "Three or four unrelated words"}
          value={pass} onChange={(e) => setPass(e.target.value)} />
        {!existing && (
          <>
            <PassphraseMeter verdict={ratePassphrase(pass)} />
            <button type="button" className="text-[12px] font-semibold mt-1"
              style={{ color: C.accentText }}
              onClick={() => { feedback("select"); setPass(suggestPassphrase()); }}>
              Suggest one for me
            </button>
            <div className="fhj-note mt-3">
              <Icon name="warn" size={14} color={C.warn} />
              <span>Write it down somewhere safe. Lose it and the synced copy can't be read again —
                the journal on this device is unaffected either way.</span>
            </div>
          </>
        )}
        <SwitchRow on={photos} onChange={(on) => { feedback(on ? "toggleOn" : "toggleOff"); setPhotos(on); }}
          label="Sync photos too"
          desc="Off by default — photos are much larger than entries. They're encrypted the same way." />
      </>
    ),
    done: (
      <>
        <div className="text-center py-2">
          <div className="fhj-icon-btn mx-auto mb-3" style={{ width: "3rem", height: "3rem", pointerEvents: "none" }}>
            <Icon name="check" size={22} color={C.good} />
          </div>
          <div className="font-display text-xl mb-1.5">Syncing</div>
          <p className="text-sm leading-relaxed" style={{ color: C.sub }}>
            {summary && summary.after > summary.before
              ? `Your journals were merged — ${summary.before} ${summary.before === 1 ? "day was" : "days were"} already here and ${summary.after - summary.before} more came from your other device. Nothing was overwritten.`
              : "Everything on this device is now on your other devices too. Open Health Journal anywhere and it'll be waiting."}
          </p>
        </div>
      </>
    ),
  }[step];

  const actions = {
    explain: <Button variant="primary" block onClick={() => { feedback("nav"); setStep("email"); }}>Continue</Button>,
    email: (
      <Button variant="primary" block disabled={busy || !/.+@.+\..+/.test(email)} onClick={sendCode}>
        {busy ? "Sending…" : "Email me a code"}
      </Button>
    ),
    code: (
      <Button variant="primary" block disabled={busy || code.length < 6} onClick={verify}>
        {busy ? "Checking…" : "Continue"}
      </Button>
    ),
    passphrase: (
      <Button variant="primary" block
        disabled={busy || (existing ? pass.length < 1 : !ratePassphrase(pass).ok)}
        onClick={finish}>
        {busy ? "Setting up…" : existing ? "Unlock and sync" : "Turn on sync"}
      </Button>
    ),
    done: <Button variant="primary" block onClick={() => { feedback("tap"); onFinished(); }}>Done</Button>,
  }[step];

  return (
    <Modal title={step === "done" ? "You're all set" : "Sync across devices"}
      eyebrow={step === "done" ? undefined : SYNC_STEPS[index]}
      onClose={busy ? undefined : onClose}
      footer={actions}>
      <SyncFlowProgress index={index} />
      <div ref={bodyRef}>{body}</div>
      {err && (
        <div className="fhj-note mt-3" role="alert" style={{ borderColor: C.alert }}>
          <Icon name="warn" size={14} color={C.alert} />
          <span>{err}</span>
        </div>
      )}
    </Modal>
  );
}

/* ---------- self-hosting ----------

   Addressed to a different reader than everything above: someone running their
   own copy of the app who has their own project to point it at. Folded away by
   default, because for everyone else its existence is noise. */

function SyncServerPanel({ onSaved }) {
  const [url, setUrl] = useState("");
  const [key, setKey] = useState("");
  const [msg, setMsg] = useState(null);
  const cfg = syncConfig();
  return (
    <Disclosure label="Use your own sync server"
      summary={cfg ? `Configured (${cfg.source === "build" ? "built in" : "set on this device"})` : "Not configured"}
      className="mt-3">
      <p className="text-[11.5px] leading-relaxed mb-2.5" style={{ color: C.subtle }}>
        Health Journal syncs through a Supabase project you control. Create one, run{" "}
        <code>supabase/schema.sql</code> from the repository in its SQL editor, then paste the
        project URL and its <em>public anon</em> key below. The anon key is designed to be public —
        every table is restricted to the signed-in owner. Never paste a service-role key anywhere.
      </p>
      <label className="fhj-label" htmlFor="fhj-sync-url">Project URL</label>
      <input id="fhj-sync-url" className="fhj-input" placeholder="https://xxxx.supabase.co"
        value={url} onChange={(e) => setUrl(e.target.value)} />
      <label className="fhj-label mt-2" htmlFor="fhj-sync-key">Public anon key</label>
      <input id="fhj-sync-key" className="fhj-input" placeholder="eyJhbGciOi…"
        value={key} onChange={(e) => setKey(e.target.value)} />
      <div className="flex gap-2 mt-2.5">
        <Button variant="secondary" size="sm" onClick={() => {
          if (setDeviceConfig(url, key)) {
            feedback("save");
            setMsg({ ok: true, text: "Saved on this device." });
            onSaved && onSaved();
          } else {
            feedback("error");
            setMsg({ ok: false, text: "That doesn't look like a project URL and an anon key." }); // feedback already fired
          }
        }}>Save</Button>
        {cfg?.source === "device" && (
          <Button variant="ghost" size="sm" onClick={() => {
            feedback("tap"); clearDeviceConfig(); setMsg({ ok: true, text: "Cleared." }); onSaved && onSaved();
          }}>Clear</Button>
        )}
      </div>
      {msg && (
        <p className="text-[11.5px] mt-2" style={{ color: msg.ok ? C.good : C.alert }}>{msg.text}</p>
      )}
    </Disclosure>
  );
}

/* ---------- the Settings card ---------- */

function SyncCard({ engine, status, available, onRefreshConfig }) {
  const [flow, setFlow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [, force] = useState(0);
  const on = status.phase !== "off";

  const syncNow = async () => {
    setBusy(true);
    feedback("tap");
    const next = await engine.settle();
    setBusy(false);
    /* One sound, and only for the outcome the person asked to see. A silent
       background sync is the normal case and stays silent. */
    feedback(next.phase === "idle" ? "syncDone" : next.phase === "blocked" || next.phase === "error" ? "warn" : "tap");
  };

  const stop = async (purge) => {
    const question = purge
      ? "Delete the synced copy from the server and stop syncing on this device? Your journal here is kept, and nothing else changes."
      : "Stop syncing on this device? Your journal stays here in full — this only disconnects it.";
    if (!window.confirm(question)) return;
    setBusy(true);
    await engine.disable({ purge });
    setBusy(false);
    feedback("save");
    toast({ text: purge ? "Synced copy deleted" : "Sync turned off — your journal is still here", icon: "check" });
  };

  return (
    <Card className="mt-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="fhj-eyebrow mb-1">Sync across devices</div>
          <p className="text-[12.5px] leading-relaxed" style={{ color: C.sub }}>{syncLine(status)}</p>
        </div>
        <SyncBadge status={status} />
      </div>

      {!available && !on && (
        <>
          <p className="text-[11.5px] leading-relaxed mt-3" style={{ color: C.subtle }}>
            This copy of Health Journal doesn't have a sync server set up, so the journal is local
            only — which is the default and works completely. Everything else on this screen is
            unaffected.
          </p>
          <SyncServerPanel onSaved={() => { onRefreshConfig && onRefreshConfig(); force((n) => n + 1); }} />
        </>
      )}

      {available && !on && (
        <div className="mt-3">
          <Button variant="primary" block icon="link" onClick={() => { feedback("nav"); setFlow(true); }}>
            Set up sync
          </Button>
          <p className="text-[11px] leading-relaxed mt-2" style={{ color: C.subtle }}>
            Takes about a minute. You can turn it off again whenever you like and keep everything.
          </p>
        </div>
      )}

      {on && (
        <div className="mt-3 flex flex-col gap-2">
          {status.email && (
            <div className="text-[11.5px]" style={{ color: C.subtle }}>
              Signed in as <span className="font-semibold" style={{ color: C.ink }}>{status.email}</span>
            </div>
          )}
          {status.action === "signIn" || status.action === "passphrase" ? (
            <Button variant="primary" block icon="key" onClick={() => { feedback("nav"); setFlow(true); }}>
              {status.action === "signIn" ? "Sign in again" : "Enter passphrase"}
            </Button>
          ) : (
            <Button variant="secondary" block icon="refresh" disabled={busy} onClick={syncNow}>
              {busy ? "Syncing…" : "Sync now"}
            </Button>
          )}
          <SwitchRow
            on={engine.photosEnabled()}
            onChange={(v) => { feedback(v ? "toggleOn" : "toggleOff"); engine.setPhotoSync(v); force((n) => n + 1); }}
            label="Sync photos too"
            desc="Photos are much larger than entries, so this is a separate choice. Encrypted the same way." />
          <Button variant="ghost" size="sm" block disabled={busy} onClick={() => stop(false)}>
            Stop syncing on this device
          </Button>
          <Button variant="ghost" size="sm" block disabled={busy} onClick={() => stop(true)}>
            Stop and delete the synced copy
          </Button>
        </div>
      )}

      {flow && (
        <SyncSetupFlow engine={engine}
          onClose={() => setFlow(false)}
          onFinished={() => { setFlow(false); force((n) => n + 1); }} />
      )}
    </Card>
  );
}

function SettingsScreen({ db, setDb, goHome, goSetup, goImport, goNoteImport, goExport, lockEnabled, onSetupPin, onChangePin, onDisablePin, setAi, onAiSetupComplete, syncEngine, syncStatus, syncConfigured, onRefreshSyncConfig }) {
  const prefs = db.profile.prefs || DEFAULT_PREFS;
  const setPrefs = (patch) => setDb((prev) => ({
    ...prev,
    profile: { ...prev.profile, prefs: { ...(prev.profile.prefs || DEFAULT_PREFS), ...patch }, updatedAt: new Date().toISOString() },
  }));
  const setReportPrefs = (reportPrefs) => setDb((prev) => ({
    ...prev, profile: { ...prev.profile, reportPrefs, updatedAt: new Date().toISOString() },
  }));
  const setReminders = (reminders) => setDb((prev) => ({
    ...prev, profile: { ...prev.profile, reminders, updatedAt: new Date().toISOString() },
  }));
  const setGoals = (goals) => setDb((prev) => ({
    ...prev, profile: { ...prev.profile, goals, updatedAt: new Date().toISOString() },
  }));
  return (
    <div className="px-4 pb-10 pt-3 fhj-stagger">
      <Card>
        <div className="fhj-eyebrow mb-2.5">Your survey</div>
        <Button variant="secondary" block icon="sliders" onClick={goSetup}>
          Edit survey / tracking setup
        </Button>
      </Card>

      <AppearanceCard />
      <ReminderCard profile={db.profile} onSave={setReminders} />
      <GoalsCard goals={db.profile.goals} onSave={setGoals} />

      <Card className="mt-3">
        <div className="fhj-eyebrow mb-1">Taps & sounds</div>
        {hapticsSupported() && (
          <>
            <SwitchRow
              on={prefs.haptics !== false}
              onChange={(on) => {
                setPrefs({ haptics: on });
                FB.prefs = { ...prefs, haptics: on };
                if (on) feedback("select");
              }}
              label="Vibration feedback" desc="A buzz on taps and saves" />
            {prefs.haptics !== false && (
              <div className="pb-3 -mt-1">
                <div className="flex gap-1.5">
                  {HAPTIC_LEVELS.map(([v, l]) => {
                    const active = (prefs.hapticStrength || DEFAULT_PREFS.hapticStrength) === v;
                    return (
                      <button key={v} type="button"
                        aria-pressed={active}
                        onClick={() => {
                          setPrefs({ hapticStrength: v });
                          // Buzz at the new strength, not the old one, so the
                          // control demonstrates itself as it is pressed.
                          FB.prefs = { ...prefs, hapticStrength: v };
                          feedback("save");
                        }}
                        className="flex-1 py-2 rounded-lg text-[11.5px] font-semibold"
                        style={{
                          background: active ? C.accent : "transparent",
                          color: active ? C.onAccent : C.sub,
                          border: `1px solid ${active ? C.accent : C.lineStrong}`,
                        }}>
                        {l}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] leading-relaxed mt-2" style={{ color: C.subtle }}>
                  Phones expose vibration length, not intensity — a stronger setting
                  is a longer pulse, which reads as a firmer one.
                </p>
              </div>
            )}
          </>
        )}
        <SwitchRow
          on={prefs.sound !== false}
          onChange={(on) => {
            setPrefs({ sound: on });
            // Flip the engine before the sound plays, or the confirmation of
            // "sounds on" is itself silent.
            FB.prefs = { ...prefs, sound: on };
            setSoundEnabled(on);
            if (on) feedback("save");
          }}
          label="Sounds"
          desc="Soft taps, a warm note when something saves, and a small chord when the day's journal is done. Quiet by design." />
        {prefs.sound !== false && (
          <div className="flex flex-wrap gap-1.5 pb-3 -mt-1">
            {[["tap", "Tap"], ["save", "Save"], ["quickadd", "Quick Add"], ["complete", "Finish"]].map(([v, l]) => (
              <button key={v} type="button" onClick={() => feedback(v)}
                className="px-2.5 py-1 rounded-full text-[11px] font-semibold"
                style={{ background: "transparent", color: C.sub, border: `1px solid ${C.lineStrong}` }}>
                {l}
              </button>
            ))}
          </div>
        )}
      </Card>

      {syncEngine && (
        <SyncCard engine={syncEngine} status={syncStatus} available={syncConfigured}
          onRefreshConfig={onRefreshSyncConfig} />
      )}

      <AiSettingsCard ai={db.ai} setAi={setAi} db={db} onSetupComplete={onAiSetupComplete} />

      <DailyContextCard
        profile={db.profile}
        contextCount={(db.context || []).length}
        onSave={(consent, opts) => setDb((prev) => ({
          ...prev,
          /* Deleting the days is part of the same writer as the switch, so
             "turn it off and remove what it collected" is one decision with
             one undo-free, unambiguous result. */
          context: opts?.wipe ? [] : prev.context,
          profile: {
            ...prev.profile,
            context: sanitizeConsent(consent),
            updatedAt: new Date().toISOString(),
          },
        }))} />

      <SunProfileCard
        profile={db.profile}
        onSave={(sun) => setDb((prev) => ({
          ...prev,
          profile: { ...prev.profile, sun: sanitizeSunProfile(sun), updatedAt: new Date().toISOString() },
        }))} />

      <Card className="mt-3">
        <div className="fhj-eyebrow mb-1.5">Report cards</div>
        <p className="text-[11.5px] leading-relaxed mb-2" style={{ color: C.subtle }}>
          Choose what appears in weekly and monthly reports.
        </p>
        <ReportPrefsSettings profile={db.profile} onSavePrefs={setReportPrefs} />
      </Card>

      <Card className="mt-3">
        <div className="fhj-eyebrow mb-2.5">Wearable data</div>
        <p className="text-sm leading-relaxed mb-3.5" style={{ color: C.sub }}>
          Import steps, heart rate, sleep, and weight history from a Google Fit / Google Health or Fitbit export
          (Google Takeout). Read on this device only — nothing is uploaded.
        </p>
        <Button variant="secondary" block onClick={goImport}>Import wearable data</Button>
      </Card>

      {/* The other kind of import: the notes somebody was already keeping
          before they found this app. Only shown once the optional AI is on,
          because reading shorthand is the whole job — see lib/import.ts. */}
      {db.ai?.enabled === true && (
        <Card className="mt-3">
          <div className="fhj-eyebrow mb-2.5">Your own notes</div>
          <p className="text-sm leading-relaxed mb-3.5" style={{ color: C.sub }}>
            Paste in what you have been writing somewhere else — a notes file, a chat with
            yourself, a photo of a page — and it gets read into meals, doses, numbers and notes
            on the days the notes themselves give. You approve every row before anything is
            written. This is the one feature that sends your writing off the device, and it
            says exactly what it is sending each time before it does.
          </p>
          <Button variant="secondary" block onClick={goNoteImport}>Import your notes</Button>
        </Card>
      )}

      <Card className="mt-3">
        <div className="fhj-eyebrow mb-2.5">App lock</div>
        <p className="text-sm leading-relaxed mb-3.5" style={{ color: C.sub }}>
          {lockEnabled
            ? "A PIN is required to open the app on this device, and it re-locks whenever you leave the app."
            : "Off by default — the app opens straight to your journal, like today. Turn this on if this device is ever shared and you want a PIN before it opens."}
        </p>
        {lockEnabled ? (
          <div className="flex flex-col gap-2">
            <Button variant="secondary" block onClick={onChangePin}>Change PIN</Button>
            <Button variant="danger" block onClick={onDisablePin}>Turn off PIN lock</Button>
          </div>
        ) : (
          <Button variant="primary" block onClick={onSetupPin}>Turn on PIN lock</Button>
        )}
      </Card>

      <Card className="mt-3">
        <div className="fhj-eyebrow mb-2.5">Disclaimer</div>
        <p className="text-sm leading-relaxed" style={{ color: C.sub }}>{DISCLAIMER}</p>
      </Card>

      <DataDurabilityCard db={db} setDb={setDb} />

      <Card className="mt-3">
        <div className="fhj-eyebrow mb-2.5">Data</div>
        <p className="text-sm leading-relaxed mb-3.5" style={{ color: C.sub }}>
          Your journal is stored on this device. Export gives you CSV, Excel, and JSON backups.
        </p>
        <div className="flex flex-col gap-2">
          {goExport && (
            <Button variant="outline" block icon="download" onClick={goExport}>
              Export data
            </Button>
          )}
          <Button variant="secondary" block onClick={async () => {
            if (window.confirm("Replace your current setup and entries with the example Eczema + Carnivore setup? Saved photos will be deleted.")) {
              const ix = await loadPhotoIndex();
              await deletePhotos(Object.keys(ix));
              await loadSampleData(setDb); goHome();
            }
          }}>
            Restore example data
          </Button>
          <Button variant="danger" block icon="trash" onClick={async () => {
            /* With sync on, erasing only the local copy would be a trap: the
               next pull would bring the whole journal back within seconds. So
               the question says what actually happens, and the cloud copy goes
               with it. */
            const synced = syncStatus && syncStatus.phase !== "off";
            const question = synced
              ? "Erase your setup, all entries, and all saved photos — on this device and on the sync server? This cannot be undone, and it signs this device out of sync."
              : "Erase your setup, all entries, and all saved photos? This cannot be undone. You'll go back through first-time setup.";
            if (window.confirm(question)) {
              if (synced && syncEngine) await syncEngine.disable({ purge: true });
              const ix = await loadPhotoIndex();
              await deletePhotos(Object.keys(ix));
              setDb({ profile: blankProfile(), entries: [], reports: [], tombstones: [], ack: false, onboarded: false, ai: DEFAULT_AI, schemaVersion: SCHEMA_VERSION }); goHome();
            }
          }}>
            Erase all data
          </Button>
        </div>
      </Card>

      <PrivacyCard aiEnabled={db.ai?.enabled === true} aiAuto={db.ai?.enabled === true && db.ai?.auto === true}
        syncOn={!!syncStatus && syncStatus.phase !== "off"} syncEmail={syncStatus?.email}
        contextOn={db.profile.context?.enabled === true} />
      <p className="text-[11px] mt-4 text-center" style={{ color: C.subtle }}>
        {APP_NAME} {APP_VERSION} ·{" "}
        {syncStatus && syncStatus.phase !== "off"
          ? "saved on this device, encrypted across yours."
          : "your data stays on this device."}
      </p>
    </div>
  );
}

/* Daily context — the permission screen.

   This is the only switch in the app that turns on an automatic outbound
   request, so it is written to be read rather than skimmed: what is sent, what
   comes back, what is stored, and what is deliberately not. The list is
   specific enough that somebody could check it against the network tab, which
   is the only kind of privacy copy worth writing.

   The location choice is three-way rather than a toggle because "use my
   location" and "I'll tell you roughly where I am" are genuinely different
   answers, and an app that only offers the first one is telling somebody who
   would rather not share a fix that the whole feature is closed to them. */
function DailyContextCard({ profile, onSave, contextCount = 0 }) {
  const consent = profile.context || DEFAULT_CONSENT;
  const [place, setPlace] = useState(
    consent.place ? `${consent.place.lat}, ${consent.place.lon}` : ""
  );
  const [msg, setMsg] = useState("");

  const set = (patch) => onSave({ ...consent, ...patch });

  const savePlace = () => {
    const m = place.split(",").map((x) => Number(x.trim()));
    if (m.length !== 2 || !Number.isFinite(m[0]) || !Number.isFinite(m[1])) {
      setMsg("That doesn't look like a latitude and longitude.");
      return;
    }
    const c = coarse({ lat: m[0], lon: m[1] });
    set({ location: "manual", place: { ...c } });
    setPlace(`${c.lat}, ${c.lon}`);
    setMsg("Saved, rounded to about a kilometre.");
  };

  return (
    <Card className="mt-3">
      <div className="fhj-eyebrow mb-1.5">Daily context</div>
      <p className="text-[12px] leading-relaxed mb-3" style={{ color: C.sub }}>
        Attach the weather to each day automatically — temperature, humidity, pressure and its change,
        UV, daylight, air quality and pollen where it's published. It stays behind your entries until it
        has something to say about your own numbers.
      </p>

      <SwitchRow
        on={!!consent.enabled}
        onChange={(v) => set({ enabled: v, location: v && consent.location === "off" ? "device" : consent.location })}
        label="Attach daily context"
        desc={contextCount ? `${contextCount} days have it so far.` : "Off. Nothing is requested while this is off."}
      />

      {consent.enabled && (
        <>
          <div className="fhj-label mt-3">Where</div>
          <Segmented
            label="How to find your location"
            value={consent.location === "off" ? "device" : consent.location}
            onChange={(v) => set({ location: v })}
            options={[
              { value: "device", label: "Use this device" },
              { value: "manual", label: "I'll set it" },
            ]}
          />

          {consent.location === "manual" && (
            <div className="mt-2">
              <input
                className="fhj-input"
                value={place}
                onChange={(e) => { setPlace(e.target.value); setMsg(""); }}
                placeholder="51.51, -0.13"
                aria-label="Latitude and longitude"
              />
              <div className="flex items-center gap-2 mt-2">
                <Button variant="outline" onClick={savePlace}>Save place</Button>
                {msg && <span className="text-[11.5px]" style={{ color: C.subtle }}>{msg}</span>}
              </div>
            </div>
          )}

          <div className="fhj-label mt-3">Temperature</div>
          <Segmented
            label="Temperature units"
            value={consent.units === "imperial" ? "imperial" : "metric"}
            onChange={(v) => set({ units: v })}
            options={[
              { value: "metric", label: "°C" },
              { value: "imperial", label: "°F" },
            ]}
          />
        </>
      )}

      <Disclosure
        label="What is sent, and what is kept"
        className="mt-3"
        summary="Two requests, a rounded latitude and longitude, nothing else."
      >
        <ul className="text-[12px] leading-relaxed grid gap-1.5" style={{ color: C.sub }}>
          <li>
            <strong style={{ color: C.ink }}>Sent:</strong> a latitude and longitude rounded to two
            decimal places — about a kilometre — to Open-Meteo, which needs no account and no key. No
            identifier, no name, and nothing at all from your journal.
          </li>
          <li>
            <strong style={{ color: C.ink }}>Stored:</strong> one weather record per day. Temperature,
            humidity, pressure, UV, daylight, air quality, pollen. That is a record of the sky, not of
            where you were.
          </li>
          <li>
            <strong style={{ color: C.ink }}>Not stored:</strong> a location history. Your precise fix is
            rounded before it is used and never written down.
          </li>
          <li>
            <strong style={{ color: C.ink }}>How often:</strong> at most once an hour while the app is
            open, and only when today's record is missing or stale.
          </li>
          <li>
            <strong style={{ color: C.ink }}>Turning it off</strong> stops the requests immediately. The
            days already attached stay, and can be removed with the button below.
          </li>
        </ul>
        {contextCount > 0 && (
          <Button
            variant="danger"
            className="mt-3"
            onClick={() => { onSave(consent, { wipe: true }); setMsg("Removed."); }}
          >
            Delete the {contextCount} days of context
          </Button>
        )}
      </Disclosure>
    </Card>
  );
}

/* Sun & skin — the three answers the vitamin D estimate personalises on.

   Skin type moves the estimate more than everything else here combined, which
   is exactly why it is asked in the person's own words rather than as a roman
   numeral, and why the card says what it is for. All three are refusable and
   the estimate falls back to a middle value, saying so. */
function SunProfileCard({ profile, onSave }) {
  const sun = profile.sun || {};
  const set = (patch) => onSave({ ...sun, ...patch });

  return (
    <Card className="mt-3">
      <div className="fhj-eyebrow mb-1.5">Sun & skin</div>
      <p className="text-[12px] leading-relaxed mb-3" style={{ color: C.sub }}>
        Used to personalise the vitamin D estimate and the burn warning on a sun session. It is an
        estimate either way — these make it a better one.
      </p>

      <div className="fhj-label">How your skin behaves in strong sun</div>
      <div className="grid gap-1.5 mb-3">
        {SKIN_TYPES.map((t) => (
          <button
            key={t.type}
            type="button"
            onClick={() => { feedback("select"); set({ skin: t.type }); }}
            className="fhj-skin-row"
            aria-pressed={sun.skin === t.type}
            data-on={sun.skin === t.type ? "true" : undefined}
          >
            <span className="fhj-skin-swatch" data-type={t.type} aria-hidden />
            <span>
              <span className="block text-sm font-medium">{t.label}</span>
              <span className="block text-[11.5px]" style={{ color: C.subtle }}>{t.desc}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="fhj-label">What you usually have out in the sun</div>
      <div className="fhj-chip-row">
        {EXPOSURE_LEVELS.map((e) => (
          <button
            key={e.id}
            type="button"
            className={"fhj-chip" + (sun.exposure === e.id ? " is-active" : "")}
            onClick={() => { feedback("select"); set({ exposure: e.id }); }}
          >
            {e.label}
          </button>
        ))}
      </div>

      <div className="fhj-label">When you usually wake</div>
      <input
        className="fhj-input"
        type="time"
        value={sun.wake || ""}
        onChange={(e) => set({ wake: e.target.value || undefined })}
        aria-label="Usual waking time"
      />
      <p className="text-[11.5px] leading-relaxed mt-1.5" style={{ color: C.subtle }}>
        Only used for one number: how long after waking you first got outside. Leave it blank and that
        number simply isn't shown.
      </p>
    </Card>
  );
}

/* The claim this whole app rests on, written out so it can be checked rather
   than taken on faith. Every line here is verifiable from the source: there is
   no analytics call, no fetch to a backend, and after first load no network
   request at all — the fonts are bundled, not fetched from a CDN. */
/* The claim the whole app rests on, written so it can be checked rather than
   taken on faith — which means every line of it has to track what is actually
   switched on right now. Two options change what is true here: AI observations,
   and sync. Both rewrite their own line rather than leaving a promise standing
   that the app has stopped keeping. A privacy card that is right by default and
   quietly wrong once you use a feature is worse than no card. */
/* The card that has to track reality rather than the ideal.

   Every switch in this app that can reach the network changes a sentence here,
   and the sentence changes on the card rather than leaving a promise standing
   that is no longer true. That is the whole design of it: a privacy claim is
   worth exactly as much as its worst case, so the worst case is what it
   prints. Nothing here says "everything else stays on this device" any more —
   with AI on, two things can leave, and both are named. */
function PrivacyCard({ aiEnabled = false, aiAuto = false, syncOn = false, syncEmail = null, contextOn: ctxOn = false }) {
  const [open, setOpen] = useState(false);
  const facts = [
    syncOn
      ? ["Signed in for sync", `Sync across devices is on${syncEmail ? `, using ${syncEmail}` : ""}. That email is the only thing identifying you, and it exists so your own devices can find each other. Turning sync off removes it from this device and leaves your journal untouched.`]
      : ["No account", "There's no sign-up, no email, no password. Nothing identifies you to anyone."],
    syncOn
      ? ["Encrypted before it's uploaded", "Your entries are sealed on this device with a key derived from your sync passphrase, which is never sent anywhere. The server holds dates and unreadable blocks. Because the app is delivered over the web, this can't protect you from someone who controls the site itself — and no HIPAA or medical-records claim is made."]
      : ["No server", "Your entries, photos, and reports are written to this browser's storage. There is no backend holding a copy, and nothing is uploaded on its own."],
    ["No tracking", "No analytics, no cookies, no advertising or third-party scripts of any kind."],
    /* Daily context is the third thing that can change the network line, and
       the only one that touches location — so it gets its own row rather than
       being folded into the sentence below, which people skim. */
    ...(ctxOn
      ? [["Weather, not whereabouts", "Daily context is on. Once an hour at most, this device asks a weather service for the conditions at a latitude and longitude rounded to about a kilometre — no identifier, no name, nothing from your journal. What comes back is stored as a reading of the sky per day. Your precise location is rounded before it is used and is never written down."] as [string, string]]
      : []),
    // This claim has to track reality, not the ideal. Turning on AI
    // observations adds exactly one outbound call — the card says so, on the
    // card, rather than leaving a promise standing that is no longer true.
    aiAuto
      ? ["Photos are sent as you attach them", "AI observations are on, and so is letting AI fill in the log. A photo you attach to a meal or a bowel entry is sent to your AI provider for a reading as soon as you add it, without a confirmation each time — that is what the switch in Settings turned on, and turning it back off restores the confirm step. Two other things can reach your provider, and only when you ask: an analysis you run, and notes you paste into Import. Nothing else does."]
      : aiEnabled
        ? ["Two things can be sent, and only when you ask", "AI observations are on. Nothing goes automatically. An analysis you run sends a summary of your logged numbers. Importing your own notes sends the notes — that one is the exception to everything else here, because the words are what is being read. Both show you the entire payload before it leaves, every time, and the rest of the app works offline."]
        : syncOn
          ? ["Still offline-first", "Saving never waits for the network. Everything is written here first and sent afterwards, so a full day logged in airplane mode is normal — it catches up when you're back."]
          : ctxOn
            ? ["One quiet request a day", "Daily context is the only thing here that reaches the network, and it only ever asks for the weather. Everything else stays on this device, and a full day logged in airplane mode is still normal — the weather simply fills in later."]
            : ["No network", "After the app loads once, it makes no network requests. Fonts ship with the app. You can log a full day in airplane mode. Four switches in Settings can change that — AI observations, importing your own notes, sync, and daily context — and each one says what it sends before it sends anything."],
    ["Your files, your move", "Exports and backups are ordinary files saved to your device. Where they go next is entirely up to you."],
  ];
  return (
    <Card className="mt-3">
      <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: C.sub }}>Privacy</div>
      <div className="flex flex-col gap-2.5">
        {facts.slice(0, open ? facts.length : 3).map(([title, body]) => (
          <div key={title} className="flex gap-2.5">
            <span className="shrink-0 mt-0.5"><Icon name="check" size={15} color={C.good} /></span>
            <span>
              <span className="text-sm font-medium block">{title}</span>
              <span className="text-[12px] leading-relaxed block" style={{ color: C.sub }}>{body}</span>
            </span>
          </div>
        ))}
      </div>
      {!open && (
        <button onClick={() => setOpen(true)} className="mt-3 text-sm font-medium" style={{ color: C.accentText }}>
          Read the rest
        </button>
      )}
      {open && (
        <p className="text-[11px] leading-relaxed mt-3 pt-3" style={{ color: C.sub, borderTop: `1px solid ${C.line}` }}>
          {syncOn
            ? "The flip side: your sync passphrase can't be reset by anyone, including us — that is what makes the encryption worth anything. Lose it and the synced copy becomes unreadable, though the journal on this device is unaffected. A downloaded backup is still the thing that survives everything."
            : "The flip side of all this: nobody can recover your journal for you. If you clear this browser's site data, uninstall the app, or lose the device, the only copy that survives is a backup file you saved yourself."}
        </p>
      )}
    </Card>
  );
}

function DisclaimerModal({ onAck }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: C.overlay, backdropFilter: "blur(3px)" }}>
      <div className="w-full max-w-md rounded-2xl p-5" style={{ background: C.card }}>
        <div className="font-display text-xl mb-2">Before you start</div>
        <p className="text-sm leading-relaxed mb-3">{DISCLAIMER}</p>
        <p className="text-sm leading-relaxed mb-4" style={{ color: C.sub }}>
          The app highlights <i>possible patterns</i> in what you log. It never concludes that something caused a symptom.
        </p>
        <button onClick={onAck} className="fhj-btn fhj-btn-primary fhj-btn-block">
          I understand
        </button>
      </div>
    </div>
  );
}

const CUSTOM_KINDS = [
  { key: "scale", label: "Rating 1–10 (recommended)" },
  { key: "toggle", label: "Yes / No" },
  { key: "choice", label: "Multiple choice (pick one)" },
  { key: "multichoice", label: "Multi-select (pick many)" },
  { key: "number", label: "Number" },
  { key: "text", label: "Text note" },
  { key: "time", label: "Time" },
  { key: "date", label: "Date" },
  { key: "bodyarea", label: "Body area" },
  { key: "photo", label: "Photo (with optional rating)" },
];

function buildCustomField(input, seq) {
  const k = "c_" + Date.now().toString(36) + seq;
  const base = { k, label: input.label.trim(), sec: "Custom", quick: input.quick !== false, custom: true };
  const opts = (input.options || "").split(",").map((s) => s.trim()).filter(Boolean);
  switch (input.kind) {
    case "toggle": return { ...base, type: "toggle" };
    case "choice": return { ...base, type: "chips", single: true, options: opts.length ? opts : ["Option A", "Option B"] };
    case "multichoice": return { ...base, type: "chips", single: false, options: opts.length ? opts : ["Option A", "Option B"] };
    case "number": return { ...base, type: "number", unit: input.unit || undefined, step: 1, dir: "neutral" };
    case "text": return { ...base, type: "text" };
    case "time": return { ...base, type: "time" };
    case "date": return { ...base, type: "date" };
    case "bodyarea": return { ...base, type: "chips", single: false, options: BODY_AREAS };
    case "photo": return {
      ...base, type: "photo", dir: "sym",
      category: input.category || "skin", bodyPart: (input.bodyPart || "").trim(),
      side: input.side || "", angle: input.angle || "",
      rated: input.rated !== false, scaleMax: 10, autoRate: false, requiredInSession: true, linkedTo: null,
    };
    default: return { ...base, type: "scale", dir: input.higherBetter ? "pos" : "sym" };
  }
}

function AddCustomQuestion({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState("scale");
  const [options, setOptions] = useState("");
  const [unit, setUnit] = useState("");
  const [higherBetter, setHigherBetter] = useState(false);
  const [quick, setQuick] = useState(true);
  const [category, setCategory] = useState("skin");
  const [bodyPart, setBodyPart] = useState("");
  const [side, setSide] = useState("");
  const [angle, setAngle] = useState("");
  const [rated, setRated] = useState(true);
  const needsOptions = kind === "choice" || kind === "multichoice";

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="w-full py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5"
        style={{ border: `1.5px dashed ${C.lineStrong}`, color: C.sub }}>
        <Icon name="plus" size={14} color={C.sub} /> Add your own question
      </button>
    );
  }
  return (
    <div className="rounded-xl p-3" style={{ background: C.faint }}>
      <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Question, e.g. Jaw tension"
        className="w-full rounded-lg px-2.5 py-2 text-sm mb-2 outline-none" style={{ background: C.card, border: `1px solid ${C.line}` }} />
      <select value={kind} onChange={(e) => setKind(e.target.value)}
        className="w-full rounded-lg px-2.5 py-2 text-sm mb-2 outline-none" style={{ background: C.card, border: `1px solid ${C.line}` }}>
        {CUSTOM_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
      </select>
      {needsOptions && (
        <input value={options} onChange={(e) => setOptions(e.target.value)} placeholder="Options, comma separated"
          className="w-full rounded-lg px-2.5 py-2 text-sm mb-2 outline-none" style={{ background: C.card, border: `1px solid ${C.line}` }} />
      )}
      {kind === "number" && (
        <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Unit (optional), e.g. lb"
          className="w-full rounded-lg px-2.5 py-2 text-sm mb-2 outline-none" style={{ background: C.card, border: `1px solid ${C.line}` }} />
      )}
      {kind === "scale" && (
        <label className="flex items-center gap-2 text-xs mb-2" style={{ color: C.sub }}>
          <input type="checkbox" checked={higherBetter} onChange={(e) => setHigherBetter(e.target.checked)} />
          Higher number is better (e.g. energy) — leave unchecked if higher = worse (e.g. pain)
        </label>
      )}
      {kind === "photo" && (
        <>
          <div className="flex gap-2 mb-2">
            <select value={category} onChange={(e) => setCategory(e.target.value)}
              className="flex-1 rounded-lg px-2 py-2 text-sm outline-none" style={{ background: C.card, border: `1px solid ${C.line}` }}>
              {PHOTO_CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <input value={bodyPart} onChange={(e) => setBodyPart(e.target.value)} placeholder="Body part, e.g. Left hand" list="fhj-bodyareas"
              className="flex-[1.4] rounded-lg px-2.5 py-2 text-sm outline-none" style={{ background: C.card, border: `1px solid ${C.line}` }} />
            <datalist id="fhj-bodyareas">{BODY_AREAS.map((a) => <option key={a} value={a} />)}</datalist>
          </div>
          <div className="flex gap-2 mb-2">
            <select value={side} onChange={(e) => setSide(e.target.value)}
              className="flex-1 rounded-lg px-2 py-2 text-sm outline-none" style={{ background: C.card, border: `1px solid ${C.line}` }}>
              {PHOTO_SIDES.map((s) => <option key={s} value={s}>{s || "Side — n/a"}</option>)}
            </select>
            <select value={angle} onChange={(e) => setAngle(e.target.value)}
              className="flex-1 rounded-lg px-2 py-2 text-sm outline-none" style={{ background: C.card, border: `1px solid ${C.line}` }}>
              {PHOTO_ANGLES.map((a) => <option key={a} value={a}>{a || "Angle — n/a"}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 text-xs mb-2" style={{ color: C.sub }}>
            <input type="checkbox" checked={rated} onChange={(e) => setRated(e.target.checked)} />
            Include a 1–10 severity/progress rating with each photo
          </label>
        </>
      )}
      <label className="flex items-center gap-2 text-xs mb-3" style={{ color: C.sub }}>
        <input type="checkbox" checked={quick} onChange={(e) => setQuick(e.target.checked)} />
        Include in Quick Log
      </label>
      <div className="flex gap-2">
        <button onClick={() => setOpen(false)} className="flex-1 py-2 rounded-lg text-sm font-medium" style={{ background: C.card, border: `1px solid ${C.line}` }}>Cancel</button>
        <button disabled={!label.trim() || (needsOptions && !options.trim())}
          onClick={() => { onAdd({ label, kind, options, unit, higherBetter, quick, category, bodyPart, side, angle, rated }); setLabel(""); setOptions(""); setUnit(""); setKind("scale"); setHigherBetter(false); setQuick(true); setCategory("skin"); setBodyPart(""); setSide(""); setAngle(""); setRated(true); setOpen(false); }}
          className="fhj-btn fhj-btn-primary flex-1">Add</button>
      </div>
    </div>
  );
}

const VISIBILITY_FLAGS = [
  ["quick", "Quick"], ["detailed", "Detailed"], ["dashboard", "Dashboard"], ["chart", "Chart"], ["exportable", "Export"],
];

function EditSetupScreen({ profile, entries = [], onSave, goBack }) {
  const [name, setName] = useState(profile.name || "");
  /* Held as an age because that is what a person knows about themselves, and
     written back as a birth year because that is what stays true. An empty
     box is a real answer: it clears the year rather than storing a zero. */
  const [age, setAge] = useState(() => {
    const a = profileAge(profile);
    return a == null ? "" : String(a);
  });
  const [modules, setModules] = useState(new Set(profile.modules?.length ? profile.modules : []));
  const [disabledFields, setDisabledFields] = useState(new Set(profile.disabledFields || []));
  const [customQuestions, setCustomQuestions] = useState(profile.customQuestions || []);
  const [order, setOrder] = useState(profile.fieldOrder || []);
  const [overrides, setOverrides] = useState(profile.fieldOverrides || {});
  const [cameraTimer, setCameraTimer] = useState(profile.cameraTimer ?? 3);
  const [keyMetric, setKeyMetric] = useState(profile.keyMetric || null);
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    const n = Number(age);
    const validAge = age.trim() !== "" && Number.isFinite(n) && n >= 0 && n < 130;
    onSave({
      name: name.trim(), modules: Array.from(modules), disabledFields: Array.from(disabledFields),
      customQuestions, fieldOrder: order, fieldOverrides: overrides, cameraTimer, keyMetric,
      birthYear: validAge ? new Date().getFullYear() - Math.round(n) : undefined,
    });
  }, [name, age, modules, disabledFields, customQuestions, order, overrides, cameraTimer, keyMetric]); // eslint-disable-line

  const toggleModule = (k) => {
    if (modules.has(k)) {
      const histDays = packHistoryDays(k, Array.from(modules), entries);
      if (histDays > 0 && !window.confirm(
        `${TEMPLATES[k]?.label || k} has answers on ${histDays} logged day${histDays === 1 ? "" : "s"}. ` +
        "Turning it off hides those questions from logging, dashboard, and charts — your saved answers stay in your data and come back if you re-enable it. Turn it off?"
      )) return;
    }
    setModules((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  };
  const toggleField = (k) => setDisabledFields((prev) => {
    const next = new Set(prev);
    if (next.has(k)) next.delete(k); else next.add(k);
    return next;
  });
  const addCustom = (input) => setCustomQuestions((prev) => [...prev, buildCustomField(input, prev.length)]);
  const removeCustom = (k) => {
    setCustomQuestions((prev) => prev.filter((c) => c.k !== k));
    setOrder((prev) => prev.filter((ok) => ok !== k));
  };

  /* Packs overlap heavily — sleep quality, stress, fatigue and brain fog each
     appear in four or five of them. The rest of the app dedupes by key (see
     computeProfileTemplate), and the copy above promises shared questions are
     "only asked once", but this editor used to list one row per pack per key:
     four identical "Brain fog" rows, all four writing the same answer. First
     pack wins, and the row remembers everyone who asked for it. */
  const naturalFields = useMemo(() => {
    const byKey = new Map();
    for (const mk of modules) {
      const t = TEMPLATES[mk];
      if (!t) continue;
      for (const f of t.fields) {
        const hit = byKey.get(f.k);
        if (hit) { hit.sharedWith.push(t.label); continue; }
        byKey.set(f.k, { ...f, moduleLabel: t.label, moduleColor: t.color, sharedWith: [t.label] });
      }
    }
    for (const cq of customQuestions) {
      if (byKey.has(cq.k)) continue;
      byKey.set(cq.k, { ...cq, moduleLabel: "Custom", moduleColor: C.accent, sharedWith: ["Custom"] });
    }
    return Array.from(byKey.values());
  }, [modules, customQuestions]);

  /* Which questions could be the main number: the 1–10 ones that are actually
     switched on. A journal cannot be about a question it does not ask. */
  const keyScales = useMemo(
    () => naturalFields.filter((f) => f.type === "scale" && !disabledFields.has(f.k)),
    [naturalFields, disabledFields]
  );
  /* What the app is pointing at right now, so the chips show the live answer
     rather than nothing at all before anybody has ever chosen one. */
  const activeKeyMetric = useMemo(() => getProfileTemplate(profile).keyMetric, [profile]);
  const displayFields = useMemo(() => orderFields(naturalFields, order), [naturalFields, order]);

  /* Reordering swaps a question with its neighbour *inside its own drawer*,
     writing the swap back into the one global order. Swapping against the raw
     global neighbour would fling the question into a different category the
     moment you tapped the arrow, which reads as the app losing it. */
  const moveWithin = (k, dir, siblingKeys) => {
    const list = displayFields.map((f) => f.k);
    const s = siblingKeys.indexOf(k);
    const target = siblingKeys[s + dir];
    if (target === undefined) return;
    const i = list.indexOf(k), j = list.indexOf(target);
    if (i < 0 || j < 0) return;
    [list[i], list[j]] = [list[j], list[i]];
    setOrder(list);
    feedback("reorder");
  };
  const getFlag = (f, flag) => {
    const o = overrides[f.k]?.[flag];
    if (o !== undefined) return o;
    if (flag === "quick") return !!f.quick;
    return f[flag] !== false;
  };
  const toggleFlag = (f, flag) => setOverrides((prev) => ({
    ...prev, [f.k]: { ...(prev[f.k] || {}), [flag]: !getFlag(f, flag) },
  }));
  const getMeta = (f, key) => overrides[f.k]?.[key] !== undefined ? overrides[f.k][key] : f[key];
  const setMeta = (f, key, val) => setOverrides((prev) => ({
    ...prev, [f.k]: { ...(prev[f.k] || {}), [key]: val },
  }));
  const [photoOpen, setPhotoOpen] = useState(null); // field key of expanded photo settings

  /* The question list used to be one flat run of every question from every
     enabled pack — routinely sixty rows, with the thing you came to change
     somewhere in the middle. It is grouped into collapsed drawers now, with a
     filter across the top and a running count on every header.

     Subject ("Symptoms", "Sleep", "Photos") is the default grouping because
     that is how someone describes what they came to change. Grouping by pack
     is still one tap away, for anyone who thinks in the packs they switched
     on. Either way the drawers start shut, so the screen opens at about a
     screenful however many questions are configured. */
  const [query, setQuery] = useState("");
  const [groupBy, setGroupBy] = useState("category"); // "category" | "pack"
  const [openSections, setOpenSections] = useState(() => new Set());

  const q = query.trim().toLowerCase();
  const matches = (f) =>
    !q ||
    f.label.toLowerCase().includes(q) ||
    (f.moduleLabel || "").toLowerCase().includes(q) ||
    (f.sec || "").toLowerCase().includes(q) ||
    (CATEGORY_META[categoryOf(f)]?.label || "").toLowerCase().includes(q);

  const sections = useMemo(() => {
    const map = new Map();
    for (const f of displayFields) {
      const id = groupBy === "pack" ? (f.moduleLabel || "Other") : categoryOf(f);
      const meta = groupBy === "pack"
        ? { label: f.moduleLabel || "Other", color: f.moduleColor, icon: "sliders" }
        : CATEGORY_META[id] || CATEGORY_META.other;
      if (!map.has(id)) map.set(id, { id, label: meta.label, color: meta.color, icon: meta.icon, fields: [] });
      map.get(id).fields.push(f);
    }
    const out = Array.from(map.values());
    if (groupBy === "category") {
      out.sort((a, b) => CATEGORY_ORDER.indexOf(a.id) - CATEGORY_ORDER.indexOf(b.id));
    }
    // Arrows step through this list, so each section carries its own key order.
    return out.map((s) => ({ ...s, keys: s.fields.map((f) => f.k) }));
  }, [displayFields, groupBy]);

  const visibleSections = useMemo(
    () => sections
      .map((s) => ({ ...s, fields: s.fields.filter(matches) }))
      .filter((s) => s.fields.length > 0),
    [sections, q]
  );

  const matchCount = useMemo(
    () => visibleSections.reduce((n, s) => n + s.fields.length, 0),
    [visibleSections]
  );

  const toggleSection = (id) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    feedback("expand");
  };
  const allOpen = visibleSections.length > 0 && visibleSections.every((s) => openSections.has(s.id));

  /* Which drawers have ever been opened, so their rows can stay mounted and
     animate shut instead of vanishing. A drawer nobody touched costs nothing. */
  const everOpened = useRef(new Set()).current;
  for (const s of visibleSections) if (!!q || openSections.has(s.id)) everOpened.add(s.id);

  /* Switching the grouping shuts everything: the open set is keyed by section
     id, and a category id left over from the other mode opens nothing. */
  const chooseGroupBy = (next) => {
    if (next === groupBy) return;
    setGroupBy(next);
    setOpenSections(new Set());
    everOpened.clear();
    feedback("select");
  };

  return (
    <div className="px-4 pb-10 pt-3">
      <label className="fhj-eyebrow block" htmlFor="fhj-setup-name">Your name (optional)</label>
      <input id="fhj-setup-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Connor"
        className="fhj-input mt-2 mb-4" />

      <label className="fhj-eyebrow block" htmlFor="fhj-setup-age">Your age (optional)</label>
      <input id="fhj-setup-age" value={age} inputMode="numeric" maxLength={3}
        onChange={(e) => setAge(e.target.value.replace(/[^0-9]/g, ""))}
        placeholder="e.g. 34" className="fhj-input mt-2" />
      <p className="text-[11.5px] leading-relaxed mt-2 mb-6" style={{ color: C.subtle }}>
        Both are printed at the top of your appointment packs, summaries and exports, so a
        clinician can see whose logs they're reading. Stored on this device like everything else —
        the age is kept as the year you were born, so it stays right.
      </p>

      <div className="fhj-eyebrow">Question packs — turn on everything that fits you</div>
      <div className="flex flex-col gap-2 mt-2.5 mb-3">
        {Object.entries(TEMPLATES).map(([k, t]) => {
          const on = modules.has(k);
          return (
            <button key={k} onClick={() => toggleModule(k)} role="switch" aria-checked={on}
              className="w-full px-3.5 py-3 rounded-xl text-sm text-left flex items-center justify-between gap-3"
              style={{
                background: on ? C.accentSoft : "transparent",
                border: `1px solid ${on ? C.accentLine : C.line}`,
              }}>
              <span className="font-medium">{t.label}</span>
              <span className="w-[22px] h-[22px] rounded-md flex items-center justify-center shrink-0"
                style={on ? { background: C.accent } : { border: `1.5px solid ${C.lineStrong}` }}>
                {on && <Icon name="check" size={13} color={C.onAccent} />}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-[11.5px] leading-relaxed mb-7" style={{ color: C.subtle }}>
        Mix and match — shared questions (like sleep or stress) are only asked once.
      </p>

      {/* The main number, changeable. It is chosen during setup, and what it
          points at is not fixed for life: the thing somebody most needs to
          watch in March is often not the thing they needed to watch in
          November. */}
      {keyScales.length > 0 && (
        <>
          <div className="fhj-eyebrow">Main number — the one-tap question on Today</div>
          <div className="flex flex-wrap gap-1.5 mt-2.5 mb-2">
            {keyScales.map((f) => {
              const on = (keyMetric || activeKeyMetric) === f.k;
              return (
                <button key={f.k} type="button" aria-pressed={on}
                  onClick={() => { feedback("select"); setKeyMetric(f.k); }}
                  className={"fhj-chip" + (on ? " is-active" : "")}>
                  {on && <Icon name="check" size={13} color="currentColor" />}{f.label}
                </button>
              );
            })}
          </div>
          <p className="text-[11.5px] leading-relaxed mb-7" style={{ color: C.subtle }}>
            It is what Today asks for in one tap, what the streak counts, and the first figure in
            an appointment pack. Everything you have already logged stays exactly as it is.
          </p>
        </>
      )}

      <div className="fhj-eyebrow mt-1">Questions</div>
      <p className="text-[11.5px] leading-relaxed mt-1.5" style={{ color: C.subtle }}>
        Questions are filed by subject and start closed — open one category at a time, or search
        to jump straight to a question. Inside a category: the arrows reorder, the checkbox turns
        a question off entirely, and the pills control where it appears. A{" "}
        <b style={{ color: C.ink }}>filled</b> pill means the question shows up there; a dashed one
        means it's hidden from that screen.
      </p>
      {displayFields.filter((f) => !disabledFields.has(f.k)).length === 0 && (
        <div className="mt-1.5 px-3 py-2.5 rounded-xl text-sm" style={{ background: C.dangerBg, color: C.dangerInk }}>
          No questions are enabled — logging, the dashboard, and reports will be empty until you turn a pack or question on.
        </div>
      )}
      <div className="mt-1.5 mb-5">
        {displayFields.length === 0 && (
          <div className="text-sm py-3" style={{ color: C.sub }}>Turn on a question pack above, or add your own question below.</div>
        )}
        {displayFields.length > 0 && (
          <>
            <div className="flex items-center gap-2 mb-2">
              <input className="fhj-input" type="search" placeholder="Find a question"
                value={query} onChange={(e) => setQuery(e.target.value)}
                aria-label="Filter questions" style={{ minHeight: 40 }} />
              {query.trim() ? (
                <Button size="sm" variant="ghost" className="shrink-0 whitespace-nowrap"
                  onClick={() => setQuery("")}>Clear</Button>
              ) : (
                <Button size="sm" variant="ghost" className="shrink-0 whitespace-nowrap"
                  onClick={() => {
                    feedback("expand");
                    setOpenSections(allOpen ? new Set() : new Set(visibleSections.map((x) => x.id)));
                  }}>
                  {allOpen ? "Collapse" : "Expand all"}
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2 mb-2.5">
              <span className="fhj-eyebrow shrink-0" style={{ margin: 0 }}>Group by</span>
              <div className="flex gap-1" role="group" aria-label="Group questions by">
                {[["category", "Subject"], ["pack", "Pack"]].map(([v, l]) => (
                  <button key={v} type="button" onClick={() => chooseGroupBy(v)} aria-pressed={groupBy === v}
                    className="px-2.5 py-1 rounded-full text-[11px] font-semibold"
                    style={groupBy === v
                      ? { background: C.accent, color: C.onAccent, border: `1px solid ${C.accent}` }
                      : { background: "transparent", color: C.sub, border: `1px solid ${C.lineStrong}` }}>
                    {l}
                  </button>
                ))}
              </div>
              <span className="text-[10.5px] ml-auto shrink-0" aria-live="polite" style={{ color: C.subtle }}>
                {q
                  ? `${matchCount} match${matchCount === 1 ? "" : "es"}`
                  : `${displayFields.length} question${displayFields.length === 1 ? "" : "s"} · ${visibleSections.length} categor${visibleSections.length === 1 ? "y" : "ies"}`}
              </span>
            </div>
          </>
        )}

        {displayFields.length > 0 && visibleSections.length === 0 && (
          <div className="text-sm py-3" style={{ color: C.sub }}>
            No question matches “{query.trim()}”.
          </div>
        )}

        {visibleSections.map((sec) => {
          /* A search result is useless inside a collapsed section, so a live
             query forces every matching section open. */
          const open = !!q || openSections.has(sec.id);
          const total = sec.fields.length;
          const enabled = sec.fields.filter((f) => !disabledFields.has(f.k)).length;
          return (
            <div key={sec.id} className="mb-2">
              <button type="button" onClick={() => toggleSection(sec.id)} aria-expanded={open}
                className="fhj-acc-head w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left"
                style={{
                  background: open ? C.card : C.faint,
                  border: `1.5px solid ${open ? C.lineStrong : "transparent"}`,
                }}>
                <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: (sec.color || C.accent) + "1f" }}>
                  <Icon name={sec.icon || "sliders"} size={15} color={sec.color || C.accent} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="text-sm font-bold block truncate" style={{ color: C.ink }}>{sec.label}</span>
                  <span className="text-[10.5px] block" style={{ color: C.subtle }}>
                    {total} question{total === 1 ? "" : "s"} · {enabled} of {total} on
                  </span>
                </span>
                {enabled > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold shrink-0"
                    style={{ background: (sec.color || C.accent) + "1f", color: sec.color || C.accentText }}>
                    {enabled}
                  </span>
                )}
                <span className="fhj-acc-chev shrink-0" style={{ transform: open ? "rotate(180deg)" : "none" }}>
                  <Icon name="down" size={16} color={C.sub} />
                </span>
              </button>

              {/* Rows are only built once a drawer has been opened, so a
                  sixty-question setup still mounts about a screenful. Once
                  built they stay, which is what lets the close animate too. */}
              {(open || everOpened.has(sec.id)) && (
              <div className={"fhj-expand" + (open ? " is-open" : "")} aria-hidden={!open}>
              <div><div className="fhj-expand-body pt-2">{sec.fields.map((f) => {
          const i = sec.keys.indexOf(f.k);
          const on = !disabledFields.has(f.k);
          return (
            <div key={f.k} className="rounded-xl mb-2 overflow-hidden"
              style={{
                border: `1px solid ${C.line}`,
                background: on ? C.card : "transparent",
                opacity: on ? 1 : 0.55,
              }}>
              <div className="flex items-center gap-2 px-2.5 py-2.5">
                <div className="flex flex-col shrink-0">
                  <button onClick={() => moveWithin(f.k, -1, sec.keys)} disabled={i <= 0}
                    aria-label={`move ${f.label} up`}
                    className="w-7 h-6 flex items-center justify-center rounded-md disabled:opacity-20">
                    <Icon name="up" size={14} color={C.sub} />
                  </button>
                  <button onClick={() => moveWithin(f.k, 1, sec.keys)} disabled={i === sec.keys.length - 1}
                    aria-label={`move ${f.label} down`}
                    className="w-7 h-6 flex items-center justify-center rounded-md disabled:opacity-20">
                    <Icon name="down" size={14} color={C.sub} />
                  </button>
                </div>
                <button onClick={() => { toggleField(f.k); feedback(on ? "toggleOff" : "toggleOn"); }}
                  role="switch" aria-checked={on}
                  className="flex-1 min-w-0 text-left flex items-center gap-2.5 py-1">
                  <span className="w-[22px] h-[22px] rounded-md flex items-center justify-center shrink-0"
                    style={on
                      ? { background: C.accent }
                      : { background: "transparent", border: `1.5px solid ${C.lineStrong}` }}>
                    {on && <Icon name="check" size={13} color={C.onAccent} />}
                  </span>
                  <span className="min-w-0">
                    <span className="text-sm block truncate">{f.label}</span>
                    {/* Whichever way the list is grouped, the row still says
                        where the question came from and what it sits with — and
                        that turning it off turns it off for every pack asking. */}
                    <span className="text-[10.5px] block truncate" style={{ color: C.subtle }}>
                      {[
                        groupBy === "pack" ? f.sec : f.moduleLabel,
                        groupBy === "pack" ? null : f.sec,
                        f.sharedWith?.length > 1 ? `shared by ${f.sharedWith.length} packs` : null,
                      ].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </button>
                {f.custom && (
                  <button onClick={() => { feedback("delete"); removeCustom(f.k); }} aria-label={`delete ${f.label}`}
                    className="w-8 h-8 flex items-center justify-center rounded-full shrink-0">
                    <Icon name="x" size={15} color={C.subtle} />
                  </button>
                )}
              </div>
              <div className="px-3 pb-3">
                <div className="flex flex-wrap gap-1.5">
                  {VISIBILITY_FLAGS.map(([flag, label]) => {
                    const flagOn = getFlag(f, flag);
                    return (
                      <button key={flag} onClick={() => { feedback(flagOn ? "toggleOff" : "toggleOn"); toggleFlag(f, flag); }}
                        aria-pressed={flagOn}
                        aria-label={`${f.label}: ${flagOn ? "shown in" : "hidden from"} ${label}`}
                        className="px-2.5 py-1 rounded-full text-[11px] font-semibold"
                        style={flagOn
                          ? { background: C.faint, color: C.ink, border: "1px solid transparent" }
                          : { background: "transparent", color: C.subtle, border: `1px dashed ${C.lineStrong}` }}>
                        {label}
                      </button>
                    );
                  })}
                  {f.type === "photo" && (
                    <button onClick={() => setPhotoOpen(photoOpen === f.k ? null : f.k)}
                      aria-expanded={photoOpen === f.k}
                      className="px-2.5 py-1 rounded-full text-[11px] font-semibold"
                      style={photoOpen === f.k
                        ? { background: C.accent, color: C.onAccent, border: `1px solid ${C.accent}` }
                        : { background: "transparent", color: C.sub, border: `1px solid ${C.lineStrong}` }}>
                      Photo settings
                    </button>
                  )}
                </div>
              </div>
              {f.type === "photo" && photoOpen === f.k && (
                <div className="px-2.5 pb-2.5 flex flex-col gap-2" style={{ borderTop: `1px solid ${C.line}`, paddingTop: 10 }}>
                  <div className="flex gap-2">
                    <select value={getMeta(f, "category") || "skin"} onChange={(e) => setMeta(f, "category", e.target.value)}
                      className="flex-1 rounded-lg px-2 py-1.5 text-xs outline-none" style={{ background: C.faint, border: `1px solid ${C.line}` }}>
                      {PHOTO_CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <input value={getMeta(f, "bodyPart") || ""} onChange={(e) => setMeta(f, "bodyPart", e.target.value)}
                      placeholder="Body part" list="fhj-bodyareas-setup"
                      className="flex-[1.4] rounded-lg px-2 py-1.5 text-xs outline-none" style={{ background: C.faint, border: `1px solid ${C.line}` }} />
                    <datalist id="fhj-bodyareas-setup">{BODY_AREAS.map((a) => <option key={a} value={a} />)}</datalist>
                  </div>
                  <div className="flex gap-2">
                    <select value={getMeta(f, "side") || ""} onChange={(e) => setMeta(f, "side", e.target.value)}
                      className="flex-1 rounded-lg px-2 py-1.5 text-xs outline-none" style={{ background: C.faint, border: `1px solid ${C.line}` }}>
                      {PHOTO_SIDES.map((s) => <option key={s} value={s}>{s || "Side — n/a"}</option>)}
                    </select>
                    <select value={getMeta(f, "angle") || ""} onChange={(e) => setMeta(f, "angle", e.target.value)}
                      className="flex-1 rounded-lg px-2 py-1.5 text-xs outline-none" style={{ background: C.faint, border: `1px solid ${C.line}` }}>
                      {PHOTO_ANGLES.map((a) => <option key={a} value={a}>{a || "Angle — n/a"}</option>)}
                    </select>
                  </div>
                  <label className="flex items-center gap-2 text-[11px]" style={{ color: C.sub }}>
                    <input type="checkbox" checked={getMeta(f, "rated") !== false} onChange={(e) => setMeta(f, "rated", e.target.checked)} />
                    Ask for a 1–10 rating with each photo
                  </label>
                  {getMeta(f, "rated") !== false && (
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px]" style={{ color: C.sub }}>Link this rating to an existing question (optional)</label>
                      <select value={getMeta(f, "linkedTo") || ""} onChange={(e) => setMeta(f, "linkedTo", e.target.value || null)}
                        className="w-full rounded-lg px-2 py-1.5 text-xs outline-none" style={{ background: C.faint, border: `1px solid ${C.line}` }}>
                        <option value="">None — rate this photo on its own</option>
                        {naturalFields.filter((x) => x.type === "scale" && x.k !== f.k).map((x) => (
                          <option key={x.k} value={x.k}>{x.label}</option>
                        ))}
                      </select>
                      {getMeta(f, "linkedTo") && (
                        <div className="text-[10px]" style={{ color: C.sub }}>
                          Rating this photo also answers "{naturalFields.find((x) => x.k === getMeta(f, "linkedTo"))?.label}" for the day — one tap, no duplicate question.
                        </div>
                      )}
                    </div>
                  )}
                  <label className="flex items-center gap-2 text-[11px]" style={{ color: C.sub }}>
                    <input type="checkbox" checked={getMeta(f, "requiredInSession") !== false} onChange={(e) => setMeta(f, "requiredInSession", e.target.checked)} />
                    Include in the guided photo session
                  </label>
                </div>
              )}
            </div>
          );
              })}</div></div>
              </div>
              )}
            </div>
          );
        })}
      </div>

      {naturalFields.some((f) => f.type === "photo") && (
        <Card className="mt-4">
          <div className="text-sm font-semibold mb-1">Camera timer</div>
          <div className="text-[11px] mb-2.5" style={{ color: C.sub }}>
            Countdown before a photo is taken, for hands-free capture. Uses the in-app camera; if that isn't available on your device, photos open your normal camera instead (no countdown).
          </div>
          <div className="flex gap-1.5">
            {CAMERA_TIMERS.map(([v, l]) => (
              <button key={v} onClick={() => setCameraTimer(v)}
                className="flex-1 py-2 rounded-xl text-sm font-semibold"
                style={{ background: cameraTimer === v ? C.accent : C.faint, color: cameraTimer === v ? C.onAccent : C.ink }}>
                {l}
              </button>
            ))}
          </div>
        </Card>
      )}

      <AddCustomQuestion onAdd={addCustom} />

      <button onClick={goBack} className="fhj-btn fhj-btn-primary fhj-btn-block mt-5">
        Done
      </button>
    </div>
  );
}

/* ============================================================
   Photo gallery — thumbnail grid with filters, tap-through to compare
   ============================================================ */

function PhotoCompareView({ field, tpl, items, baselinePhotoId, initialPhotoId, onSetBaseline, onBack }) {
  const [selectedId, setSelectedId] = useState(initialPhotoId);
  const [showing, setShowing] = useState("b"); // "a" = baseline, "b" = selected
  const baselineItem = items.find((i) => i.photoId === baselinePhotoId) || items[0];
  const selectedItem = items.find((i) => i.photoId === selectedId) || items[items.length - 1];
  const activeItem = showing === "a" ? baselineItem : selectedItem;
  const activeSrc = usePhoto(activeItem?.photoId, "full");
  const lbl = linkedLabel(field, tpl);

  const sparkPoints = items
    .map((i) => (i.rating != null ? i.rating : (i.captionVal ? parseFloat(i.captionVal) : null)))
    .filter((v) => v != null && !Number.isNaN(v));

  return (
    <div className="mt-1">
      <div className="flex items-center justify-between mb-2">
        <button onClick={onBack} className="text-sm underline" style={{ color: C.sub }}>‹ back to grid</button>
        <div className="text-sm font-semibold">{field.label}</div>
      </div>

      {activeSrc && (
        <img src={activeSrc} alt="" className="w-full rounded-xl object-cover mb-2" style={{ maxHeight: 320 }} />
      )}
      <div className="flex gap-2 mb-3">
        <button onClick={() => setShowing("a")}
          className="flex-1 py-2 rounded-xl text-xs font-semibold"
          style={{ background: showing === "a" ? tpl.color : C.faint, color: showing === "a" ? readableInk(tpl.color) : C.ink }}>
          Baseline · {baselineItem ? fmtNice(baselineItem.date) : "—"}
        </button>
        <button onClick={() => setShowing("b")}
          className="flex-1 py-2 rounded-xl text-xs font-semibold"
          style={{ background: showing === "b" ? tpl.color : C.faint, color: showing === "b" ? readableInk(tpl.color) : C.ink }}>
          Selected · {selectedItem ? fmtNice(selectedItem.date) : "—"}
        </button>
      </div>

      {(activeItem?.rating != null || activeItem?.captionVal) && (
        <div className="text-center text-sm mb-3" style={{ color: C.ink }}>
          {activeItem.rating != null && <span>Rating <b>{activeItem.rating}</b>{lbl ? ` (${lbl})` : ""}</span>}
          {activeItem.rating != null && activeItem.captionVal && <span> · </span>}
          {activeItem.captionVal && <span>{activeItem.captionVal}</span>}
        </div>
      )}

      {selectedItem && baselineItem && selectedItem.photoId !== baselineItem.photoId && (
        <button onClick={() => onSetBaseline(field.k, selectedItem.photoId)}
          className="w-full mb-3 py-2 rounded-xl text-xs font-semibold" style={{ background: C.faint, color: C.accent }}>
          Set {fmtNice(selectedItem.date)} photo as new baseline
        </button>
      )}

      {sparkPoints.length >= 2 && (
        <Card className="mb-3">
          <div className="text-[11px] mb-1" style={{ color: C.sub }}>
            {items.some((i) => i.rating != null) ? "Rating over time" : "Trend over time"}
          </div>
          <Sparkline points={sparkPoints} color={tpl.color} />
        </Card>
      )}

      <div className="text-[11px] mb-1.5" style={{ color: C.sub }}>All photos for this question</div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {items.slice().reverse().map((i) => (
          <button key={i.photoId} onClick={() => { setSelectedId(i.photoId); setShowing("b"); }}
            className="shrink-0 rounded-lg overflow-hidden"
            style={{ width: 56, height: 56, border: i.photoId === selectedId ? `2px solid ${tpl.color}` : `1px solid ${C.line}` }}>
            <GalleryThumb id={i.photoId} />
          </button>
        ))}
      </div>
      <p className="text-[11px] mt-3 leading-relaxed" style={{ color: C.sub }}>
        Visual comparison only — not a medical assessment.
      </p>
    </div>
  );
}

function PhotoGalleryScreen({ profile, entries, tpl, onSetBaseline, goBack }) {
  const photoFields = useMemo(() => tpl.fields.filter((f) => f.type === "photo"), [tpl]);
  const items = useMemo(() => buildPhotoItems(tpl, entries), [tpl, entries]);
  const [category, setCategory] = useState("all");
  const [bodyPart, setBodyPart] = useState("all");
  const [range, setRange] = useState("90");
  const [compare, setCompare] = useState(null); // { fieldKey, photoId }
  const [limit, setLimit] = useState(60);

  const categories = useMemo(() => ["all", ...Array.from(new Set(photoFields.map((f) => f.category || "skin")))], [photoFields]);
  const bodyParts = useMemo(() => ["all", ...Array.from(new Set(photoFields.map(bodyPartLabel).filter(Boolean)))], [photoFields]);

  if (photoFields.length === 0) {
    return (
      <div className="px-4 pb-10 pt-3">
        <Card><div className="text-sm" style={{ color: C.sub }}>No photo questions are set up yet. Add one in Edit Setup.</div></Card>
      </div>
    );
  }

  if (compare) {
    const field = photoFields.find((f) => f.k === compare.fieldKey);
    const fieldItems = items.filter((it) => it.field.k === compare.fieldKey).slice().sort((a, b) => (a.date < b.date ? -1 : 1));
    return (
      <div className="px-4 pb-10 pt-3">
        <PhotoCompareView field={field} tpl={tpl} items={fieldItems}
          baselinePhotoId={profile.photoBaselines?.[compare.fieldKey]}
          initialPhotoId={compare.photoId}
          onSetBaseline={onSetBaseline}
          onBack={() => setCompare(null)} />
      </div>
    );
  }

  const rangeStart = range === "all" ? null : addDays(todayStr(), -Number(range));
  const filtered = items.filter((it) => {
    if (category !== "all" && (it.field.category || "skin") !== category) return false;
    if (bodyPart !== "all" && bodyPartLabel(it.field) !== bodyPart) return false;
    if (rangeStart && it.date < rangeStart) return false;
    return true;
  });

  return (
    <div className="px-4 pb-10 pt-3">
      <div className="flex flex-wrap gap-1.5 mb-2">
        {categories.map((c) => (
          <button key={c} onClick={() => setCategory(c)}
            className="px-3 py-1.5 rounded-full text-xs font-medium"
            style={{ background: category === c ? tpl.color : C.faint, color: category === c ? readableInk(tpl.color) : C.ink }}>
            {c === "all" ? "All" : (PHOTO_CATEGORIES.find(([v]) => v === c)?.[1] || c)}
          </button>
        ))}
      </div>
      {bodyParts.length > 2 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {bodyParts.map((b) => (
            <button key={b} onClick={() => setBodyPart(b)}
              className="px-3 py-1.5 rounded-full text-xs font-medium"
              style={{ background: bodyPart === b ? tpl.color : C.faint, color: bodyPart === b ? readableInk(tpl.color) : C.ink }}>
              {b === "all" ? "All areas" : b}
            </button>
          ))}
        </div>
      )}
      <div className="flex gap-1.5 mb-3">
        {[["30", "30d"], ["90", "90d"], ["all", "All time"]].map(([v, l]) => (
          <button key={v} onClick={() => setRange(v)}
            className="px-3 py-1.5 rounded-full text-xs font-medium"
            style={{ background: range === v ? C.ink : C.faint, color: range === v ? readableInk(C.ink) : C.sub }}>
            {l}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card><div className="text-sm" style={{ color: C.sub }}>No photos in this range yet.</div></Card>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            {filtered.slice(0, limit).map((it) => (
              <button key={it.photoId} onClick={() => setCompare({ fieldKey: it.field.k, photoId: it.photoId })}
                className="relative rounded-lg overflow-hidden aspect-square">
                <GalleryThumb id={it.photoId} />
                {it.rating != null && (
                  <span className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                    style={(() => {
                      const fill = colorFor(Math.round((it.rating / (it.field.scaleMax || 10)) * 10) || 1, it.field.dir);
                      return { background: fill, color: readableInk(fill), boxShadow: `0 0 0 1.5px ${C.card}` };
                    })()}>
                    {it.rating}
                  </span>
                )}
                <div className="absolute bottom-0 left-0 right-0 px-1 py-0.5 text-[9px] text-white text-center truncate"
                  style={{ background: "rgba(0,0,0,0.45)" }}>
                  {fmtShort(it.date)}{it.captionVal ? ` · ${it.captionVal}` : ""}
                </div>
              </button>
            ))}
          </div>
          {filtered.length > limit && (
            <button onClick={() => setLimit((n) => n + 60)}
              className="w-full mt-3 py-2.5 rounded-xl text-sm font-medium" style={{ background: C.faint }}>
              Show more ({filtered.length - limit} remaining)
            </button>
          )}
        </>
      )}
    </div>
  );
}

/* ============================================================
   Reports — weekly / monthly "your week in review"
   Pure builder (buildReport) → serializable card descriptors →
   story-card renderer. All copy lives in REPORT_COPY so the
   no-causal-language rule stays auditable in one place.
   ============================================================ */

const REPORT_COPY = {
  footer: "From your own logs — not proof of cause.",
  patternsFooter: "Possible patterns in your own logs — not proof of cause. May be worth noticing or discussing with a healthcare professional.",
  photoFooter: "Visual comparison from your own photos — not a medical assessment.",
  weekTitle: "Your week in review",
  monthTitle: "Your month in review",
  emptyBody: "Log a few more days and this report will fill in.",
};

const mondayOf = (dateStr) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const dow = (dt.getDay() + 6) % 7; // Mon=0
  return addDays(dateStr, -dow);
};
const monthStartOf = (dateStr) => dateStr.slice(0, 8) + "01";
const prevMonthStart = (monthStart) => {
  const [y, m] = monthStart.split("-").map(Number);
  return localDateStr(new Date(y, m - 2, 1));
};
const monthEndOf = (monthStart) => {
  const [y, m] = monthStart.split("-").map(Number);
  return localDateStr(new Date(y, m, 0));
};
function monthLabel(monthStart) {
  const [y, m] = monthStart.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function loggedDaysIn(entries, start, end) {
  const s = new Set();
  for (const e of entries) if (e.date >= start && e.date <= end && !e.auto) s.add(e.date);
  return s.size;
}

/* Picks the calendar week (Mon–Sun) or calendar month to report on:
   the current period if it already has >= minDays logged, otherwise
   the previous period if it does. Returns null when neither qualifies. */
function pickReportRange(entries, type, today = todayStr(), minDays = 4) {
  if (type === "week") {
    const curStart = mondayOf(today);
    const candidates = [
      { start: curStart, end: addDays(curStart, 6) },
      { start: addDays(curStart, -7), end: addDays(curStart, -1) },
    ];
    for (const c of candidates) {
      if (loggedDaysIn(entries, c.start, c.end) >= minDays) {
        return { ...c, type, label: `${fmtNice(c.start)} – ${fmtNice(c.end)}` };
      }
    }
    return null;
  }
  const curStart = monthStartOf(today);
  const candidates = [curStart, prevMonthStart(curStart)];
  for (const s of candidates) {
    const end = monthEndOf(s);
    if (loggedDaysIn(entries, s, end) >= minDays) {
      return { start: s, end, type, label: monthLabel(s) };
    }
  }
  return null;
}

/* Period navigation: total functions over any offset (0 = the period
   containing today, -1 = the one before, …). Unlike pickReportRange these
   never return null — the screen decides what to show for thin periods. */
const dayDiff = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / 86400000);
function rangeForOffset(entries, type, offset, today = todayStr()) {
  if (type === "week") {
    const start = addDays(mondayOf(today), offset * 7);
    const end = addDays(start, 6);
    return { start, end, type, label: `${fmtNice(start)} – ${fmtNice(end)}`, days: loggedDaysIn(entries, start, end) };
  }
  let s = monthStartOf(today);
  for (let i = 0; i > offset; i--) s = prevMonthStart(s);
  const end = monthEndOf(s);
  return { start: s, end, type, label: monthLabel(s), days: loggedDaysIn(entries, s, end) };
}
function offsetOfPeriod(startStr, type, today = todayStr()) {
  if (type === "week") return Math.round(dayDiff(startStr, mondayOf(today)) / 7);
  const [cy, cm] = monthStartOf(today).split("-").map(Number);
  const [sy, sm] = startStr.split("-").map(Number);
  return (sy - cy) * 12 + (sm - cm);
}
/* Earliest period offset that contains any logged entry (0 when no entries). */
function minPeriodOffset(entries, type, today = todayStr()) {
  let earliest = null;
  for (const e of entries) if (e && e.date && (!earliest || e.date < earliest)) earliest = e.date;
  if (!earliest) return 0;
  const start = type === "week" ? mondayOf(earliest) : monthStartOf(earliest);
  return Math.min(0, offsetOfPeriod(start, type, today));
}

function avgInRange(entries, key, start, end) {
  const vals = entries.filter((e) => e.date >= start && e.date <= end)
    .map((e) => e.answers[key]).filter((v) => typeof v === "number");
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}
function priorRange(range) {
  if (range.type === "month") {
    const s = prevMonthStart(range.start);
    return { start: s, end: monthEndOf(s) };
  }
  const len = 7;
  return { start: addDays(range.start, -len), end: addDays(range.start, -1) };
}
function longestRunInRange(entries, start, end) {
  const set = new Set(entries.filter((e) => e.date >= start && e.date <= end && !e.auto).map((e) => e.date));
  let best = 0, run = 0, d = start;
  while (d <= end) {
    run = set.has(d) ? run + 1 : 0;
    if (run > best) best = run;
    d = addDays(d, 1);
  }
  return best;
}

/* ---------- P6: deterministic photo pair picking ----------
   For each photo field with >= 2 saved photos taken on or before
   range.end: right = latest such photo; left = the field's baseline
   photo if it's older than right, else the earliest photo. */
function pickPairs(tpl, entries, range, baselines = {}) {
  const items = buildPhotoItems(tpl, entries); // newest first
  const groups = [];
  for (const f of tpl.fields.filter((x) => x.type === "photo")) {
    const cand = items.filter((it) => it.field.k === f.k && it.date <= range.end)
      .slice().sort((a, b) => (a.date < b.date ? -1 : 1)); // oldest → newest
    if (cand.length < 2) continue;
    const right = cand[cand.length - 1];
    const baseId = baselines[f.k];
    let left = baseId ? cand.find((it) => it.photoId === baseId) : null;
    if (!left || left.photoId === right.photoId || left.date >= right.date) left = cand[0];
    if (left.photoId === right.photoId) continue;
    groups.push({
      fieldKey: f.k, label: f.label, spot: bodyPartLabel(f) || f.label,
      ratingLabel: linkedLabel(f, tpl),
      a: { photoId: left.photoId, date: left.date, rating: left.rating, captionVal: left.captionVal },
      b: { photoId: right.photoId, date: right.date, rating: right.rating, captionVal: right.captionVal },
    });
  }
  return groups;
}

/* ---------- report card catalog (P5 uses this for the deck) ---------- */

const REPORT_CARD_CATALOG = [
  { key: "streak", title: "Streaks", desc: "Your logging streak and best run in the period." },
  { key: "bestWorst", title: "Best & toughest days", desc: "The days your key metric was at its best and its worst." },
  { key: "averages", title: "Averages vs last period", desc: "Each tracked metric compared with the period before." },
  { key: "mostImproved", title: "Biggest change", desc: "The metric that moved the most, in the helpful direction." },
  { key: "mostCommon", title: "Most common level", desc: "The rating you logged most often for your key metric." },
  { key: "trends", title: "Trend lines", desc: "A small trend line for each charted metric." },
  { key: "routines", title: "Routines", desc: "How often your habits and tags showed up." },
  { key: "notes", title: "Notes highlights", desc: "A few of your own notes from the period." },
  { key: "patterns", title: "Possible patterns", desc: "Cautious pattern hints from your own logs." },
  { key: "photoCompare", title: "Photo comparisons", desc: "Side-by-side earlier vs latest photos per body spot." },
];

/* Which catalog cards can even exist for this setup (personalization). */
function availableReportCards(tpl) {
  const hasPhotos = tpl.fields.some((f) => f.type === "photo");
  const hasRoutines = tpl.fields.some((f) => f.type === "toggle" || f.type === "chips");
  return REPORT_CARD_CATALOG.filter((c) => {
    if (c.key === "photoCompare") return hasPhotos;
    if (c.key === "routines") return hasRoutines;
    if (c.key === "patterns") return tpl.pairs.length > 0;
    return true;
  });
}
function cardIncluded(prefs, key) {
  return !prefs || prefs[key] !== false;
}

/* ---------- buildReport: pure, serializable output ---------- */

function buildReport(db, range) {
  const profile = db.profile;
  const tpl = getProfileTemplate(profile);
  const entries = entriesFor(db);
  const inRange = entries.filter((e) => e.date >= range.start && e.date <= range.end);
  const days = loggedDaysIn(entries, range.start, range.end);
  const prefs = profile.reportPrefs;
  const prev = priorRange(range);
  const cards = [];

  cards.push({
    type: "header",
    title: range.type === "week" ? REPORT_COPY.weekTitle : REPORT_COPY.monthTitle,
    rangeLabel: range.label, days, periodType: range.type,
  });
  if (days < 4) { cards.push({ type: "empty", text: REPORT_COPY.emptyBody }); return cards; }

  const keyField = getField(tpl, tpl.keyMetric);

  if (cardIncluded(prefs, "streak")) {
    cards.push({ type: "streak", current: calcStreak(entries), longest: longestRunInRange(entries, range.start, range.end) });
  }

  if (cardIncluded(prefs, "bestWorst") && keyField) {
    const scored = inRange.filter((e) => typeof e.answers[tpl.keyMetric] === "number")
      .map((e) => ({ date: e.date, v: e.answers[tpl.keyMetric] }));
    if (scored.length >= 2) {
      const sorted = [...scored].sort((a, b) => a.v - b.v);
      const lowest = sorted[0], highest = sorted[sorted.length - 1];
      const best = keyField.dir === "pos" ? highest : lowest;
      const worst = keyField.dir === "pos" ? lowest : highest;
      if (best.v !== worst.v) {
        cards.push({ type: "bestWorst", metricLabel: keyField.label, dir: keyField.dir, best, worst });
      }
    }
  }

  if (cardIncluded(prefs, "averages")) {
    const rows = [];
    for (const k of tpl.dashboardMetrics) {
      const f = getField(tpl, k);
      if (!f) continue;
      const cur = avgInRange(entries, k, range.start, range.end);
      if (cur == null) continue;
      const before = avgInRange(entries, k, prev.start, prev.end);
      rows.push({ key: k, label: f.label, dir: f.dir, cur, prev: before, delta: before == null ? null : cur - before });
    }
    if (rows.length) cards.push({ type: "averages", rows: rows.slice(0, 8) });
  }

  if (cardIncluded(prefs, "mostImproved")) {
    let bestRow = null;
    for (const k of tpl.dashboardMetrics) {
      const f = getField(tpl, k);
      if (!f || f.dir === "neutral") continue;
      const cur = avgInRange(entries, k, range.start, range.end);
      const before = avgInRange(entries, k, prev.start, prev.end);
      if (cur == null || before == null) continue;
      const delta = cur - before;
      const improvement = f.dir === "pos" ? delta : -delta;
      if (improvement >= 0.5 && (!bestRow || improvement > bestRow.improvement)) {
        bestRow = { label: f.label, dir: f.dir, cur, prev: before, delta, improvement };
      }
    }
    if (bestRow) cards.push({ type: "mostImproved", ...bestRow });
  }

  if (cardIncluded(prefs, "mostCommon") && keyField) {
    const counts = {};
    for (const e of inRange) {
      const v = e.answers[tpl.keyMetric];
      if (typeof v === "number") counts[v] = (counts[v] || 0) + 1;
    }
    const levels = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    if (levels.length && levels[0][1] >= 3) {
      cards.push({ type: "mostCommon", metricLabel: keyField.label, dir: keyField.dir, level: Number(levels[0][0]), count: levels[0][1], days });
    }
  }

  if (cardIncluded(prefs, "trends")) {
    const metrics = [];
    for (const k of tpl.chartMetrics) {
      const f = getField(tpl, k);
      if (!f) continue;
      const pts = inRange.filter((e) => typeof e.answers[k] === "number")
        .map((e) => ({ d: e.date, v: e.answers[k] }));
      if (pts.length >= 3) metrics.push({ key: k, label: f.label, dir: f.dir, points: pts, avg: pts.reduce((s, p) => s + p.v, 0) / pts.length });
    }
    if (metrics.length) cards.push({ type: "trends", metrics: metrics.slice(0, 6) });
  }

  if (cardIncluded(prefs, "routines")) {
    const items = [];
    for (const f of tpl.fields) {
      if (f.type === "toggle") {
        const n = inRange.filter((e) => e.answers[f.k] === true).length;
        if (n >= 3) items.push({ label: f.label, text: `${n} of ${days} logged days` });
      }
    }
    const chipCounts = [];
    for (const f of tpl.fields.filter((x) => x.type === "chips")) {
      const counts = {};
      for (const e of inRange) for (const opt of (Array.isArray(e.answers[f.k]) ? e.answers[f.k] : [])) counts[opt] = (counts[opt] || 0) + 1;
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3);
      if (top.length && top[0][1] >= 2) chipCounts.push({ label: f.label, text: top.map(([o, n]) => `${o} ×${n}`).join(" · ") });
    }
    const all = [...items, ...chipCounts].slice(0, 5);
    if (all.length) cards.push({ type: "routines", items: all });
  }

  if (cardIncluded(prefs, "notes")) {
    const noted = inRange.filter((e) => e.notes && e.notes.trim())
      .sort((a, b) => b.notes.length - a.notes.length).slice(0, 3)
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .map((e) => ({ date: e.date, text: e.notes.trim().slice(0, 160) }));
    if (noted.length) cards.push({ type: "notes", items: noted });
  }

  if (cardIncluded(prefs, "patterns")) {
    const ins = computeInsightsWindow(tpl, entries, range.start, range.end)
      .map((i) => ({ title: i.title, detail: i.detail }));
    if (ins.length) cards.push({ type: "patterns", items: ins });
  }

  if (cardIncluded(prefs, "photoCompare")) {
    const groups = pickPairs(tpl, entries, range, profile.photoBaselines || {});
    if (groups.length) cards.push({ type: "photoCompare", groups });
  }

  return cards;
}

/* Flattens saved reports overlapping [start, end] into spreadsheet rows —
   pulled from the saved descriptor models, so it matches what the user saw. */
function reportSummaryRows(reports, start, end) {
  const rows = [];
  for (const r of reports || []) {
    if (r.range.start > end || r.range.end < start) continue;
    const get = (t) => r.model.find((c) => c.type === t);
    const header = get("header") || {};
    const streak = get("streak");
    const imp = get("mostImproved");
    const avg = get("averages");
    const pats = get("patterns");
    rows.push({
      report_type: r.type,
      period: header.rangeLabel || r.range.label || "",
      period_start: r.range.start,
      period_end: r.range.end,
      saved_at: r.createdAt,
      logged_days: header.days ?? "",
      best_run: streak ? streak.longest : "",
      streak_at_save: streak ? streak.current : "",
      biggest_change: imp ? `${imp.label}: ${fmt1(imp.prev)} -> ${fmt1(imp.cur)}` : "",
      averages: avg ? avg.rows.map((x) =>
        `${x.label} ${fmt1(x.cur)}${x.delta != null ? ` (${x.delta > 0 ? "+" : ""}${Math.round(x.delta * 10) / 10})` : ""}`).join("; ") : "",
      possible_patterns: pats ? pats.items.map((p) => p.title).join("; ") : "",
      note: REPORT_COPY.footer,
    });
  }
  return rows.sort((a, b) => (a.period_start < b.period_start ? -1 : 1));
}

/* ============================================================
   Report UI — story cards, photo pager, A/B slider
   ============================================================ */

function DeltaBadge({ delta, dir }) {
  if (delta == null) return <span className="text-xs" style={{ color: C.sub }}>new</span>;
  const rounded = Math.round(delta * 10) / 10;
  if (Math.abs(rounded) < 0.05) return <span className="text-xs font-medium" style={{ color: C.sub }}>±0</span>;
  const improving = dir === "neutral" ? null : (dir === "pos" ? rounded > 0 : rounded < 0);
  const color = improving == null ? C.sub : improving ? C.good : C.bad;
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: C.faint, color }}>
      {rounded > 0 ? "+" : ""}{rounded}
    </span>
  );
}

function ReportCardShell({ eyebrow, children, tint, footer }) {
  return (
    <Card className="mb-3">
      {eyebrow && (
        <div className="text-[10px] font-semibold uppercase tracking-wider mb-2 px-2 py-0.5 rounded-full inline-block"
          style={{ background: C.faint, color: tint }}>{eyebrow}</div>
      )}
      {children}
      {footer && <p className="text-[10px] mt-3 leading-relaxed" style={{ color: C.sub }}>{footer}</p>}
    </Card>
  );
}

/* Full-screen A/B compare with a draggable divider (touch + keyboard). */
function ABSlider({ a, b, ratingLabel, onClose }) {
  const srcA = usePhoto(a.photoId, "full");
  const srcB = usePhoto(b.photoId, "full");
  const [pos, setPos] = useState(50);
  const boxRef = useRef(null);
  const dragging = useRef(false);
  const move = (clientX) => {
    const r = boxRef.current?.getBoundingClientRect();
    if (!r) return;
    setPos(clamp(Math.round(((clientX - r.left) / r.width) * 100), 0, 100));
  };
  return (
    <div className="fixed inset-0 z-50 flex flex-col p-4" style={{ background: "rgba(20,26,23,0.96)" }}>
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-white">{ratingLabel || "Compare"}</div>
        <button onClick={onClose} aria-label="close compare view"
          className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.12)" }}>
          <Icon name="x" size={16} color="#fff" />
        </button>
      </div>
      <div ref={boxRef} className="relative w-full rounded-xl overflow-hidden select-none"
        style={{ aspectRatio: "3 / 4", maxHeight: "60vh", background: "#000", touchAction: "none" }}
        onPointerDown={(e) => { dragging.current = true; move(e.clientX); }}
        onPointerMove={(e) => { if (dragging.current) move(e.clientX); }}
        onPointerUp={() => { dragging.current = false; }}
        onPointerLeave={() => { dragging.current = false; }}>
        {srcB && <img src={srcB} alt={`later photo, ${fmtNice(b.date)}`} className="absolute inset-0 w-full h-full object-cover" draggable={false} />}
        {srcA && (
          <img src={srcA} alt={`earlier photo, ${fmtNice(a.date)}`} className="absolute inset-0 w-full h-full object-cover" draggable={false}
            style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} />
        )}
        <div className="absolute top-0 bottom-0" style={{ left: `${pos}%`, width: 2, background: "#fff", transform: "translateX(-1px)" }} />
        <div className="absolute top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center"
          style={{ left: `${pos}%`, transform: "translate(-50%,-50%)", background: "#fff" }}>
          <Icon name="sliders" size={15} color={C.ink} />
        </div>
        {(!srcA || !srcB) && (
          <div className="absolute inset-0 flex items-center justify-center text-xs" style={{ color: C.subtle }}>
            {srcA === undefined || srcB === undefined ? "Loading…" : "Photo missing"}
          </div>
        )}
      </div>
      <input type="range" min={0} max={100} value={pos} onChange={(e) => setPos(Number(e.target.value))}
        aria-label="comparison divider position" className="w-full mt-3" />
      <div className="flex justify-between text-[11px] mt-2" style={{ color: C.muted }}>
        <span>Left: {fmtNice(a.date)}{a.rating != null ? `, rated ${a.rating}` : ""}</span>
        <span>Right: {fmtNice(b.date)}{b.rating != null ? `, rated ${b.rating}` : ""}</span>
      </div>
      <p className="text-[10px] mt-2" style={{ color: C.subtle }}>{REPORT_COPY.photoFooter}</p>
    </div>
  );
}

function PhotoPairThumb({ item, side }) {
  const src = usePhoto(item.photoId, "thumb");
  return (
    <div className="flex-1 min-w-0">
      <div className={"rounded-lg overflow-hidden aspect-square" + (src === undefined ? " fhj-shimmer" : "")} style={{ background: C.faint }}>
        {src ? <img src={src} alt={`${side} photo, ${fmtNice(item.date)}`} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-[10px]" style={{ color: C.sub }}>Photo missing</div>}
      </div>
      <div className="text-[10px] mt-1 text-center leading-tight" style={{ color: C.sub }}>
        {fmtNice(item.date)}{item.rating != null ? <> · rated <b style={{ color: C.ink }}>{item.rating}</b></> : ""}
        {item.captionVal ? ` · ${item.captionVal}` : ""}
      </div>
    </div>
  );
}

/* Horizontal snap pager through body-spot photo pairs. */
function PhotoCompareCard({ groups, tint }) {
  /* data-noswipe: this card pages horizontally itself */
  const [ab, setAb] = useState(null);
  return (
    <ReportCardShell eyebrow="Photo comparison" tint={tint} footer={REPORT_COPY.photoFooter}>
      <div data-noswipe className="fhj-photo-pager flex gap-3 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollSnapType: "x mandatory" }}>
        {groups.map((g) => (
          <div key={g.fieldKey} className="fhj-photo-page shrink-0" style={{ width: groups.length > 1 ? "86%" : "100%", scrollSnapAlign: "start" }}>
            <div className="text-sm font-semibold mb-1">{g.spot}</div>
            {g.ratingLabel && <div className="text-[10px] mb-2" style={{ color: C.sub }}>Rating shown: {g.ratingLabel}</div>}
            <button onClick={() => setAb(g)} className="w-full text-left" aria-label={`open full comparison for ${g.spot}`}>
              <div className="flex gap-2">
                <PhotoPairThumb item={g.a} side="earlier" />
                <PhotoPairThumb item={g.b} side="latest" />
              </div>
            </button>
            {g.a.rating != null && g.b.rating != null && (
              <div className="flex items-center justify-center gap-2 mt-2 text-xs" style={{ color: C.sub }}>
                <span>{g.a.rating}</span><Icon name="right" size={12} color={C.sub} /><span>{g.b.rating}</span>
                <DeltaBadge delta={g.b.rating - g.a.rating} dir="neutral" />
              </div>
            )}
            <div className="text-[10px] mt-1 text-center no-print" style={{ color: C.sub }}>Tap photos for full-screen slider</div>
          </div>
        ))}
      </div>
      {groups.length > 1 && (
        <div className="text-[10px] mt-2 no-print" style={{ color: C.sub }}>Swipe sideways for more body spots →</div>
      )}
      {ab && <ABSlider a={ab.a} b={ab.b} ratingLabel={ab.spot} onClose={() => setAb(null)} />}
    </ReportCardShell>
  );
}

function ReportCards({ cards, tint }) {
  return (
    <>
      {cards.map((card, i) => {
        if (card.type === "header") {
          return (
            /* Hidden when printing — the print masthead already carries the
               title, range, and day count, and this card's white-on-tint text
               is unreadable once print styles flatten backgrounds to paper. */
            /* Ink is derived, not literal: `tint` is the live accent, which is
               a pale blue in dark mode and a deep one in light mode. A fixed
               white here was legible in exactly one of those. */
            <Card key={i} className="mb-3 relative overflow-hidden no-print"
              style={{ background: tint, border: "none", color: readableInk(tint) }}>
              <AmbientGlow tint={C.accent} second={C.warn} opacity={0.3} />
              <div className="text-[10px] font-semibold uppercase tracking-wider relative" style={{ opacity: 0.75 }}>
                {card.periodType === "week" ? "Weekly report" : "Monthly report"}
              </div>
              <div className="font-display text-3xl mt-1">{card.title}</div>
              <div className="text-sm mt-1" style={{ opacity: 0.85 }}>{card.rangeLabel}</div>
              <div className="text-xs mt-2" style={{ opacity: 0.75 }}>{card.days} logged day{card.days === 1 ? "" : "s"}</div>
            </Card>
          );
        }
        if (card.type === "empty") {
          return <Card key={i} className="mb-3"><div className="text-sm" style={{ color: C.sub }}>{card.text}</div></Card>;
        }
        if (card.type === "streak") {
          return (
            <ReportCardShell key={i} eyebrow="Streaks" tint={tint}>
              <div className="flex gap-4">
                <div className="flex-1">
                  <div className="font-display text-4xl leading-none"><CountUp value={card.longest} /></div>
                  <div className="text-xs mt-1" style={{ color: C.sub }}>best run this period</div>
                </div>
                <div className="flex-1">
                  <div className="font-display text-4xl leading-none"><CountUp value={card.current} /></div>
                  <div className="text-xs mt-1" style={{ color: C.sub }}>current streak</div>
                </div>
              </div>
            </ReportCardShell>
          );
        }
        if (card.type === "bestWorst") {
          return (
            <ReportCardShell key={i} eyebrow="Best & toughest days" tint={tint} footer={REPORT_COPY.footer}>
              <div className="text-xs mb-2" style={{ color: C.sub }}>{card.metricLabel}</div>
              <div className="flex gap-3">
                {[["Best day", card.best], ["Toughest day", card.worst]].map(([lbl, d]) => (
                  <div key={lbl} className="flex-1 rounded-xl p-3" style={{ background: C.faint }}>
                    <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: C.sub }}>{lbl}</div>
                    <div className="font-display text-3xl mt-1" style={{ color: colorFor(d.v, card.dir) }}>{d.v}</div>
                    <div className="text-xs mt-1" style={{ color: C.sub }}>{fmtNice(d.date)}</div>
                  </div>
                ))}
              </div>
            </ReportCardShell>
          );
        }
        if (card.type === "averages") {
          return (
            <ReportCardShell key={i} eyebrow="Averages vs last period" tint={tint} footer={REPORT_COPY.footer}>
              {card.rows.map((r, j) => (
                <div key={r.key || j} className="flex items-center justify-between py-2"
                  style={{ borderTop: j > 0 ? `1px solid ${C.line}` : "none" }}>
                  <span className="text-sm">{r.label}</span>
                  <span className="flex items-center gap-2">
                    <span className="font-display text-lg">{fmt1(r.cur)}</span>
                    <DeltaBadge delta={r.delta} dir={r.dir} />
                  </span>
                </div>
              ))}
            </ReportCardShell>
          );
        }
        if (card.type === "mostImproved") {
          return (
            <ReportCardShell key={i} eyebrow="Biggest helpful change" tint={tint} footer={REPORT_COPY.footer}>
              <div className="text-sm font-semibold">{card.label}</div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="font-display text-3xl">{fmt1(card.cur)}</span>
                <span className="text-xs" style={{ color: C.sub }}>from {fmt1(card.prev)} last period</span>
                <DeltaBadge delta={card.delta} dir={card.dir} />
              </div>
            </ReportCardShell>
          );
        }
        if (card.type === "mostCommon") {
          return (
            <ReportCardShell key={i} eyebrow="Most common level" tint={tint}>
              <div className="text-xs mb-1" style={{ color: C.sub }}>{card.metricLabel}</div>
              <div className="flex items-baseline gap-2">
                <span className="font-display text-4xl" style={{ color: colorFor(card.level, card.dir) }}>{card.level}</span>
                <span className="text-sm" style={{ color: C.sub }}>on {card.count} of {card.days} logged days</span>
              </div>
            </ReportCardShell>
          );
        }
        if (card.type === "trends") {
          return (
            <ReportCardShell key={i} eyebrow="Trend lines" tint={tint}>
              {card.metrics.map((m, j) => (
                <div key={m.key || j} className="py-2" style={{ borderTop: j > 0 ? `1px solid ${C.line}` : "none" }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm">{m.label}</span>
                    <span className="text-xs" style={{ color: C.sub }}>avg {fmt1(m.avg)}</span>
                  </div>
                  <Sparkline points={m.points.map((p) => p.v)} color={tint} height={32} />
                </div>
              ))}
            </ReportCardShell>
          );
        }
        if (card.type === "routines") {
          return (
            <ReportCardShell key={i} eyebrow="Routines" tint={tint}>
              {card.items.map((it, j) => (
                <div key={j} className="flex items-center justify-between py-2 gap-3"
                  style={{ borderTop: j > 0 ? `1px solid ${C.line}` : "none" }}>
                  <span className="text-sm">{it.label}</span>
                  <span className="text-xs text-right" style={{ color: C.sub }}>{it.text}</span>
                </div>
              ))}
            </ReportCardShell>
          );
        }
        if (card.type === "notes") {
          return (
            <ReportCardShell key={i} eyebrow="In your own words" tint={tint}>
              {card.items.map((n, j) => (
                <div key={j} className="py-2" style={{ borderTop: j > 0 ? `1px solid ${C.line}` : "none" }}>
                  <div className="text-[10px] mb-0.5" style={{ color: C.sub }}>{fmtNice(n.date)}</div>
                  <div className="text-sm leading-relaxed">“{n.text}”</div>
                </div>
              ))}
            </ReportCardShell>
          );
        }
        if (card.type === "patterns") {
          return (
            <ReportCardShell key={i} eyebrow="Possible patterns" tint={tint} footer={REPORT_COPY.patternsFooter}>
              {card.items.map((p, j) => (
                <div key={j} className="py-2" style={{ borderTop: j > 0 ? `1px solid ${C.line}` : "none" }}>
                  <div className="text-sm font-semibold">{p.title}</div>
                  <div className="text-sm mt-0.5 leading-relaxed" style={{ color: C.sub }}>{p.detail}</div>
                </div>
              ))}
            </ReportCardShell>
          );
        }
        if (card.type === "photoCompare") {
          return <PhotoCompareCard key={i} groups={card.groups} tint={tint} />;
        }
        return null;
      })}
    </>
  );
}

/* ============================================================
   P7 — share PNG + save/history helpers
   ============================================================ */

async function renderShareCard(cards, tint, includePhotos) {
  const W = 1080, H = 1400;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d");
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
  const header = cards.find((c) => c.type === "header") || {};
  // header band (roundRect is missing on older Safari — fall back to a plain rect)
  ctx.fillStyle = tint; ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(48, 48, W - 96, 260, 28); else ctx.rect(48, 48, W - 96, 260);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.font = "600 30px system-ui, sans-serif";
  ctx.fillText(header.periodType === "week" ? "WEEKLY REPORT" : "MONTHLY REPORT", 88, 122);
  ctx.fillStyle = "#fff"; ctx.font = "600 72px Georgia, serif";
  ctx.fillText(header.title || "Your report", 88, 205);
  ctx.font = "400 32px system-ui, sans-serif"; ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillText(`${header.rangeLabel || ""} · ${header.days || 0} logged days`, 88, 262);

  let y = 380;
  const line = (txt, opts = {}) => {
    ctx.fillStyle = opts.color || C.ink;
    ctx.font = opts.font || "400 34px system-ui, sans-serif";
    ctx.fillText(txt, opts.x ?? 88, y);
    y += opts.gap ?? 56;
  };
  const streak = cards.find((c) => c.type === "streak");
  if (streak) line(`Best run: ${streak.longest} days · Current streak: ${streak.current}`, { font: "600 36px system-ui, sans-serif" });
  const avg = cards.find((c) => c.type === "averages");
  if (avg) {
    y += 12;
    line("Averages vs last period", { color: C.sub, font: "600 28px system-ui, sans-serif", gap: 48 });
    for (const r of avg.rows.slice(0, 6)) {
      const d = r.delta == null ? "new" : `${r.delta > 0 ? "+" : ""}${Math.round(r.delta * 10) / 10}`;
      line(`${r.label}: ${fmt1(r.cur)}  (${d})`, { gap: 50 });
    }
  }
  const imp = cards.find((c) => c.type === "mostImproved");
  if (imp) { y += 8; line(`Biggest helpful change: ${imp.label} ${fmt1(imp.prev)} → ${fmt1(imp.cur)}`, { font: "600 34px system-ui, sans-serif" }); }
  const pats = cards.find((c) => c.type === "patterns");
  if (pats) line(`${pats.items.length} possible pattern${pats.items.length === 1 ? "" : "s"} noticed — not proof of cause`, { color: C.sub });

  const photo = cards.find((c) => c.type === "photoCompare");
  if (includePhotos && photo && photo.groups[0]) {
    const g = photo.groups[0];
    const [ta, tb] = await Promise.all([loadThumbData(g.a.photoId), loadThumbData(g.b.photoId)]);
    const size = 300, px = 88;
    const drawImg = (src, x) => new Promise((res) => {
      if (!src) { res(); return; }
      const img = new Image();
      img.onload = () => { ctx.drawImage(img, x, y, size, size); res(); };
      img.onerror = () => res();
      img.src = src;
    });
    y += 12;
    ctx.fillStyle = C.sub; ctx.font = "600 28px system-ui, sans-serif";
    ctx.fillText(`${g.spot} — earlier vs latest`, px, y); y += 24;
    await drawImg(ta, px); await drawImg(tb, px + size + 24);
    ctx.fillStyle = C.sub; ctx.font = "400 26px system-ui, sans-serif";
    ctx.fillText(`${fmtShort(g.a.date)}${g.a.rating != null ? ` · rated ${g.a.rating}` : ""}`, px, y + size + 40);
    ctx.fillText(`${fmtShort(g.b.date)}${g.b.rating != null ? ` · rated ${g.b.rating}` : ""}`, px + size + 24, y + size + 40);
    y += size + 90;
  }

  ctx.fillStyle = C.sub; ctx.font = "400 24px system-ui, sans-serif";
  ctx.fillText(REPORT_COPY.footer, 88, H - 120);
  ctx.fillText("Personal tracking only — not medical advice.", 88, H - 80);

  return new Promise((resolve) => cv.toBlob((b) => resolve(b), "image/png"));
}

/* ============================================================
   P5 — swipe deck for report card preferences
   ============================================================ */

function SwipeCard({ card, onDecide, tint, topmost, flingRef }) {
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false, axis: null });
  const [leaving, setLeaving] = useState(false);
  const [settled, setSettled] = useState(!topmost); // true once the promote tween owns the resting state
  const start = useRef(null);
  const width = useRef(300);
  const ref = useRef(null);
  const busy = useRef(false);
  useEffect(() => { if (ref.current) width.current = ref.current.offsetWidth; }, []);

  const fling = (include, fromX = 0) => {
    if (busy.current) return;
    busy.current = true;
    setLeaving(true);
    feedback(include ? "include" : "skip");
    flingCard(ref.current, include ? 1 : -1, fromX, () => onDecide(include));
  };
  // useLayoutEffect: GSAP claims the transform before the browser paints, so
  // promotion never flashes React's resting style first. React then steps
  // back entirely (no inline transform) — one system owns motion at a time.
  useLayoutEffect(() => {
    if (topmost && flingRef) {
      flingRef.current = fling;
      setSettled(false);
      promoteCard(ref.current, () => setSettled(true));
    }
  }, [topmost]); // eslint-disable-line
  const onDown = (e) => { start.current = { x: e.clientX, y: e.clientY }; setDrag({ x: 0, y: 0, active: true, axis: null }); };
  const onMove = (e) => {
    if (!start.current) return;
    const dx = e.clientX - start.current.x, dy = e.clientY - start.current.y;
    let axis = drag.axis;
    if (!axis && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) axis = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
    if (axis === "y") { start.current = null; setDrag({ x: 0, y: 0, active: false, axis: null }); return; }
    setDrag({ x: dx, y: dy * 0.2, active: true, axis });
  };
  const onUp = () => {
    if (!start.current) return;
    const dx = drag.x;
    start.current = null;
    if (Math.abs(dx) > width.current * 0.35) { fling(dx > 0, dx); return; }
    setDrag({ x: 0, y: 0, active: false, axis: null });
  };
  const rot = drag.x / 22;
  const opinion = drag.x > 40 ? "include" : drag.x < -40 ? "skip" : null;
  return (
    <div ref={ref}
      className="absolute inset-0 rounded-2xl p-5 flex flex-col"
      style={{
        background: C.card, border: `1px solid ${C.line}`, boxShadow: "0 10px 30px rgba(31,43,39,0.12)",
        transform: leaving || (topmost && !settled) ? undefined // GSAP owns these phases
          : topmost ? `translate(${drag.x}px, ${drag.y}px) rotate(${rot}deg)`
          : "scale(0.95) translateY(10px)",
        transition: drag.active || leaving || (topmost && !settled) ? "none" : "transform 320ms cubic-bezier(0.34, 1.45, 0.64, 1)",
        touchAction: "pan-y", zIndex: topmost ? 2 : 1,
      }}
      onPointerDown={topmost && !leaving ? onDown : undefined}
      onPointerMove={topmost && !leaving ? onMove : undefined}
      onPointerUp={topmost && !leaving ? onUp : undefined}
      onPointerCancel={topmost && !leaving ? onUp : undefined}>
      <div className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: tint }}>Report card</div>
      <div className="font-display text-2xl leading-snug">{card.title}</div>
      <p className="text-sm mt-2 leading-relaxed" style={{ color: C.sub }}>{card.desc}</p>
      <div className="mt-auto rounded-xl p-3 text-xs" style={{ background: C.faint, color: C.sub }}>
        Swipe right to include · swipe left to skip
      </div>
      {opinion && (
        <div className="absolute top-4 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
          style={{
            [opinion === "include" ? "left" : "right"]: "1rem",
            background: opinion === "include" ? C.good : C.subtle,
            color: readableInk(opinion === "include" ? C.good : C.subtle),
            transform: `rotate(${opinion === "include" ? -8 : 8}deg)`,
          }}>
          {opinion === "include" ? "Include" : "Skip"}
        </div>
      )}
    </div>
  );
}

function SwipeDeck({ catalog, initialPrefs, tint, onDone }) {
  const [idx, setIdx] = useState(0);
  const [choices, setChoices] = useState({ ...(initialPrefs || {}) });
  const flingRef = useRef(null);
  const endRef = useRef(null);
  const done = idx >= catalog.length;
  const includedCount = catalog.filter((c) => choices[c.key] !== false).length;
  const ok = includedCount >= 3;

  const decide = (include) => {
    const key = catalog[idx].key;
    setChoices((p) => ({ ...p, [key]: include }));
    setIdx((i) => i + 1);
  };
  // buttons throw the top card exactly like a swipe does
  const decideViaButton = (include) => {
    if (flingRef.current) flingRef.current(include);
    else decide(include);
  };

  useEffect(() => {
    if (done) { animateFinish(endRef.current); if (ok) feedback("milestone"); }
  }, [done]); // eslint-disable-line

  if (done) {
    return (
      <div ref={endRef} className="px-4 pt-6 pb-10">
        <div className="font-display text-2xl mb-2">{ok ? "Your report is personalized" : "A few more to go"}</div>
        <p className="text-sm leading-relaxed mb-4" style={{ color: C.sub }}>
          {ok
            ? `${includedCount} card type${includedCount === 1 ? "" : "s"} included. You can change this anytime in Settings → Report cards.`
            : "Reports need at least 3 card types to be useful. Please include a few more."}
        </p>
        {!ok && (
          <button onClick={() => setIdx(0)} className="w-full py-3 rounded-xl text-sm font-semibold mb-2" style={{ background: C.faint }}>
            Go through the cards again
          </button>
        )}
        <button disabled={!ok} onClick={() => onDone(choices)}
          className="fhj-btn fhj-btn-primary fhj-btn-block">
          Show my report
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 pb-10">
      <div className="font-display text-2xl mb-1">Pick your report cards</div>
      <p className="text-sm mb-4" style={{ color: C.sub }}>
        Choose what shows up in your weekly and monthly reports.
      </p>
      <div className="relative" style={{ height: 300 }}>
        {catalog.slice(idx, idx + 2).map((c, j) => (
          <SwipeCard key={c.key} card={c} tint={tint} topmost={j === 0} onDecide={decide}
            flingRef={j === 0 ? flingRef : undefined} />
        ))}
      </div>
      <div className="flex gap-3 mt-4">
        <button onClick={() => decideViaButton(false)}
          className="flex-1 py-3.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
          style={{ background: C.faint }} aria-label="skip this card">
          <Icon name="x" size={15} color={C.ink} /> Skip
        </button>
        <button onClick={() => decideViaButton(true)}
          className="flex-1 py-3.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
          style={{ background: tint, color: readableInk(tint) }} aria-label="include this card">
          <Icon name="check" size={15} color={readableInk(tint)} /> Include
        </button>
      </div>
      <div className="text-center text-xs mt-4" style={{ color: C.sub }} aria-live="polite">
        {idx + 1} of {catalog.length}
      </div>
      <div className="flex justify-center gap-1.5 mt-2" aria-hidden="true">
        {catalog.map((c, j) => (
          <span key={c.key} className="w-1.5 h-1.5 rounded-full"
            style={{ background: j < idx ? tint : j === idx ? C.ink : C.line }} />
        ))}
      </div>
    </div>
  );
}

/* Settings list editor — the non-swipe way to edit report prefs. */
function ReportPrefsSettings({ profile, onSavePrefs }) {
  const tpl = getProfileTemplate(profile);
  const catalog = availableReportCards(tpl);
  const prefs = profile.reportPrefs || {};
  const includedCount = catalog.filter((c) => cardIncluded(prefs, c.key)).length;
  const toggle = (key) => {
    const on = cardIncluded(prefs, key);
    if (on && includedCount <= 3) return; // keep the 3-card floor
    feedback("tap");
    onSavePrefs({ ...prefs, [key]: !on });
  };
  return (
    <div>
      {catalog.map((c, i) => {
        const on = cardIncluded(prefs, c.key);
        const locked = on && includedCount <= 3;
        return (
          <button key={c.key} onClick={() => toggle(c.key)}
            className="w-full flex items-center justify-between py-2.5 text-left gap-3"
            style={{ borderTop: i > 0 ? `1px solid ${C.line}` : "none", opacity: locked ? 0.6 : 1 }}>
            <span>
              <span className="text-sm font-medium block">{c.title}</span>
              <span className="text-[11px] block" style={{ color: C.sub }}>{c.desc}</span>
            </span>
            <span className="w-10 h-6 rounded-full relative shrink-0 transition-colors"
              style={{ background: on ? C.accent : C.line }}>
              <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
                style={{ left: on ? "1.15rem" : "0.15rem" }} />
            </span>
          </button>
        );
      })}
      <p className="text-[11px] mt-2" style={{ color: C.sub }}>At least 3 card types stay on so reports remain useful.</p>
    </div>
  );
}

/* ============================================================
   Report screen — live or saved, save/share/print actions
   ============================================================ */

function ReportScreen({ db, setDb, params, goBack }) {
  const profile = db.profile;
  const tpl = getProfileTemplate(profile);
  const entries = entriesFor(db);
  const saved = params.savedId ? (db.reports || []).find((r) => r.id === params.savedId) : null;
  const needsPrefs = !saved && profile.reportPrefs === undefined;
  const [busyShare, setBusyShare] = useState(false);
  const [sharePhotos, setSharePhotos] = useState(false);

  /* editable time frame: week/month toggle + previous/next period */
  const [type, setType] = useState(params.type || "week");
  const autoOffset = useMemo(() => {
    const auto = pickReportRange(entries, type);
    return auto ? offsetOfPeriod(auto.start, type) : 0;
  }, [entries, type]);
  const [offset, setOffset] = useState(autoOffset);
  useEffect(() => { setOffset(autoOffset); }, [type]); // switching Week/Month snaps to its best period
  const minOffset = useMemo(() => minPeriodOffset(entries, type), [entries, type]);
  const range = saved ? saved.range : rangeForOffset(entries, type, offset);
  const enough = saved ? true : range.days >= 4;
  const dirRef = useRef(0); // -1 slide from left (older), +1 from right (newer)
  const changePeriod = (next) => {
    if (next === offset) return;
    dirRef.current = next < offset ? -1 : 1;
    feedback("select");
    setOffset(next);
  };

  /* flipping back and forth between periods is instant: reports are pure
     functions of (db, range), so cache per range until the db changes */
  const reportCache = useRef({ db: null, map: new Map() });
  const cards = useMemo(() => {
    if (saved) return saved.model;
    if (!enough || needsPrefs) return null;
    const cache = reportCache.current;
    if (cache.db !== db) { cache.db = db; cache.map.clear(); }
    const key = `${range.type}:${range.start}`;
    if (!cache.map.has(key)) {
      cache.map.set(key, buildReport(db, { start: range.start, end: range.end, type: range.type, label: range.label }));
    }
    return cache.map.get(key);
  }, [db, saved, needsPrefs, enough, range && range.start, range && range.end]); // eslint-disable-line

  const savePrefs = (prefs) => {
    setDb((prev) => ({ ...prev, profile: { ...prev.profile, reportPrefs: prefs, updatedAt: new Date().toISOString() } }));
  };

  /* Every hook in this component has to run before the card-picker early
     return below. The picker only shows on the very first report, so a
     hook declared after it would appear on the *next* render and trip
     React's "rendered more hooks than during the previous render" —
     which is exactly what used to crash the first report a user opened.
     Both motion helpers tolerate a null ref, so running them while the
     picker is up is a no-op. */
  const revealRef = useRef(null);
  const lastReveal = useRef(0);
  const hswipe = useRef(null);
  useLayoutEffect(() => {
    // rapid ‹ ›/swipe flipping shouldn't strobe: within 350ms of the last
    // change, cards appear instantly; once the person settles, animate
    const now = Date.now();
    const rapid = now - lastReveal.current < 350;
    lastReveal.current = now;
    if (rapid) { dirRef.current = 0; return; }
    slideFrom(revealRef.current, dirRef.current); // directional continuity when navigating
    dirRef.current = 0;
    const kill = initReportReveal(revealRef.current);
    return kill;
  }, [cards]);

  if (needsPrefs) {
    return <SwipeDeck catalog={availableReportCards(tpl)} initialPrefs={null} tint={tpl.color} onDone={savePrefs} />;
  }

  const alreadySaved = !saved && (db.reports || []).some((r) => r.type === range.type && r.range.start === range.start && r.range.end === range.end);

  const saveReport = () => {
    if (alreadySaved) return;
    feedback("save");
    setDb((prev) => {
      let reports = [...(prev.reports || [])];
      if (reports.length >= 24) {
        if (!window.confirm("Report history keeps the last 24 reports. Delete the oldest saved report to make room?")) return prev;
        reports = reports.slice(1);
      }
      reports.push({ id: uid(), type: range.type, range: { start: range.start, end: range.end, type: range.type, label: range.label }, createdAt: new Date().toISOString(), model: cards });
      return { ...prev, reports };
    });
  };

  const shareImage = async () => {
    setBusyShare(true);
    try {
      const blob = await renderShareCard(cards, tpl.color, sharePhotos);
      if (blob) download(blob, `health-report-${range.start}.png`);
    } catch (e) { window.alert("Couldn't create the share image on this device."); }
    setBusyShare(false);
  };

  const hasPhotoCard = (cards || []).some((c) => c.type === "photoCompare");

  /* swipe left = forward in time, swipe right = back; axis-locked, and
     hands-off anywhere that owns its own horizontal gesture (photo compare,
     A/B slider, charts) */
  const onSwipeDown = (e) => {
    if (saved) return;
    if (e.target.closest && e.target.closest("svg, [data-noswipe], input, button")) { hswipe.current = null; return; }
    hswipe.current = { x: e.clientX, y: e.clientY, axis: null };
  };
  const onSwipeMove = (e) => {
    const st = hswipe.current;
    if (!st || st.axis) return; // no gesture, or axis already locked
    const dx = e.clientX - st.x, dy = e.clientY - st.y;
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
    st.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
  };
  const onSwipeUp = (e) => {
    const st = hswipe.current;
    hswipe.current = null;
    if (!st || st.axis !== "x") return;
    const dx = e.clientX - st.x;
    if (Math.abs(dx) < 60) return;
    if (dx < 0 && offset < 0) changePeriod(offset + 1); // forward in time
    if (dx > 0 && offset > minOffset) changePeriod(offset - 1); // back in time
  };

  const segBtn = (t, label) => (
    <button onClick={() => { if (type !== t) { feedback("select"); setType(t); } }}
      className="flex-1 py-2 rounded-full text-sm font-semibold transition-colors"
      style={type === t ? { background: tpl.color, color: readableInk(tpl.color) } : { color: C.sub }}
      aria-pressed={type === t}>
      {label}
    </button>
  );
  const navBtn = (dir, disabled) => (
    <button onClick={() => changePeriod(offset + dir)} disabled={disabled}
      aria-label={dir < 0 ? "previous period" : "next period"}
      className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-semibold disabled:opacity-30 active:scale-95 transition-transform"
      style={{ background: C.card, border: `1px solid ${C.line}`, color: C.ink }}>
      {dir < 0 ? "‹" : "›"}
    </button>
  );

  return (
    <div className="px-4 pt-3 pb-10 print-area"
      onPointerDown={onSwipeDown} onPointerMove={onSwipeMove} onPointerUp={onSwipeUp}>
      {!saved && (
        <div className="no-print mb-3">
          <div className="flex rounded-full p-1 mb-2" style={{ background: C.card, border: `1px solid ${C.line}` }}>
            {segBtn("week", "Week")}
            {segBtn("month", "Month")}
          </div>
          <div className="flex items-center gap-2">
            {navBtn(-1, offset <= minOffset)}
            <div className="flex-1 text-center">
              <div className="font-display text-base leading-tight">{range.label}</div>
              <div className="text-[11px]" style={{ color: C.sub }}>
                {range.days} {range.days === 1 ? "day" : "days"} logged
                {offset !== 0 && (
                  <button onClick={() => changePeriod(0)} className="ml-2 font-semibold underline" style={{ color: tpl.color }}>
                    latest
                  </button>
                )}
              </div>
            </div>
            {navBtn(1, offset >= 0)}
          </div>
        </div>
      )}
      {saved && (
        <div className="text-xs mb-2 px-3 py-2 rounded-xl no-print" style={{ background: C.faint, color: C.sub }}>
          Saved report from {fmtNice(saved.createdAt.slice(0, 10))} — shown exactly as saved.
        </div>
      )}

      {/* Printed-only masthead. On screen the range already sits in the pager
          above; on paper — the version that gets handed to a clinician — the
          page has to say what it is, whose logs it covers, and when it was made. */}
      <div className="print-only print-masthead">
        <div className="print-title">{APP_NAME} — {range.type === "month" ? "monthly" : "weekly"} summary</div>
        <div className="print-meta">
          <span>{profile.name || tpl.label}</span>
          {profileAge(profile) != null && <span>{profileAge(profile)} years old</span>}
          <span>{range.label}</span>
          <span>{range.days} daily {range.days === 1 ? "entry" : "entries"}</span>
          <span>Printed {fmtNice(todayStr())}</span>
        </div>
      </div>
      {!enough ? (
        <Card className="text-center py-8">
          <div className="font-display text-xl mb-1">Quiet {type}</div>
          <div className="text-sm leading-relaxed" style={{ color: C.sub }}>
            {range.days === 0 ? "No days logged in this period." : `Only ${range.days} of the 4 needed days logged here.`}
            {" "}Browse other periods with the arrows above.
          </div>
        </Card>
      ) : (
      <div ref={revealRef}>
      <ReportCards cards={cards} tint={tpl.color} />
      </div>
      )}

      {enough && <div className="no-print">
        {hasPhotoCard && (
          <label className="flex items-center gap-2 text-xs mb-2 px-1" style={{ color: C.sub }}>
            <input type="checkbox" checked={sharePhotos} onChange={(e) => setSharePhotos(e.target.checked)} />
            Include photos in the share image (off by default)
          </label>
        )}
        <div className="flex flex-col gap-2 mt-1">
          {!saved && (
            <button onClick={saveReport} disabled={alreadySaved}
              className="fhj-btn fhj-btn-primary fhj-btn-block">
              {alreadySaved ? "Saved to report history" : "Save this report"}
            </button>
          )}
          <div className="flex gap-2">
            <button onClick={shareImage} disabled={busyShare}
              className="flex-1 py-3 rounded-xl text-sm font-semibold disabled:opacity-50"
              style={{ background: C.card, border: `1.5px solid ${tpl.color}`, color: tpl.color }}>
              {busyShare ? "Rendering…" : "Share as image"}
            </button>
            <button onClick={() => window.print()}
              className="flex-1 py-3 rounded-xl text-sm font-semibold"
              style={{ background: C.card, border: `1.5px solid ${C.line}`, color: C.ink }}>
              Print / PDF
            </button>
          </div>
        </div>
        <p className="text-[11px] mt-3 leading-relaxed" style={{ color: C.sub }}>
          {REPORT_COPY.footer} This report is a summary of your own logs, not medical advice.
        </p>
        <p className="text-[11px] mt-1.5 leading-relaxed" style={{ color: C.sub }}>
          <b>Print / PDF</b> produces a clean one-document version to bring to an appointment —
          choose "Save as PDF" in the print dialog to keep a file.
        </p>
      </div>}

      {/* The printed page leaves the app; it has to carry its own caveat. */}
      <div className="print-only print-footnote">
        <p><b>{PATTERN_NOTE}</b></p>
        <p>{DISCLAIMER}</p>
        <p>Self-reported daily ratings recorded in {APP_NAME} {APP_VERSION}. Data stored on the author's own device.</p>
      </div>
    </div>
  );
}

function ReportHistoryList({ reports, openSaved, deleteSaved }) {
  if (!reports || reports.length === 0) return null;
  const list = [...reports].reverse();
  return (
    <Card className="mt-3 !p-0" style={{ padding: 0 }}>
      <div className="text-xs font-semibold uppercase tracking-wider px-4 pt-3 pb-1" style={{ color: C.sub }}>
        Report history ({reports.length}/24)
      </div>
      {list.map((r, i) => (
        <div key={r.id} className="flex items-center px-4"
          style={{ borderTop: i > 0 ? `1px solid ${C.line}` : "none" }}>
          <button onClick={() => openSaved(r.id)} className="flex-1 py-3 text-left">
            <div className="text-sm font-medium">{r.type === "week" ? "Weekly" : "Monthly"} · {r.range.label}</div>
            <div className="text-[11px]" style={{ color: C.sub }}>saved {fmtNice(r.createdAt.slice(0, 10))}</div>
          </button>
          <button onClick={() => { if (window.confirm("Delete this saved report? Your entries and photos are not affected.")) deleteSaved(r.id); }}
            aria-label="delete saved report" className="p-2">
            <Icon name="x" size={14} color={C.sub} />
          </button>
        </div>
      ))}
    </Card>
  );
}

/* ============================================================
   P3 — feedback (haptics + synthesized sound), smart defaults,
   shared empty state
   ============================================================ */

/* The whole feedback layer now lives in src/lib/feedback.ts — haptics (native
   Taptic Engine where there is one, `navigator.vibrate` where there isn't),
   sound, and the visual acknowledgement, behind one call that names what the
   person did. What stays here is the adapter this file's several thousand call
   sites already speak to.

   `FB.prefs` is a live view of the module's preferences rather than a copy, so
   the many places that assign to it (Settings, the strength picker) keep
   working and reach the real engine instead of a stale object. */
const FB = {
  get prefs() { return getFeedbackPrefs(); },
  set prefs(p) { setFeedbackPrefs(p); },
  ctx: null,
};

/* ============================================================
   Toasts and Undo
   ============================================================

   Saving a log is now optimistic: the sheet closes on the tap, the row is
   already in the timeline, and the receipt arrives as a toast with an Undo in
   it. That ordering is the whole point — a confirmation dialog *before* an
   action costs every user a tap to prevent a mistake most of them were never
   going to make, while Undo *after* costs only the people who actually erred.

   Undo is offered for anything reversible without loss: saving a log, deleting
   one, re-logging a favourite. It is deliberately NOT offered for the
   irreversible ones (clearing photos, restoring a backup over the top of a
   journal) — those keep their confirmation, because there is nothing to undo
   them with.

   The store is module-level, like `feedback` and the theme tokens, so any
   component can raise a toast without a provider threaded through several
   thousand lines of markup. */

const TOASTS = { items: [], listeners: new Set() };
let toastSeq = 0;

function emitToasts() {
  for (const fn of TOASTS.listeners) fn([...TOASTS.items]);
}

function dismissToast(id) {
  const t = TOASTS.items.find((x) => x.id === id);
  if (t?.timer) clearTimeout(t.timer);
  TOASTS.items = TOASTS.items.filter((x) => x.id !== id);
  emitToasts();
}

/** Raise a toast. `undo`, when given, draws the button and runs on press.

    One at a time: a second toast replaces the first rather than stacking.
    Logging three foods in a row should leave one receipt for the last one, not
    a tower of them climbing the screen — and the Undo that matters is always
    the most recent. */
function toast({ text, undo, icon = "check", cat = "fhj-cat-symptom", duration = 5000 }) {
  for (const t of TOASTS.items) if (t.timer) clearTimeout(t.timer);
  const id = ++toastSeq;
  const item = { id, text, undo, icon, cat, timer: null };
  item.timer = setTimeout(() => dismissToast(id), duration);
  TOASTS.items = [item];
  emitToasts();
  return id;
}

/** Report the outcome of something the user asked for: show the message *and*
    say so through the feedback layer.

    Before there was an `error` voice this could not be done honestly — the
    only sounds the app had were for things going right, so a failed backup and
    a successful one were equally silent. Now a result is a result: success
    resolves, failure does not, and neither is an alarm. */
function reportResult(setMsg, msg) {
  setMsg(msg);
  feedback(msg && msg.ok === false ? "error" : "save");
  return msg;
}

function ToastHost() {
  const [items, setItems] = useState(TOASTS.items);
  useEffect(() => {
    TOASTS.listeners.add(setItems);
    return () => { TOASTS.listeners.delete(setItems); };
  }, []);
  if (!items.length) return null;
  return (
    /* aria-live rather than a dialog: this reports something that already
       happened and must never steal focus from whatever the user does next. */
    <div className="fhj-toast-host" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`fhj-toast ${t.cat}`}>
          <span className="fhj-toast-mark" aria-hidden="true">
            <Icon name={t.icon} size={13} color="currentColor" />
          </span>
          <span className="fhj-toast-text">{t.text}</span>
          {t.undo && (
            <button type="button" className="fhj-toast-undo"
              onClick={() => { feedback("tap"); dismissToast(t.id); t.undo(); }}>
              Undo
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/* 7-day median of a scale before `date` — the "same as usual" ghost value. */
function medianDefaultFor(entries, key, date) {
  const vals = entries.filter((e) => e.date < date && typeof e.answers[key] === "number")
    .sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 7)
    .map((e) => e.answers[key]).sort((a, b) => a - b);
  if (vals.length < 3) return null;
  const mid = Math.floor(vals.length / 2);
  return vals.length % 2 ? vals[mid] : Math.round((vals[mid - 1] + vals[mid]) / 2);
}
/* Most recent number logged before `date` — weight, water, etc. start here. */
function lastValueFor(entries, key, date) {
  let best = null;
  for (const e of entries) {
    if (e.date >= date || !e.answers || typeof e.answers[key] !== "number") continue;
    if (!best || e.date > best.date) best = { date: e.date, v: e.answers[key] };
  }
  return best ? best.v : null;
}
/* Follow-up questions attached to a field (shown only when it's answered Yes). */
const depsFor = (tpl, k) => tpl.fields.filter((d) => d.dependsOn === k);
function yesterdayToggleFor(entries, key, date) {
  const y = entryOn(entries, addDays(date, -1));
  const v = y?.answers?.[key];
  return typeof v === "boolean" ? v : null;
}
/* Last 5 distinct short notes — tappable suggestions. */
function recentNotes(entries, limit = 5) {
  const out = [];
  for (const e of [...entries].sort((a, b) => (a.date < b.date ? 1 : -1))) {
    const n = (e.notes || "").trim();
    if (!n || n.length > 80 || out.includes(n)) continue;
    out.push(n);
    if (out.length >= limit) break;
  }
  return out;
}

/* rAF number count-up with ease-out — static under reduced motion. */
function CountUp({ value, duration = 650, decimals = 0, from = 0 }) {
  const [n, setN] = useState(() => (typeof value === "number" ? from : value));
  const prev = useRef(from);
  useEffect(() => {
    if (typeof value !== "number") { setN(value); return; }
    const reduced = typeof window !== "undefined" && window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = typeof prev.current === "number" ? prev.current : from;
    prev.current = value;
    if (reduced || start === value) { setN(value); return; }
    let raf;
    const t0 = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / duration);
      const e = 1 - Math.pow(1 - p, 3);
      setN(start + (value - start) * e);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]); // eslint-disable-line
  return <>{typeof n === "number" ? Number(n).toFixed(decimals) : n}</>;
}

/* Two slow-drifting blurred color fields — an ambient, Vanta-like backdrop at
   ~zero cost. Parent needs position:relative + overflow:hidden. */
function AmbientGlow({ tint, second = C.warn, opacity = 0.4 }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true" style={{ opacity }}>
      <span className="fhj-glow" style={{ width: 190, height: 190, left: "-8%", top: "-30%", background: tint }} />
      <span className="fhj-glow" style={{ width: 150, height: 150, right: "-6%", bottom: "-35%", background: second, animationDelay: "-4.5s" }} />
    </div>
  );
}

function EmptyState({ icon = "trends", title, text, actionLabel, onAction }) {  return (
    <Card className="text-center py-8">
      <div className="w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-3" style={{ background: C.faint }}>
        <Icon name={icon} size={22} color={C.sub} />
      </div>
      {title && <div className="font-display text-lg mb-1">{title}</div>}
      <div className="text-sm leading-relaxed" style={{ color: C.sub }}>{text}</div>
      {actionLabel && (
        <button onClick={onAction} className="fhj-btn fhj-btn-primary mt-4">
          {actionLabel}
        </button>
      )}
    </Card>
  );
}

/* Finish celebration — the review screen's success state, not a modal. */
function FinishCelebration({ streak, tint, onDone }) {
  const [shown, setShown] = useState(0);
  const rootRef = useRef(null);
  useEffect(() => { animateFinish(rootRef.current); }, []);
  const reduced = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  useEffect(() => {
    if (reduced) { setShown(streak); return; }
    let n = 0;
    const iv = setInterval(() => {
      n++;
      setShown((s) => Math.min(streak, s + Math.max(1, Math.ceil(streak / 14))));
      if (n > 20) clearInterval(iv);
    }, 60);
    return () => clearInterval(iv);
  }, [streak, reduced]);
  const MILESTONE_LINES = {
    3: "Three days in. It's becoming a habit.",
    7: "One full week — 7 days straight.",
    14: "Two weeks of steady logging.",
    21: "Three weeks. Your trends mean something now.",
    30: "A full month on the record.",
    50: "Fifty days. Genuinely rare.",
    100: "Day 100. Remarkable consistency.",
    365: "A whole year, one day at a time.",
  };
  const milestone = MILESTONE_LINES[streak];
  /* Finishing the day's journal always gets a sound; a streak milestone gets
     the longer one. This is the single moment the app is allowed to sing. */
  useEffect(() => { feedback(milestone ? "milestone" : "complete"); }, []); // eslint-disable-line
  const lines = ["Steady wins.", "Logged and done.", "Small taps, real history.", "Future-you says thanks.", "Another day on the record."];
  const line = milestone || lines[streak % lines.length];
  return (
    <div ref={rootRef} className="mt-2 relative overflow-hidden">
      {!reduced && (
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          {Array.from({ length: milestone ? 26 : 18 }, (_, i) => (
            <span key={i} className="fhj-confetti" style={{
              left: `${(i * 53) % 100}%`,
              background: [tint, C.warn, C.good, C.bad][i % 4],
              animationDelay: `${(i % 6) * 0.12}s`,
            }} />
          ))}
        </div>
      )}
      <Card className="text-center py-8 relative overflow-hidden">
        <AmbientGlow tint={tint} opacity={0.28} />
        <div className="text-[10px] font-semibold uppercase tracking-wider mb-2 relative" style={{ color: C.sub }}>Saved for today</div>
        <div className="font-display text-6xl leading-none" style={{ color: tint }}>{shown}</div>
        <div className="text-sm mt-1" style={{ color: C.sub }}>day streak</div>
        <div className="text-sm font-medium mt-3">{line}</div>
        <div className="text-[11px] mt-2" style={{ color: C.sub }}>Saved on this device only.</div>
      </Card>
      <button onClick={onDone} className="fhj-btn fhj-btn-primary fhj-btn-block mt-3">
        Done
      </button>
    </div>
  );
}

/* ============================================================
   Connor sample photos — small canvas-drawn stand-ins so the
   gallery, photo reports, and A/B slider are testable at once.
   ============================================================ */

const SAMPLE_PHOTO_SPECS = [
  { fieldKey: "photo_left_hand", label: "Left hand", ratingKey: "left_hand_severity", offsets: [30, 14, 2] },
  { fieldKey: "photo_right_hand", label: "Right hand", ratingKey: "right_hand_severity", offsets: [28, 12, 1] },
];

function drawSamplePhoto(label, date, severity) {
  const s = 640;
  const cv = document.createElement("canvas");
  cv.width = s; cv.height = s;
  const ctx = cv.getContext("2d");
  // skin-toned base; redness scales with the linked severity rating
  const red = clamp((severity ?? 5) / 10, 0.1, 1);
  ctx.fillStyle = `rgb(${Math.round(222 + red * 20)}, ${Math.round(198 - red * 60)}, ${Math.round(178 - red * 60)})`;
  ctx.fillRect(0, 0, s, s);
  const rng = mulberry32(date.split("-").join("") * 1 + (label.length || 1));
  for (let i = 0; i < 14; i++) {
    ctx.beginPath();
    ctx.fillStyle = `rgba(${180 + Math.round(red * 60)}, ${90 - Math.round(red * 30)}, ${80 - Math.round(red * 30)}, ${0.10 + red * 0.22})`;
    ctx.arc(rng() * s, rng() * s, 24 + rng() * 70 * red, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "rgba(31,43,39,0.75)";
  ctx.font = "600 34px system-ui, sans-serif";
  ctx.fillText(`${label} · sample`, 28, s - 66);
  ctx.font = "400 28px system-ui, sans-serif";
  ctx.fillText(date, 28, s - 28);
  return makeShot(cv, s, s);
}

/* Attaches sample photo blobs + metadata to a freshly generated sample DB.
   Never touches real user data — only called from explicit sample loads. */
async function attachSamplePhotos(db) {
  if (typeof document === "undefined") return db;
  const entries = [...db.entries].map((e) => ({ ...e }));
  const sorted = [...entries].sort((a, b) => (a.date < b.date ? -1 : 1));
  const nearest = (target) => {
    let best = null, bestGap = Infinity;
    for (const e of sorted) {
      const gap = Math.abs(new Date(e.date) - new Date(target));
      if (gap < bestGap) { bestGap = gap; best = e; }
    }
    return best;
  };
  const toSave = [];
  const baselines = {};
  try {
    for (const spec of SAMPLE_PHOTO_SPECS) {
      let prevId = null;
      for (const off of spec.offsets) {
        const e = nearest(addDays(todayStr(), -off));
        if (!e || e.photos?.[spec.fieldKey]) continue;
        const severity = e.answers[spec.ratingKey];
        const shot = drawSamplePhoto(spec.label, e.date, severity);
        const id = uid();
        toSave.push({ id, full: shot.full, thumb: shot.thumb, fieldKey: spec.fieldKey, date: e.date, takenAt: e.date + "T19:30:00" });
        const target = entries.find((x) => x.id === e.id);
        target.photos = { ...(target.photos || {}), [spec.fieldKey]: { photoId: id, takenAt: e.date + "T19:30:00", comparedTo: prevId || undefined } };
        if (!prevId) baselines[spec.fieldKey] = id;
        prevId = id;
      }
    }
    if (toSave.length) await savePhotos(toSave);
  } catch (e) {
    return db; // storage/canvas unavailable — sample stays photo-free
  }
  return { ...db, entries, profile: { ...db.profile, photoBaselines: { ...(db.profile.photoBaselines || {}), ...baselines } } };
}

async function loadSampleData(setDb) {
  const base = migrateDb({ ...genSampleData(), ack: true, onboarded: true });
  const withPhotos = await attachSamplePhotos(base);
  setDb(withPhotos);
}


/* =====================================================================
   Food & bowel logging
   =====================================================================

   These two categories share a shape the daily survey doesn't have: many
   entries per day, each with its own clock time, and each optionally carrying
   a photo and a model's reading of it.

   The rule that shapes every component below is that a number the user typed
   and a number a model guessed must never be indistinguishable. That is why
   NutrientRow takes a `source` and renders differently for each, why the AI
   block sits in its own bordered panel rather than pre-filling the form, and
   why "Use these" is an explicit action instead of a default.
   ===================================================================== */

/** Take a subtree out of both the tab order and the accessibility tree while
    `active`. Used when a confirmation sheet opens over a form: without it the
    form's own Cancel button is still tabbable and still announced, behind the
    dialog that is asking about it. Set imperatively because React 18 does not
    forward the `inert` attribute. */
function useInert(active) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (active) el.setAttribute("inert", "");
    else el.removeAttribute("inert");
  }, [active]);
  return ref;
}

/** Split a stored data URL into the { mime, data } pair the AI layer wants.
    Photos are saved as `data:image/jpeg;base64,…`; the wire formats want the
    payload without the prefix. */
function dataUrlToImage(dataUrl) {
  const m = /^data:([^;,]+);base64,(.+)$/.exec(String(dataUrl || ""));
  return m ? { mime: m[1], data: m[2] } : null;
}

/** The stored AI connection, or null. Re-read when the opt-in flips so turning
    the feature on in Settings doesn't need a reload to take effect here. */
function useAiConnection(enabled) {
  const [conn, setConn] = useState(null);
  useEffect(() => {
    let live = true;
    if (!enabled) { setConn(null); return; }
    loadConnection().then((c) => { if (live) setConn(c || null); }).catch(() => {});
    return () => { live = false; };
  }, [enabled]);
  return conn;
}

/** Save a captured shot under its own photo id and hand the id back. */
async function savePhotoFor(category, date, shot) {
  const id = `${category}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  await savePhotos([{
    id, full: shot.full, thumb: shot.thumb,
    fieldKey: category, date, takenAt: new Date().toISOString(),
  }]);
  return id;
}

/** Photo capture + preview + remove, for the two new log sheets. */
function LogPhotoField({ category, date, photoId, onChange, label = "Add a photo" }) {
  const src = usePhoto(photoId, "thumb");
  const [busy, setBusy] = useState(false);
  return (
    <div>
      {photoId ? (
        <div className="flex items-center gap-3">
          <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0"
            style={{ border: `1.5px solid ${C.line}`, background: C.faint }}>
            {src ? <img src={src} alt="" className="fhj-photo" /> : null}
          </div>
          <Button variant="ghost" size="sm" icon="trash"
            onClick={async () => { const id = photoId; onChange(null); await deletePhotos([id]).catch(() => {}); }}>
            Remove photo
          </Button>
        </div>
      ) : (
        <CaptureButton label={busy ? "Saving…" : label} tint={C.accent}
          variant="secondary" icon="camera"
          onPick={async (shot) => {
            setBusy(true);
            try { onChange(await savePhotoFor(category, date, shot)); }
            catch (e) { window.alert("Couldn't save that photo — the device may be out of space."); }
            finally { setBusy(false); }
          }} />
      )}
    </div>
  );
}

/** One nutrient: the value, where it came from, and an input to override it.
    An estimated value is shown in the AI hue with a dashed underline; typing
    over it makes it the user's, permanently. */
function NutrientRow({ nutrient, value, source, onChange }) {
  const def = nutrientDef(nutrient);
  return (
    <label className="flex items-center gap-2.5 py-1.5">
      <span className="text-xs flex-1 min-w-0" style={{ color: C.sub }}>{def.label}</span>
      <input
        type="number"
        inputMode="decimal"
        className="fhj-input"
        style={{
          width: "5.5rem", minHeight: 38, padding: "0.375rem 0.5rem", textAlign: "right",
          fontVariantNumeric: "tabular-nums",
          color: source === "ai" ? C.lavenderText : C.ink,
          borderColor: source === "ai" ? C.lavender : C.line,
        }}
        placeholder="–"
        value={value == null ? "" : String(value)}
        aria-label={`${def.label} in ${def.unit}${source === "ai" ? ", currently an AI estimate" : ""}`}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") { onChange(null); return; }
          const n = Number(raw);
          if (isFinite(n) && n >= 0) onChange(n);
        }} />
      <span className="text-[11px] w-8 shrink-0" style={{ color: C.muted }}>{def.unit}</span>
    </label>
  );
}

/** The model's reading of a meal, kept in its own panel so it reads as a
    suggestion rather than as data that has already been accepted. */
function FoodEstimatePanel({ result, onUse, onDiscard, onRerun, busy }) {
  const [open, setOpen] = useState(false);
  const shown = NUTRIENT_KEYS
    .map((k) => ({ k, v: result.nutrition?.[k] }))
    .filter((n) => typeof n.v === "number");
  const micros = result.nutrition?.micros || [];

  return (
    <div className="fhj-cat-ai rounded-xl p-3.5 mt-3"
      style={{ background: C.lavenderSoft, border: `1.5px solid ${C.lavender}` }}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="fhj-ai-badge">AI Estimated</span>
        <span className="text-[11px]" style={{ color: C.subtle }}>
          {result.confidence === "high" ? "Clear enough to be confident"
            : result.confidence === "medium" ? "A reasonable guess"
            : "A rough guess"}
        </span>
      </div>

      {result.identified && (
        <div className="text-sm mb-2" style={{ color: C.ink }}>
          Looks like <span className="font-semibold">{result.identified}</span>
        </div>
      )}

      {shown.length === 0 ? (
        <div className="text-xs" style={{ color: C.sub }}>
          It couldn't put numbers to this one. Adding a description or a serving size usually helps.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          {shown.map(({ k, v }) => (
            <div key={k} className="flex items-baseline justify-between gap-2">
              <span className="text-[11px]" style={{ color: C.sub }}>{nutrientDef(k).label}</span>
              <span className="text-sm font-semibold tabular-nums" style={{ color: C.lavenderText }}>
                {formatNutrient(k, v)}
                <span className="text-[10px] font-normal ml-0.5" style={{ color: C.subtle }}>{nutrientDef(k).unit}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {(micros.length > 0 || result.note) && (
        <>
          <button type="button" onClick={() => setOpen((v) => !v)}
            className="text-[11px] font-semibold mt-2.5 inline-flex items-center gap-1"
            style={{ color: C.lavenderText }} aria-expanded={open}>
            {open ? "Hide detail" : "What else it said"}
            <Icon name={open ? "up" : "down"} size={13} color={C.lavenderText} />
          </button>
          <div className={"fhj-expand" + (open ? " is-open" : "")}>
            <div>
              <div className="fhj-expand-body pt-2">
                {micros.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {micros.map((m, i) => (
                      <span key={i} className="fhj-badge fhj-badge-neutral">{m.label} {m.amount}</span>
                    ))}
                  </div>
                )}
                {result.note && (
                  <p className="text-[11px] leading-relaxed" style={{ color: C.sub }}>{result.note}</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      <p className="text-[10px] leading-relaxed mt-2.5" style={{ color: C.subtle }}>
        An estimate from {result.source === "photo" ? "the photo" : result.source === "text" ? "your description" : "the photo and your description"},
        not a measurement. Edit anything that looks off — your own numbers always win.
      </p>

      <div className="flex gap-2 mt-3">
        <Button size="sm" onClick={onUse} disabled={busy || shown.length === 0}>Use these</Button>
        <Button size="sm" variant="secondary" onClick={onRerun} disabled={busy}>
          {busy ? "Working…" : "Try again"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDiscard} disabled={busy}>Discard</Button>
      </div>
    </div>
  );
}

/* ---------- the food sheet ---------- */

function FoodLogSheet({ initial, date, aiEnabled, aiAuto, defaultMeal, defaultTime, onSave, onDelete, onClose }) {
  const [log, setLog] = useState(() => initial || newFoodLog({ date, meal: defaultMeal, time: defaultTime }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [confirm, setConfirm] = useState(null); // pending send, awaiting consent
  const conn = useAiConnection(aiEnabled);
  const abortRef = useRef(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  const patch = (p) => setLog((prev) => ({ ...prev, ...p, updatedAt: new Date().toISOString() }));
  const setNutrient = (k, v) => setLog((prev) => {
    const nutrition = { ...(prev.nutrition || {}) };
    if (v == null) delete nutrition[k]; else nutrition[k] = v;
    return { ...prev, nutrition, updatedAt: new Date().toISOString() };
  });

  const canEstimate = !!conn && (!!log.photoId || !!log.description.trim() || !!log.serving?.trim() || log.quantity != null);

  /* Nothing is sent until this returns. The sheet describes the payload, the
     user presses Send — there is no path from "took a photo" to "photo left
     the device" that skips this step. */
  /* With auto-judging on, the consent sheet has already been answered — once,
     in Settings, for every send. Showing it again on the button press would be
     asking the same question twice and would make the switch mean nothing on
     the text-only path, where there is no photo to trigger the automatic run. */
  const askToEstimate = async () => {
    setErr("");
    let image = null;
    if (log.photoId) {
      const raw = await loadPhotoData(log.photoId);
      image = dataUrlToImage(raw);
    }
    if (aiAuto) { await sendEstimate(image); return; }
    setConfirm({ image, summary: summariseFoodRequest({ ...log, image }) });
  };

  /* The send itself, once consent exists — either from the sheet below, or
     standing, from the AI-judging switch in Settings. */
  const sendEstimate = async (image) => {
    setBusy(true); setErr("");
    abortRef.current = new AbortController();
    try {
      const result = await analyseFood(
        conn,
        {
          description: log.description, serving: log.serving,
          quantity: log.quantity, unit: log.unit, image,
        },
        { signal: abortRef.current.signal }
      );
      setLog((prev) => ({ ...prev, ai: result, updatedAt: new Date().toISOString() }));
    } catch (e) {
      if (e?.name !== "AbortError") setErr(e?.message || "That didn't work. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  const runEstimate = async () => {
    const pending = confirm;
    setConfirm(null);
    if (!pending) return;
    await sendEstimate(pending.image);
  };

  /* Auto-judging: the moment a photo is attached, read it. The photo is the
     one input that carries everything the form is asking for, so a person who
     has turned this on can take a picture and press Save without typing a
     single number.

     Standing consent, not silent sending: `aiAuto` is off unless someone went
     into Settings and switched it on, and the switch says in as many words
     that photos will go without the per-send sheet. One analysis per photo —
     `judgedRef` is what stops a re-render, an edit to the notes field, or the
     estimate itself arriving from firing a second identical request. */
  const judgedRef = useRef(null);
  useEffect(() => {
    if (!aiEnabled || !aiAuto || !conn) return;
    const id = log.photoId;
    if (!id || judgedRef.current === id || log.ai || busy) return;
    judgedRef.current = id;
    (async () => {
      const raw = await loadPhotoData(id);
      const image = dataUrlToImage(raw);
      if (!image) { setErr("Couldn't read that photo."); return; }
      await sendEstimate(image);
    })();
  }, [aiEnabled, aiAuto, conn, log.photoId, log.ai, busy]);

  const resolved = effectiveNutrition(log);
  const title = initial ? "Edit meal" : "Log food";
  const bodyRef = useInert(!!confirm);

  const servingSummary = [
    log.serving?.trim(),
    log.quantity != null ? `${log.quantity}${log.unit ? ` ${log.unit}` : ""}` : null,
  ].filter(Boolean).join(" · ") || "One serving";

  return (
    <Modal title={title} onClose={onClose}
      /* One action, full width. The header's × already dismisses, as do
         Escape, a tap on the scrim and a drag on the grabber — a Cancel button
         was a fifth way to do the same thing, and it was taking half the
         action bar from the button people actually came to press. */
      footer={
        <Button block onClick={() => { feedback("save"); onSave(log); }}>
          {initial ? "Save changes" : "Log it"}
        </Button>
      }>
      <div className="fhj-cat-food" ref={bodyRef}>
        {/* ---------- the photo, first ----------
            A picture of the plate is the fastest, richest thing anyone can
            give this form: it takes one tap, it needs no vocabulary, and with
            AI judging on it fills in the rest of the sheet by itself. It used
            to sit five fields down, below three text inputs, which had it
            reading as an optional extra for people who had already done the
            typing. It is the headline now. */}
        <div className="fhj-photo-lead mb-3">
          <LogPhotoField category="food" date={log.date} photoId={log.photoId}
            onChange={(id) => patch({ photoId: id || undefined })}
            label="Take a photo of the meal" />
          <p className="text-[11px] mt-1.5 leading-relaxed" style={{ color: C.subtle }}>
            {aiEnabled && conn && aiAuto
              ? "A photo is sent for a nutrition estimate as soon as you add it. Everything below stays optional."
              : log.photoId
                ? "Kept on this device with the meal."
                : "Optional — but it's the quickest way to remember what a meal actually was."}
          </p>
        </div>

        {/* meal + time */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {MEALS.map((m) => (
            <button key={m.id} type="button" onClick={() => { feedback("select"); patch({ meal: m.id }); }}
              className={"fhj-chip" + (log.meal === m.id ? " is-active" : "")}
              aria-pressed={log.meal === m.id}>
              {m.label}
            </button>
          ))}
        </div>

        <label className="block mb-3">
          <span className="fhj-eyebrow block mb-1">What did you eat?</span>
          <textarea className="fhj-input" rows={2} placeholder="Chicken salad with olive oil and feta"
            value={log.description} onChange={(e) => patch({ description: e.target.value })} />
        </label>

        {/* Serving and clock time are both already correct for the overwhelming
            majority of meals — one portion, logged as it is eaten — so they
            fold into two rows that say what they currently hold. */}
        <Disclosure className="mb-3" label="Serving size" summary={servingSummary}>
          <div className="flex gap-2">
            <label className="flex-1 min-w-0">
              <span className="fhj-eyebrow block mb-1">Serving</span>
              <input className="fhj-input" placeholder="1 bowl" value={log.serving || ""}
                onChange={(e) => patch({ serving: e.target.value })} />
            </label>
            <label style={{ width: "5.5rem" }}>
              <span className="fhj-eyebrow block mb-1">Amount</span>
              <input type="number" inputMode="decimal" className="fhj-input" placeholder="150"
                value={log.quantity == null ? "" : String(log.quantity)}
                onChange={(e) => {
                  const v = e.target.value;
                  patch({ quantity: v === "" ? undefined : (isFinite(Number(v)) ? Number(v) : undefined) });
                }} />
            </label>
            <label style={{ width: "5rem" }}>
              <span className="fhj-eyebrow block mb-1">Unit</span>
              <select className="fhj-input" value={log.unit || ""} onChange={(e) => patch({ unit: e.target.value || undefined })}>
                <option value="">–</option>
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </label>
          </div>
        </Disclosure>

        <Disclosure className="mb-3" label="When"
          summary={`${log.date === todayStr() ? "Today" : fmtNice(log.date)} · ${prettyTime(log.time)}`}>
          <div className="flex gap-2">
            <label className="flex-1">
              <span className="fhj-eyebrow block mb-1">Date</span>
              <input type="date" className="fhj-input" value={log.date}
                onChange={(e) => patch({ date: e.target.value })} />
            </label>
            <label className="flex-1">
              <span className="fhj-eyebrow block mb-1">Time</span>
              <input type="time" className="fhj-input" value={log.time}
                onChange={(e) => patch({ time: e.target.value })} />
            </label>
          </div>
        </Disclosure>

        {/* AI estimate */}
        {aiEnabled && conn ? (
          log.ai ? (
            <FoodEstimatePanel
              result={log.ai} busy={busy}
              onUse={() => { feedback("select"); setLog((prev) => acceptEstimate(prev)); }}
              onDiscard={() => setLog((prev) => discardEstimate(prev))}
              onRerun={askToEstimate} />
          ) : busy ? (
            <div className="mt-1 mb-1 p-3 rounded-xl text-[12.5px] leading-relaxed" role="status"
              style={{ background: C.lavenderSoft, border: `1.5px solid ${C.lavender}`, color: C.sub }}>
              Reading the photo…
            </div>
          ) : (
            <div className="mt-1 mb-1">
              <Button variant="outline" block icon="spark" onClick={askToEstimate} disabled={!canEstimate || busy}>
                Estimate nutrition with AI
              </Button>
              <p className="text-[11px] mt-1.5 leading-relaxed" style={{ color: C.subtle }}>
                {canEstimate
                  ? "You'll see exactly what gets sent before anything leaves this device."
                  : "Add a photo or describe the meal first."}
              </p>
            </div>
          )
        ) : null}

        {err && (
          <div className="text-xs mt-2 p-2.5 rounded-lg" style={{ background: C.dangerBg, color: C.dangerInk }}>{err}</div>
        )}

        {/* Nutrition — always editable by hand, with or without AI.

            The four headline figures are never hidden. Typing calories is the
            single most common thing anyone does in a food tracker, and putting
            it behind a disclosure is exactly the friction this feature exists
            to remove. The other three sit behind "More nutrients" because
            almost nobody fills them in by hand. */}
        <div className="mt-3">
          <span className="fhj-eyebrow block mb-1">Nutrition</span>
          {resolved.filter((n) => nutrientDef(n.k).primary).map((n) => (
            <NutrientRow key={n.k} nutrient={n.k} value={n.value} source={n.source}
              onChange={(v) => setNutrient(n.k, v)} />
          ))}
          <details className="mt-1">
            <summary className="text-[11px] font-semibold cursor-pointer py-1.5" style={{ color: C.accentText }}>
              More nutrients
            </summary>
            <div className="pt-1">
              {resolved.filter((n) => !nutrientDef(n.k).primary).map((n) => (
                <NutrientRow key={n.k} nutrient={n.k} value={n.value} source={n.source}
                  onChange={(v) => setNutrient(n.k, v)} />
              ))}
            </div>
          </details>
          {hasAiValues(log) && (
            <p className="text-[10px] leading-relaxed mt-1.5" style={{ color: C.subtle }}>
              Values in lavender are AI estimates. Type over any of them to make it yours.
            </p>
          )}
        </div>

        <Disclosure className="mt-3" label="Notes"
          summary={log.notes?.trim() || "Optional"}>
          <textarea className="fhj-input" rows={2} placeholder="Anything worth remembering"
            aria-label="Notes"
            value={log.notes || ""} onChange={(e) => patch({ notes: e.target.value })} />
        </Disclosure>

        {/* Delete sits at the foot of the form, not in the action bar. In the
            bar it was a 36px red square wedged against Cancel and Save — under
            the tap minimum, ambiguous without a label, and one slip away from
            the button most likely to be aimed at. Down here it is full width,
            unmistakably labelled, and reached only by someone who scrolled to
            it on purpose. Undo covers the slip that gets through. */}
        {onDelete && (
          <Button variant="danger" block icon="trash" className="mt-4"
            onClick={() => onDelete(log)}>
            Delete this meal
          </Button>
        )}
      </div>

      {confirm && (
        <AiSendPreview
          title="Send this for an estimate?"
          lines={[
            confirm.summary.sendsPhoto ? "The photo of this meal" : null,
            confirm.summary.sendsText ? `What you wrote: “${confirm.summary.textParts.join(" · ")}”` : null,
          ].filter(Boolean)}
          providerLabel={PROVIDERS[conn?.provider]?.label || "your AI provider"}
          onCancel={() => setConfirm(null)}
          onConfirm={runEstimate} />
      )}
    </Modal>
  );
}

/* ---------- the bowel sheet ---------- */

/** 0–3 severity, as four labelled buttons rather than a slider — faster on a
    phone and readable without dragging anything. */
function Severity03({ label, value, onChange }) {
  return (
    <div className="mb-3">
      <span className="fhj-eyebrow block mb-1.5">{label}</span>
      <div className="flex gap-1.5">
        {SEVERITY_0_3.map((l, i) => (
          <button key={l} type="button"
            onClick={() => { feedback("tap"); onChange(value === i ? undefined : i); }}
            aria-pressed={value === i}
            className={"fhj-chip flex-1 justify-center" + (value === i ? " is-active" : "")}>
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

function BowelLogSheet({ initial, date, aiEnabled, aiAuto, onSave, onDelete, onClose }) {
  const [log, setLog] = useState(() => initial || newBowelLog({ date }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [confirm, setConfirm] = useState(false);
  const conn = useAiConnection(aiEnabled);
  const abortRef = useRef(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  const patch = (p) => setLog((prev) => ({ ...prev, ...p, updatedAt: new Date().toISOString() }));

  /* `auto` distinguishes the two ways this runs. A manual analysis leaves the
     result sitting in a panel for the user to accept; an automatic one is the
     whole point of having switched auto-judging on, so it lands in the blank
     fields directly. Either way it only ever fills blanks — see
     applyBowelSuggestion. */
  const runAnalysis = async ({ auto = false } = {}) => {
    setConfirm(false);
    if (!log.photoId || !conn) return;
    setBusy(true); setErr("");
    abortRef.current = new AbortController();
    try {
      const raw = await loadPhotoData(log.photoId);
      const image = dataUrlToImage(raw);
      if (!image) throw new Error("Couldn't read that photo.");
      const result = await analyseBowelPhoto(conn, image, { signal: abortRef.current.signal });
      setLog((prev) => {
        const next = { ...prev, ai: result, updatedAt: new Date().toISOString() };
        return auto ? applyBowelSuggestion(next, result) : next;
      });
    } catch (e) {
      if (e?.name !== "AbortError") setErr(e?.message || "That didn't work. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  /* One reading per photo, started the moment there is a photo to read. See
     the matching block in FoodLogSheet for why this is standing consent
     rather than a silent send. */
  const judgedRef = useRef(null);
  useEffect(() => {
    if (!aiEnabled || !aiAuto || !conn) return;
    const id = log.photoId;
    if (!id || judgedRef.current === id || log.ai || busy) return;
    judgedRef.current = id;
    runAnalysis({ auto: true });
  }, [aiEnabled, aiAuto, conn, log.photoId, log.ai, busy]);

  /* Suggestions are never written straight into the log on the manual path —
     the user presses "Use these", and only the fields they haven't already
     answered change. */
  const applySuggestion = () => {
    feedback("select");
    setLog((prev) => applyBowelSuggestion(prev));
  };

  const suggestion = log.ai;
  const hasSuggestion = suggestion && (suggestion.bristol != null || suggestion.amount || suggestion.color || suggestion.consistency || suggestion.form);
  /* What the model is currently answering *for* the user, as opposed to what
     it has merely offered. Only the automatic path produces these without a
     tap, and it is what earns the right to fold the detail fields away. */
  const aiFilled = aiEnabled && aiAuto ? aiFilledBowelFields(log) : [];
  const [detailsOpen, setDetailsOpen] = useState(false);
  const foldDetails = aiFilled.length > 0 && !detailsOpen;

  const bodyRef = useInert(confirm);

  /* Where the photo sits depends on whether it is about to do any work.

     With AI connected, one photo answers Bristol type, amount, colour and
     consistency, so it earns the top of the sheet — asking someone to tap four
     chip grids above the camera that was about to fill them in is backwards —
     and the sentence about where that photo goes has to be on screen with it.

     With AI off, which is the shipped default, the camera answers nothing: the
     photo is an optional keepsake and the *scale is the task*. Leading with it
     then pushed the only control most people opened the sheet for below the
     fold, to make room for a feature they had switched off. */
  const photoLeads = aiEnabled && !!conn;

  const photoBlock = (
    <div className="fhj-photo-lead">
      <LogPhotoField category="bowel" date={log.date} photoId={log.photoId}
        onChange={(id) => patch({ photoId: id || undefined, ai: id ? log.ai : undefined })}
        label="Take a photo" />
      {/* This sentence is a promise about where the photo goes, so it has
          to be keyed on the setting rather than on whether a photo has
          been attached yet. Saying "nothing is sent unless you ask" on a
          screen that has just sent it is the one wording this feature
          cannot ship with. */}
      {/* Keyed on auto-judging, NOT on where the block happens to sit. These
          two sentences make different promises about where someone's photo
          goes, and only `aiAuto` decides which one is true — tying them to the
          layout rule would have this saying "nothing is sent unless you ask"
          on a screen that sends on add, or the reverse. */}
      <p className="text-[11px] mt-1.5 leading-relaxed" style={{ color: C.subtle }}>
        {aiEnabled && conn && aiAuto
          ? "Optional. A photo is sent for a reading as soon as you add it — that fills in the type, amount, colour and consistency — and the image itself stays on this device."
          : "Optional, and it stays on this device. Nothing is sent anywhere unless you ask for the photo to be analysed."}
      </p>
    </div>
  );

  const whenSummary = `${log.date === todayStr() ? "Today" : fmtNice(log.date)} · ${prettyTime(log.time)}`;

  return (
    <Modal title={initial ? "Edit entry" : "Log bowel movement"} onClose={onClose}
      /* One action, full width. The header's × already dismisses, as do
         Escape, a tap on the scrim and a drag on the grabber — a Cancel button
         was a fifth way to do the same thing, and it was taking half the
         action bar from the button people actually came to press. */
      footer={
        <Button block onClick={() => { feedback("save"); onSave(log); }}>
          {initial ? "Save changes" : "Log it"}
        </Button>
      }>
      <div className="fhj-cat-bowel" ref={bodyRef}>
        {photoLeads && <div className="mb-3">{photoBlock}</div>}

        {/* AI reading — directly under the photo it came from */}
        {aiEnabled && conn && log.photoId && (
          busy ? (
            <div className="mb-3 p-3 rounded-xl text-[12.5px] leading-relaxed" role="status"
              style={{ background: C.lavenderSoft, border: `1.5px solid ${C.lavender}`, color: C.sub }}>
              Reading the photo…
            </div>
          ) : hasSuggestion ? (
            <div className="fhj-cat-ai rounded-xl p-3.5 mb-3"
              style={{ background: C.lavenderSoft, border: `1.5px solid ${C.lavender}` }}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="fhj-ai-badge">{aiFilled.length ? "AI Filled In" : "AI Suggested"}</span>
                <span className="text-[11px]" style={{ color: C.subtle }}>
                  {suggestion.confidence === "high" ? "Clear photo" : suggestion.confidence === "medium" ? "Fairly clear" : "Hard to read"}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {suggestion.bristol != null && <span className="fhj-badge fhj-badge-neutral">Type {suggestion.bristol}</span>}
                {suggestion.amount && <span className="fhj-badge fhj-badge-neutral">{BOWEL_AMOUNTS.find((a) => a.id === suggestion.amount)?.label}</span>}
                {suggestion.color && <span className="fhj-badge fhj-badge-neutral">{suggestion.color}</span>}
                {suggestion.consistency && <span className="fhj-badge fhj-badge-neutral">{suggestion.consistency}</span>}
                {suggestion.form && <span className="fhj-badge fhj-badge-neutral">{suggestion.form}</span>}
              </div>
              {suggestion.note && (
                <p className="text-[11px] leading-relaxed mt-2" style={{ color: C.sub }}>{suggestion.note}</p>
              )}
              <p className="text-[10px] leading-relaxed mt-2" style={{ color: C.subtle }}>
                A description of what's visible in the photo — nothing more. It can't tell you what anything means,
                and it won't try.
              </p>
              <div className="flex gap-2 mt-3">
                {aiFilled.length > 0 ? (
                  <span className="text-[11px] leading-relaxed self-center" style={{ color: C.sub }}>
                    Already filled in below. Change anything that looks wrong.
                  </span>
                ) : (
                  <Button size="sm" onClick={applySuggestion}>Use these</Button>
                )}
                <div className="flex-1" />
                <Button size="sm" variant="ghost" onClick={() => patch({ ai: undefined })}>Discard</Button>
              </div>
            </div>
          ) : (
            <div className="mb-3">
              {/* Auto-judging answers the consent question standingly, so the
                  button sends rather than asking again. It stays on screen
                  either way — a reading that came back empty, or one the user
                  discarded, needs a way to be asked for a second time. */}
              <Button variant="outline" block icon="spark" disabled={busy}
                onClick={() => (aiAuto ? runAnalysis({ auto: true }) : setConfirm(true))}>
                Describe the photo with AI
              </Button>
              {log.ai && !hasSuggestion && (
                <p className="text-[11px] mt-1.5" style={{ color: C.subtle }}>
                  It couldn't make anything out clearly enough to suggest. Fill the fields in yourself below.
                </p>
              )}
            </div>
          )
        )}

        {err && (
          <div className="text-xs mb-3 p-2.5 rounded-lg" style={{ background: C.dangerBg, color: C.dangerInk }}>{err}</div>
        )}

        {/* Once the model has answered the descriptive questions, asking them
            again in full takes more screen than the answers are worth. They
            fold into one line that says what was filled and opens the lot for
            editing — never hidden, just not in the way. */}
        {foldDetails && (
          <button type="button"
            onClick={() => { feedback("tap"); setDetailsOpen(true); }}
            className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl mb-3 text-left"
            style={{ background: C.faint, border: `1.5px solid ${C.line}` }}>
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold" style={{ color: C.ink }}>
                {bowelSummary(log) || "Details"}
              </span>
              <span className="block text-[11px]" style={{ color: C.subtle }}>
                Filled in from the photo · tap to adjust
              </span>
            </span>
            <Icon name="down" size={15} color={C.sub} />
          </button>
        )}

        <div hidden={foldDetails}>
          {/* Bristol type is the task. It is an ordered scale — 1 is hard, 7
              is liquid — so it is drawn as one, in a single row of seven
              targets with the selected description printed underneath. The
              seven stacked rows this replaces were 390px of sheet to answer
              one question, and pushed everything else below the fold. */}
          <div className="mb-4">
            <span className="fhj-eyebrow block mb-1.5">Bristol type</span>
            <StepScale
              label="Bristol type" tint={C.clay}
              lowLabel="1 · hard" highLabel="7 · liquid"
              options={BRISTOL.map((b) => ({ value: b.type, label: b.label, desc: b.desc }))}
              value={log.bristol}
              onChange={(v) => patch({ bristol: v })} />
          </div>

          {/* Everything below is the thorough path. Most entries are a type
              and a time; the rest is here, one tap away, with its own answers
              on the closed row so nothing is hidden by folding it. */}
          <Disclosure className="mb-3" label="Amount, colour and consistency"
            summary={[
              BOWEL_AMOUNTS.find((a) => a.id === log.amount)?.label,
              log.color, log.consistency,
            ].filter(Boolean).join(" · ") || "Not recorded"}>
            <div className="mb-3">
              <span className="fhj-eyebrow block mb-1.5">Amount</span>
              <div className="flex gap-1.5">
                {BOWEL_AMOUNTS.map((a) => (
                  <button key={a.id} type="button"
                    onClick={() => { feedback("tap"); patch({ amount: log.amount === a.id ? undefined : a.id }); }}
                    aria-pressed={log.amount === a.id}
                    className={"fhj-chip flex-1 justify-center" + (log.amount === a.id ? " is-active" : "")}>
                    {a.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-3">
              <span className="fhj-eyebrow block mb-1.5">Colour</span>
              <div className="flex flex-wrap gap-1.5">
                {BOWEL_COLORS.map((c) => (
                  <button key={c} type="button"
                    onClick={() => { feedback("tap"); patch({ color: log.color === c ? undefined : c }); }}
                    aria-pressed={log.color === c}
                    className={"fhj-chip" + (log.color === c ? " is-active" : "")}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="fhj-eyebrow block mb-1.5">Consistency</span>
              <div className="flex flex-wrap gap-1.5">
                {BOWEL_CONSISTENCY.map((c) => (
                  <button key={c} type="button"
                    onClick={() => { feedback("tap"); patch({ consistency: log.consistency === c ? undefined : c }); }}
                    aria-pressed={log.consistency === c}
                    className={"fhj-chip" + (log.consistency === c ? " is-active" : "")}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </Disclosure>

          <Disclosure className="mb-3" label="How it felt"
            summary={[
              log.urgency != null ? `urgency ${log.urgency}` : null,
              log.straining != null ? `straining ${log.straining}` : null,
              log.discomfort != null ? `discomfort ${log.discomfort}` : null,
            ].filter(Boolean).join(" · ") || "Not recorded"}>
            <Severity03 label="Urgency" value={log.urgency} onChange={(v) => patch({ urgency: v })} />
            <Severity03 label="Straining" value={log.straining} onChange={(v) => patch({ straining: v })} />
            <Severity03 label="Discomfort" value={log.discomfort} onChange={(v) => patch({ discomfort: v })} />
          </Disclosure>
        </div>

        {/* When, and a note. Both start correct — the clock filled them in —
            so they are a summary line rather than two inputs demanding
            attention on the way past. */}
        <Disclosure className="mb-3" label="When" summary={whenSummary}>
          <div className="flex gap-2">
            <label className="flex-1">
              <span className="fhj-eyebrow block mb-1">Date</span>
              <input type="date" className="fhj-input" value={log.date}
                onChange={(e) => patch({ date: e.target.value })} />
            </label>
            <label className="flex-1">
              <span className="fhj-eyebrow block mb-1">Time</span>
              <input type="time" className="fhj-input" value={log.time}
                onChange={(e) => patch({ time: e.target.value })} />
            </label>
          </div>
        </Disclosure>

        <Disclosure className="mb-3" label={photoLeads ? "Notes" : "Photo and notes"}
          summary={[
            !photoLeads && log.photoId ? "Photo attached" : null,
            log.notes?.trim() || null,
          ].filter(Boolean).join(" · ") || "Optional"}>
          {!photoLeads && <div className="mb-3">{photoBlock}</div>}
          <label className="block">
            <span className="fhj-eyebrow block mb-1">Notes</span>
            <textarea className="fhj-input" rows={2} placeholder="Anything worth remembering"
              value={log.notes || ""} onChange={(e) => patch({ notes: e.target.value })} />
          </label>
        </Disclosure>

        {/* Same reasoning as the food sheet: out of the action bar, full width,
            labelled, and behind a deliberate scroll. */}
        {onDelete && (
          <Button variant="danger" block icon="trash" className="mt-4"
            onClick={() => onDelete(log)}>
            Delete this entry
          </Button>
        )}
      </div>

      {confirm && (
        <AiSendPreview
          title="Send this photo?"
          lines={["The photo attached to this entry", "Nothing else from your journal"]}
          providerLabel={PROVIDERS[conn?.provider]?.label || "your AI provider"}
          onCancel={() => setConfirm(false)}
          onConfirm={runAnalysis} />
      )}
    </Modal>
  );
}

/* =====================================================================
   The food diary
   =====================================================================

   The thing that makes a calorie tracker usable is not the form — it is never
   having to fill the form in twice. MyFitnessPal solves that with two million
   foods on a server. This app has no server and no account, so it solves the
   half that actually does the work: people eat the same thirty or forty things
   on repeat, so the library builds itself out of their own logs and the second
   time you eat something is one tap. */

/** A number stepper for servings. Half steps below 3, whole above — nobody
    eats 4.5 bowls, and everybody eats half a sandwich. */
function ServingStepper({ value, onChange, serving }) {
  const step = (dir) => {
    const s = value < 3 || (dir < 0 && value <= 3) ? 0.5 : 1;
    const next = Math.round((value + dir * s) * 100) / 100;
    onChange(Math.max(0.5, Math.min(99, next)));
  };
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => step(-1)} aria-label="fewer servings"
        className="fhj-icon-btn" style={{ width: "2.25rem", height: "2.25rem" }} disabled={value <= 0.5}>
        <Icon name="minus" size={16} color={C.ink} />
      </button>
      <div className="text-center" style={{ minWidth: "5.5rem" }}>
        <div className="text-base font-bold tabular-nums" style={{ color: C.ink }}>
          {Math.round(value * 100) / 100}
        </div>
        <div className="text-[10px] truncate" style={{ color: C.subtle }}>× {serving}</div>
      </div>
      <button type="button" onClick={() => step(1)} aria-label="more servings"
        className="fhj-icon-btn" style={{ width: "2.25rem", height: "2.25rem" }}>
        <Icon name="plus" size={16} color={C.ink} />
      </button>
    </div>
  );
}

/** One row in the picker: the food, what a serving of it costs, and a tap
    target that logs it outright. The name opens the serving stepper for
    anything that isn't exactly one serving. */
function FoodRow({ item, onQuickAdd, onOpen, onToggleFavorite }) {
  const cal = item.nutrition?.calories;
  return (
    <div className="flex items-center gap-1 fhj-row" style={{ borderTop: `1px solid ${C.line}` }}>
      <button type="button" onClick={onOpen} className="flex-1 min-w-0 text-left px-3 py-2.5">
        <div className="text-sm font-medium truncate" style={{ color: C.ink }}>
          {item.name}
          {item.brand && <span className="font-normal" style={{ color: C.subtle }}> · {item.brand}</span>}
        </div>
        <div className="text-[11px] mt-0.5 flex items-center gap-1.5 flex-wrap" style={{ color: C.subtle }}>
          <span>{item.serving}</span>
          {cal != null && <><span aria-hidden="true">·</span><span>{formatNutrient("calories", cal)} kcal</span></>}
          {item.estimated && <span className="fhj-ai-badge" style={{ fontSize: "0.5rem" }}>Est.</span>}
        </div>
      </button>
      <button type="button" onClick={onToggleFavorite}
        aria-label={item.favorite ? `remove ${item.name} from favourites` : `add ${item.name} to favourites`}
        aria-pressed={!!item.favorite}
        className="w-9 h-9 flex items-center justify-center shrink-0 rounded-full">
        <Icon name={item.favorite ? "starFilled" : "star"} size={16}
          color={item.favorite ? C.warn : C.muted} />
      </button>
      <button type="button" onClick={onQuickAdd} aria-label={`log one ${item.serving} of ${item.name}`}
        className="fhj-icon-btn mr-2 shrink-0" style={{ width: "2.25rem", height: "2.25rem" }}>
        <Icon name="plus" size={16} color={C.accentText} />
      </button>
    </div>
  );
}

/** Search + browse the library, and log from it in one tap.

    Search deliberately beats the tab: once someone is typing they are after
    one specific thing, and whichever tab they happen to be on is noise. */
function FoodPicker({ library, meal: initialMeal, date, onLog, onOpenFull, onUpdateLibrary, onClose }) {
  const [tab, setTab] = useState("recent");
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState(null); // { item, servings }
  const [quickCal, setQuickCal] = useState("");
  const searchRef = useRef(null);
  /* Focus the search box on a pointer device only. On a phone, autofocus
     raises the keyboard over the very list this sheet exists to show — and
     the fast path here is tapping a recent item, not typing. Someone who
     wants to search taps the field, which is one tap, and gets the keyboard
     they actually asked for. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(hover: hover) and (pointer: fine)").matches) searchRef.current?.focus();
  }, []);

  /* When something was eaten or drunk, on the fast path.

     Every route through this picker used to stamp the log with the clock time
     of the tap, and the only way to correct that was to save the item and then
     reopen it in the full sheet. That is fine for a meal logged as it happens
     and useless for the far more common case — remembering at 9pm that you had
     a coffee at 8am — which is exactly when a one-tap path is worth the most.

     Changing the time re-files the meal to match it, but only while the meal
     is still whatever the clock implied: someone who has deliberately picked
     "Snack" keeps Snack no matter what they do to the time. */
  const [time, setTime] = useState(() => localTime());
  const [meal, setMeal] = useState(initialMeal);
  const mealTouched = useRef(false);
  const setTimeAndMeal = (next) => {
    setTime(next);
    if (!mealTouched.current && meal !== "drink" && /^\d{2}:\d{2}$/.test(next)) {
      setMeal(mealForTime(next));
    }
  };

  const rows = useMemo(() => browseFoods(library, tab, query), [library, tab, query]);
  const TABS = [["recent", "Recent"], ["frequent", "Frequent"], ["favorite", "Favourites"], ["all", "All"]];

  const emptyCopy = query.trim()
    ? `Nothing saved matches “${query.trim()}”.`
    : tab === "favorite"
      ? "Star a food and it lands here."
      : library.length === 0
        ? "Your saved foods build up as you log. The second time you eat something, it's one tap."
        : "Nothing here yet.";

  const bodyRef = useInert(!!detail);

  return (
    <>
      <Modal title={`Add to ${mealLabel(meal).toLowerCase()}`} onClose={onClose}
        footer={
          <Button variant="outline" block icon="plus" onClick={() => onOpenFull({ meal, time })}>
            Something new
          </Button>
        }>
        <div className="fhj-cat-food" ref={bodyRef}>
          {/* Search, then the list. Both used to sit under a time field and a
              meal dropdown, which meant the fast path — open, tap the coffee
              you have every morning, done — began by scrolling past two
              controls that were already correct. They are still here, one tap
              down, and they still re-file whatever gets tapped below. */}
          <input ref={searchRef} className="fhj-input" type="search" placeholder="Search your foods"
            value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search your saved foods" />

          {!query.trim() && (
            <div className="fhj-segmented mt-2.5" role="tablist">
              {TABS.map(([id, label]) => (
                <button key={id} type="button" role="tab" aria-selected={tab === id}
                  onClick={() => { feedback("tap"); setTab(id); }}
                  className={"fhj-segment" + (tab === id ? " is-active" : "")}>
                  {label}
                </button>
              ))}
            </div>
          )}

          <div className="mt-3 rounded-xl overflow-hidden" style={{ border: `1px solid ${C.line}` }}>
            {rows.length === 0 ? (
              <div className="px-3 py-6 text-center text-[13px] leading-relaxed" style={{ color: C.sub }}>
                {emptyCopy}
              </div>
            ) : (
              rows.slice(0, 60).map((item) => (
                <FoodRow key={item.id} item={item}
                  onQuickAdd={() => { feedback("save"); onLog(logFromFoodItem(item, { date, time, meal, servings: 1 })); }}
                  onOpen={() => setDetail({ item, servings: 1 })}
                  onToggleFavorite={() => onUpdateLibrary(toggleFavorite(library, item.id))} />
              ))
            )}
          </div>

          {/* Quick-add calories: the escape hatch for "I know roughly what that
              was and I don't want to describe it". */}
          <div className="flex items-end gap-2 mt-3">
            <label className="flex-1">
              <span className="fhj-eyebrow block mb-1">Quick add calories</span>
              <input className="fhj-input" type="number" inputMode="numeric" placeholder="e.g. 250"
                value={quickCal} onChange={(e) => setQuickCal(e.target.value)} />
            </label>
            <Button variant="secondary" disabled={!Number(quickCal)}
              onClick={() => {
                const n = Number(quickCal);
                if (!isFinite(n) || n <= 0) return;
                feedback("save");
                onLog(newFoodLog({ date, time, meal, description: "Quick add", nutrition: { calories: n } }));
              }}>
              Add
            </Button>
          </div>

          <Disclosure className="mt-3 mb-1" label="When and which meal"
            summary={`${prettyTime(time)} · ${mealLabel(meal)}`}>
            <div className="flex items-end gap-2">
              <label style={{ width: "7.5rem" }}>
                <span className="fhj-eyebrow block mb-1">Time</span>
                <input type="time" className="fhj-input" value={time}
                  aria-label="Time this was eaten or drunk"
                  onChange={(e) => setTimeAndMeal(e.target.value)} />
              </label>
              <label className="flex-1 min-w-0">
                <span className="fhj-eyebrow block mb-1">Meal</span>
                <select className="fhj-input" value={meal} aria-label="Which meal this belongs to"
                  onChange={(e) => { mealTouched.current = true; setMeal(e.target.value); }}>
                  {MEALS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
              </label>
            </div>
          </Disclosure>
        </div>
      </Modal>

      {detail && (
        <Modal title={detail.item.name} onClose={() => setDetail(null)}
          footer={
            <Button block onClick={() => {
              feedback("save");
              onLog(logFromFoodItem(detail.item, { date, time, meal, servings: detail.servings }));
            }}>
              Add to {mealLabel(meal).toLowerCase()}
            </Button>
          }>
          <div className="fhj-cat-food">
            <div className="flex items-center justify-between gap-3 mb-4">
              <span className="text-xs" style={{ color: C.sub }}>How much?</span>
              <ServingStepper value={detail.servings} serving={detail.item.serving}
                onChange={(servings) => setDetail((d) => ({ ...d, servings }))} />
            </div>
            <div className="rounded-xl p-3" style={{ background: C.faint }}>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                {NUTRIENTS.filter((n) => detail.item.nutrition?.[n.k] != null).map((n) => (
                  <div key={n.k} className="flex items-baseline justify-between gap-2">
                    <span className="text-[11px]" style={{ color: C.sub }}>{n.label}</span>
                    <span className="text-sm font-semibold tabular-nums" style={{ color: C.ink }}>
                      {formatNutrient(n.k, (detail.item.nutrition[n.k] || 0) * detail.servings)}
                      <span className="text-[10px] font-normal ml-0.5" style={{ color: C.subtle }}>{n.unit}</span>
                    </span>
                  </div>
                ))}
              </div>
              {detail.item.estimated && (
                <p className="text-[10px] leading-relaxed mt-2" style={{ color: C.subtle }}>
                  These figures started as an AI estimate. They stay labelled as one until you edit them.
                </p>
              )}
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

/** Progress toward one target. Deliberately unjudged: the bar fills, and that
    is all it says. No red for over, no green for under — this app does not
    have an opinion about someone's calorie count. */
function GoalBar({ progress }) {
  const def = nutrientDef(progress.k);
  const pct = progress.ratio == null ? 0 : Math.round(progress.ratio * 100);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <span className="text-[11px]" style={{ color: C.sub }}>{def.label}</span>
        <span className="text-[11px] tabular-nums" style={{ color: C.subtle }}>
          <b style={{ color: C.ink }}>{formatNutrient(progress.k, progress.eaten)}</b>
          {" / "}{formatNutrient(progress.k, progress.goal)} {def.unit}
        </span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: C.faint }}
        role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
        aria-label={`${def.label}: ${pct}% of your target`}>
        <div className="h-full rounded-full" style={{
          width: `${pct}%`, background: C.sage,
          transition: "width var(--fhj-ease) var(--fhj-out)",
        }} />
      </div>
    </div>
  );
}

/** The calories ring on the diary header. One number, big, plus what's left. */
function CalorieRing({ eaten, goal }) {
  const r = 42, circ = 2 * Math.PI * r;
  const ratio = goal > 0 ? Math.max(0, Math.min(1, (eaten || 0) / goal)) : 0;
  const remaining = goal - (eaten || 0);
  return (
    <div className="relative shrink-0" style={{ width: 104, height: 104 }}>
      <svg width="104" height="104" viewBox="0 0 104 104" aria-hidden="true" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="52" cy="52" r={r} fill="none" stroke={C.faint} strokeWidth="9" />
        <circle cx="52" cy="52" r={r} fill="none" stroke={C.sage} strokeWidth="9" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - ratio)}
          style={{ transition: "stroke-dashoffset 600ms var(--fhj-out)" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="font-display text-xl leading-none tabular-nums" style={{ color: C.ink }}>
          {formatNutrient("calories", Math.abs(remaining))}
        </div>
        <div className="text-[9.5px] mt-1 text-center leading-tight" style={{ color: C.subtle }}>
          {remaining >= 0 ? "kcal left" : "kcal over"}
        </div>
      </div>
    </div>
  );
}

/** One meal's block: its items, its subtotal, and one button to add to it.
    Grouping by meal is what makes a day of food readable — a flat list of nine
    items is a receipt, not a diary. */
function MealSection({ meal, logs, onAdd, onOpenLog, viewer }) {
  const def = MEALS.find((m) => m.id === meal);
  let kcal = null;
  for (const l of logs) {
    const c = resolveNutrient(l, "calories");
    if (c.value != null) kcal = (kcal ?? 0) + c.value;
  }
  /* An empty meal draws nothing at all here — `MealChips` collects every empty
     one into a single row of add buttons. Five empty cards cost 300px to say
     nothing five times, on the exact screen you open *before* you have eaten,
     and that 300px is the difference between the day fitting on one screen and
     not. See MealChips for the other half of this decision. */
  if (!logs.length) return null;

  return (
    <Card className="!p-0 mb-2" style={{ padding: 0 }}>
      {/* Add lives in the header, beside the subtotal. As its own row under the
          items it was a full-width control repeated once per meal — three
          filled meals spent 120px on a button that is one 44px target up
          here, next to the name of the meal it adds to. */}
      <div className="flex items-center justify-between gap-2 pl-3.5 pr-1.5 py-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="fhj-tl-dot" style={{ width: "1.5rem", height: "1.5rem" }}>
            <Icon name={def?.icon || "food"} size={12} color="currentColor" />
          </span>
          <span className="text-sm font-bold" style={{ color: C.ink }}>{def?.label || "Meal"}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[11px] tabular-nums" style={{ color: C.subtle }}>
            {kcal == null ? "—" : `${formatNutrient("calories", kcal)} kcal`}
          </span>
          {!viewer && (
            <button type="button" onClick={onAdd}
              aria-label={`Add food to ${def?.label || "meal"}`}
              className="fhj-icon-btn" style={{ width: "2.5rem", height: "2.5rem" }}>
              <Icon name="plus" size={16} color={C.accentText} />
            </button>
          )}
        </div>
      </div>

      {logs.map((l) => {
        const cal = resolveNutrient(l, "calories");
        return (
          <button key={l.id} type="button" onClick={() => onOpenLog(l)}
            className="fhj-row w-full flex items-center gap-2 px-3.5 py-2 text-left"
            style={{ borderTop: `1px solid ${C.line}` }}>
            <span className="flex-1 min-w-0">
              <span className="text-[13px] block truncate" style={{ color: C.ink }}>
                {l.description?.trim() || l.ai?.identified || "Meal"}
              </span>
              <span className="text-[10.5px] block truncate" style={{ color: C.subtle }}>
                {l.serving || prettyTime(l.time)}
              </span>
            </span>
            {hasAiValues(l) && <span className="fhj-ai-badge shrink-0" style={{ fontSize: "0.5rem" }}>Est.</span>}
            <span className="text-[12px] tabular-nums shrink-0" style={{ color: C.sub }}>
              {cal.value == null ? "—" : formatNutrient("calories", cal.value)}
            </span>
          </button>
        );
      })}

    </Card>
  );
}

/* =====================================================================
   The Diary — one day, everything that went in or on you
   =====================================================================

   Meals and the routine used to live on two screens. That was two screens for
   one question. "What did I have today" and "did I take the morning lot" are
   asked in the same breath, usually while standing in the same kitchen, and a
   person filling in yesterday evening has to answer both — so they belong on
   one page, over one date, with one pager moving both.

   The layout is ordered by how long each thing takes:

     1. the day, and the two numbers that summarise it
     2. the routine — a checklist, answered in taps
     3. the meals — a diary, answered in sentences

   Everything is on the page at once. Nothing is behind a tab, a toggle or a
   horizontal scroller: on a day page, "is it all there" has to be answerable
   by looking, and anything scrolled sideways is a thing people stop finding.
   The routine's rows are the compact single-line variant precisely so that
   holds — a five-item routine costs about 200px here, not 350. */

/** The day's two headline numbers, side by side under one hairline: what you
    ate, and how much of the routine you have answered. Each half only draws
    when it has something to say, so a journal that tracks food and no meds —
    or meds and no food — gets a card about that, not a card with a hole. */
function DaySummary({ food, goals, items, logs, date, onEditGoals, viewer }) {
  const totals = dayTotals(food, date);
  const progress = routineProgress(items, logs, date);
  const taken = routineOn(logs, date).filter((l) => !l.skipped).length;
  const calGoal = goals?.calories;
  const goalRows = goalProgress(goals, totals).filter((p) => p.k !== "calories");
  /* The food half always draws. It is the half that carries the way *in* to
     daily targets, and hiding it on a day with nothing eaten yet hid that door
     on precisely the days somebody opens this screen to start using it. The
     routine half is conditional, because a journal with no routine has no
     use for a row about one. */
  const hasRoutine = progress.total > 0 || taken > 0;

  return (
    <Card className="!p-3.5 mb-3" style={{ padding: "0.875rem" }}>
      <div className={`flex gap-3.5 ${calGoal ? "items-center" : "items-start"} fhj-cat-food`}>
        {calGoal ? (
          <CalorieRing eaten={totals.calories} goal={calGoal} />
        ) : (
          <div className="shrink-0">
            <div className="font-display text-3xl leading-none tabular-nums"
              style={{ color: totals.calories != null ? C.ink : C.muted }}>
              {totals.calories != null ? formatNutrient("calories", totals.calories) : "0"}
            </div>
            <div className="text-[10.5px] mt-1" style={{ color: C.subtle }}>kcal</div>
          </div>
        )}
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          {goalRows.length > 0 ? (
            goalRows.slice(0, 3).map((p) => <GoalBar key={p.k} progress={p} />)
          ) : (
            <div className="flex flex-wrap gap-x-3.5 gap-y-1">
              {NUTRIENTS.filter((n) => n.primary && n.k !== "calories" && totals[n.k] != null).map((n) => (
                <div key={n.k} className="flex items-baseline gap-1">
                  <span className="text-sm font-bold tabular-nums" style={{ color: C.ink }}>
                    {formatNutrient(n.k, totals[n.k])}
                  </span>
                  <span className="text-[10px]" style={{ color: C.subtle }}>{n.label.toLowerCase()}</span>
                </div>
              ))}
              {totals.meals === 0 && (
                <span className="text-[11.5px]" style={{ color: C.subtle }}>Nothing eaten yet</span>
              )}
            </div>
          )}
          {!goalRows.length && !calGoal && !viewer && (
            <button onClick={() => { feedback("nav"); onEditGoals(); }}
              className="text-[11.5px] font-semibold text-left" style={{ color: C.accentText }}>
              Set daily targets
            </button>
          )}
        </div>
      </div>

      {hasRoutine && <div className="my-3" style={{ borderTop: `1px solid ${C.line}` }} />}

      {hasRoutine && (
        <div className="fhj-cat-routine">
          <div className="flex items-baseline justify-between gap-2 mb-1.5">
            <span className="text-[12.5px] font-semibold tabular-nums" style={{ color: C.ink }}>
              {progress.total ? `Routine ${progress.done} of ${progress.total}` : `${taken} logged`}
              {progress.skipped > 0 && (
                <span className="font-normal" style={{ color: C.subtle }}> · {progress.skipped} skipped</span>
              )}
            </span>
            {progress.total > 0 && progress.done === progress.total && (
              <span className="fhj-badge fhj-badge-good">All done</span>
            )}
          </div>
          {progress.total > 0 && (
            <div className="fhj-check-bar">
              <span style={{ width: `${Math.round((progress.ratio || 0) * 100)}%` }} />
            </div>
          )}
        </div>
      )}

      {totals.partlyEstimated && (
        <div className="mt-3 pt-3 flex items-center gap-2 flex-wrap" style={{ borderTop: `1px solid ${C.line}` }}>
          <span className="fhj-ai-badge">Partly estimated</span>
          <span className="text-[10.5px]" style={{ color: C.subtle }}>
            Some of today's figures came from AI, not a label.
          </span>
        </div>
      )}
    </Card>
  );
}

/** The pager. Sticky, because a day page is long by design and "which day am I
    editing" is the one thing you must never have to scroll back up to check —
    on a screen whose entire job is writing to a particular date, that question
    getting lost is a wrong entry. */
function DayBar({ date, setDate }) {
  const isToday = date === todayStr();
  return (
    <div className="sticky top-0 z-20 -mx-4 px-4 py-2"
      style={{ background: C.bg, backdropFilter: "saturate(140%) blur(8px)" }}>
      <div className="flex items-center justify-between gap-2">
        <button className="fhj-icon-btn shrink-0" onClick={() => { feedback("nav"); setDate(addDays(date, -1)); }}
          aria-label="previous day">
          <Icon name="left" size={16} color={C.sub} />
        </button>
        <div className="text-center min-w-0">
          <div className="font-display text-[1.05rem] leading-tight truncate" style={{ color: C.ink }}>
            {isToday ? "Today" : fmtNice(date)}
          </div>
          {isToday ? (
            <div className="text-[10.5px] leading-tight" style={{ color: C.subtle }}>{fmtNice(date)}</div>
          ) : (
            <button type="button" onClick={() => { feedback("nav"); setDate(todayStr()); }}
              className="text-[10.5px] font-semibold leading-tight" style={{ color: C.accentText }}>
              Jump to today
            </button>
          )}
        </div>
        <button className="fhj-icon-btn shrink-0" onClick={() => { feedback("nav"); setDate(addDays(date, 1)); }}
          disabled={date >= todayStr()} aria-label="next day">
          <Icon name="right" size={16} color={C.sub} />
        </button>
      </div>
    </div>
  );
}

/** Every meal with nothing in it yet, as one row of add buttons.

    The five empty meal cards this replaces were the single biggest block of
    dead space in the app: 300px of headings and dashes, on the screen you open
    when you have not eaten. As chips they cost one row, they keep the exact
    same one-tap path into each meal — the labels are unchanged, so is the
    picker they open — and they disappear one by one as the day fills in. */
function MealChips({ meals, onAdd }) {
  if (!meals.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mb-2 fhj-cat-food">
      {meals.map((m) => (
        <button key={m.id} type="button"
          onClick={() => { feedback("tap"); onAdd(m.id); }}
          aria-label={`Add food to ${m.label}`}
          className="fhj-chip fhj-pop">
          <Icon name="plus" size={12} color="currentColor" />
          {m.label}
        </button>
      ))}
    </div>
  );
}

function DiaryScreen({
  food, foods, goals, onLog, onSaveLog, onDeleteLog, onUpdateLibrary,
  routine = [], routineItems = [], onSaveRoutine, onDeleteRoutine, onLogRoutineRows,
  onSaveRoutineItem, goRoutine,
  onEditGoals, aiEnabled, aiAuto, viewer,
}) {
  const [date, setDate] = useState(todayStr());
  const [picker, setPicker] = useState(null);        // meal id
  const [sheet, setSheet] = useState(null);          // food log being edited, or { meal } for new
  const [routineSheet, setRoutineSheet] = useState(null); // { item, slot, log }
  const [itemEditor, setItemEditor] = useState(false);    // add-an-item sheet
  const rows = foodOn(food, date);
  const hasRoutine = routineItems.length > 0;

  const yesterday = addDays(date, -1);
  const yesterdayRows = foodOn(food, yesterday);

  const copyYesterday = () => {
    if (!yesterdayRows.length) return;
    if (!window.confirm(
      `Copy all ${yesterdayRows.length} item${yesterdayRows.length === 1 ? "" : "s"} from ${fmtNice(yesterday)} to ${fmtNice(date)}?`
    )) return;
    feedback("save");
    for (const src of yesterdayRows) {
      const { id, createdAt, updatedAt, ...rest } = src;
      onLog(newFoodLog({ ...rest, date }));
    }
  };

  /* One tap ticks, the same tap unticks — on whichever date the pager is on,
     which is the entire reason the routine moved onto this page. */
  const toggleRoutine = (row) => {
    if (row.log) onDeleteRoutine(row.log);
    else onSaveRoutine(logFromItem(row.item, { date, slot: row.slot }));
  };

  return (
    <div className="px-4 pb-8">
      <DayBar date={date} setDate={setDate} />

      <DaySummary food={food} goals={goals} items={routineItems} logs={routine} date={date}
        onEditGoals={onEditGoals} viewer={viewer} />

      {/* ---------- the routine ----------
          Above the meals because it is the shorter task and the one with a
          right answer: a checklist you can clear in four taps should not be
          under five meal cards you might add nothing to. */}
      {/* Both actions live in the heading rather than as rows under the list:
          a full-width dashed "Add" button under five checklist rows is 48px
          spent on the thing people do twice a year, directly beneath the thing
          they do every morning. */}
      <div className="fhj-section mt-4 fhj-cat-routine">
        <h2 className="fhj-section-title">Routine</h2>
        {!viewer && (
          <span className="flex items-center gap-3 shrink-0">
            {hasRoutine && (
              <button onClick={() => { feedback("tap"); setItemEditor(true); }}
                aria-label="Add an item to your routine"
                className="text-[11px] font-semibold flex items-center gap-0.5" style={{ color: C.accentText }}>
                <Icon name="plus" size={12} color={C.accentText} /> Add
              </button>
            )}
            <button onClick={() => { feedback("nav"); goRoutine(); }}
              className="text-[11px] font-semibold flex items-center gap-0.5" style={{ color: C.accentText }}>
              {hasRoutine ? "Manage" : "Set up"}
              <Icon name="right" size={12} color={C.accentText} />
            </button>
          </span>
        )}
      </div>

      {hasRoutine ? (
        <RoutineChecklist
          items={routineItems} logs={routine} date={date} viewer={viewer} compact
          onToggle={toggleRoutine}
          onAdjust={(row) => !viewer && setRoutineSheet({ ...row, date })}
          onLogRows={(pending, label) => onLogRoutineRows(pending.map((r) => ({ ...r, date })), label)}
          onLogAsNeeded={(item) => onSaveRoutine(logFromItem(item, { date, slot: slotForTime(localTime()) }))} />
      ) : (
        !viewer && (
          <button type="button" onClick={() => { feedback("tap"); setItemEditor(true); }}
            className="w-full text-[12px] leading-relaxed px-3 py-3 rounded-xl text-left"
            style={{ background: C.faint, border: `1px dashed ${C.lineStrong}`, color: C.subtle }}>
            Meds, supplements, creams, products — add what you take or use and it becomes a
            one-tap checklist right here, on whichever day you're looking at.
          </button>
        )
      )}

      {/* ---------- the meals ---------- */}
      <div className="fhj-section mt-5 fhj-cat-food">
        <h2 className="fhj-section-title">Meals</h2>
        {rows.length > 0 && (
          <span className="text-[11px] tabular-nums" style={{ color: C.subtle }}>
            {rows.length} item{rows.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {MEALS.map((m) => (
        <MealSection key={m.id} meal={m.id} viewer={viewer}
          logs={rows.filter((r) => r.meal === m.id)}
          onAdd={() => setPicker(m.id)}
          onOpenLog={(l) => !viewer && setSheet(l)} />
      ))}

      {!viewer && (
        <MealChips
          meals={MEALS.filter((m) => !rows.some((r) => r.meal === m.id))}
          onAdd={(id) => setPicker(id)} />
      )}

      {!viewer && yesterdayRows.length > 0 && rows.length === 0 && (
        <Button variant="secondary" block icon="refresh" className="mt-3" onClick={copyYesterday}>
          Copy {yesterdayRows.length} item{yesterdayRows.length === 1 ? "" : "s"} from yesterday
        </Button>
      )}

      {rows.length === 0 && (
        /* One line. The long version of this sentence was the only thing left
           pushing a typical day past the fold, and it was explaining a feature
           the user meets on their second meal anyway. */
        <p className="text-[11px] mt-3 text-center" style={{ color: C.subtle }}>
          Foods you save build up as you go — most meals become one tap.
        </p>
      )}

      {picker && (
        <FoodPicker
          library={foods} meal={picker} date={date}
          onLog={(log) => { onLog(log); setPicker(null); }}
          onOpenFull={(pre) => { setSheet({ ...pre }); setPicker(null); }}
          onUpdateLibrary={onUpdateLibrary}
          onClose={() => setPicker(null)} />
      )}
      {sheet && (
        <FoodLogSheet
          initial={sheet.id ? sheet : null}
          date={date}
          defaultMeal={sheet.meal} defaultTime={sheet.time}
          aiEnabled={aiEnabled} aiAuto={aiAuto}
          onSave={(log) => { onSaveLog(log); setSheet(null); }}
          onDelete={sheet.id ? (log) => { onDeleteLog(log); setSheet(null); } : null}
          onClose={() => setSheet(null)} />
      )}
      {routineSheet && (
        <RoutineLogAdjustSheet row={routineSheet} date={date}
          onSave={(log) => { onSaveRoutine(log); setRoutineSheet(null); }}
          onSkip={(log) => { onSaveRoutine(log); setRoutineSheet(null); }}
          onUnlog={(log) => { onDeleteRoutine(log); setRoutineSheet(null); }}
          onClose={() => setRoutineSheet(null)} />
      )}
      {itemEditor && (
        /* Adding an item without leaving the day. The manage screen still
           exists for editing, archiving and the history; this is the path for
           "I've just started taking this", which is when people actually add
           things — standing in front of the thing. */
        <RoutineItemSheet
          initial={null}
          onSave={(item) => { onSaveRoutineItem(item); setItemEditor(false); }}
          onDelete={null}
          onClose={() => setItemEditor(false)} />
      )}
    </div>
  );
}


/* =====================================================================
   The routine — medications, supplements, creams, products
   =====================================================================

   The daily survey answers "how was today". The food diary answers "what did
   I eat". Neither could answer the question people asked for most: *what am I
   actually taking, and did I take it?*

   Everything below is built around one interaction and defends it:

       one tap says "took it", the same tap again undoes it.

   No dose picker in the way, no confirmation, no "are you sure". A dose is
   free text because "2 pumps" and "pea-sized" are what people say. Adjusting
   today's dose without changing the plan is one more tap, and it is the only
   thing hiding behind a sheet — because on the vast majority of days there is
   nothing to adjust, and a form that asks anyway is a form that gets skipped
   until the whole feature is abandoned.

   The app has no opinion about any of it. It does not know interactions, does
   not know maximum doses, will not warn, rate or advise. It writes down what
   the person tells it and gives it back to them in a spreadsheet. */

/** The tick box on a checklist row. Not an <input type=checkbox>: the row is
    the control, and a real checkbox inside a button is two targets fighting
    over one tap. */
function CheckMark({ done, skipped }) {
  return (
    <span className="fhj-check-box" aria-hidden="true">
      <Icon name={skipped ? "minus" : "check"} size={15}
        color={done ? C.onAccent : skipped ? C.sub : "transparent"} />
    </span>
  );
}

/** One line of the checklist.

    The whole row toggles. The small button on the right is the only way to
    reach anything else — today's dose, the time, a note, a deliberate skip —
    and it is deliberately the *second* control, not the first. */
function RoutineCheckRow({ row, onToggle, onAdjust, disabled, compact = false }) {
  const { item, log, done, skipped } = row;
  /* No kind icon on this row, deliberately. The name is what somebody reads,
     and a 28px glyph on the right was costing "CeraVe moisturising cream" its
     last two words to say something the dose line already said. The icons live
     where they earn their space: the manage list and the timeline. */

  /* The second line answers a different question before and after the tap.
     Before: *what am I meant to take* — the dose. After: *when did I* — the
     clock. Printing both at once would be the row explaining itself twice. */
  const meta = done || skipped
    ? [skipped ? "Skipped" : "Taken", logLine(log)].filter(Boolean).join(" · ")
    : [item.dose?.trim(), item.brand?.trim()].filter(Boolean).join(" · ");

  /* Compact says the same thing on one line. It exists for the day page, where
     the routine shares the screen with five meals and every row it doesn't
     spend is a row of food the user can still see without scrolling. */
  const inline = done || skipped
    ? [skipped ? "Skipped" : null, prettyTime(log?.time)].filter(Boolean).join(" · ")
    : item.dose?.trim() || "";

  /* An item scheduled twice a day draws two identical rows, so the slot has to
     be part of the name a screen reader reads out — otherwise the morning and
     the bedtime dose are two buttons called the same thing. */
  const label = row.slot ? `${item.name}, ${timeLabel(row.slot)}` : item.name;

  return (
    <div className="flex items-center gap-1">
      <button type="button" disabled={disabled}
        onClick={() => { feedback(done || skipped ? "tap" : "save"); onToggle(row); }}
        aria-pressed={done}
        aria-label={`${done ? "Undo" : "Mark taken"}: ${label}`}
        className={"fhj-check-row fhj-pop flex-1 min-w-0" + (compact ? " is-compact" : "")
          + (done ? " is-done" : "") + (skipped ? " is-skipped" : "")}>
        <CheckMark done={done} skipped={skipped} />
        {compact ? (
          <span className="fhj-check-line">
            <span className="fhj-check-name">{item.name}</span>
            {inline && <span className="fhj-check-sub">{inline}</span>}
          </span>
        ) : (
          <span className="flex-1 min-w-0">
            <span className="fhj-check-name">{item.name}</span>
            {meta && <span className="fhj-check-meta">{meta}</span>}
          </span>
        )}
      </button>
      {!disabled && (
        <button type="button" onClick={() => { feedback("tap"); onAdjust(row); }}
          aria-label={`Adjust ${label}`} className="fhj-icon-btn shrink-0"
          style={{ width: compact ? "2.25rem" : "2.5rem", height: compact ? "2.25rem" : "2.5rem" }}>
          <Icon name="sliders" size={compact ? 14 : 16} color={C.sub} />
        </button>
      )}
    </div>
  );
}

/** The day's checklist: every scheduled item, grouped by the part of the day
    it belongs to, with the as-needed row underneath.

    Used by both the dashboard and the Routine screen, because "what does today
    ask for" has exactly one right answer and two components drawing it their
    own way is how the two drift apart. */
function RoutineChecklist({
  items = [], logs = [], date, onToggle, onAdjust, onLogAsNeeded, onLogRows, viewer, compact = false,
}) {
  const groups = useMemo(() => routineChecklist(items, logs, date), [items, logs, date]);
  const asNeeded = useMemo(() => asNeededItems(items), [items]);
  const extras = useMemo(
    /* Uses of an item that isn't on today's plan — an as-needed painkiller, or
       something logged before it was archived. They belong on the day even
       though nothing asked for them. */
    () => routineOn(logs, date).filter((l) => !groups.some((g) => g.rows.some((r) => r.log?.id === l.id))),
    [logs, date, groups]
  );

  /* Which finished groups the user has re-opened. Collapsing is the default
     for a group that is entirely answered — see the summary row below. */
  const [opened, setOpened] = useState({});

  if (!groups.length && !asNeeded.length && !extras.length) return null;

  return (
    <div className="fhj-cat-routine">
      {groups.map((g) => {
        /* "All" is the one shortcut worth having here. Somebody with four
           morning pills takes them in one handful and then taps four times to
           say so; this is that handful, as one tap, with a single Undo behind
           it. It only appears when there are at least two left to take, so it
           never sits there offering to do something already done. */
        const key = g.slot || "anytime";
        const pending = g.rows.filter((r) => !r.done && !r.skipped);
        /* A finished group folds into one line. This is what makes the list
           get *shorter* as the day goes on rather than staying the same size
           in a different colour — by bedtime a nine-item routine is four rows,
           and the day still fits on one screen. Groups of one never fold:
           there is nothing to save, and it would cost a tap to undo them.

           Skipped counts as answered here for the same reason it does in the
           progress bar: the question was dealt with. */
        const foldable = g.rows.length > 1 && !pending.length;
        const folded = foldable && !opened[key];
        const doneCount = g.rows.filter((r) => r.done).length;

        return (
          <div key={key} className={compact ? "mb-2" : "mb-3"}>
            {!folded && (
              <div className="flex items-center gap-1.5 mb-1.5">
                <Icon name={g.icon} size={12} color={C.subtle} />
                <span className="fhj-eyebrow">{g.label}</span>
                <span className="flex-1" />
                {/* "All" is the one shortcut worth having here. Somebody with
                    four morning pills takes them in one handful and then taps
                    four times to say so; this is that handful, as one tap, with
                    a single Undo behind it. */}
                {!viewer && onLogRows && pending.length > 1 && (
                  <button type="button"
                    onClick={() => { feedback("save"); onLogRows(pending, g.label); }}
                    aria-label={`Mark all ${pending.length} ${g.label.toLowerCase()} items taken`}
                    className="text-[10.5px] font-bold tracking-wide uppercase px-2 py-1 rounded-full"
                    style={{ color: C.accentText, background: C.faint }}>
                    All {pending.length}
                  </button>
                )}
              </div>
            )}

            {folded ? (
              <button type="button"
                onClick={() => { feedback("tap"); setOpened((o) => ({ ...o, [key]: true })); }}
                aria-label={`${g.label} done — show all ${g.rows.length} items`}
                className="fhj-check-row is-compact is-done w-full">
                <CheckMark done />
                <span className="fhj-check-line">
                  <span className="fhj-check-name">{g.label}</span>
                  <span className="fhj-check-sub">
                    {doneCount === g.rows.length
                      ? `all ${g.rows.length} done`
                      : `${doneCount} done · ${g.rows.length - doneCount} skipped`}
                  </span>
                </span>
                <Icon name="down" size={14} color={C.sub} />
              </button>
            ) : (
              <div className={"flex flex-col " + (compact ? "gap-1" : "gap-1.5")}>
                {g.rows.map((row) => (
                  <RoutineCheckRow key={`${row.item.id}_${row.slot || "any"}`} row={row} compact={compact}
                    onToggle={onToggle} onAdjust={onAdjust} disabled={viewer} />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {extras.length > 0 && (
        <div className={compact ? "mb-2" : "mb-3"}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Icon name="plus" size={12} color={C.subtle} />
            <span className="fhj-eyebrow">Also logged</span>
          </div>
          <div className={"flex flex-col " + (compact ? "gap-1" : "gap-1.5")}>
            {extras.map((log) => (
              <button key={log.id} type="button" disabled={viewer}
                onClick={() => { feedback("tap"); onAdjust({ item: { id: log.itemId, name: log.name, kind: log.kind }, log, done: !log.skipped, skipped: !!log.skipped }); }}
                aria-label={`Adjust ${log.name}`}
                className={"fhj-check-row" + (compact ? " is-compact" : "") + (log.skipped ? " is-skipped" : " is-done")}>
                <CheckMark done={!log.skipped} skipped={!!log.skipped} />
                {compact ? (
                  <span className="fhj-check-line">
                    <span className="fhj-check-name">{log.name}</span>
                    <span className="fhj-check-sub">{[log.skipped ? "Skipped" : null, prettyTime(log.time)].filter(Boolean).join(" · ")}</span>
                  </span>
                ) : (
                  <span className="flex-1 min-w-0">
                    <span className="fhj-check-name">{log.name}</span>
                    <span className="fhj-check-meta">{routineSummary(log) || logLine(log)}</span>
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* As needed: offered, never chased. Chips rather than checklist lines,
          because an antihistamine you might not take today is not an unfinished
          task and should not read as one — and they *wrap* rather than scroll
          sideways, so nothing about the day is hidden past an edge. */}
      {!viewer && asNeeded.length > 0 && (
        <>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Icon name="clock" size={12} color={C.subtle} />
            <span className="fhj-eyebrow">As needed</span>
          </div>
          <div className="flex flex-wrap gap-1.5" role="list" aria-label="Log an as-needed item">
            {asNeeded.map((item) => {
              const count = countToday(logs, date, item.id);
              return (
                <button key={item.id} type="button" role="listitem"
                  onClick={() => { feedback("save"); onLogAsNeeded(item); }}
                  aria-label={`Log ${item.name}`}
                  className={"fhj-chip fhj-pop" + (count ? " is-active" : "")}>
                  <Icon name={count ? "check" : "plus"} size={12} color="currentColor" />
                  {item.name}
                  {(count || item.dose?.trim()) && (
                    <span className="fhj-check-sub">{count || item.dose?.trim()}</span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/** "2 today" — how many times an as-needed item has already been logged, so a
    second dose is a decision rather than a surprise. */
function countToday(logs, date, itemId) {
  const n = routineOn(logs, date).filter((l) => l.itemId === itemId && !l.skipped).length;
  return n ? `${n} today` : "";
}

/** The dashboard section. Header, one progress line, the checklist.

    It renders even when the routine is empty — as a single dashed row, the
    same shape the Quick Add editor uses for "nothing selected". That row is
    the entire discovery path for this feature, and one line on the first
    screen is a price worth paying for it; anyone who never wants it can hide
    the section from the same screen it points at. */
function RoutineCard({ items = [], logs = [], date, onToggle, onAdjust, onLogAsNeeded, onLogRows, onManage, viewer }) {
  const progress = routineProgress(items, logs, date);
  const active = scheduledItems(items).length + asNeededItems(items).length;

  return (
    <>
      <button type="button" onClick={() => { feedback("nav"); onManage(); }}
        aria-label="Manage your routine"
        className="fhj-section mt-6 fhj-cat-routine w-full text-left">
        <h2 className="fhj-section-title">Routine</h2>
        <span className="text-[11px] font-semibold flex items-center gap-0.5" style={{ color: C.accentText }}>
          {active ? "Manage" : "Set up"}
          <Icon name="right" size={12} color={C.accentText} />
        </span>
      </button>

      {active === 0 ? (
        <button type="button" onClick={() => { feedback("nav"); onManage(); }}
          className="w-full text-[12px] leading-relaxed px-3 py-3 rounded-xl text-left"
          style={{ background: C.faint, border: `1px dashed ${C.lineStrong}`, color: C.subtle }}>
          Meds, supplements, creams, products — add what you take or use and it becomes a one-tap
          checklist here.
        </button>
      ) : (
        /* No card around this. The rows *are* cards, and wrapping them in
           another one cost 28px of width — enough to truncate "CeraVe
           moisturising cream" here while it fitted perfectly on the Diary,
           which is the same list in the same component. One list, one width. */
        <div className="fhj-cat-routine">
          {progress.total > 0 && (
            <div className="mb-2">
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <span className="text-[12px] font-semibold tabular-nums" style={{ color: C.sub }}>
                  {`${progress.done} of ${progress.total} done`}
                  {progress.skipped > 0 && (
                    <span className="font-normal" style={{ color: C.subtle }}> · {progress.skipped} skipped</span>
                  )}
                </span>
                {progress.done === progress.total && (
                  <span className="fhj-badge fhj-badge-good">All done</span>
                )}
              </div>
              <div className="fhj-check-bar">
                <span style={{ width: `${Math.round((progress.ratio || 0) * 100)}%` }} />
              </div>
            </div>
          )}
          <RoutineChecklist items={items} logs={logs} date={date} viewer={viewer} compact
            onToggle={onToggle} onAdjust={onAdjust} onLogRows={onLogRows}
            onLogAsNeeded={onLogAsNeeded} />
        </div>
      )}
    </>
  );
}

/* ---------- the item sheet: what a thing is, and when it is asked for ---------- */

/** Add or edit one routine item. Four questions, and only the first is
    required: what is it, what kind, how much, when. Everything else is behind
    a disclosure, because a supplement someone takes every morning should cost
    a name and two taps to set up. */
function RoutineItemSheet({ initial, onSave, onDelete, onClose }) {
  const [item, setItem] = useState(() => initial || newRoutineItem({ name: "" }));
  const patch = (p) => setItem((prev) => ({ ...prev, ...p, updatedAt: new Date().toISOString() }));
  const def = kindDef(item.kind);
  const name = (item.name || "").trim();

  const toggleTime = (t) => {
    feedback("tap");
    setItem((prev) => {
      const times = prev.times || [];
      return {
        ...prev,
        times: times.includes(t) ? times.filter((x) => x !== t) : [...times, t],
        updatedAt: new Date().toISOString(),
      };
    });
  };

  return (
    <Modal title={initial ? "Edit item" : "Add to your routine"} onClose={onClose}
      footer={
        <Button block disabled={!name}
          onClick={() => { feedback("save"); onSave({ ...item, name, dose: item.dose?.trim() || undefined }); }}>
          {initial ? "Save changes" : "Add it"}
        </Button>
      }>
      <div className="fhj-cat-routine">
        <label className="block mb-3">
          <span className="fhj-eyebrow block mb-1">Name</span>
          <input className="fhj-input" autoFocus={!initial} value={item.name}
            placeholder="Vitamin D, CeraVe, hydrocortisone…"
            onChange={(e) => patch({ name: e.target.value })} />
        </label>

        <div className="mb-3">
          <span className="fhj-eyebrow block mb-1.5">Kind</span>
          <div className="flex flex-wrap gap-1.5">
            {ROUTINE_KINDS.map((k) => (
              <button key={k.id} type="button"
                onClick={() => { feedback("tap"); patch({ kind: k.id }); }}
                aria-pressed={item.kind === k.id}
                className={"fhj-chip" + (item.kind === k.id ? " is-active" : "")}>
                <Icon name={k.icon} size={13} color="currentColor" />
                {k.label}
              </button>
            ))}
          </div>
        </div>

        {/* Free text, and the placeholder follows the kind — a cream asked for
            "e.g. 10 mg" is a form telling somebody it wasn't built for them. */}
        <label className="block mb-3">
          <span className="fhj-eyebrow block mb-1">Dose or amount</span>
          <input className="fhj-input" value={item.dose || ""} placeholder={def.dosePlaceholder}
            onChange={(e) => patch({ dose: e.target.value })} />
          <span className="text-[11px] leading-relaxed block mt-1" style={{ color: C.subtle }}>
            Whatever you'd say out loud. It's shown on the checklist and can be changed for a single
            day without touching this.
          </span>
        </label>

        <div className="mb-3">
          <span className="fhj-eyebrow block mb-1.5">When</span>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {ROUTINE_TIMES.map((t) => {
              const on = item.daily && (item.times || []).includes(t.id);
              return (
                <button key={t.id} type="button" disabled={!item.daily}
                  onClick={() => toggleTime(t.id)} aria-pressed={on}
                  className={"fhj-chip" + (on ? " is-active" : "")}
                  style={!item.daily ? { opacity: 0.45 } : undefined}>
                  <Icon name={t.icon} size={13} color="currentColor" />
                  {t.label}
                </button>
              );
            })}
          </div>
          <SwitchRow
            label="Every day"
            desc={item.daily
              ? ((item.times || []).length
                ? "On the checklist at the times above."
                : "On the checklist under Anytime — no particular time of day.")
              : "Offered as a one-tap chip, never counted as missed."}
            on={item.daily}
            onChange={(v) => { feedback("tap"); patch({ daily: v }); }} />
        </div>

        <Disclosure className="mb-3" label="Notes" summary={item.notes?.trim() || "Optional"}>
          <textarea className="fhj-input" rows={2}
            placeholder="Prescribed by…, take with food, the shelf it lives on"
            value={item.notes || ""} onChange={(e) => patch({ notes: e.target.value })} />
        </Disclosure>

        {initial && (
          <>
            <SwitchRow
              label="Archived"
              desc="Off the checklist, history kept. For the course that finished."
              on={!!item.archived}
              onChange={(v) => { feedback("tap"); patch({ archived: v || undefined }); }} />
            {onDelete && (
              <Button variant="danger" block icon="trash" className="mt-4" onClick={() => onDelete(item)}>
                Delete this item
              </Button>
            )}
            <p className="text-[11px] leading-relaxed mt-2" style={{ color: C.subtle }}>
              Deleting removes it from the list. Days you already logged keep saying what they said —
              every entry carries its own copy of the name and dose.
            </p>
          </>
        )}
      </div>
    </Modal>
  );
}

/* ---------- the adjust sheet: one use, on one day ---------- */

/** Everything about a single use that isn't "did it happen": the dose actually
    taken, the clock time, a deliberate skip, a note.

    Opened from the small button on a checklist row, and from a timeline row.
    It never edits the item behind it — changing today's dose here does not
    change tomorrow's plan, which is the distinction that makes both safe. */
function RoutineLogAdjustSheet({ row, date, onSave, onSkip, onUnlog, onClose }) {
  const { item } = row;
  const existing = row.log;
  const [log, setLog] = useState(
    () => existing || logFromItem(item, { date, slot: row.slot, time: localTime() })
  );
  const patch = (p) => setLog((prev) => ({ ...prev, ...p, updatedAt: new Date().toISOString() }));

  return (
    <Modal title={item.name} eyebrow={existing ? "Adjust this entry" : "Log this"} onClose={onClose}
      footer={
        <Button block onClick={() => { feedback("save"); onSave(log); }}>
          {existing ? "Save changes" : "Log it"}
        </Button>
      }>
      <div className="fhj-cat-routine">
        <label className="block mb-3">
          <span className="fhj-eyebrow block mb-1">Dose taken</span>
          <input className="fhj-input" value={log.dose || ""}
            placeholder={kindDef(log.kind).dosePlaceholder}
            onChange={(e) => patch({ dose: e.target.value })} />
          {item.dose && log.dose?.trim() && log.dose.trim() !== item.dose.trim() && (
            <span className="text-[11px] leading-relaxed block mt-1" style={{ color: C.subtle }}>
              Usually {item.dose}. This changes {fmtNice(log.date)} only — edit the item itself to
              change it from now on.
            </span>
          )}
        </label>

        <div className="flex gap-2 mb-3">
          <label className="flex-1">
            <span className="fhj-eyebrow block mb-1">Time</span>
            <input type="time" className="fhj-input" value={log.time}
              onChange={(e) => patch({ time: e.target.value })} />
          </label>
          <label className="flex-1">
            <span className="fhj-eyebrow block mb-1">Date</span>
            <input type="date" className="fhj-input" value={log.date}
              onChange={(e) => patch({ date: e.target.value })} />
          </label>
        </div>

        <label className="block mb-3">
          <span className="fhj-eyebrow block mb-1">Note</span>
          <input className="fhj-input" value={log.notes || ""}
            placeholder="Anything worth remembering"
            onChange={(e) => patch({ notes: e.target.value })} />
        </label>

        {/* A skip is a recorded decision, not an empty box. Kept next to the
            delete so the two readings of "it isn't ticked" — I chose not to,
            and I never said — are chosen between deliberately. */}
        <div className="flex flex-col gap-2 mt-4">
          <Button variant={log.skipped ? "primary" : "secondary"} block icon="minus"
            onClick={() => { feedback("tap"); onSkip({ ...log, skipped: !log.skipped }); }}>
            {log.skipped ? "Not skipped after all" : "Mark as skipped"}
          </Button>
          {existing && (
            <Button variant="ghost" block icon="trash" onClick={() => { feedback("tap"); onUnlog(existing); }}>
              Remove this entry
            </Button>
          )}
        </div>
        <p className="text-[11px] leading-relaxed mt-2" style={{ color: C.subtle }}>
          A skipped dose is recorded as a skip. An entry you remove goes back to saying nothing at
          all, which is not the same thing.
        </p>
      </div>
    </Modal>
  );
}

/* ---------- the Routine screen: the day, then the list ---------- */

/** One row of the manage list. */
function RoutineItemRow({ item, onEdit, first }) {
  const def = kindDef(item.kind);
  return (
    <button type="button" onClick={() => { feedback("tap"); onEdit(item); }}
      aria-label={`Edit ${item.name}`}
      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left fhj-row"
      style={{ borderTop: first ? "none" : `1px solid ${C.line}`, minHeight: "var(--fhj-tap)" }}>
      <span className="fhj-tl-dot shrink-0"><Icon name={def.icon} size={13} color="currentColor" /></span>
      <span className="flex-1 min-w-0">
        <span className="block text-[13.5px] font-semibold truncate" style={{ color: C.ink }}>
          {item.name}
        </span>
        <span className="block text-[11px] truncate" style={{ color: C.subtle }}>{itemSummary(item)}</span>
      </span>
      {item.archived && <span className="fhj-badge fhj-badge-neutral shrink-0">Archived</span>}
      <Icon name="right" size={14} color={C.subtle} />
    </button>
  );
}

/** Managing the routine: the *plan*, and only the plan.

    Ticking things off happens on the Diary, over whichever date its pager is
    on — including yesterday's missed dose. So this screen deliberately has no
    checklist, no progress and no day pager of its own: it had all three until
    the two systems shared a page, at which point they were a second copy of
    the day, one tab away, that could drift out of step with the first. What is
    left is what only this screen can do — add, edit, archive, and see
    everything you track in one list. */
function RoutineScreen({ items = [], viewer, onSaveItem, onDeleteItem, goDiary }) {
  const [editor, setEditor] = useState(null); // item being edited, or {} for a new one
  const [query, setQuery] = useState("");

  const active = useMemo(() => items.filter((i) => !i.archived), [items]);
  const archived = useMemo(() => items.filter((i) => i.archived), [items]);
  const shown = useMemo(() => searchItems(active, query), [active, query]);

  return (
    <div className="px-4 pb-8 pt-3 fhj-cat-routine">
      {items.length === 0 ? (
        <EmptyState icon="pill" title="Nothing in your routine yet"
          text="Medications, supplements, creams, shampoos, a daily shake — anything you take or use. Add one and it becomes a one-tap checklist on your Diary and your dashboard, and a column in your export."
          actionLabel={viewer ? null : "Add your first item"}
          onAction={viewer ? null : () => { feedback("tap"); setEditor({}); }} />
      ) : (
        <>
          {!viewer && (
            <Button block icon="plus" onClick={() => { feedback("tap"); setEditor({}); }}>
              Add an item
            </Button>
          )}

          <SectionTitle cat="fhj-cat-routine"
            action={
              <button type="button" onClick={() => { feedback("nav"); goDiary(); }}
                className="text-[11px] font-semibold flex items-center gap-0.5" style={{ color: C.accentText }}>
                Tick things off
                <Icon name="right" size={12} color={C.accentText} />
              </button>
            }>
            Everything you track
          </SectionTitle>

          {active.length > 6 && (
            <input className="fhj-input mb-2" value={query} placeholder="Search your routine"
              onChange={(e) => setQuery(e.target.value)} aria-label="Search your routine" />
          )}
          <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${C.line}` }}>
            {shown.map((item, i) => (
              <RoutineItemRow key={item.id} item={item} first={i === 0}
                onEdit={(it) => !viewer && setEditor(it)} />
            ))}
            {shown.length === 0 && (
              <div className="px-3 py-4 text-[12px]" style={{ color: C.subtle }}>
                Nothing matches “{query}”.
              </div>
            )}
          </div>

          {archived.length > 0 && (
            <Disclosure className="mt-3" label="Archived"
              summary={`${archived.length} item${archived.length === 1 ? "" : "s"} off the checklist`}>
              <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${C.line}` }}>
                {archived.map((item, i) => (
                  <RoutineItemRow key={item.id} item={item} first={i === 0}
                    onEdit={(it) => !viewer && setEditor(it)} />
                ))}
              </div>
            </Disclosure>
          )}
        </>
      )}

      <p className="text-[11px] leading-relaxed mt-5" style={{ color: C.subtle }}>
        This is a written record, not advice. Health Journal doesn't know what anything interacts
        with, doesn't check doses, and won't tell you whether something is working — it keeps what
        you enter, on this device, and hands it back whole when you export it.
      </p>

      {editor && (
        <RoutineItemSheet
          initial={editor.id ? editor : null}
          onSave={(it) => { onSaveItem(it); setEditor(null); }}
          onDelete={editor.id ? (it) => { onDeleteItem(it); setEditor(null); } : null}
          onClose={() => setEditor(null)} />
      )}
    </div>
  );
}


/* ---------- Quick Add ----------
   Tactile tiles, one per thing worth logging. This is the most-pressed control
   in the app and the reason the chunky-button treatment exists.

   Which tiles appear is the user's call. The four it ships with are the right
   default for most people, but "most people" is not who uses this — somebody
   tracking a diet has no use for a bowel tile, somebody tracking a gut
   condition wants it first, and somebody who logs drinks separately from meals
   was previously routing every glass of water through a form that opens on
   "Breakfast". The catalogue below is the whole set; `profile.quickAdd` is the
   ordered subset, and everything else here derives from those two. */

const QUICK_ADD_TILES = [
  {
    id: "checkin", cat: "fhj-cat-symptom", icon: "log", label: "Check-in",
    sub: "A couple of taps", desc: "Today's survey questions",
  },
  {
    id: "food", cat: "fhj-cat-food", icon: "food", label: "Food",
    sub: "Meal or snack", desc: "Opens your saved foods for the meal you're in",
  },
  {
    id: "drink", cat: "fhj-cat-food", icon: "drink", label: "Drink",
    sub: "Water, coffee, anything", desc: "The same picker, filed as a drink instead of a meal",
  },
  {
    id: "bowel", cat: "fhj-cat-bowel", icon: "bowel", label: "Bowel",
    sub: "Quick log", desc: "Bristol type, amount, colour — or just a photo",
  },
  {
    id: "routine", cat: "fhj-cat-routine", icon: "pill", label: "Routine",
    sub: "Meds and creams", desc: "Tick off today's doses without leaving this screen",
  },
  {
    id: "photo", cat: "fhj-cat-photo", icon: "camera", label: "Photo",
    sub: "Progress shot", desc: "Needs at least one photo question in your setup",
    needs: "photo",
  },
  /* ---- the condition-shaped ones ----
     Everything above is something any journal can hold. Everything below only
     appears when the person's own setup can answer it, which is what makes
     the row read as *their* app rather than a menu of features. */
  {
    id: "flare", cat: "fhj-cat-symptom", icon: "spark", label: "Flare",
    sub: "Mark a bad stretch", desc: "Starts a flare today, and ends it when it's over",
    needs: "flare",
  },
  {
    id: "symptom", cat: "fhj-cat-symptom", icon: "trends", label: "Symptom",
    sub: "Rate one thing", desc: "Rate a single question 1–10 without the whole check-in",
    needs: "scale",
  },
  {
    id: "hr", cat: "fhj-cat-symptom", icon: "heart", label: "Heart rate",
    sub: "Lying, then standing", desc: "Both numbers, and the jump between them",
    needs: "hr",
  },
  {
    id: "water", cat: "fhj-cat-food", icon: "drink", label: "Water",
    sub: "One tap, one cup", desc: "Adds a cup to today without opening anything",
    needs: "water",
  },
  {
    id: "trigger", cat: "fhj-cat-symptom", icon: "warn", label: "Trigger",
    sub: "Something set it off", desc: "Tag what may have set today off, while you remember",
    needs: "trigger",
  },
  {
    id: "note", cat: "fhj-cat-symptom", icon: "note", label: "Note",
    sub: "A line about today", desc: "A line about today, without the survey around it",
  },
  {
    id: "measurement", cat: "fhj-cat-symptom", icon: "target", label: "Measurement",
    sub: "Weight, steps", desc: "Straight to the keypad for a number you track",
    needs: "number",
  },
  {
    id: "diary", cat: "fhj-cat-food", icon: "calendar", label: "Diary",
    sub: "The whole day", desc: "The day's meals, totals and routine on one page",
  },
  /* ---- 1.21 ----
     Sun is the one tile in the row that starts something running rather than
     recording something finished, which is why it says "Start" rather than
     naming a quantity. */
  {
    id: "sun", cat: "fhj-cat-symptom", icon: "spark", label: "Sun",
    sub: "Start a session", desc: "Time outside, with the sun's own arithmetic attached",
  },
  {
    id: "lab", cat: "fhj-cat-symptom", icon: "target", label: "Lab result",
    sub: "A measured number", desc: "Blood work, blood pressure, weight — anything measured",
  },
  /* The only tile that logs a *week* rather than a moment. It appears solely
     for somebody who has turned the optional AI on, because reading shorthand
     is the whole job — see src/lib/import.ts. */
  {
    id: "import", cat: "fhj-cat-food", icon: "spark", label: "Import notes",
    sub: "Paste or screenshot", desc: "Read notes you kept elsewhere into the right days",
    needs: "ai",
  },
];

/* What each condition actually reaches for.

   A default set of four tiles that is right for everybody is right for
   nobody: somebody tracking POTS wants water and a heart rate, somebody
   tracking eczema wants a camera and a flare, and neither wants the other's.
   These are the tiles each pack suggests, in the order that pack would want
   them; `defaultQuickAdd` merges them for whatever combination somebody
   picked. Nothing here is binding — it is the starting arrangement of a
   screen the user owns and can edit from the tile row itself. */
const PACK_QUICK_ADD = {
  eczema: ["photo", "routine", "flare", "trigger"],
  ibs: ["bowel", "food", "trigger", "flare"],
  migraine: ["flare", "routine", "trigger", "water"],
  pots: ["water", "hr", "flare", "symptom"],
  fatigue: ["symptom", "flare", "note", "routine"],
  allergy: ["trigger", "routine", "flare", "food"],
  autoimmune: ["flare", "routine", "symptom", "trigger"],
  thyroid: ["routine", "measurement", "hr", "note"],
  joint: ["symptom", "flare", "routine", "trigger"],
  carnivore: ["food", "measurement", "photo", "diary"],
  wellness: ["note", "food", "measurement", "photo"],
};

/** The fallback for a journal with no packs at all, and the shape a saved
    empty list is measured against. */
const DEFAULT_QUICK_ADD = ["checkin", "food", "bowel", "photo"];

/** Check-in always leads — it is the one thing worth doing every day — and the
    packs fill the rest in the order they asked for. Six is the cap: a wall of
    tiles is a menu, and a menu is something you read rather than press. */
function defaultQuickAdd(modules) {
  const mods = Array.isArray(modules) ? modules : [];
  const out = ["checkin"];
  /* Round-robin rather than pack-by-pack: somebody tracking two conditions
     gets each one's first choice before either one's third. */
  const lists = mods.map((m) => PACK_QUICK_ADD[m]).filter(Boolean);
  if (!lists.length) return [...DEFAULT_QUICK_ADD];
  for (let i = 0; i < 4 && out.length < 6; i++) {
    for (const l of lists) {
      if (out.length >= 6) break;
      const id = l[i];
      if (id && !out.includes(id) && quickAddTile(id)) out.push(id);
    }
  }
  return out;
}

const quickAddTile = (id) => QUICK_ADD_TILES.find((t) => t.id === id);

/** Whether the person's own setup can honour a tile.

    A camera tile with no photo question behind it, a water tile in a journal
    that never asks about water, a heart-rate tile without the two numbers it
    compares — each of those is a button that opens an apology. They are not
    offered at all rather than offered and then explained. */
function tileSupported(tile, caps) {
  if (!tile) return false;
  if (!tile.needs) return true;
  return !!caps?.[tile.needs];
}

/** What a given setup can actually answer, and the fields the tiles write to.

    Derived from the template rather than from the pack list, so a question
    added or removed by hand in Edit Setup moves the buttons with it. Shared by
    the dashboard, the editor and the end of first run — three places that must
    agree about which buttons exist, or somebody is offered one that opens an
    apology. */
function quickAddContext(tpl) {
  const photoFields = tpl.fields.filter((f) => f.type === "photo");
  const numberFields = tpl.fields.filter((f) => f.type === "number");
  /* The main number first, then the ones marked quick, then the rest — which
     is the order somebody would tap them in. */
  const scaleFields = tpl.fields
    .filter((f) => f.type === "scale")
    .map((f, i) => ({ f, i, w: f.k === tpl.keyMetric ? 0 : f.quick ? 1 : 2 }))
    .sort((a, b) => a.w - b.w || a.i - b.i)
    .map((x) => x.f);
  const waterField = numberFields.find((f) => f.k === "water_intake" || /water/i.test(f.label)) || null;
  const hr = {
    rest: numberFields.find((f) => f.k === "resting_hr") || null,
    stand: numberFields.find((f) => f.k === "standing_hr") || null,
  };
  const triggerField = tpl.fields.find((f) => f.type === "chips" && f.k === "possible_triggers")
    || tpl.fields.find((f) => f.type === "chips" && /trigger/i.test(f.label)) || null;
  const keyField = tpl.fields.find((f) => f.k === tpl.keyMetric) || null;
  return {
    photoFields, numberFields, scaleFields, waterField, hr, triggerField, keyField,
    caps: {
      photo: photoFields.length > 0,
      number: numberFields.length > 0,
      scale: scaleFields.length > 0,
      water: !!waterField,
      hr: !!(hr.rest && hr.stand),
      trigger: !!triggerField,
      flare: !!(keyField && keyField.type === "scale"),
    },
  };
}

/** "1 cup", "3 cups". A tile that reads "1 cups so far" is a small thing and
    it is also the whole difference between software somebody trusts with
    their symptoms and software that was clearly never read out loud. */
function amountWithUnit(n, unit) {
  if (!unit) return String(n);
  const one = n === 1 && /s$/i.test(unit) ? unit.replace(/s$/i, "") : unit;
  return `${n} ${one}`;
}

/** Known ids only, no duplicates, order preserved. Runs on load and on save,
    because this list reaches the app from a hand-editable backup as readily as
    from the editor. An empty list is a real choice and survives — it means
    "don't show me Quick Add" — so `undefined` is the only thing that falls
    back to the default. */
function sanitizeQuickAdd(list) {
  if (!Array.isArray(list)) return undefined;
  const seen = new Set();
  const out = [];
  for (const id of list) {
    if (typeof id !== "string" || seen.has(id) || !quickAddTile(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** The ids to draw, after the user's choice, what their setup can actually
    support, and — only if they asked for it — what they actually use.

    **The order holds still.** This is the default now, and it used to be the
    opposite. Sorting the row by what somebody taps most is a good idea on
    paper and a bad one in the hand: the whole value of a button on a phone is
    that after a week the thumb goes there without the eyes, and a row that
    quietly re-sorts itself overnight spends that every time it is right. A
    misfire costs a wrong log to undo, and it costs the person the sense that
    they know their own screen.

    So the position of every button is the position it had yesterday, unless
    the person moved it — which they can now do by holding it and dragging,
    right there on the dashboard. Learned ordering still exists for anybody who
    wants it, one switch away in the editor, and `quickAddOrder: "auto"` is the
    only thing that turns it on. */
function resolveQuickAdd(profile, { caps, stats, today }) {
  const chosen = sanitizeQuickAdd(profile?.quickAdd) ?? defaultQuickAdd(profile?.modules);
  const usable = chosen.filter((id) => tileSupported(quickAddTile(id), caps));
  return rankIds(usable, stats || {}, today || todayStr(),
    profile?.quickAddOrder === "auto" ? "auto" : "manual");
}

/* A tile that knows what today looks like.

   Two of these change their own face: Check-in reads "Done today" once it is,
   and Flare becomes "End flare · day 6" while one is running. Everything the
   row draws that isn't in the catalogue arrives through `live` — one map, one
   place to look, and a tile that has nothing live about it is untouched. */
function tileFace(t, live) {
  const l = live?.[t.id];
  if (!l) return t;
  return { ...t, ...l };
}

/* ---------- hold, then move ----------

   The row of buttons on Today is the most-pressed thing in this app, and the
   thing that makes it fast is not the size of the tiles — it is that after a
   week the thumb knows where food is and goes there without the eyes. Which
   is why the order now holds still, and why *changing* it had to stop being a
   trip to a screen with little arrows on it. You move a button the way you
   move anything: hold it until it comes up, put it where you want it, let go.

   Press and keep pressing. A third of a second later the tile lifts under the
   finger — a heavier shadow, a degree of tilt, one tick from the haptic motor
   — and from that moment the row is a thing being rearranged rather than a set
   of buttons being pressed. Drag; the others slide out of the way and the gap
   follows the thumb. Let go; it lands in the gap, and that is the save.

   Three details are the whole difference between this and a list with arrows:

   **The hold is patient and the slop is small.** A finger that has moved ten
   pixels in the first third of a second is scrolling the page, not picking
   anything up, and a dashboard that steals that gesture feels broken in a way
   people cannot name but do not forgive. Movement before the hold cancels it,
   and everything up to that moment is still an ordinary tap that logs a meal.

   **The slots stand still; the tiles move between them.** Every position is
   measured once, at pick-up, and nothing is re-measured mid-drag. So a tile
   crossing from the end of one row to the start of the next travels a real
   diagonal, and the arrangement cannot jitter, because the layout it is
   compared against never changes underneath it.

   **The commit is invisible.** On release the tile animates into its slot, and
   only then does the stored order change — in a frame with every transition
   switched off, so the pixels before and after are identical. The instant the
   app writes down what happened is the one instant nothing moves.

   The gesture is an addition, not the only door: the editor still lists the
   buttons with arrows beside them, and Alt with an arrow key moves the focused
   tile for anybody driving this from a keyboard. */

const HOLD_MS = 320;
const HOLD_SLOP = 10;
const LAND_MS = 220;

/** How many tiles share the top row, read off the measured slots rather than
    assumed — the grid is two across on a phone and this code should not be the
    reason that can never change. */
function columnsOf(rects) {
  if (!rects || !rects.length) return 1;
  let cols = 0;
  for (const r of rects) if (Math.abs(r.top - rects[0].top) < 1) cols++;
  return Math.max(1, cols);
}

function useHoldToReorder({ ids, onReorder, nameOf, enabled = true }) {
  const boxRef = useRef(null);
  const hintId = useId();
  /* The live gesture, deliberately in a ref: a finger moving produces sixty
     events a second and none of them are state — the only thing worth a
     re-render is which slot the gap is in. */
  const sess = useRef(null);
  const geom = useRef(null);
  const blockClick = useRef(false);
  const [drag, setDrag] = useState(null);
  const [announce, setAnnounce] = useState("");
  const on = enabled && ids.length > 1 && typeof onReorder === "function";

  function release() {
    const s = sess.current;
    if (!s) return;
    sess.current = null;
    window.clearTimeout(s.timer);
    window.removeEventListener("pointermove", s.onMove, true);
    window.removeEventListener("pointerup", s.onUp, true);
    window.removeEventListener("pointercancel", s.onUp, true);
    document.removeEventListener("touchmove", s.holdScroll);
  }

  /* A screen that unmounts mid-drag — a sheet closing, a tab change — must not
     leave window listeners behind. */
  useEffect(() => release, []);

  /** Where every tile is, relative to the row itself, at the moment of lift. */
  function measure() {
    const box = boxRef.current;
    if (!box) return null;
    const origin = box.getBoundingClientRect();
    const nodes = [...box.querySelectorAll("[data-sort]")];
    const rects = nodes.map((n) => {
      const r = n.getBoundingClientRect();
      return { left: r.left - origin.left, top: r.top - origin.top, width: r.width, height: r.height };
    });
    return { origin, nodes, rects };
  }

  const still = () => prefersReducedMotion();
  const lifted = (dx, dy) =>
    still()
      ? `translate3d(${dx}px, ${dy}px, 0)`
      : `translate3d(${dx}px, ${dy}px, 0) scale(1.045) rotate(-0.75deg)`;

  function lift() {
    const s = sess.current;
    if (!s) return;
    const m = measure();
    /* If the row is not the shape we think it is, this stays a tap. Half a
       drag against a stale layout would put a button somewhere nobody asked
       for, and the one unacceptable outcome here is a silent wrong move. */
    if (!m || m.rects.length !== ids.length) { release(); return; }
    s.active = true;
    geom.current = m.rects;
    s.origin = m.origin;
    s.node.style.transition = "none";
    s.node.style.transform = lifted(0, 0);
    try { s.node.setPointerCapture(s.pointerId); } catch { /* capture is a nicety */ }
    feedback("reorder");
    setDrag({ from: s.i, to: s.i });
  }

  function onMove(ev) {
    const s = sess.current;
    if (!s) return;
    const dx = ev.clientX - s.startX;
    const dy = ev.clientY - s.startY;
    if (!s.active) {
      if (Math.abs(dx) > HOLD_SLOP || Math.abs(dy) > HOLD_SLOP) release();
      return;
    }
    s.node.style.transform = lifted(dx, dy);
    const to = slotAt(geom.current, ev.clientX - s.origin.left, ev.clientY - s.origin.top, s.to);
    if (to !== s.to) {
      s.to = to;
      feedback("reorder");
      setDrag({ from: s.i, to });
    }
  }

  function onUp() {
    const s = sess.current;
    if (!s) return;
    if (!s.active) { release(); return; } // a tap: the click behind it is real
    const { i, to, node } = s;
    const rects = geom.current || [];
    /* The click that follows a drag would log a meal nobody asked to log. */
    blockClick.current = true;
    release();

    const settle = () => {
      const box = boxRef.current;
      /* The one frame where the saved order changes. Transitions off, so the
         tiles' inline offsets and the DOM order swap places without a pixel
         moving. */
      if (box) box.classList.add("is-settling");
      node.style.transition = "";
      node.style.transform = "";
      geom.current = null;
      setDrag(null);
      if (to !== i) {
        onReorder(moveItem(ids, i, to));
        setAnnounce(describeMove(nameOf?.(ids[i]) || "Button", to, ids.length));
      }
      if (box) requestAnimationFrame(() => requestAnimationFrame(() => box.classList.remove("is-settling")));
      window.setTimeout(() => { blockClick.current = false; }, 80);
    };

    if (still() || !rects[i] || !rects[to]) { settle(); return; }
    node.style.transition = `transform ${LAND_MS}ms var(--fhj-out)`;
    node.style.transform =
      `translate3d(${rects[to].left - rects[i].left}px, ${rects[to].top - rects[i].top}px, 0)`;
    feedback("tap");
    window.setTimeout(settle, LAND_MS);
  }

  function onDown(e, i) {
    if (!on || sess.current) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const s = {
      i, to: i, active: false, node: e.currentTarget, pointerId: e.pointerId,
      startX: e.clientX, startY: e.clientY, timer: 0,
      onMove, onUp,
      /* Registered on the way down rather than on lift: by the time a drag is
         under way the browser has already decided whether this touch is a
         scroll, and a listener added afterwards is too late to say otherwise.
         It refuses nothing until the tile is actually in the air. */
      holdScroll: (ev) => { if (sess.current?.active) ev.preventDefault(); },
    };
    sess.current = s;
    window.addEventListener("pointermove", s.onMove, true);
    window.addEventListener("pointerup", s.onUp, true);
    window.addEventListener("pointercancel", s.onUp, true);
    document.addEventListener("touchmove", s.holdScroll, { passive: false });
    s.timer = window.setTimeout(lift, HOLD_MS);
  }

  /** The keyboard's version of the same gesture. Alt is deliberate: Space and
      Enter belong to the button itself and always will — the tile's job is to
      log something, and a reordering scheme that took the key that logs things
      would be a worse bargain than no reordering at all. */
  function onKeyDown(e, i) {
    if (!on || !(e.altKey || e.metaKey)) return;
    const m = measure();
    const cols = columnsOf(m?.rects);
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols, ArrowDown: cols }[e.key];
    if (!step) return;
    const to = Math.max(0, Math.min(ids.length - 1, i + step));
    e.preventDefault();
    if (to === i) return;
    feedback("reorder");
    onReorder(moveItem(ids, i, to));
    setAnnounce(describeMove(nameOf?.(ids[i]) || "Button", to, ids.length));
  }

  const offsets = drag && geom.current ? shiftOffsets(geom.current, drag.from, drag.to) : null;

  const itemProps = (i) => {
    if (!on) return {};
    const isUp = drag?.from === i;
    const o = !isUp && offsets ? offsets[i] : null;
    return {
      "data-sort": i,
      "aria-describedby": hintId,
      onPointerDown: (e) => onDown(e, i),
      onKeyDown: (e) => onKeyDown(e, i),
      onContextMenu: (e) => { if (sess.current?.active) e.preventDefault(); },
      onClickCapture: (e) => {
        if (!blockClick.current) return;
        e.preventDefault();
        e.stopPropagation();
      },
      className: isUp ? " is-lifted" : "",
      style: isUp
        ? { position: "relative", zIndex: 6, touchAction: "none" }
        : o && (o.dx || o.dy)
          ? { transform: `translate3d(${o.dx}px, ${o.dy}px, 0)` }
          : undefined,
    };
  };

  /* The gap where the tile will land, the sentence a screen reader hears when
     it lands there, and — said once and pointed at by every tile — the fact
     that any of this is possible at all. All three are out of flow, so a row
     that can be rearranged lays out exactly like one that cannot. */
  const chrome = on ? (
    <>
      {drag && geom.current && geom.current[drag.to] && (
        <span aria-hidden="true" className="fhj-sort-gap" style={{
          left: geom.current[drag.to].left, top: geom.current[drag.to].top,
          width: geom.current[drag.to].width, height: geom.current[drag.to].height,
        }} />
      )}
      <span id={hintId} className="sr-only">
        Hold to move this button, or hold Alt and press an arrow key.
      </span>
      <span className="sr-only" role="status" aria-live="polite">{announce}</span>
    </>
  ) : null;

  return { boxRef, itemProps, chrome, sorting: !!drag, on };
}

function QuickAdd({ ids, actions, live, onReorder }) {
  const tiles = ids.map(quickAddTile).filter((t) => t && actions[t.id]);
  const sort = useHoldToReorder({
    ids: tiles.map((t) => t.id),
    onReorder,
    nameOf: (id) => quickAddTile(id)?.label,
  });
  if (!tiles.length) return null;

  return (
    <div ref={sort.boxRef} className={`fhj-tiles fhj-sortable${sort.sorting ? " is-sorting" : ""}`}>
      {sort.chrome}
      {tiles.map((base, i) => {
        const t = tileFace(base, live);
        const held = sort.itemProps(i);
        return (
          <button key={t.id} type="button" {...held}
            /* The third channel. Sound needs a speaker and haptics need a
               motor; this reaches the person who has neither — and on the
               most-tapped control in the app, that matters most. */
            onClick={(e) => { feedback("quickadd", { el: e.currentTarget }); actions[t.id](); }}
            className={`fhj-tile fhj-pop ${t.cat}${t.done ? " is-done" : ""}${held.className || ""}`}>
            <span className="fhj-tile-icon">
              <Icon name={t.done ? "check" : t.icon} size={17} color="currentColor" />
            </span>
            <span>
              <span className="fhj-tile-label block">{t.label}</span>
              <span className="fhj-tile-sub block">{t.sub}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Choose the tiles and their order.

    Reorder is up/down arrows rather than drag-and-drop, matching how the
    question list in Edit Setup already works — this app has one reordering
    idiom and it is this one. Nothing is applied until Save, so a fiddle that
    goes wrong costs a Cancel rather than a repair. */
function QuickAddEditor({ profile, caps, stats, onSave, onClose }) {
  const [manual, setManual] = useState(profile?.quickAddOrder !== "auto");
  const [order, setOrder] = useState(() => {
    const chosen = sanitizeQuickAdd(profile?.quickAdd) ?? defaultQuickAdd(profile?.modules);
    /* Opened while the order is learned, the list shows what is actually on
       screen — otherwise the first thing somebody does here is move a tile
       that was already in that position, and the arrows appear broken. */
    return profile?.quickAddOrder === "auto"
      ? rankIds(chosen, stats || {}, todayStr(), "auto")
      : chosen;
  });
  const available = QUICK_ADD_TILES.filter((t) => tileSupported(t, caps));
  const off = available.filter((t) => !order.includes(t.id));
  /* What this person's own conditions reach for, minus whatever they already
     have. Named as a suggestion rather than slipped in silently: the list is
     theirs, and the app is allowed to have an opinion but not a vote. */
  const suggested = defaultQuickAdd(profile?.modules)
    .filter((id) => !order.includes(id) && tileSupported(quickAddTile(id), caps));

  /* Moving a tile *is* the decision to arrange them by hand. Making somebody
     find a switch first, and then discover their arrangement was ignored
     because they hadn't, is the worst of both. */
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    feedback("tap");
    setManual(true);
    setOrder((prev) => {
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };
  const remove = (id) => { feedback("tap"); setOrder((prev) => prev.filter((x) => x !== id)); };
  const add = (id) => { feedback("tap"); setOrder((prev) => [...prev, id]); };

  return (
    <Modal title="Edit Quick Add" onClose={onClose}>
      <p className="text-[12.5px] leading-relaxed mb-3" style={{ color: C.sub }}>
        Pick the buttons you want on the dashboard. They stay exactly where you put them — use the
        arrows here, or hold any button on the dashboard and drag it where you want it.
      </p>

      <SwitchRow on={!manual}
        onChange={(v) => {
          feedback("select");
          setManual(!v);
          if (v) setOrder((prev) => rankIds(prev, stats || {}, todayStr(), "auto"));
        }}
        label="Let the order follow what I use most"
        desc={manual
          ? "Off — your buttons stay exactly where you put them."
          : "On — the ones you tap most often move themselves to the front, and the row can look different tomorrow."} />

      {suggested.length > 0 && (
        <div className="mb-3">
          <div className="fhj-eyebrow mb-1.5">Suggested for what you track</div>
          <div className="flex flex-wrap gap-1.5">
            {suggested.map((id) => {
              const t = quickAddTile(id);
              return (
                <button key={id} type="button" onClick={() => add(id)}
                  aria-label={`Add ${t.label} to Quick Add`}
                  className="flex items-center gap-1.5 pl-2 pr-3 py-1.5 rounded-full text-[12px] font-semibold"
                  style={{ background: C.accentSoft, color: C.accentText,
                    border: `1px solid ${C.accentLine}` }}>
                  <Icon name="plus" size={12} color={C.accentText} />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="fhj-eyebrow mb-1.5">On the dashboard</div>
      {order.length === 0 ? (
        <p className="text-[12px] leading-relaxed px-3 py-4 rounded-xl mb-3"
          style={{ background: C.faint, color: C.subtle }}>
          Nothing selected — the Quick Add section will be hidden entirely.
        </p>
      ) : (
        <div className="rounded-xl overflow-hidden mb-3" style={{ border: `1px solid ${C.line}` }}>
          {order.map((id, i) => {
            const t = quickAddTile(id);
            if (!t) return null;
            return (
              <div key={id} className={`flex items-center gap-1.5 px-2.5 py-2 ${t.cat}`}
                style={{ borderTop: i ? `1px solid ${C.line}` : "none" }}>
                <span className="fhj-tl-dot shrink-0" style={{ width: "1.75rem", height: "1.75rem" }}>
                  <Icon name={t.icon} size={13} color="currentColor" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] font-semibold truncate" style={{ color: C.ink }}>{t.label}</span>
                  <span className="block text-[10.5px] truncate" style={{ color: C.subtle }}>{t.desc}</span>
                </span>
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
                  aria-label={`Move ${t.label} up`} className="fhj-icon-btn shrink-0"
                  style={{ width: "2rem", height: "2rem" }}>
                  <Icon name="up" size={14} color={C.sub} />
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === order.length - 1}
                  aria-label={`Move ${t.label} down`} className="fhj-icon-btn shrink-0"
                  style={{ width: "2rem", height: "2rem" }}>
                  <Icon name="down" size={14} color={C.sub} />
                </button>
                <button type="button" onClick={() => remove(id)}
                  aria-label={`Remove ${t.label} from Quick Add`} className="fhj-icon-btn shrink-0"
                  style={{ width: "2rem", height: "2rem" }}>
                  <Icon name="x" size={14} color={C.sub} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {off.length > 0 && (
        <>
          <div className="fhj-eyebrow mb-1.5">Not shown</div>
          <div className="rounded-xl overflow-hidden mb-3" style={{ border: `1px solid ${C.line}` }}>
            {off.map((t, i) => (
              <button key={t.id} type="button" onClick={() => add(t.id)}
                className="w-full flex items-center gap-1.5 px-2.5 py-2 text-left fhj-row"
                style={{ borderTop: i ? `1px solid ${C.line}` : "none" }}>
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] font-semibold truncate" style={{ color: C.ink }}>{t.label}</span>
                  <span className="block text-[10.5px] truncate" style={{ color: C.subtle }}>{t.desc}</span>
                </span>
                <span className="fhj-icon-btn shrink-0" style={{ width: "2rem", height: "2rem" }} aria-hidden="true">
                  <Icon name="plus" size={14} color={C.accentText} />
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {QUICK_ADD_TILES.some((t) => !tileSupported(t, caps)) && (
        <p className="text-[11px] leading-relaxed mb-3" style={{ color: C.subtle }}>
          Some buttons — photos, water, heart rate, triggers — only appear once your setup has a
          question behind them. Add one in Edit Setup and the button turns up here.
        </p>
      )}

      <div className="flex gap-2 mt-4">
        <Button variant="ghost" size="sm"
          onClick={() => { feedback("tap"); setManual(true); setOrder(defaultQuickAdd(profile?.modules).filter((id) => tileSupported(quickAddTile(id), caps))); }}>
          Reset
        </Button>
        <div className="flex-1" />
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={() => { feedback("save"); onSave(order, manual ? "manual" : "auto"); }}>Save</Button>
      </div>
    </Modal>
  );
}

/* ---------- Today's Logs ----------
   Everything logged today in the order it happened, whatever kind it is. The
   daily check-in has no clock time of its own, so it borrows the moment it was
   first saved — which is the honest answer and keeps the ordering stable. */

function timeOfEntry(entry) {
  const iso = entry?.createdAt || entry?.updatedAt;
  if (!iso) return "00:00";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "00:00" : localTime(d);
}

function TimelineRow({ cat, icon, time, title, meta, badge, thumbId, onClick }) {
  const src = usePhoto(thumbId, "thumb");
  const Row = onClick ? "button" : "div";
  return (
    <Row
      {...(onClick ? { type: "button", onClick } : {})}
      className={`fhj-tl-item ${cat} w-full text-left`}>
      <span className="fhj-tl-gutter">
        <span className="fhj-tl-dot"><Icon name={icon} size={11} color="currentColor" /></span>
      </span>
      <span className="fhj-tl-body">
        <span className="flex items-center gap-2 flex-wrap">
          {time && <span className="fhj-tl-time">{prettyTime(time)}</span>}
          {badge}
        </span>
        <span className="fhj-tl-title block">{title}</span>
        {meta && <span className="fhj-tl-meta block">{meta}</span>}
      </span>
      {thumbId && (
        <span className="w-11 h-11 rounded-lg overflow-hidden shrink-0 self-center"
          style={{ border: `1.5px solid ${C.line}`, background: C.faint }}>
          {src ? <img src={src} alt="" className="fhj-photo" /> : null}
        </span>
      )}
    </Row>
  );
}

function TodayTimeline({ entry, tpl, food, bowel, routine = [], date, onOpenEntry, onOpenFood, onOpenBowel, onOpenRoutine }) {
  const rows = [];

  if (entry) {
    const v = entry.answers?.[tpl.keyMetric];
    const keyField = getField(tpl, tpl.keyMetric);
    const answered = Object.values(entry.answers || {}).filter((x) => x != null && x !== "").length;
    rows.push({
      key: `entry_${entry.id}`, time: timeOfEntry(entry), cat: "fhj-cat-symptom", icon: "log",
      title: "Daily check-in",
      meta: [
        keyField && v != null ? `${keyField.label}: ${v}` : null,
        `${answered} answer${answered === 1 ? "" : "s"}`,
      ].filter(Boolean).join(" · "),
      onClick: () => onOpenEntry(date),
    });
  }

  for (const f of foodOn(food, date)) {
    rows.push({
      key: f.id, time: f.time, cat: "fhj-cat-food", icon: "food",
      title: f.description?.trim() || f.ai?.identified || mealLabel(f.meal),
      meta: [mealLabel(f.meal), foodSummary(f)].filter(Boolean).join(" · "),
      badge: hasAiValues(f) ? <span className="fhj-ai-badge">AI Estimated</span> : null,
      thumbId: f.photoId,
      onClick: () => onOpenFood(f),
    });
  }

  for (const b of bowelOn(bowel, date)) {
    rows.push({
      key: b.id, time: b.time, cat: "fhj-cat-bowel", icon: "bowel",
      title: "Bowel movement",
      meta: bowelSummary(b) || "Logged",
      /* Same rule as food: a value the model supplied says so wherever it is
         shown, not only in the sheet it was written in. */
      badge: aiFilledBowelFields(b).length > 0
        ? <span className="fhj-ai-badge">AI Filled In</span>
        : null,
      thumbId: b.photoId,
      onClick: () => onOpenBowel(b),
    });
  }

  for (const r of routineOn(routine, date)) {
    rows.push({
      key: r.id, time: r.time, cat: "fhj-cat-routine", icon: kindDef(r.kind).icon,
      title: r.name,
      meta: routineSummary(r) || kindLabel(r.kind),
      onClick: () => onOpenRoutine(r),
    });
  }

  rows.sort((a, b) => String(a.time).localeCompare(String(b.time)));

  /* Deliberately small. This is the most-seen state on the most-seen screen —
     every morning starts here — and it has nothing to report, so it takes one
     row rather than the 480px illustrated panel it used to. The big empty
     states elsewhere in the app are for screens that would otherwise be blank;
     this one sits directly under four buttons that answer it. */
  if (!rows.length) {
    return (
      <Card className="!p-3.5" style={{ padding: "0.875rem" }}>
        <div className="flex items-center gap-3 fhj-cat-symptom">
          <span className="fhj-tl-dot shrink-0"><Icon name="clock" size={13} color="currentColor" /></span>
          <span className="text-[12.5px] leading-snug" style={{ color: C.subtle }}>
            Nothing logged yet — whatever you add above appears here, in order.
          </span>
        </div>
      </Card>
    );
  }

  return (
    <Card className="!py-1.5" style={{ paddingTop: "0.375rem", paddingBottom: "0.375rem" }}>
      <div className="fhj-tl">
        {rows.map(({ key, ...row }) => <TimelineRow key={key} {...row} />)}
      </div>
    </Card>
  );
}

/** Today's food totals, shown under the hero number when there is anything to
    show. Says when a total leans on an estimate rather than quietly folding
    the two together. */
function TodayNutritionStrip({ food, date }) {
  const totals = dayTotals(food, date);
  if (!totals.meals) return null;
  const shown = NUTRIENTS.filter((n) => n.primary && totals[n.k] != null);
  if (!shown.length) {
    return (
      <div className="text-[11px] mt-3 pt-3" style={{ color: C.subtle, borderTop: `1px solid ${C.line}` }}>
        {totals.meals} meal{totals.meals === 1 ? "" : "s"} logged · no nutrition recorded
      </div>
    );
  }
  return (
    <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${C.line}` }}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="fhj-eyebrow">Food today</span>
        {totals.partlyEstimated && <span className="fhj-ai-badge">Partly estimated</span>}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {shown.map((n) => (
          <div key={n.k} className="flex items-baseline gap-1">
            <span className="text-sm font-bold tabular-nums" style={{ color: C.ink }}>
              {formatNutrient(n.k, totals[n.k])}
            </span>
            <span className="text-[10px]" style={{ color: C.subtle }}>{n.unit === "kcal" ? "kcal" : `${n.unit} ${n.label.toLowerCase()}`}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   Today — the first screen, and the only one most opens need
   ============================================================ */

/** Time-of-day greeting. Small thing, but it is the difference between an app
    that opens with its own name — which the user already knows, they tapped
    the icon — and one that opens by acknowledging the person holding it. */
function greetingFor(d = new Date(), name = "") {
  const h = d.getHours();
  const hello = h < 5 ? "Still up" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  /* First name only. A journal that greets somebody by their full legal name
     is not greeting them, and the name field takes whatever they typed. */
  const first = (name || "").trim().split(/\s+/)[0];
  return first ? `${hello}, ${first}` : hello;
}

/** One-tap repeat.

    The food library already knows what someone eats over and over; until now
    it only paid out *inside* the picker, three taps deep. These are the same
    rows, hoisted onto the first screen: tap the chip, the meal is logged at
    the current time under whichever category the clock implies, and the toast
    offers an Undo. That is the shortest path this app has to anything.

    Frequency beats recency here on purpose. "Recent" puts the one-off you
    logged yesterday at the front; "frequent" puts the coffee you have every
    morning there, which is the thing a repeat button is for. */
/* One tap, again.

   The second time somebody logs a thing is the tap this row exists to save,
   and it does not care what kind of thing it is: the porridge they have every
   morning, the cream they put on twice a day, the arm they photograph on
   Sundays, the weight they record on Mondays. They are ranked against each
   other by the same score (see src/lib/quickActions.ts), so this is the
   person's own week in their own order rather than a menu of everything the
   app can do. */
function QuickRepeats({ items, onRun, onOpenPicker }) {
  if (!items.length) return null;
  return (
    <>
      <div className="fhj-section mt-6 fhj-cat-symptom">
        <h2 className="fhj-section-title">Again</h2>
        {onOpenPicker && (
          <button type="button" onClick={onOpenPicker}
            className="text-[11px] font-semibold" style={{ color: C.accentText }}>
            All foods
          </button>
        )}
      </div>
      <Rail label="Do something again">
        {items.map((item) => (
          <button key={item.id} type="button" role="listitem"
            onClick={(e) => { feedback("quickadd", { el: e.currentTarget }); onRun(item); }}
            aria-label={`${item.kind === "food" ? "Log" : item.kind === "photo" ? "Take" : "Add"} ${item.label} again`}
            className={"fhj-repeat fhj-pop " + REPEAT_CAT[item.kind]}>
            <span className="fhj-repeat-name">
              <Icon name={item.icon} size={12} color="currentColor" /> {item.label}
            </span>
            <span className="fhj-repeat-meta">{item.sub}</span>
          </button>
        ))}
      </Rail>
    </>
  );
}

/* How long the "bring your old notes in" offer stays on Today. Two weeks of
   logged days is the point where a journal has its own history and an offer to
   import somebody else's app becomes clutter. */
const IMPORT_INVITE_UNTIL_DAYS = 14;

const REPEAT_CAT = {
  food: "fhj-cat-food", routine: "fhj-cat-routine", photo: "fhj-cat-photo",
  measurement: "fhj-cat-symptom", note: "fhj-cat-symptom",
};

function RepeatRow({ library, onLog, onOpenPicker }) {
  const items = useMemo(() => {
    /* Everything the library knows, most-logged first — including a food
       logged exactly once. Waiting for a second log before offering the
       one-tap repeat had it backwards: the second time is precisely the tap
       this row exists to save. */
    const frequent = browseFoods(library, "frequent");
    const favourites = browseFoods(library, "favorite");
    /* Favourites first — they are an explicit "I will want this again" — then
       whatever the counts say, de-duped. */
    const seen = new Set();
    const out = [];
    for (const f of [...favourites, ...frequent]) {
      if (seen.has(f.id)) continue;
      seen.add(f.id);
      out.push(f);
    }
    return out.slice(0, 8);
  }, [library]);

  if (!items.length) return null;

  return (
    <>
      <div className="fhj-section mt-6 fhj-cat-food">
        <h2 className="fhj-section-title">Again</h2>
        <button type="button" onClick={onOpenPicker}
          className="text-[11px] font-semibold" style={{ color: C.accentText }}>
          All foods
        </button>
      </div>
      <Rail label="Log a food again" className="fhj-cat-food">
        {items.map((item) => {
          const cal = item.nutrition?.calories;
          return (
            <button key={item.id} type="button" role="listitem"
              onClick={() => { feedback("save"); onLog(item); }}
              aria-label={`Log ${item.name} again`}
              className="fhj-repeat fhj-pop">
              <span className="fhj-repeat-name">{item.name}</span>
              <span className="fhj-repeat-meta">
                {item.serving}
                {cal != null && ` · ${formatNutrient("calories", cal)} kcal`}
              </span>
            </button>
          );
        })}
      </Rail>
    </>
  );
}

/** The invitation a new journal needs, and an old one does not.

    Almost nobody arrives at a health journal having tracked nothing. They have
    months of it — in a notes file, a chat with themselves, a photo of a page —
    and the reason it never gets in is that typing it back in one sheet at a
    time is an hour of work. Import does it in about a minute, and the whole
    problem with Import is that it lives behind a button in a menu, which is
    exactly where somebody in their first week will not look.

    So it is offered, once, where they are: under the day, for as long as the
    journal is young enough for it to be worth doing. Three things keep it an
    invitation rather than a nag.

    **It retires itself.** Past two weeks of logged days the journal has its own
    history and this stops appearing, whether or not anybody dismissed it.

    **It can be sent away for good**, and that is stored, so it never comes back
    on the next launch to ask again.

    **It never pretends.** Import needs the optional AI, so when that is off the
    card says so in its own copy and its button goes to Settings — an offer that
    quietly turns into a setup screen is a bait, and this app does not have any
    of those. */
function ImportInvite({ aiReady, onImport, onSetup, onDismiss }) {
  return (
    <Card className="mt-6 fhj-invite">
      <div className="flex items-start gap-3">
        <span className="fhj-invite-mark"><Icon name="spark" size={15} color={C.accentText} /></span>
        <div className="min-w-0 flex-1">
          <div className="fhj-eyebrow mb-1">Been tracking somewhere else?</div>
          <h2 className="font-display text-[1.1rem] leading-tight mb-1.5">Bring those notes in</h2>
          <p className="text-[12.5px] leading-relaxed" style={{ color: C.sub }}>
            A notes file, a chat with yourself, a photo of a page. Paste it or drop a
            screenshot in, and it lands as meals, doses, numbers and notes{" "}
            <b style={{ color: C.ink }}>on the days your own notes give</b> — months of shorthand
            in about a minute. You approve every row before a word of it is written.
            {!aiReady && " It needs the optional AI switched on first, because reading shorthand is the whole job."}
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <Button size="sm" icon={aiReady ? "download" : "key"} onClick={aiReady ? onImport : onSetup}>
              {aiReady ? "Import my notes" : "Set it up"}
            </Button>
            <Button size="sm" variant="ghost" onClick={onDismiss}>Not for me</Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

/** The one-line answer to "how is today going", and the doorway to the screen
    that answers it properly. Deliberately a summary and not a chart: this
    screen is for doing, not for reading. */
function GlanceCard({ tpl, keyField, entry, food, streak, onOpen }) {
  const v = entry?.answers?.[tpl.keyMetric];
  const totals = dayTotals(food, todayStr());

  /* Only facts that exist. An em dash standing in for "not logged" read as a
     value in its own right, and sat immediately beside the calorie count —
     "Overall skin severity — 420 kcal" is a sentence nobody meant to write.
     A stat with no number simply isn't a stat yet. */
  const stats = [
    v != null && keyField
      ? { label: keyField.label, value: String(v), tone: colorFor(v, keyField.dir) }
      : null,
    totals.calories != null
      ? { label: "eaten", value: `${formatNutrient("calories", totals.calories)} kcal` }
      : null,
    streak > 0 ? { label: "streak", value: `${streak} ${streak === 1 ? "day" : "days"}` } : null,
  ].filter(Boolean);

  return (
    <button type="button" onClick={() => { feedback("nav"); onOpen(); }}
      className="w-full text-left mt-6" aria-label="Open Insights">
      <Card tappable className="!p-4" style={{ padding: "1rem" }}>
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="fhj-eyebrow mb-2">How you're doing</div>
            {stats.length ? (
              <div className="flex items-baseline gap-x-4 gap-y-1 flex-wrap">
                {stats.map((s) => (
                  <span key={s.label} className="flex items-baseline gap-1.5">
                    <b className="text-[15px] font-bold tabular-nums leading-none"
                      style={{ color: s.tone || C.ink }}>{s.value}</b>
                    <span className="text-[11.5px]" style={{ color: C.subtle }}>{s.label}</span>
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-[13px]" style={{ color: C.subtle }}>
                Trends, patterns and reports from what you've logged
              </div>
            )}
          </div>
          <Icon name="right" size={16} color={C.subtle} />
        </div>
      </Card>
    </button>
  );
}

/* ============================================================
   The + sheet
   ============================================================

   One button in the middle of the navigation bar, and everything a day can
   hold behind it. This is the half of the navigation rebuild that matters:
   five tabs made the app a filing cabinet you had to know your way around,
   where "log a meal" and "log a dose" lived on different shelves. There is one
   verb — add — and it is always in the same place, always one tap from
   anywhere, and it says what it can do rather than making somebody remember.

   Everything here is a thing you *add to today*. Reading what is already
   there is Today and History; this sheet only ever writes. */

/* What the + sheet offers is what the person put on their own dashboard.

   It used to be a fixed list of seven, which meant the app had two different
   opinions about what a day can hold — the tiles somebody chose, and this.
   Somebody who had turned Bowel off still got it here, and somebody who had
   added Heart rate did not. One list, chosen once, honoured in both places:
   the row on Today and the sheet behind the +. Everything else the app can
   still do is one tap further down, under "Everything else", so nothing is
   lost by curating — which is the whole reason curating is safe. */
/** One tile in the sheet. Defined out here rather than inside AddSheet on
    purpose: a component declared inside a render is a new component type every
    render, and React unmounts and rebuilds it each time — which is invisible
    until a tile is being dragged, at which point the node under the finger is
    replaced mid-gesture. */
function AddTile({ base, live, run, held = {} }) {
  const t = tileFace(base, live);
  return (
    <button type="button" {...held} onClick={run(t)}
      className={`fhj-add-tile fhj-pop ${t.cat}${held.className || ""}`}>
      <span className="fhj-tile-icon"><Icon name={t.done ? "check" : t.icon} size={18} color="currentColor" /></span>
      <span>
        <span className="fhj-tile-label block">{t.label}</span>
        <span className="fhj-tile-sub block">{t.sub}</span>
      </span>
    </button>
  );
}

function AddSheet({ ids, actions, live, caps, onEdit, onReorder, onClose }) {
  const [all, setAll] = useState(false);
  const chosen = ids.map(quickAddTile).filter((t) => t && actions[t.id]);
  const rest = QUICK_ADD_TILES
    .filter((t) => tileSupported(t, caps) && actions[t.id] && !ids.includes(t.id));
  const run = (t) => (e) => { feedback("quickadd", { el: e.currentTarget }); onClose(); actions[t.id](); };
  /* The same arrangement, movable from the same gesture. The sheet and the
     dashboard have always shown one list; they now edit it the same way too,
     so nobody has to discover the gesture twice or wonder which screen owns
     the order. */
  const sort = useHoldToReorder({
    ids: chosen.map((t) => t.id),
    onReorder,
    nameOf: (id) => quickAddTile(id)?.label,
  });

  return (
    <Modal title="Add to today" eyebrow="What happened?" onClose={onClose}>
      {chosen.length > 0 ? (
        <div ref={sort.boxRef} className={`fhj-add-grid fhj-sortable${sort.sorting ? " is-sorting" : ""}`}>
          {sort.chrome}
          {chosen.map((t, i) => (
            <AddTile key={t.id} base={t} live={live} run={run} held={sort.itemProps(i)} />
          ))}
        </div>
      ) : (
        <p className="text-[12.5px] leading-relaxed px-3 py-4 rounded-xl"
          style={{ background: C.faint, color: C.subtle }}>
          You have no buttons chosen — everything the app can add to a day is below.
        </p>
      )}

      {rest.length > 0 && (all || chosen.length === 0) && (
        <>
          <div className="fhj-eyebrow mt-4 mb-2">Everything else</div>
          <div className="fhj-add-grid">
            {rest.map((t) => <AddTile key={t.id} base={t} live={live} run={run} />)}
          </div>
        </>
      )}

      <div className="flex items-center justify-between gap-2 mt-4">
        {rest.length > 0 && chosen.length > 0 ? (
          <button type="button" onClick={() => { feedback("tap"); setAll((v) => !v); }}
            aria-expanded={all}
            className="flex items-center gap-1 text-[12px] font-semibold" style={{ color: C.sub }}>
            {all ? "Show less" : `Everything else (${rest.length})`}
            <Icon name={all ? "up" : "down"} size={12} color={C.sub} />
          </button>
        ) : <span />}
        {onEdit && (
          <button type="button" onClick={() => { feedback("tap"); onClose(); onEdit(); }}
            className="text-[12px] font-semibold" style={{ color: C.accentText }}>
            Edit these buttons
          </button>
        )}
      </div>
    </Modal>
  );
}

/** A line about today, on its own, without the survey around it. */
function NoteSheet({ initial, suggestions = [], onSave, onClose }) {
  const [text, setText] = useState(initial || "");
  return (
    <Modal title="Note" eyebrow="Today" onClose={onClose}
      footer={
        <Button block disabled={!text.trim()}
          onClick={() => { feedback("save"); onSave(text.trim()); }}>
          Save note
        </Button>
      }>
      <textarea rows={4} autoFocus value={text} onChange={(e) => setText(e.target.value)}
        aria-label="Note for today"
        placeholder="Anything worth remembering about today…"
        className="w-full rounded-xl px-3 py-2.5 text-sm outline-none resize-none"
        style={{ background: C.faint, border: `1px solid ${C.line}` }} />
      {suggestions.length > 0 && !text && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {suggestions.map((n) => (
            <button key={n} type="button" onClick={() => { feedback("tap"); setText(n); }}
              className="px-3 py-1.5 rounded-full text-xs" style={{ background: C.faint, color: C.sub }}>
              “{n.length > 34 ? n.slice(0, 34) + "…" : n}”
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}

/** Weight, steps, water — the numbers in a setup, straight to the keypad.

    Which numbers exist is the person's own setup, so this lists them rather
    than assuming weight; with exactly one it skips the list entirely, because
    a menu of one is a tap somebody had to make for no reason. */
function MeasurementSheet({ fields, answers, ghosts, date, onSave, onClose }) {
  const [picked, setPicked] = useState(() => (fields.length === 1 ? fields[0] : null));
  if (picked) {
    return (
      <NumberPadSheet field={picked} value={answers[picked.k]} ghost={ghosts?.[picked.k]}
        onCommit={(v) => { onSave(picked.k, v); onClose(); }}
        onClose={() => (fields.length === 1 ? onClose() : setPicked(null))} />
    );
  }
  return (
    <Modal title="Measurement" eyebrow={date === todayStr() ? "Today" : fmtNice(date)} onClose={onClose}>
      {fields.length === 0 ? (
        <p className="text-sm leading-relaxed" style={{ color: C.sub }}>
          No number questions in your setup yet — add one in Edit Setup and it will show up here.
        </p>
      ) : (
        <div className="flex flex-col">
          {fields.map((f, i) => (
            <button key={f.k} type="button" onClick={() => { feedback("tap"); setPicked(f); }}
              className="flex items-center justify-between gap-3 py-3 text-left"
              style={{ borderTop: i > 0 ? `1px solid ${C.line}` : "none" }}>
              <span>
                <span className="block text-sm font-semibold">{f.label}</span>
                {f.unit && <span className="block text-[11px]" style={{ color: C.subtle }}>in {f.unit}</span>}
              </span>
              <span className="text-sm tabular-nums" style={{ color: answers[f.k] != null ? C.ink : C.subtle }}>
                {answers[f.k] != null ? `${answers[f.k]}${f.unit ? ` ${f.unit}` : ""}` : "—"}
              </span>
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}

/** One question, one number, done.

    The check-in asks everything; this asks one thing. It exists because the
    honest unit of a symptom is not the day — itch at 3pm and itch at 11pm are
    different facts, and somebody who has just noticed one should be able to
    put it down in two taps rather than open a survey and scroll past nine
    questions they already answered this morning.

    Ordered by what the person actually rates: the questions marked quick in
    their own setup come first, and the main number leads. */
function SymptomSheet({ fields, answers, date, onSave, onClose }) {
  const [picked, setPicked] = useState(() => (fields.length === 1 ? fields[0] : null));
  if (picked) {
    return (
      <Modal title={picked.label} eyebrow={date === todayStr() ? "Today" : fmtNice(date)}
        onClose={() => (fields.length === 1 ? onClose() : setPicked(null))}>
        <div className="fhj-cat-symptom">
          <ScaleInput field={picked} hideLabel value={answers[picked.k] ?? null}
            onChange={(v) => { onSave(picked.k, v); if (v != null) onClose(); }} />
        </div>
        <p className="text-[11.5px] leading-relaxed mt-3" style={{ color: C.subtle }}>
          Saved to today the moment you tap. The rest of the check-in is still there when you
          want it.
        </p>
      </Modal>
    );
  }
  return (
    <Modal title="Rate one thing" eyebrow={date === todayStr() ? "Today" : fmtNice(date)} onClose={onClose}>
      {fields.length === 0 ? (
        <p className="text-sm leading-relaxed" style={{ color: C.sub }}>
          No 1–10 questions in your setup yet — add one in Edit Setup and it will show up here.
        </p>
      ) : (
        <div className="flex flex-col">
          {fields.map((f, i) => {
            const v = answers[f.k];
            return (
              <button key={f.k} type="button" onClick={() => { feedback("tap"); setPicked(f); }}
                className="flex items-center justify-between gap-3 py-3 text-left"
                style={{ borderTop: i > 0 ? `1px solid ${C.line}` : "none" }}>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold truncate">{f.label}</span>
                  <span className="block text-[11px]" style={{ color: C.subtle }}>
                    {v != null ? scoreWord(v, f.dir) : "not rated today"}
                  </span>
                </span>
                <span className="font-display text-2xl leading-none shrink-0"
                  style={{ color: v != null ? colorFor(v, f.dir) : C.muted }}>
                  {v != null ? v : "–"}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

/** Lying, then standing, then the number that actually matters.

    A POTS journal that records two heart rates and never subtracts them has
    made the person do the arithmetic that defines their condition. This does
    it live: both numbers side by side, the jump between them underneath, and
    a plain-language read of what that jump was — never a diagnosis, which is
    somebody else's job, but the sentence they would otherwise write in the
    note field every single time.

    Both values are ordinary answers on today's entry. Nothing here invents a
    field, and the check-in shows the same two numbers. */
const HR_RISE_NOTE = (rise) => {
  if (rise == null) return "";
  if (rise >= 30) return "A rise of 30 or more is the threshold clinicians ask about.";
  if (rise >= 20) return "A noticeable rise. Worth a run of days rather than one reading.";
  return "A small rise today.";
};

function HeartRateSheet({ restField, standField, answers, ghosts, date, onSave, onClose }) {
  const [pad, setPad] = useState(null);
  const rest = restField ? answers[restField.k] : null;
  const stand = standField ? answers[standField.k] : null;
  const rise = rest != null && stand != null ? Math.round(stand - rest) : null;

  if (pad) {
    return (
      <NumberPadSheet field={pad} value={answers[pad.k]} ghost={ghosts?.[pad.k]}
        onCommit={(v) => { onSave(pad.k, v); setPad(null); }}
        onClose={() => setPad(null)} />
    );
  }

  const Row = ({ field, value, hint }) => (
    <button type="button" disabled={!field}
      onClick={() => { feedback("tap"); setPad(field); }}
      className="flex-1 rounded-xl px-3 py-3 text-left"
      style={{ background: C.faint, border: `1px solid ${C.line}` }}>
      <span className="block text-[11px] font-semibold uppercase tracking-wide" style={{ color: C.subtle }}>
        {hint}
      </span>
      <span className="flex items-baseline gap-1 mt-1">
        <span className="font-display text-[2rem] leading-none tabular-nums"
          style={{ color: value != null ? C.ink : C.muted }}>
          {value != null ? value : "–"}
        </span>
        <span className="text-[11px]" style={{ color: C.subtle }}>bpm</span>
      </span>
    </button>
  );

  return (
    <Modal title="Heart rate" eyebrow={date === todayStr() ? "Today" : fmtNice(date)} onClose={onClose}>
      <p className="text-[12.5px] leading-relaxed mb-3" style={{ color: C.sub }}>
        Rest for a few minutes, take the first number, then stand and take the second after about
        ten minutes on your feet.
      </p>
      <div className="flex gap-2">
        <Row field={restField} value={rest} hint="Lying / resting" />
        <Row field={standField} value={stand} hint="Standing" />
      </div>
      <div className="mt-3 rounded-xl px-3 py-3 fhj-cat-symptom"
        style={{ background: rise != null ? C.accentSoft : C.faint, border: `1px solid ${rise != null ? C.accentLine : C.line}` }}>
        <div className="flex items-baseline gap-2">
          <span className="fhj-eyebrow">The jump</span>
          <span className="font-display text-2xl leading-none tabular-nums"
            style={{ color: rise != null ? C.ink : C.muted }}>
            {rise != null ? `${rise > 0 ? "+" : ""}${rise}` : "–"}
          </span>
          <span className="text-[11px]" style={{ color: C.subtle }}>bpm</span>
        </div>
        <p className="text-[11.5px] leading-relaxed mt-1" style={{ color: C.sub }}>
          {rise != null ? HR_RISE_NOTE(rise) : "Both numbers, and this fills itself in."}
        </p>
      </div>
      <p className="text-[11px] leading-relaxed mt-3" style={{ color: C.subtle }}>
        A record of what you measured, not a diagnosis. Bring the trend to whoever is treating you.
      </p>
    </Modal>
  );
}

/** What may have set today off, tagged while it is still remembered.

    The check-in asks this at the end of the day, which is exactly when nobody
    can remember it. Two taps at the moment it happens is the difference
    between a trigger list worth reading in six months and one full of
    "Unknown". */
function TriggerSheet({ field, value, date, onSave, onClose }) {
  const sel = Array.isArray(value) ? value : [];
  return (
    <Modal title={field.label} eyebrow={date === todayStr() ? "Today" : fmtNice(date)} onClose={onClose}
      footer={<Button block variant="secondary" onClick={onClose}>Done</Button>}>
      <p className="text-[12.5px] leading-relaxed mb-1" style={{ color: C.sub }}>
        Tag it now while you remember. Nothing here is a conclusion — the app looks for the
        pattern later.
      </p>
      <div className="fhj-cat-symptom">
        <ChipsInput field={field} value={sel} tint={C.accent}
          onChange={(v) => { feedback("select"); onSave(field.k, v); }} />
      </div>
      {sel.length > 0 && (
        <p className="text-[11.5px] mt-2" style={{ color: C.subtle }}>
          {sel.length} tagged today.
        </p>
      )}
    </Modal>
  );
}

/** Today's routine, in a sheet, for when the + button is how somebody got
    here. Same checklist component as Today and the Diary — one list, one set
    of rules about what a tick means. */
function RoutineQuickSheet({ items, logs, date, onToggle, onAdjust, onLogRows, onLogAsNeeded, onManage, onClose }) {
  const progress = routineProgress(items, logs, date);
  return (
    <Modal title="Routine" eyebrow={progress.total ? `${progress.done} of ${progress.total} done` : "Today"}
      onClose={onClose}
      footer={<Button variant="secondary" block onClick={() => { onClose(); onManage(); }}>Manage your routine</Button>}>
      <div className="fhj-cat-routine">
        {progress.total === 0 && asNeededItems(items).length === 0 ? (
          <p className="text-sm leading-relaxed" style={{ color: C.sub }}>
            Nothing in your routine yet. Add what you take or use and it becomes a one-tap
            checklist here and on Today.
          </p>
        ) : (
          <RoutineChecklist items={items} logs={logs} date={date} compact
            onToggle={onToggle} onAdjust={onAdjust} onLogRows={onLogRows} onLogAsNeeded={onLogAsNeeded} />
        )}
      </div>
    </Modal>
  );
}

/* ============================================================
   The Daily Pulse
   ============================================================

   One question, ten targets, one tap, written immediately. It is the first
   thing on Today and the only thing on Today that is not optional, because for
   most people on most days it is the only thing that will get recorded — and a
   year of one honest number is worth more than a fortnight of forty.

   Three things this is careful about:

   **The tap is the save.** There is no Save button, no confirmation step, and
   no "did you mean it?" — the number goes into the journal on the tap. Tapping
   the same number again clears it, which is the same gesture the rest of the
   app already uses for a scale.

   **The saved state is derived, never asserted.** The line under the scale
   reads the value back out of the journal. If the write did not happen, it
   does not appear — an app that says "Saved" because a tap fired is an app
   that will eventually lie about somebody's medical history.

   **Detail comes after, never in front.** Under it: three to five optional
   follow-ups chosen for today's score (see src/lib/pulse.ts), each answered
   inline, and one link to the full check-in for anybody who wants the survey.
   Nothing here opens a screen the person did not ask for. */

function PulseScale({ field, value, onSet, disabled }) {
  const lowLbl = field.dir === "pos" ? "1 · low" : "1 · none";
  const highLbl = field.dir === "pos" ? "10 · great" : "10 · severe";
  return (
    <>
      <div className="fhj-pulse-scale" role="group" aria-label={field.label}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
          const filled = value != null && n <= value;
          return (
            <button key={n} type="button" disabled={disabled}
              aria-label={`${field.label} ${n} out of 10`}
              aria-pressed={value === n}
              onClick={(e) => onSet(n, e.currentTarget)}
              className={"fhj-pulse-rung" + (filled ? " is-filled" : "") + (value === n ? " is-picked" : "")}
              style={filled ? { "--fhj-rung": colorFor(value, field.dir) } : undefined}>
              {n}
            </button>
          );
        })}
      </div>
      <div className="flex justify-between mt-1.5 text-[10px]" style={{ color: C.subtle }}>
        <span>{lowLbl}</span>
        <span>{highLbl}</span>
      </div>
    </>
  );
}

/** The next question, asked where the person already is.

    The Daily Pulse answers "how was today" in one tap, and for most people on
    most days that is the whole log. But some days somebody *wants* to do the
    round — and until now the only route to it was "Add more detail", which
    opens the survey: a screen, a scroll, forty fields, and a Back button. The
    chip row underneath is not that route either. A chip row is a menu; it
    shows what could be answered and hands the choosing back. Choosing is work,
    and at eleven questions it is most of the work.

    So: a queue, and the front of it, in place.

    One question. The app's own input for it, so an answer given here is the
    same act as an answer given in the survey. The tap writes it, the question
    leaves the queue, and the next one takes its place — which means the whole
    daily review can be done from the first card of the first screen, at the
    speed of tapping, without a form ever opening.

    Two rules keep it an offer rather than a wall:

    **It never advances out from under an answer.** A scale, a yes/no and a
    single-choice are finished by the tap, so those move on by themselves. A
    number or a multi-select is not — the person is still typing, or still
    choosing — so those stay put until they say Next. Snatching a field away
    mid-keystroke would be the app racing its user.

    **It is always leaveable.** Skip moves past this one; "Done for now" closes
    the queue for the sitting. Neither is remembered: tomorrow it asks again,
    because a journal that permanently stops asking on the strength of one
    impatient tap has quietly started deciding what its owner tracks. */
function NextQuestion({ tpl, field, value, ghost, progress, onSet, onAdvance, onStop }) {
  const oneTap = isOneTap(field);
  const answeredNow = value != null && !(Array.isArray(value) && value.length === 0);
  const pct = progress.total ? Math.round((progress.answered / progress.total) * 100) : 0;
  return (
    <div className="fhj-next">
      <div className="fhj-next-head">
        <span className="fhj-eyebrow">Next question</span>
        <span className="fhj-next-count">
          {progress.answered} of {progress.total} answered
        </span>
      </div>
      <div className="fhj-next-bar" aria-hidden="true">
        <span className="fhj-next-bar-fill" style={{ width: `${pct}%`, background: tpl.color }} />
      </div>
      {/* The live region is the count and the question together: a screen
          reader landing on a silently-replaced input would otherwise be
          answering a question nobody read out. */}
      <div aria-live="polite">
        <h3 className="fhj-next-title">
          {field.label}
          {field.unit && <span className="fhj-next-unit"> · {field.unit}</span>}
        </h3>
      </div>
      <FieldInput field={field} value={value} onChange={onSet} tint={tpl.color} ghost={ghost} hideLabel />
      <div className="fhj-next-foot">
        <button type="button" className={"fhj-next-btn" + (answeredNow && !oneTap ? " is-forward" : "")}
          onClick={() => { feedback("nav"); onAdvance(); }}>
          {answeredNow && !oneTap ? "Next" : "Skip this one"}
          {answeredNow && !oneTap && <Icon name="right" size={12} color="currentColor" />}
        </button>
        <button type="button" className="fhj-next-btn" onClick={() => { feedback("tap"); onStop(); }}>
          Done for now
        </button>
      </div>
    </div>
  );
}

function DailyPulse({
  profile, tpl, keyField, entries, entry, date, viewer,
  routineItems, routine, photoFields, onPatch, onOpenLog, onOpenPhotos, onOpenRoutine,
}) {
  const answers = entry?.answers || {};
  const { value, recorded } = pulseState(answers, keyField.k);
  const [open, setOpen] = useState(null);      // which follow-up is expanded
  const [note, setNote] = useState(entry?.notes || "");
  const noteRef = useRef(null);

  /* Photos are per-field on an entry, so "have I photographed anything lately"
     is a question about the journal rather than about today's answers. */
  const photoInfo = useMemo(() => {
    let last = null;
    for (const e of entries) {
      if (!e.photos) continue;
      if (Object.values(e.photos).some((p) => p?.photoId) && (!last || e.date > last)) last = e.date;
    }
    return {
      photoToday: last === date,
      daysSincePhoto: last ? daySpan(last, date) - 1 : null,
    };
  }, [entries, date]);

  const routineDue = useMemo(() => {
    const p = routineProgress(routineItems || [], routine || [], date);
    return p.total - p.done - p.skipped;
  }, [routineItems, routine, date]);

  /* What this person actually records, over the last month of their journal.
     It is what turns the pack's opinion about which questions matter into
     theirs — see answerHabits in lib/pulse. */
  const habits = useMemo(() => {
    const from = addDays(date, -29);
    return answerHabits(tpl.fields, entries.filter((e) => e.date >= from && e.date <= date));
  }, [tpl.fields, entries, date]);

  const pulseCtx = useMemo(() => ({
    primaryKey: keyField.k,
    score: value,
    dir: keyField.dir,
    fields: tpl.fields,
    priority: tpl.chartMetrics,
    answers,
    usual: habits,
    hasNote: !!(entry?.notes || "").trim(),
    photoFields: photoFields.map((f) => f.k),
    photoToday: photoInfo.photoToday,
    daysSincePhoto: photoInfo.daysSincePhoto,
    routineDue,
  }), [keyField, value, tpl, answers, habits, entry, photoFields, photoInfo, routineDue]);

  /* The chips no longer offer questions: the card above them asks those one at
     a time, and the same question in two places is one place too many. What is
     left is the three things a question cannot be — the routine, the camera,
     and the note. */
  const items = useMemo(() => followUps({ ...pulseCtx, includeFields: false }), [pulseCtx]);

  /* ---------- the queue ----------

     `skipped` and `stopped` are session state on purpose. Neither is written to
     the journal: a question waved past this morning is a fair question again
     tonight, and "Done for now" means for now. */
  const [skipped, setSkipped] = useState([]);
  const [stopped, setStopped] = useState(false);
  /* Which question the person is *on*. Null means "whatever is at the front of
     the queue", which is what lets a one-tap answer hand straight over to the
     next question. A field that takes typing pins itself here instead, so it
     cannot vanish between two keystrokes. */
  const [cursor, setCursor] = useState(null);

  const queue = useMemo(() => askQueue(pulseCtx, skipped), [pulseCtx, skipped]);
  const progress = useMemo(() => surveyProgress(pulseCtx), [pulseCtx]);
  const asking = (cursor && tpl.fields.find((f) => f.k === cursor)) || queue[0] || null;
  const ghosts = useMemo(
    () => recentAnswers(tpl.fields.filter((f) => f.type === "number"), entries, date),
    [tpl.fields, entries, date]
  );

  const answerNext = (f, v) => {
    /* Anything that is not finished by one tap holds the queue where it is
       until the person says Next — see the note on NextQuestion. */
    if (!isOneTap(f)) setCursor(f.k);
    else feedback("select");
    onPatch(profile.id, date, { answers: { [f.k]: v } }, "quick");
  };
  const advance = (f) => {
    setSkipped((prev) => (prev.includes(f.k) ? prev : [...prev, f.k]));
    setCursor(null);
  };

  const setPulse = (n, el) => {
    if (viewer) return;
    if (value === n) { feedback("erase"); onPatch(profile.id, date, { answers: { [keyField.k]: null } }, "quick"); return; }
    feedback("quickadd", { el });
    place("scale", n, 10);
    onPatch(profile.id, date, { answers: { [keyField.k]: n } }, "quick");
  };

  const openItem = (item) => {
    feedback("tap");
    if (item.kind === "photo") return onOpenPhotos();
    if (item.kind === "routine") return onOpenRoutine();
    setOpen((cur) => (cur === item.id ? null : item.id));
  };

  /* Only the note expands in place now — the questions moved to the queue
     above, and the routine and the camera open their own screens. */
  const openItemDef = items.find((i) => i.id === open);

  return (
    <Card className="fhj-pulse-card mt-4">
      <div className="fhj-eyebrow">{recorded ? "Today, recorded" : "Today, in one tap"}</div>
      <h2 className="font-display text-[1.35rem] leading-tight mt-1 mb-3">{keyField.label}</h2>

      <PulseScale field={keyField} value={value} onSet={setPulse} disabled={viewer} />

      {/* Derived from the journal, not from the tap. See the note above. */}
      <div className="fhj-pulse-state" aria-live="polite">
        {recorded ? (
          <>
            <span className="fhj-pulse-mark" style={{ background: colorFor(value, keyField.dir) }}>
              <Icon name="check" size={13} color={readableInk(colorFor(value, keyField.dir))} />
            </span>
            <span>
              <b>{value}/10</b> saved for today — {scoreWord(value, keyField.dir)}.
              {" "}<span style={{ color: C.subtle }}>Tap it again to clear.</span>
            </span>
          </>
        ) : (
          <span style={{ color: C.subtle }}>
            {viewer ? "Read-only — nothing is saved here." : "Nothing recorded yet. One tap is a whole day logged."}
          </span>
        )}
      </div>

      {/* One question at a time, straight after the number — the queue, not the
          menu. See NextQuestion. */}
      {recorded && !viewer && !stopped && asking && (
        <NextQuestion
          tpl={tpl} field={asking} value={answers[asking.k]} ghost={ghosts[asking.k] ?? null}
          progress={progress}
          onSet={(v) => answerNext(asking, v)}
          onAdvance={() => advance(asking)}
          onStop={() => setStopped(true)} />
      )}
      {/* The end of it, said once. Only for somebody who actually got there —
          a setup with nothing left to ask on the very first tap has not
          finished anything. */}
      {recorded && !viewer && !stopped && !asking && progress.total > 1 && progress.left === 0 && (
        <div className="fhj-next-done">
          <span className="fhj-pulse-mark" style={{ background: colorFor(value, keyField.dir) }}>
            <Icon name="check" size={13} color={readableInk(colorFor(value, keyField.dir))} />
          </span>
          <span>All {progress.total} of today's questions are answered.</span>
        </div>
      )}

      {recorded && !viewer && items.length > 0 && (
        <div className="mt-3">
          <div className="fhj-eyebrow mb-1.5">Anything else? — all optional</div>
          <div className="fhj-pulse-chips">
            {items.map((item) => (
              <button key={item.id} type="button" onClick={() => openItem(item)}
                aria-expanded={item.kind === "field" || item.kind === "note" ? open === item.id : undefined}
                className={"fhj-pulse-chip" + (open === item.id ? " is-open" : "")}>
                <Icon name={item.icon} size={14} color="currentColor" />
                <span>
                  <span className="fhj-pulse-chip-label">{item.label}</span>
                  <span className="fhj-pulse-chip-hint">{item.hint}</span>
                </span>
              </button>
            ))}
          </div>

          {openItemDef?.kind === "note" && (
            <Card className="mt-2">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="fhj-eyebrow">Note</span>
                <button type="button" onClick={() => setOpen(null)} aria-label="Close Note" className="fhj-icon-btn">
                  <Icon name="x" size={14} color={C.sub} />
                </button>
              </div>
              <textarea ref={noteRef} rows={2} value={note} autoFocus
                aria-label="Note for today"
                onChange={(e) => setNote(e.target.value)}
                onBlur={() => onPatch(profile.id, date, { notes: note }, "quick")}
                placeholder="Anything worth remembering about today…"
                className="w-full rounded-xl px-3 py-2 text-sm outline-none resize-none"
                style={{ background: C.faint, border: `1px solid ${C.line}` }} />
              <button type="button"
                onClick={() => { feedback("save"); onPatch(profile.id, date, { notes: note }, "quick"); setOpen(null); }}
                className="fhj-btn fhj-btn-secondary fhj-btn-sm mt-2" disabled={!note.trim()}>
                Save note
              </button>
            </Card>
          )}
        </div>
      )}

      {!viewer && (
        <button type="button" onClick={() => { feedback("nav"); onOpenLog(); }}
          className="fhj-pulse-more">
          Add more detail
          <Icon name="right" size={13} color="currentColor" />
        </button>
      )}
    </Card>
  );
}

/* Today's context: the weather behind the day, the sun so far, and the one
   thing worth acting on — when the next window is.

   Absent entirely when daily context is off and nothing has been logged
   outside, because a card that says "no data" every morning is a card people
   learn to scroll past. */
function TodayContextCard({ ctx, units, sun = [], coords, onOpenSun, viewer }) {
  const day = sunDay(sun, todayStr());
  const now = new Date();
  const window = coords ? nextVitaminDWindow(now, coords) : null;
  if (!ctx && !day.minutes && !window) return null;

  return (
    <>
      <div className="fhj-section mt-6 fhj-cat-symptom">
        <h2 className="fhj-section-title">Around today</h2>
      </div>
      <Card>
        {ctx && <ContextStrip ctx={ctx} units={units} variant="full" />}

        {(day.minutes || window) && (
          <div className="fhj-today-sun" style={{ marginTop: ctx ? 14 : 0 }}>
            <div>
              <div className="fhj-eyebrow">Outside today</div>
              <div className="fhj-today-sun-val">
                {day.minutes ? minutesLabel(day.minutes) : "Nothing yet"}
              </div>
              {day.iuHigh >= 100 && (
                <div className="fhj-sun-iu-note">
                  ~{day.iuLow.toLocaleString("en-US")}–{day.iuHigh.toLocaleString("en-US")} IU estimated
                  · not a measurement
                </div>
              )}
              {!day.minutes && window && (
                <div className="fhj-sun-iu-note">
                  {window.start.toDateString() === now.toDateString()
                    ? `Vitamin D window open until ${window.end.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
                    : `Next vitamin D window ${window.start.toLocaleDateString(undefined, { weekday: "long" })}`}
                </div>
              )}
            </div>
            {!viewer && onOpenSun && (
              <button type="button" className="fhj-btn fhj-btn-outline fhj-btn-sm"
                onClick={() => { feedback("nav"); onOpenSun(); }}>
                {day.minutes ? "Sun" : "Go outside"}
              </button>
            )}
          </div>
        )}
      </Card>
    </>
  );
}

/* One pinned experiment on Today. Deliberately the smallest possible version
   of the card on the experiments screen: the title, the ladder, and the
   sentence if there is one. No dots, no halves — this is a status, and the
   screen it came from is one tap away. */
function PinnedExperiment({ result, onOpen, onHighlight }) {
  return (
    <Card className="fhj-exp-mini">
      <button type="button" className="fhj-exp-mini-head" onClick={onOpen}>
        <span className="fhj-exp-title">{result.experiment.title}</span>
        <Icon name="right" size={14} color={C.subtle} />
      </button>
      <EvidenceMeter evidence={result.evidence} compact />
      {result.headline ? (
        <button type="button" className="fhj-exp-mini-line"
          onClick={() => onHighlight?.(highlightDates(result), result.experiment.title)}>
          {result.headline}
        </button>
      ) : (
        <p className="fhj-exp-subline">{result.subline}</p>
      )}
    </Card>
  );
}

function DashboardScreen({ profile, entries, openLog, onPatch, addOpen, onCloseAdd, onUseAction, goSettings, goSetup, goFood, goRoutine, goInsights, onUpdateQuickAdd, viewer, ai, food, bowel, foods, routine, routineItems, episodes = [], onStartFlare, onEndFlare, onUpdateLibrary, onSaveFood, onDeleteFood, onSaveBowel, onDeleteBowel, onSaveRoutine, onDeleteRoutine, onLogRoutineRows, syncStatus, goSun, goLabs, goExperiments, goImport, onDismissImport, sun = [], context = [], labs = [], pinnedExperiments = [], onHighlight }) {
  const tpl = getProfileTemplate(profile);
  /* Where to put the sun. A place set by hand wins over the last fetched one,
     and both are absent when daily context is off — in which case every sun
     surface quietly degrades to "minutes outside" and says nothing about UV. */
  const sunCoords = profile.context?.enabled
    ? (profile.context.place
      ? { lat: profile.context.place.lat, lon: profile.context.place.lon }
      : context[context.length - 1]?.coords || null)
    : null;
  const keyField = getField(tpl, tpl.keyMetric);
  const today = entryOn(entries, todayStr());
  const streak = calcStreak(entries);
  const photoFields = useMemo(() => tpl.fields.filter((f) => f.type === "photo"), [tpl]);

  /* Which log sheet is open, if any. `null` = closed; an object carries the
     row being edited (or {} for a new one). */
  const [foodSheet, setFoodSheet] = useState(null);
  const [foodPicker, setFoodPicker] = useState(null); // meal id
  const [bowelSheet, setBowelSheet] = useState(null);
  const [routineSheet, setRoutineSheet] = useState(null); // { item, slot, log } being adjusted
  const [quickAddEditor, setQuickAddEditor] = useState(false);
  /* The three sheets the + button can open that nothing else on this screen
     owned yet. Everything else it offers already had a home here. */
  const [noteSheet, setNoteSheet] = useState(false);
  const [measureSheet, setMeasureSheet] = useState(false);
  const [routineListSheet, setRoutineListSheet] = useState(false);
  const [symptomSheet, setSymptomSheet] = useState(false);
  const [hrSheet, setHrSheet] = useState(false);
  const [triggerSheet, setTriggerSheet] = useState(false);
  const numberFields = useMemo(() => tpl.fields.filter((f) => f.type === "number"), [tpl]);
  const aiEnabled = !!ai?.enabled && !viewer;
  const aiAuto = aiEnabled && ai?.auto === true;

  /* Whether to offer the note import. A journal with a fortnight of its own
     days behind it has a history already and does not need the offer; one
     without is exactly who it is for. See ImportInvite. */
  const offerImport = !viewer && !!goImport
    && profile.importOffered !== "done"
    && entries.length < IMPORT_INVITE_UNTIL_DAYS;

  /* What this particular setup can answer, and the fields each tile writes
     to. The condition-shaped tiles are only as real as the questions behind
     them: a journal with no water question has no water button, and one with
     both heart rates gets the tile that subtracts them. */
  const qa = useMemo(() => quickAddContext(tpl), [tpl]);
  const { scaleFields, waterField, hr: hrFields, triggerField } = qa;
  const caps = { ...qa.caps, flare: qa.caps.flare && !!onStartFlare, ai: aiEnabled };
  /* One flare per metric can be open at a time; this is the one for the number
     this journal is about, which is the one the tile starts and ends. */
  const runningFlare = useMemo(
    () => (keyField ? (episodes || []).find((e) => e.metric === keyField.k && episodeIsOpen(e)) || null : null),
    [episodes, keyField]
  );

  /* Quick Add: which tiles, and what each one does. The catalogue and the
     handlers are kept apart on purpose — a tile with no handler here simply
     doesn't render, so the viewer build and a setup without photo questions
     both drop the tiles they can't honour without any extra conditionals. */
  const stats = useMemo(() => sanitizeActionStats(profile.actionStats), [profile.actionStats]);
  const quickAddIds = resolveQuickAdd(profile, { caps, stats, today: todayStr() });

  /* A tile dropped in a new place. What was dragged is what this setup can
     show; what is saved is the whole list, including any button whose question
     is switched off at the moment — that one keeps its place rather than being
     quietly deleted by a rearrangement nobody could see it in. */
  const reorderQuickAdd = (visible) => {
    const stored = sanitizeQuickAdd(profile?.quickAdd) ?? defaultQuickAdd(profile?.modules);
    onUpdateQuickAdd?.(applyVisibleOrder(stored, visible), "manual", { dragged: true });
  };

  /* Every tap on an action is a vote about tomorrow's ordering. Recorded here,
     once, around whatever the action itself does — so a new action added later
     cannot forget to be counted. */
  const track = (id, fn) => (...args) => { onUseAction?.(id); return fn?.(...args); };

  /* What the journal already knows how to repeat: the foods and doses with a
     count behind them, the body spots photographed before, the numbers
     recorded before, and the note. */
  const repeats = useMemo(() => {
    const t0 = todayStr();
    const lastPhoto = {};
    const lastNumber = {};
    for (const e of entries) {
      for (const [k, p] of Object.entries(e.photos || {})) {
        if (p?.photoId && (!lastPhoto[k] || e.date > lastPhoto[k])) lastPhoto[k] = e.date;
      }
      for (const f of numberFields) {
        const v = e.answers?.[f.k];
        if (typeof v === "number" && (!lastNumber[f.k] || e.date > lastNumber[f.k].at)) {
          lastNumber[f.k] = { at: e.date, v };
        }
      }
    }
    return repeatSuggestions({
      today: t0,
      foods,
      routineItems,
      photoFields: photoFields.map((f) => ({ k: f.k, label: f.label, lastAt: lastPhoto[f.k] })),
      numberFields: numberFields.map((f) => ({
        k: f.k, label: f.label, unit: f.unit,
        lastValue: lastNumber[f.k]?.v ?? null, lastAt: lastNumber[f.k]?.at,
      })),
      hasNoteToday: !!(today?.notes || "").trim(),
      hasEverNoted: entries.some((e) => (e.notes || "").trim()),
      stats,
      max: 8,
    });
  }, [entries, foods, routineItems, photoFields, numberFields, today, stats]);

  const runRepeat = (item) => {
    onUseAction?.(item.id);
    if (item.kind === "food") {
      const food = foods.find((f) => f.id === item.refId);
      if (!food) return;
      const time = localTime();
      onSaveFood(logFromFoodItem(food, { date: todayStr(), time, meal: mealForTime(time), servings: 1 }));
      return;
    }
    if (item.kind === "routine") {
      const rItem = routineItems.find((r) => r.id === item.refId);
      if (!rItem) return;
      onSaveRoutine(logFromItem(rItem, { date: todayStr(), slot: slotForTime(localTime()) }));
      return;
    }
    if (item.kind === "photo") return openLog(todayStr(), { photos: true });
    if (item.kind === "measurement") return setMeasureSheet(item.refId);
    if (item.kind === "note") return setNoteSheet(true);
  };
  /* Water is the only tile that writes without opening anything: a cup is not
     a decision, and a sheet that asks "how many cups?" for the answer "one
     more" is the friction the tile exists to remove. Undo lives in the toast,
     like every other write on this screen. */
  const addWater = () => {
    if (!waterField) return;
    const before = today?.answers?.[waterField.k];
    const step = waterField.step || 1;
    const next = Math.min(waterField.max ?? 99, (typeof before === "number" ? before : 0) + step);
    onPatch(profile.id, todayStr(), { answers: { [waterField.k]: next } }, "quick");
    toast({
      text: `${waterField.label}: ${amountWithUnit(next, waterField.unit)} today`,
      icon: "drink", cat: "fhj-cat-food",
      undo: () => onPatch(profile.id, todayStr(), { answers: { [waterField.k]: before ?? null } }, "quick"),
    });
  };

  const toggleFlare = () => {
    if (runningFlare) onEndFlare?.(runningFlare.id);
    else onStartFlare?.();
  };

  /* One map, both doors.

     Quick Add on Today and the sheet behind the + used to keep separate
     handler tables, which is how they drifted into offering different things.
     There is one way to log a meal in this app and one list of what a day can
     hold; the row and the sheet are two views of it. */
  const actions = viewer ? {} : {
    checkin: track("checkin", () => openLog(todayStr())),
    food: track("food", () => setFoodPicker(mealForTime(localTime()))),
    drink: track("drink", () => setFoodPicker("drink")),
    bowel: track("bowel", () => setBowelSheet({})),
    routine: track("routine", () => setRoutineListSheet(true)),
    photo: caps.photo ? track("photo", () => openLog(todayStr(), { photos: true })) : null,
    flare: caps.flare ? track("flare", toggleFlare) : null,
    symptom: caps.scale ? track("symptom", () => setSymptomSheet(true)) : null,
    hr: caps.hr ? track("hr", () => setHrSheet(true)) : null,
    water: caps.water ? track("water", addWater) : null,
    trigger: caps.trigger ? track("trigger", () => setTriggerSheet(true)) : null,
    note: track("note", () => setNoteSheet(true)),
    measurement: caps.number ? track("measurement", () => setMeasureSheet(true)) : null,
    diary: goFood ? track("diary", goFood) : null,
    sun: goSun ? track("sun", goSun) : null,
    lab: goLabs ? track("lab", goLabs) : null,
    import: caps.ai && goImport ? track("import", goImport) : null,
  };

  /* The two tiles that describe today rather than name a feature. */
  const liveTiles = {
    checkin: today ? { done: true, sub: "Done today" } : null,
    flare: runningFlare
      ? {
        label: "End flare", icon: "check",
        sub: (() => {
          const days = daySpan(runningFlare.start, todayStr());
          return days > 1 ? `Running · day ${days}` : "Running · started today";
        })(),
      }
      : null,
    water: waterField && typeof today?.answers?.[waterField.k] === "number"
      ? { sub: `${amountWithUnit(today.answers[waterField.k], waterField.unit)} so far` }
      : null,
    sun: (() => {
      const day = sunDay(sun, todayStr());
      return day.minutes ? { sub: `${minutesLabel(day.minutes)} today` } : null;
    })(),
  };

  /* One tap on a checklist row. Ticking writes a log; un-ticking removes the
     one it wrote. Both are undoable from the toast, like every other write on
     this screen. */
  const toggleRoutine = (row) => {
    if (row.log) onDeleteRoutine(row.log);
    else onSaveRoutine(logFromItem(row.item, { date: todayStr(), slot: row.slot }));
  };

  return (
    <div className="px-4 pb-10 fhj-stagger">
      {/* The date is the page title. On a journal, "which day am I looking at"
          is the one piece of context every screen below depends on — and the
          app's own name, which used to sit here at 3xl, is information the
          user supplied by tapping the icon. */}
      <div className="flex items-start justify-between gap-3 pt-5 pb-1">
        <div className="min-w-0">
          <div className="text-[12.5px] font-medium" style={{ color: C.subtle }}>
            {viewer ? "Read-only viewer · nothing is saved" : greetingFor(new Date(), profile.name)}
          </div>
          <h1 className="font-display text-[1.75rem] leading-tight mt-0.5">{fmtNice(todayStr())}</h1>
        </div>
        {viewer ? (
          <span className="shrink-0 mt-1 px-2.5 py-1 rounded-full text-[11px] font-semibold"
            style={{ background: C.card, border: `1px solid ${C.line}`, color: C.sub }}>
            Read-only
          </span>
        ) : (
          <div className="flex items-center gap-2 shrink-0 mt-1">
            {/* Renders nothing at all unless sync is stuck on something only
                the user can resolve. See SyncAlert. */}
            <SyncAlert status={syncStatus} onOpen={goSettings} />
            <button onClick={goSetup} aria-label="edit survey setup" className="fhj-icon-btn">
              <Icon name="sliders" size={18} color={C.sub} />
            </button>
            <button onClick={goSettings} aria-label="settings" className="fhj-icon-btn">
              <Icon name="gear" size={19} color={C.sub} />
            </button>
          </div>
        )}
      </div>

      {/* ---------- The Daily Pulse ----------
          Above everything, including Quick Add. Quick Add is a menu of things
          you *could* log; this is the one thing worth logging every day, and
          it is answered without leaving the screen. */}
      {keyField && keyField.type === "scale" && (
        <DailyPulse
          profile={profile} tpl={tpl} keyField={keyField} entries={entries} entry={today}
          date={todayStr()} viewer={viewer}
          routineItems={routineItems} routine={routine} photoFields={photoFields}
          onPatch={onPatch}
          onOpenLog={() => openLog(todayStr())}
          onOpenPhotos={() => openLog(todayStr(), { photos: true })}
          onOpenRoutine={goRoutine} />
      )}

      {/* ---------- Quick Add ----------
          Under the pulse: the other things a day can hold, for the days that
          hold more than a number. */}
      {!viewer && (
        <>
          <div className="fhj-section mt-5 fhj-cat-symptom">
            <h2 className="fhj-section-title">Quick Add</h2>
            <button onClick={() => { feedback("tap"); setQuickAddEditor(true); }}
              aria-label="Edit which Quick Add buttons are shown"
              className="text-[11.5px] font-semibold" style={{ color: C.accentText }}>
              Edit
            </button>
          </div>
          {quickAddIds.length > 0 ? (
            <>
              <QuickAdd ids={quickAddIds} actions={actions} live={liveTiles}
                onReorder={reorderQuickAdd} />
              {/* A gesture nobody is told about is a gesture nobody has. Said
                  once, quietly, under the row — and gone for good the first
                  time somebody moves a button, because at that point they know
                  and the line is just clutter on the screen they use daily. */}
              {quickAddIds.length > 1 && !profile.quickAddDragged && (
                <p className="flex items-center justify-center gap-1.5 mt-2 text-[11px]"
                  style={{ color: C.subtle }}>
                  <Icon name="grip" size={12} color={C.subtle} />
                  Hold a button to move it
                </p>
              )}
            </>
          ) : (
            <button type="button" onClick={() => { feedback("tap"); setQuickAddEditor(true); }}
              className="w-full text-[12px] leading-relaxed px-3 py-3 rounded-xl text-left"
              style={{ background: C.faint, border: `1px dashed ${C.lineStrong}`, color: C.subtle }}>
              No Quick Add buttons — tap to choose some.
            </button>
          )}

          <QuickRepeats items={repeats} onRun={runRepeat}
            onOpenPicker={foods.length ? () => setFoodPicker(mealForTime(localTime())) : null} />

          {/* The routine sits directly under Quick Add because it is the other
              thing this screen is for: Quick Add is what happened, this is
              what was planned. Both are answered by tapping, and neither
              opens a form to do it. */}
          <RoutineCard
            items={routineItems} logs={routine} date={todayStr()} viewer={viewer}
            onToggle={toggleRoutine}
            onAdjust={(row) => setRoutineSheet(row)}
            onLogRows={onLogRoutineRows}
            onLogAsNeeded={(item) => onSaveRoutine(logFromItem(item, { date: todayStr(), slot: slotForTime(localTime()) }))}
            onManage={goRoutine} />
        </>
      )}

      {/* ---------- Today's Logs ----------
          The heading is the shortcut. "What did I log today" and "let me open
          today's log" are the same intent thirty seconds apart, and making
          people find a small text link at the other end of the row to act on
          it was pure friction. The whole row is the target now; the old link
          stays as the visible affordance so it still reads as pressable. */}
      <button type="button" onClick={() => { feedback("nav"); openLog(todayStr()); }}
        disabled={viewer}
        aria-label={today ? "Open today's check-in" : "Start today's check-in"}
        className="fhj-section mt-6 fhj-cat-symptom w-full text-left">
        <h2 className="fhj-section-title">Today's Logs</h2>
        {!viewer && (
          <span className="text-[11px] font-semibold flex items-center gap-0.5" style={{ color: C.accentText }}>
            {today ? "Edit check-in" : "Start check-in"}
            <Icon name="right" size={12} color={C.accentText} />
          </span>
        )}
      </button>
      <TodayTimeline
        entry={today} tpl={tpl} food={food} bowel={bowel} routine={routine} date={todayStr()}
        onOpenEntry={openLog}
        onOpenFood={(f) => !viewer && setFoodSheet(f)}
        onOpenBowel={(b) => !viewer && setBowelSheet(b)}
        onOpenRoutine={(log) => !viewer && setRoutineSheet({
          /* A timeline row knows its log, not the item behind it — which may
             have been renamed or deleted since. The log's own snapshot is the
             honest stand-in, and the sheet edits the log either way. */
          item: routineItems.find((i) => i.id === log.itemId) || { id: log.itemId, name: log.name, kind: log.kind },
          slot: log.slot, log, done: !log.skipped, skipped: !!log.skipped,
        })} />

      {offerImport && (
        <ImportInvite
          aiReady={aiEnabled}
          onImport={() => { feedback("nav"); goImport(); }}
          onSetup={() => { feedback("nav"); goSettings(); }}
          onDismiss={() => { feedback("tap"); onDismissImport?.(); }} />
      )}

      <GlanceCard tpl={tpl} keyField={keyField} entry={today} food={food}
        streak={streak} onOpen={goInsights} />

      {/* ---------- the day around the day ----------
          Weather, sun and whatever experiment somebody pinned. All three are
          absent until they have something to say, which is most of the point:
          this is context, not a dashboard. */}
      <TodayContextCard
        ctx={contextOn(context, todayStr())}
        units={profile.context?.units}
        sun={sun}
        coords={sunCoords}
        onOpenSun={goSun}
        viewer={viewer} />

      {pinnedExperiments.length > 0 && (
        <>
          <button type="button" onClick={() => { feedback("nav"); goExperiments?.(); }}
            className="fhj-section mt-6 fhj-cat-symptom w-full text-left">
            <h2 className="fhj-section-title">Running</h2>
            <span className="text-[11px] font-semibold flex items-center gap-0.5" style={{ color: C.accentText }}>
              All experiments
              <Icon name="right" size={12} color={C.accentText} />
            </span>
          </button>
          <div className="grid gap-2">
            {pinnedExperiments.slice(0, 2).map((r) => (
              <PinnedExperiment key={r.experiment.id} result={r}
                onOpen={() => goExperiments?.()}
                onHighlight={onHighlight} />
            ))}
          </div>
        </>
      )}

      {foodPicker && (
        <FoodPicker
          library={foods} meal={foodPicker} date={todayStr()}
          onLog={(log) => { onSaveFood(log); setFoodPicker(null); }}
          onOpenFull={(pre) => { setFoodSheet({ ...pre }); setFoodPicker(null); }}
          onUpdateLibrary={onUpdateLibrary}
          onClose={() => setFoodPicker(null)} />
      )}
      {foodSheet && (
        <FoodLogSheet
          initial={foodSheet.id ? foodSheet : null}
          defaultMeal={foodSheet.meal} defaultTime={foodSheet.time}
          date={todayStr()}
          aiEnabled={aiEnabled} aiAuto={aiAuto}
          onSave={(log) => { onSaveFood(log); setFoodSheet(null); }}
          onDelete={foodSheet.id ? (log) => { onDeleteFood(log); setFoodSheet(null); } : null}
          onClose={() => setFoodSheet(null)} />
      )}
      {bowelSheet && (
        <BowelLogSheet
          initial={bowelSheet.id ? bowelSheet : null}
          date={todayStr()}
          aiEnabled={aiEnabled} aiAuto={aiAuto}
          onSave={(log) => { onSaveBowel(log); setBowelSheet(null); }}
          onDelete={bowelSheet.id ? (log) => { onDeleteBowel(log); setBowelSheet(null); } : null}
          onClose={() => setBowelSheet(null)} />
      )}
      {routineSheet && (
        <RoutineLogAdjustSheet row={routineSheet} date={todayStr()}
          onSave={(log) => { onSaveRoutine(log); setRoutineSheet(null); }}
          onSkip={(log) => { onSaveRoutine(log); setRoutineSheet(null); }}
          onUnlog={(log) => { onDeleteRoutine(log); setRoutineSheet(null); }}
          onClose={() => setRoutineSheet(null)} />
      )}
      {addOpen && !viewer && (
        <AddSheet ids={quickAddIds} actions={actions} live={liveTiles} caps={caps}
          onEdit={() => setQuickAddEditor(true)} onReorder={reorderQuickAdd}
          onClose={onCloseAdd} />
      )}
      {noteSheet && (
        <NoteSheet initial={today?.notes || ""} suggestions={recentNotes(entries)}
          onSave={(text) => { onPatch(profile.id, todayStr(), { notes: text }, "quick"); setNoteSheet(false); }}
          onClose={() => setNoteSheet(false)} />
      )}
      {measureSheet && (
        <MeasurementSheet
          fields={typeof measureSheet === "string"
            ? numberFields.filter((f) => f.k === measureSheet)
            : numberFields}
          answers={today?.answers || {}}
          ghosts={recentAnswers(numberFields, entries, todayStr())} date={todayStr()}
          onSave={(k, v) => onPatch(profile.id, todayStr(), { answers: { [k]: v } }, "quick")}
          onClose={() => setMeasureSheet(false)} />
      )}
      {routineListSheet && (
        <RoutineQuickSheet items={routineItems} logs={routine} date={todayStr()}
          onToggle={toggleRoutine} onAdjust={(row) => { setRoutineListSheet(false); setRoutineSheet(row); }}
          onLogRows={onLogRoutineRows}
          onLogAsNeeded={(item) => onSaveRoutine(logFromItem(item, { date: todayStr(), slot: slotForTime(localTime()) }))}
          onManage={goRoutine}
          onClose={() => setRoutineListSheet(false)} />
      )}
      {symptomSheet && (
        <SymptomSheet fields={scaleFields} answers={today?.answers || {}} date={todayStr()}
          onSave={(k, v) => onPatch(profile.id, todayStr(), { answers: { [k]: v } }, "quick")}
          onClose={() => setSymptomSheet(false)} />
      )}
      {hrSheet && (
        <HeartRateSheet restField={hrFields.rest} standField={hrFields.stand}
          answers={today?.answers || {}}
          ghosts={recentAnswers(numberFields, entries, todayStr())} date={todayStr()}
          onSave={(k, v) => onPatch(profile.id, todayStr(), { answers: { [k]: v } }, "quick")}
          onClose={() => setHrSheet(false)} />
      )}
      {triggerSheet && triggerField && (
        <TriggerSheet field={triggerField} value={today?.answers?.[triggerField.k]} date={todayStr()}
          onSave={(k, v) => onPatch(profile.id, todayStr(), { answers: { [k]: v } }, "quick")}
          onClose={() => setTriggerSheet(false)} />
      )}
      {quickAddEditor && (
        <QuickAddEditor
          profile={profile}
          caps={caps}
          stats={stats}
          onSave={(ids, order) => { onUpdateQuickAdd?.(ids, order); setQuickAddEditor(false); }}
          onClose={() => setQuickAddEditor(false)} />
      )}
    </div>
  );
}

/* ============================================================
   App shell
   ============================================================ */

/* =====================================================================
   First run — everything a new journal is built out of

   The screens live in components/FirstRun; this is the data behind them and
   the one function that turns their answers into a profile. There is a single
   path through it, and no long form behind a link: a setup that has to offer
   an escape hatch to a "detailed" version has admitted its main path does not
   do the job.
   ===================================================================== */

/* What the first screen promises, and why it is a list rather than a paragraph.

   A privacy paragraph on a first-run screen is read by nobody, because every
   app has one and they all say the same thing. These five are different: each
   is a checkable fact about this build, phrased so that a user who wanted to
   could go and confirm it before logging a single day. That is the only kind of
   trust claim worth making to a stranger who is about to type their symptoms
   into something.

   If any of these stops being true, this list is the thing that has to change
   first — before the README, before the store copy. */
const PROMISES = [
  ["key", "No account. No sign-up, no email address, no password to lose."],
  ["device", "Your journal is written to this device and read back from it. There is no server holding it, and no copy you did not ask for."],
  /* The honest version of what used to be an absolute. Four things in this app
     can reach the network — sync, AI observations, daily weather, and reading
     your own notes in — and all four are off until somebody turns them on and
     say what they are sending before they send it. A promise that says
     "nothing ever leaves" is a promise this build cannot keep, and a privacy
     claim that is 95% true is worth less than one that is checkable. */
  ["link", "Nothing leaves this device unless you switch it on — sync, AI, the weather, or reading your old notes in. Each one names what it sends, every time, before it goes."],
  ["eye", "No analytics, no trackers, no ads. Nobody is counting your taps."],
  ["download", "Export the whole thing to a spreadsheet whenever you want. It's your data, in a file you keep."],
  ["trash", "Delete everything, permanently, from Settings. No 'contact us to close your account'."],
];

/* part|side → severity scale key it can link a photo rating to */
const ONBOARD_SEVERITY_LINK = {
  "Scalp|": "scalp_severity", "Face|": "face_severity", "Neck|": "neck_severity",
  "Arms|Left": "arms_severity", "Arms|Right": "arms_severity",
  "Hands|Left": "left_hand_severity", "Hands|Right": "right_hand_severity",
  "Legs|Left": "legs_severity", "Legs|Right": "legs_severity",
  "Chest|": "torso_severity", "Abdomen|": "torso_severity", "Back|": "torso_severity",
};
const SIDE_SINGULAR = { Hands: "hand", Arms: "arm", Legs: "leg", Feet: "foot" };
const spotLabel = (s) => (s.side ? `${s.side} ${SIDE_SINGULAR[s.part] || s.part.toLowerCase()}` : s.part);

/* What the first-run screen is allowed to offer, and how it says it.

   The pack catalogue lives in TEMPLATES, which is a data structure about
   questions; this is the same list said out loud to somebody who has just
   opened the app and does not know what a "pack" is. Six of them are shown
   first — the ones people arrive with — and the rest are one tap away.

   Built as a function rather than a constant because `TEMPLATES[*].color` is a
   live getter that follows the theme (see liveTint), and a frozen array would
   pin the first paint's palette forever. */
const FIRST_RUN_BLURBS = {
  eczema: "Itch, flares, skin",
  ibs: "Gut, food, bathroom",
  migraine: "Headaches, triggers",
  pots: "Dizziness, standing",
  fatigue: "Energy, crashes, fog",
  allergy: "Reactions, hives",
  autoimmune: "Symptoms, joints",
  thyroid: "Energy, weight",
  joint: "Pain, stiffness",
  carnivore: "Diet, weight, energy",
  wellness: "Mood, sleep, habits",
};
const FIRST_RUN_ICONS = {
  eczema: "drop", ibs: "bowel", migraine: "spark", pots: "sunrise", fatigue: "moon",
  allergy: "warn", autoimmune: "star", thyroid: "target", joint: "log",
  carnivore: "food", wellness: "sun",
};
const FIRST_RUN_ORDER = ["eczema", "ibs", "migraine", "pots", "fatigue", "wellness"];

function FIRST_RUN_PACKS() {
  const keys = [...FIRST_RUN_ORDER, ...Object.keys(TEMPLATES).filter((k) => !FIRST_RUN_ORDER.includes(k))];
  return keys.filter((k) => TEMPLATES[k]).map((k) => {
    const t = TEMPLATES[k];
    return {
      key: k,
      label: t.label,
      color: t.color,
      blurb: FIRST_RUN_BLURBS[k] || t.fields.filter((f) => f.quick).slice(0, 2).map((f) => f.label).join(", "),
      icon: FIRST_RUN_ICONS[k] || "star",
      keyMetric: t.keyMetric,
      scales: t.fields
        .filter((f) => f.type === "scale" && t.chartMetrics.includes(f.k))
        .slice(0, 6)
        .map((f) => ({
          k: f.k, label: f.label, dir: f.dir,
          /* The question, asked the way a person would ask it. A screen that
             says "Overall skin severity" is a form; one that says "How is your
             skin today?" is somebody being asked. */
          ask: f.k === t.keyMetric ? FIRST_RUN_ASKS[k] : undefined,
        })),
      /* Everything this pack can ask, for the screen where somebody shapes
         their own check-in. Photos and weight are left out on purpose: they
         are not questions to be toggled but decisions with their own screen,
         one step later. */
      questions: t.fields
        .filter((f) => f.type !== "photo" && f.k !== "weight")
        .map((f) => ({ k: f.k, label: f.label, type: f.type, sec: f.sec || "Other", quick: !!f.quick, dir: f.dir })),
      /* Which face the Photos choice wears: a body map, or one progress
         shot. Decided by what the pack itself photographs. */
      photoKind: t.fields.some((f) => f.type === "photo" && f.category !== "progress") ? "skin" : "progress",
    };
  });
}

/* What a journal can hold besides a daily number.

   The old first run asked about photos, then weight, then progress shots, on
   three separate screens, and every one of them was a question about a feature
   rather than about the person. This is the same ground as one screen of
   plain choices — and every one of them lights up a button on the dashboard,
   which is the honest description of what saying yes actually does.

   `suggest` is which conditions arrive with it already ticked. It is the app
   having an opinion, which is useful; everything is still offered to
   everybody, which is the part that matters. */
const FIRST_RUN_EXTRAS = [
  {
    id: "routine", label: "Meds & creams", icon: "pill",
    blurb: "A daily checklist of what you take and use",
    tile: { label: "Routine", icon: "pill" },
    suggest: ["eczema", "migraine", "autoimmune", "thyroid", "allergy", "joint", "pots"],
  },
  {
    id: "food", label: "Meals & drinks", icon: "food",
    blurb: "What you ate, and what it lines up with later",
    tile: { label: "Food", icon: "food" },
    suggest: ["ibs", "allergy", "carnivore", "migraine", "wellness"],
  },
  {
    id: "flare", label: "Flares & bad stretches", icon: "spark",
    blurb: "Mark when one starts and ends — how often, how long, how bad",
    tile: { label: "Flare", icon: "spark" },
    suggest: ["eczema", "ibs", "migraine", "pots", "autoimmune", "fatigue", "joint", "allergy"],
  },
  {
    id: "bowel", label: "Bathroom", icon: "bowel",
    blurb: "Bristol type, urgency, colour — in two taps",
    tile: { label: "Bowel", icon: "bowel" },
    suggest: ["ibs"],
  },
  {
    id: "weight", label: "Weight & measurements", icon: "target",
    blurb: "Numbers you take now and then, straight to a keypad",
    tile: { label: "Measurement", icon: "target" },
    suggest: ["carnivore", "thyroid"],
  },
];

/* What is worth photographing.

   Photos used to be one tick in the list above, and then the app guessed what
   they were of: a body map if the pack looked like skin, a single front-on
   progress shot if it did not. Both guesses are wrong for most people. The
   person with IBS wants the plate; the person starting a new cream wants the
   ingredient list on the tub; the person whose ankle swells wants the ankle.
   None of them were ever going to find that behind a switch labelled "Photos".

   So this is the same ground asked properly — *of what* — and each answer
   becomes a real photo question with its own baseline, so every shot lines up
   against the last one of the same subject.

   `suggest` is which conditions arrive with it ticked. Same rule as the
   extras: the app is allowed an opinion, everything is offered to everybody. */
const FIRST_RUN_PHOTO_SUBJECTS = [
  {
    id: "areas", label: "Specific body areas", icon: "camera", kind: "spots", frame: "square",
    blurb: "Pick them off a body map — each area keeps its own run of photos",
    suggest: ["eczema", "allergy", "autoimmune", "joint"],
  },
  {
    id: "flare", label: "Flare-ups, as they happen", icon: "spark", frame: "square",
    blurb: "One shot of whatever it looks like today, wherever it is",
    suggest: ["eczema", "allergy", "autoimmune"],
  },
  {
    id: "progress", label: "Progress shots", icon: "target", kind: "progress", frame: "tall",
    blurb: "Same pose, weeks apart — front, side or back",
    suggest: ["carnivore", "thyroid"],
  },
  {
    id: "meal", label: "Meals", icon: "food", frame: "square",
    blurb: "The plate, before you forget what was in it",
    suggest: ["ibs", "allergy", "carnivore", "migraine"],
  },
  {
    id: "label", label: "Products & labels", icon: "tube", frame: "tall",
    blurb: "The tub, the box, the ingredient list you'll want to re-read later",
    suggest: ["eczema", "allergy"],
  },
  {
    id: "swelling", label: "Swelling", icon: "drop", frame: "square",
    blurb: "Hands, ankles, anywhere that changes size on a bad day",
    suggest: ["joint", "autoimmune", "pots"],
  },
  {
    id: "healing", label: "Wounds & healing", icon: "heart", frame: "square",
    blurb: "Anything closing up, week by week",
    suggest: [],
  },
  {
    id: "anything", label: "Anything worth a picture", icon: "star", frame: "square",
    blurb: "A catch-all shot for the day — a rash, a bruise, a swollen eye",
    suggest: ["migraine", "fatigue", "wellness", "pots", "thyroid", "ibs"],
  },
];

/* The photo question each subject becomes. `rated` decides whether the camera
   also asks for a 1–10 afterwards, which is right for a flare and absurd for a
   plate of food; `required` is whether a photo session chases it, which only
   the deliberate, repeatable subjects should. */
const PHOTO_SUBJECT_FIELDS = {
  flare: { k: "c_photo_flare", label: "Flare photo", category: "skin", rated: true, required: true },
  meal: { k: "c_photo_meal", label: "Meal photo", category: "custom", rated: false, required: false },
  label: { k: "c_photo_label", label: "Product or label", category: "custom", rated: false, required: false },
  swelling: { k: "c_photo_swelling", label: "Swelling", category: "skin", rated: true, required: false },
  healing: { k: "c_photo_healing", label: "Wound / healing", category: "skin", rated: true, required: false },
  anything: { k: "c_photo_any", label: "Photo of the day", category: "custom", rated: false, required: false },
};

/** What each extra turns on: the Quick Add buttons it lights up, and whether
    it changes the profile itself. Kept beside the catalogue so that adding an
    extra is one edit rather than three. */
const EXTRA_TILES = {
  photos: ["photo"], routine: ["routine"], food: ["food"],
  flare: ["flare"], bowel: ["bowel"], weight: ["measurement"],
};

/* One line each, and the only place in the app that speaks in the second
   person about a body part. It is the first entry somebody ever makes. */
const FIRST_RUN_ASKS = {
  eczema: "How is your skin today?",
  ibs: "How is your gut today?",
  migraine: "How bad is the head today?",
  pots: "How are your symptoms today?",
  fatigue: "How is your energy today?",
  allergy: "How are your reactions today?",
  autoimmune: "How are your symptoms today?",
  thyroid: "How is your energy today?",
  joint: "How is the pain today?",
  carnivore: "How did the day go?",
  wellness: "How are you today?",
};

/* Merge selected packs' fields, de-duped by key (first pack wins) — mirrors getProfileTemplate */
function mergedPackFields(modules) {
  const seen = new Set(); const out = [];
  for (const mk of modules) {
    const t = TEMPLATES[mk]; if (!t) continue;
    for (const f of t.fields) { if (seen.has(f.k)) continue; seen.add(f.k); out.push({ ...f, module: mk }); }
  }
  return out;
}

/* Wizard selections → a complete profile. Pure function.
   - enabledKeys: Set of kept non-photo, non-weight pack field keys
   - spots: [{part, side}] (side "" | "Left" | "Right"); pack photo fields that
     match a spot are re-used instead of duplicated as custom questions
   - photo ratings auto-link to a matching severity question when it's kept */
function buildOnboardProfile(sel) {
  const now = new Date().toISOString();
  const fields = mergedPackFields(sel.modules);
  const disabled = []; const custom = []; const overrides = {};

  const keptKeys = new Set(fields
    .filter((f) => f.type !== "photo" && (f.k === "weight" ? sel.weightOn : sel.enabledKeys.has(f.k)))
    .map((f) => f.k));

  const packPhotoUsed = new Set();
  for (const c of sel.spots) {
    const match = fields.find((f) => f.type === "photo" && f.category !== "progress" &&
      f.bodyPart === c.part && (f.side || "") === (c.side || ""));
    if (match) {
      packPhotoUsed.add(match.k);
      if (match.linkedTo && !keptKeys.has(match.linkedTo)) overrides[match.k] = { linkedTo: null };
      continue;
    }
    const link = ONBOARD_SEVERITY_LINK[`${c.part}|${c.side || ""}`];
    const k = "c_photo_" + c.part.toLowerCase().replace(/[^a-z]/g, "") + (c.side ? "_" + c.side.toLowerCase() : "");
    custom.push({
      ...F.photo(k, spotLabel(c).charAt(0).toUpperCase() + spotLabel(c).slice(1) + " photo", {
        sec: "Photos", category: "skin", bodyPart: c.part, side: c.side || "",
        linkedTo: link && keptKeys.has(link) ? link : null,
      }), custom: true,
    });
  }

  /* The subjects that are not a body area and not a progress angle: one photo
     question each, sitting beside the mapped ones under the same heading. A
     pack that already asks for the same thing is left alone rather than
     duplicated, on the same rule the body areas follow above. */
  for (const id of sel.photoSubjects || []) {
    const spec = PHOTO_SUBJECT_FIELDS[id];
    if (!spec) continue;
    const match = fields.find((f) => f.type === "photo" && f.k === spec.k);
    if (match) { packPhotoUsed.add(match.k); continue; }
    custom.push({
      ...F.photo(spec.k, spec.label, {
        sec: "Photos", category: spec.category, bodyPart: "", side: "",
        rated: spec.rated, linkedTo: null, requiredInSession: spec.required,
      }), custom: true,
    });
  }

  const weightInPacks = fields.some((f) => f.k === "weight");
  if (sel.weightOn && !weightInPacks) {
    custom.push({ k: "c_weight", label: "Weight", type: "number", unit: "lb", min: 0, max: 700, step: 0.1, dir: "neutral", quick: true, sec: "Body", custom: true });
  }
  const weightKey = sel.weightOn ? (weightInPacks ? "weight" : "c_weight") : null;
  for (const ang of ["Front", "Side", "Back"]) {
    const on = sel.progressAngles.includes(ang);
    const packF = fields.find((f) => f.type === "photo" && f.category === "progress" && f.angle === ang);
    if (packF) { if (on) packPhotoUsed.add(packF.k); continue; }
    if (on) custom.push({
      ...F.photo("c_progress_" + ang.toLowerCase(), "Progress photo — " + ang.toLowerCase(), {
        sec: "Progress photos", category: "progress", bodyPart: "Full body", angle: ang,
        rated: false, captionFrom: weightKey,
      }), custom: true,
    });
  }

  for (const f of sel.customs || []) custom.push(f);

  for (const f of fields) {
    if (f.type === "photo") { if (!packPhotoUsed.has(f.k)) disabled.push(f.k); continue; }
    if (f.k === "weight") { if (!sel.weightOn) disabled.push(f.k); continue; }
    if (!sel.enabledKeys.has(f.k)) disabled.push(f.k);
  }

  /* Only honoured if it survived the question step — somebody can pick a main
     number and then switch that very question off two screens later, and a
     journal pointed at a question it does not ask is worse than one falling
     back to its pack's default. */
  const keyMetric = sel.keyMetric && keptKeys.has(sel.keyMetric) ? sel.keyMetric : undefined;

  return {
    id: "p_self", name: (sel.name || "").trim(), modules: [...sel.modules],
    /* An age typed once and stored as a number is a number that is wrong a
       year later, on a document whose whole job is to be handed to a
       clinician. The birth year it implies keeps telling the truth. */
    birthYear: sel.birthYear ?? undefined,
    disabledFields: disabled, customQuestions: custom, fieldOrder: [], fieldOverrides: overrides,
    keyMetric,
    photoBaselines: {}, cameraTimer: 3, prefs: { ...DEFAULT_PREFS }, createdAt: now, updatedAt: now,
  };
}

/* First run's answers → everything a new journal needs.

   Three things come out of it, in one place because they are one decision:
   the profile, the first entry, and the row of one-tap buttons. Splitting
   them was how the app ended up asking somebody about photographs on screen
   four and then not giving them a camera button on screen one.

   The Quick Add row is assembled here rather than left to the dashboard
   default because this person has just *said* what they want — the extras
   they ticked come first, their conditions' own suggestions fill the rest,
   and anything their setup cannot honour is dropped rather than shown as a
   button that opens an apology. */
function firstRunQuickAdd(profile, extras) {
  const ids = ["checkin"];
  for (const id of extras) {
    for (const tile of EXTRA_TILES[id] || []) if (!ids.includes(tile)) ids.push(tile);
  }
  const { caps } = quickAddContext(getProfileTemplate(profile));
  for (const id of defaultQuickAdd(profile.modules)) {
    if (ids.length >= 6) break;
    if (!ids.includes(id)) ids.push(id);
  }
  return ids.filter((id) => tileSupported(quickAddTile(id), caps)).slice(0, 6);
}

function firstRunProfile(choice) {
  const extras = new Set(choice.extras || []);
  const customs = (choice.customQuestions || [])
    .map((c, i) => buildCustomField({ label: c.label, kind: c.type }, i));

  /* The photos act answers *of what*, so nothing here has to be guessed any
     more: body areas only if they asked for the map, angles only if they asked
     for progress shots, and one question per plain subject. */
  const subjects = choice.photoSubjects || [];
  const spots = subjects.includes("areas") ? (choice.spots || []) : [];
  const progressAngles = subjects.includes("progress")
    ? (choice.progressAngles || []).filter((a) => ["Front", "Side", "Back"].includes(a))
    : [];

  const profile = buildOnboardProfile({
    modules: choice.modules,
    enabledKeys: new Set(choice.enabledKeys || []),
    spots,
    weightOn: extras.has("weight"),
    progressAngles,
    photoSubjects: subjects,
    name: choice.name || "",
    birthYear: choice.age ? new Date().getFullYear() - choice.age : undefined,
    customs,
    keyMetric: choice.keyMetric,
  });

  /* The camera button is earned by having something to point at, not by a
     switch: a Photo tile on a journal with no photo questions behind it opens
     an apology. */
  const hasPhotos = (profile.customQuestions || []).some((q) => q.type === "photo")
    || spots.length > 0 || progressAngles.length > 0;
  const tileExtras = hasPhotos ? new Set([...extras, "photos"]) : extras;

  profile.quickAdd = firstRunQuickAdd(profile, tileExtras);
  if (choice.reminder) {
    profile.reminders = [newReminder({
      label: "Daily check-in", time: choice.reminder, kind: "checkin", enabled: true,
    })];
  }

  const firstEntry = choice.score != null && choice.keyMetric
    ? { key: choice.keyMetric, value: choice.score, note: choice.note }
    : null;
  return [profile, "dashboard", firstEntry];
}

/* Tappable front-view body map. Person faces the viewer, so their right side
   is on the viewer's left (labeled). Back of body is a chip below the map. */
function BodyMap({ spots, onToggle, tint }) {
  const has = (part, side = "") => spots.some((s) => s.part === part && (s.side || "") === side);
  const Spot = ({ part, side = "", shape }) => {
    const on = has(part, side);
    const common = {
      fill: on ? tint : C.faint, stroke: on ? tint : C.line, strokeWidth: 1.5,
      style: { cursor: "pointer", transition: "fill 120ms" },
      onClick: () => onToggle({ part, side }),
      role: "button", tabIndex: 0,
      onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle({ part, side }); } },
    };
    return shape(common, <title>{spotLabel({ part, side })}</title>);
  };
  return (
    <svg viewBox="0 0 220 340" className="w-full" style={{ maxHeight: 330 }} aria-label="Tap body areas to track with photos">
      <Spot part="Face" shape={(a, t) => <circle {...a} cx="110" cy="50" r="22">{t}</circle>} />
      <Spot part="Scalp" shape={(a, t) => <ellipse {...a} cx="110" cy="27" rx="21" ry="10">{t}</ellipse>} />
      <Spot part="Neck" shape={(a, t) => <rect {...a} x="100" y="74" width="20" height="13" rx="5">{t}</rect>} />
      <Spot part="Chest" shape={(a, t) => <rect {...a} x="79" y="90" width="62" height="46" rx="14">{t}</rect>} />
      <Spot part="Abdomen" shape={(a, t) => <rect {...a} x="83" y="139" width="54" height="42" rx="14">{t}</rect>} />
      <Spot part="Arms" side="Right" shape={(a, t) => <rect {...a} x="47" y="94" width="23" height="84" rx="11">{t}</rect>} />
      <Spot part="Arms" side="Left" shape={(a, t) => <rect {...a} x="150" y="94" width="23" height="84" rx="11">{t}</rect>} />
      <Spot part="Hands" side="Right" shape={(a, t) => <circle {...a} cx="58" cy="194" r="13">{t}</circle>} />
      <Spot part="Hands" side="Left" shape={(a, t) => <circle {...a} cx="162" cy="194" r="13">{t}</circle>} />
      <Spot part="Legs" side="Right" shape={(a, t) => <rect {...a} x="84" y="185" width="24" height="102" rx="12">{t}</rect>} />
      <Spot part="Legs" side="Left" shape={(a, t) => <rect {...a} x="112" y="185" width="24" height="102" rx="12">{t}</rect>} />
      <Spot part="Feet" side="Right" shape={(a, t) => <ellipse {...a} cx="94" cy="298" rx="15" ry="9">{t}</ellipse>} />
      <Spot part="Feet" side="Left" shape={(a, t) => <ellipse {...a} cx="126" cy="298" rx="15" ry="9">{t}</ellipse>} />
      <text x="34" y="330" fontSize="11" fill={C.sub}>their right</text>
      <text x="146" y="330" fontSize="11" fill={C.sub}>their left</text>
    </svg>
  );
}

/* Five tabs, ordered by how often a thumb reaches for them.

   Export used to hold a permanent slot here and Insights had none, which had
   it backwards: exporting is something you do before an appointment, a few
   times a year, and trends are what you open the app to look at. Export now
   lives at the foot of Insights and in Settings — two places, both of them
   where someone would go looking for it — and the tab it vacated went to the
   screen that earns a daily visit. */
/* Two destinations, one verb, and a way back.

   The five-tab bar (Today, Log, Diary, Insights, Calendar) asked somebody to
   know which shelf a thing lived on before they could put anything on it — a
   tax charged on every visit, paid most often by the person feeling worst.
   What is left is the only division that survives contact with a bad day:
   what is happening now, what has happened, and *add*.

   The bar itself now lives in src/components/ThumbNav.tsx, because it grew a
   fourth job: on any screen you navigated into, the left slot becomes Back and
   says where back goes, and the + is also the handle for the destination fan
   and for pulling the page into reach. Everything the old tabs led to is one
   hold-and-slide from wherever you are, and Settings stayed in the header
   where a preference belongs. */

/* One rounded fix, or nothing.

   The browser's geolocation API is asked with `enableHighAccuracy: false`,
   which is not a formality: it keeps the radio off, answers from the coarse
   network fix, and is the only accuracy this feature ever wanted. Whatever it
   returns is rounded by `coarse` before it is used or sent, so the precise
   value exists only inside this function and only for as long as it takes to
   round it. A refusal, a timeout and an unsupported browser are all the same
   answer here: null, and the app carries on without weather. */
/** One line of weather for a tooltip. A thin wrapper so the history row does
    not have to know about the units preference living on the profile. */
function contextLineFor(ctx, units = "metric") {
  return contextLine(ctx, units);
}

function currentCoords() {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(coarse({ lat: pos.coords.latitude, lon: pos.coords.longitude })),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 30 * 60 * 1000 }
    );
  });
}

/* Forward migration — safe to run on every load; only fills gaps. */
const SCHEMA_VERSION = 3;
/* Off, empty, nothing hidden. A journal that has never touched the AI feature
   and one that has had it switched back off look identical from here. */
/* `auto` is deliberately alongside `enabled` rather than inside the profile:
   both are per-device standing decisions about sending data off this machine,
   and neither travels in a backup. Restoring a journal onto a new phone must
   not switch on automatic uploads there because they were on somewhere else. */
const DEFAULT_AI = { enabled: false, auto: false, analysis: null, dismissed: [] };
function migrateDb(data) {
  const d = { ...data };
  if (!Array.isArray(d.reports)) d.reports = [];
  d.profile = { ...d.profile };
  /* An install that predates the prefs object ran silent, with no backdrop.
     Backfilling it with today's on-by-default values would switch on sound and
     a moving background under someone who never asked for either — so it gets
     the behaviour it already had. New profiles are born with DEFAULT_PREFS in
     blankProfile()/onboarding, and anything already saved passes through
     untouched apart from filling in keys that did not exist yet. */
  {
    const p = d.profile.prefs ? { ...d.profile.prefs } : { ...LEGACY_PREFS };
    const base = p.prefsVersion >= 2 ? DEFAULT_PREFS : LEGACY_PREFS;
    for (const k of ["sound", "haptics", "backdrop"]) {
      if (p[k] === undefined) p[k] = base[k];
    }
    if (p.prefsVersion === undefined) p.prefsVersion = 1;

    /* v3 — sound on by default, motor at its top setting.

       The distinction that matters here is between silence someone *chose* and
       silence they were merely handed. From v2 onward sound shipped on, so a v2
       journal with sound off is a switch someone deliberately flicked, and it
       stays flicked. A v1 journal was silent because the app of the day was
       silent — nobody ever decided that — so it is the one that gets turned up.

       Without that split this migration is just "override the user", which is
       the exact rudeness the v2 seam above was written to prevent. */
    if (p.prefsVersion < 2) p.sound = true;
    if (p.prefsVersion < 3) {
      p.hapticStrength = DEFAULT_PREFS.hapticStrength;
      p.prefsVersion = 3;
    }
    if (!HAPTIC_SCALE[p.hapticStrength]) p.hapticStrength = DEFAULT_PREFS.hapticStrength;
    d.profile.prefs = p;
  }
  /* The backdrop moved out of the journal and into device storage, because the
     first-run screen has to offer it before there is a journal to put it in.
     An older install that had switched it off keeps that, once. */
  migrateBackdropPref(d.profile.prefs);
  d.ai = { ...DEFAULT_AI, ...(d.ai || {}) };
  if (!Array.isArray(d.ai.dismissed)) d.ai.dismissed = [];
  /* Food and bowel logs arrive from three places — a fresh install, an older
     journal that predates them, and a hand-editable backup file — so they are
     sanitised on every load rather than trusted on any of them. */
  d.food = sanitizeFoodLogs(d.food);
  d.bowel = sanitizeBowelLogs(d.bowel);
  d.foods = sanitizeFoodItems(d.foods);
  /* The routine, for the same reason and on the same terms. */
  d.routineItems = sanitizeRoutineItems(d.routineItems);
  d.routine = sanitizeRoutineLogs(d.routine);
  /* Flares, likewise. These drive every duration in Insights, so a row with the
     dates the wrong way round would print negative weeks — sanitizeEpisodes
     repairs that rather than trusting the file. */
  d.episodes = sanitizeEpisodes(d.episodes);
  /* Sun sessions, lab results and experiments — the three collections 1.21
     added. Same rule as everything above: they arrive from local storage, a
     restored backup and a sync pull, so they are repaired on every load rather
     than trusted on any of them. */
  d.sun = sanitizeSunSessions(d.sun);
  d.labs = sanitizeLabResults(d.labs);
  d.experiments = sanitizeExperiments(d.experiments);
  /* Environmental context. This one is *fetched* rather than entered, which
     makes it the collection most likely to be malformed — a provider changing
     a field name would otherwise put NaN behind every day. */
  d.context = sanitizeContexts(d.context);
  /* Whether the person agreed to any of that. Deliberately in the journal
     rather than beside it, unlike the AI switch: this describes what the
     journal is allowed to *contain*, and restoring a backup should carry it.
     The location fix itself is never stored — only the coarse place they set
     by hand, if they set one. */
  d.profile.context = sanitizeConsent(d.profile.context);
  /* Skin type and usual exposure, which the vitamin D estimate reads. */
  d.profile.sun = sanitizeSunProfile(d.profile.sun);
  if (d.profile.goals) d.profile.goals = sanitizeGoals(d.profile.goals);
  /* Same reasoning as the food logs: this arrives from a backup file as often
     as from the editor, and an unknown tile id would render as a gap. */
  if (d.profile.quickAdd !== undefined) d.profile.quickAdd = sanitizeQuickAdd(d.profile.quickAdd);
  /* Whether the hold-and-drag gesture has ever been used. Only ever written
     down once it is true — an explicit `false` on every profile would be a key
     that means "not yet" in a file where absence already says that. */
  if (d.profile.quickAddDragged !== true) delete d.profile.quickAddDragged;
  /* Which actions this person actually uses, and when they last did. Bounded
     and repaired on load: it grows one key per repeatable thing and arrives
     from hand-editable backups like everything else. */
  d.profile.actionStats = sanitizeActionStats(d.profile.actionStats);
  /* Quick Add used to re-sort itself by what somebody tapped most, and now it
     holds still unless they ask for that. Which leaves one question worth
     getting right: what happens to a journal that has been learning for
     months?

     Not "everything jumps back to the factory order the next time you open the
     app", which is the same complaint the change is meant to answer. The
     arrangement they *have* is frozen exactly as it stands — ranked once, on
     the way through, and written down as their own — so the first launch after
     this update looks identical to the last launch before it, and stays that
     way. After that the tiles only ever move because somebody moved them. */
  if (d.profile.quickAddOrder === undefined && Object.keys(d.profile.actionStats || {}).length) {
    const chosen = sanitizeQuickAdd(d.profile.quickAdd) ?? defaultQuickAdd(d.profile.modules);
    d.profile.quickAdd = rankIds(chosen, d.profile.actionStats, todayStr(), "auto");
    d.profile.quickAddOrder = "manual";
  }
  /* The appointment pack's settings — which sections print, the questions
     somebody has been collecting since the last visit, and when that visit was.
     Same reasoning as the rest: this reaches us from a hand-editable backup as
     readily as from our own writer, and a malformed section map would render
     as a pack with nothing in it. */
  d.profile.appointment = sanitizePackPrefs(d.profile.appointment);
  /* Reminders moved from one time to a list. readReminders migrates a
     pre-list install on the way through, so nobody loses the time they set. */
  d.profile.reminders = readReminders(d.profile);
  /* Deletion markers. Swept on every load rather than on a timer: the list is
     tiny, the sweep is pure, and a journal that sat closed for a year should
     not carry a year of them around. */
  d.tombstones = sweepTombstones(Array.isArray(d.tombstones) ? d.tombstones : []);
  d.schemaVersion = SCHEMA_VERSION;
  return d;
}

/* Whether a reminder's job is already done for today. Nudging someone to log
   dinner when dinner is already in the diary is the fastest way to get
   notifications switched off. */
function alreadyDone(db, reminder) {
  const today = todayStr();
  if (reminder.kind === "food") {
    // Within a couple of hours either side of the reminder, not "any food at
    // all today" — breakfast being logged says nothing about dinner.
    const mins = Number(reminder.time.slice(0, 2)) * 60 + Number(reminder.time.slice(3, 5));
    return (db.food || []).some((f) => {
      if (f.date !== today) return false;
      const m = Number(f.time.slice(0, 2)) * 60 + Number(f.time.slice(3, 5));
      return Math.abs(m - mins) <= 120;
    });
  }
  if (reminder.kind === "bowel") return (db.bowel || []).some((b) => b.date === today);
  /* Everything the day asked for has been answered — ticked or deliberately
     skipped. Nudging somebody about a checklist they have already cleared is
     the fastest way to have the whole feature muted. */
  if (reminder.kind === "routine") {
    const p = routineProgress(db.routineItems || [], db.routine || [], today);
    return p.total > 0 && p.done + p.skipped >= p.total;
  }
  const entry = entryOn(entriesFor(db), today);
  return !!entry?.quickLogCompleted || !!entry?.detailedLogCompleted;
}

/* Render-error safety net: the user's data lives in storage, not in React
   state, so a crash here never loses anything. */
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div className="px-4 py-10">
          <Card>
            <div className="font-display text-xl mb-2">Something went wrong on this screen</div>
            <p className="text-sm leading-relaxed mb-3" style={{ color: C.sub }}>
              Your entries and photos are safe — they're stored on this device, not in this screen.
              Going back to the Dashboard usually clears this up.
            </p>
            <button onClick={() => { this.setState({ error: null }); this.props.onRecover && this.props.onRecover(); }}
              className="fhj-btn fhj-btn-primary fhj-btn-block">
              Back to Dashboard
            </button>
          </Card>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App({ viewer = false }) {
  const [db, setDb] = useState(null);
  /* Not a screen name — a *stack* of them.

     Every "back" in the app used to be a guess. The header arrow went to
     Today from wherever you were, so Export → Appointment Pack → back landed
     two screens away from the thing you were reading, and History → Sun →
     back forgot that History existed at all. One array fixes the whole class
     of it, and it is what lets Back become something a thumb can do — from
     the bar, from the side edge, from the phone's own back button — because
     all three now mean the same unambiguous thing.

     `setScreen` keeps its old shape deliberately: forty-odd call sites hand it
     a string and none of them need to know a stack exists. */
  const [navStack, setNavStack] = useState([ROOT]);
  const screen = navTop(navStack);
  const setScreen = (id) => {
    const next = navGo(navStack, id);
    navDir.current = next.length > navStack.length ? 1 : next.length < navStack.length ? -1 : 0;
    setNavStack(next);
  };
  const goBack = () => { navDir.current = -1; setNavStack(navBack(navStack)); };
  const backTo = navParent(navStack);
  const canBack = canGoBack(navStack);
  /* Which direction the last navigation travelled, so the arriving screen can
     answer the departing one. A ref, not state: it is read during the layout
     effect that plays the transition and must never cause a render of its own. */
  const navDir = useRef(0);
  /* Which hand is holding the phone. A device fact, not a journal one — it
     lives in localStorage beside the theme, works before there is a profile,
     and works in the read-only viewer where there is nothing to write to. */
  const [hand, setHandState] = useState(readHand);
  useEffect(() => { applyHand(hand); return onHandChange(setHandState); }, [hand]);
  const flipHand = () => { feedback("toggleOn"); setHandState(setHand(otherHand(hand))); };
  /* Reachability: the top of the screen slid down into the thumb arc. Held in
     the shell rather than the page, so the bar — the one control that must
     always be under the thumb — stays exactly where it is. */
  const [reaching, setReaching] = useState(false);
  const shellRef = useRef(null);
  const [logDate, setLogDate] = useState(todayStr());
  const [logMode, setLogMode] = useState("quick");
  const [logPhotos, setLogPhotos] = useState(false);
  const [reportParams, setReportParams] = useState({ type: "week" });
  /* The pack's range is chosen on Export and carried into the pack screen —
     the two screens have to agree on one window, and a range that lived in the
     pack screen's own state would silently reset every time somebody went back
     to change it. */
  const [packParams, setPackParams] = useState({ range: null });
  /* The + sheet is opened from the navigation bar, which lives in the shell,
     and answered by Today, which owns every sheet it can open. */
  const [addSheet, setAddSheet] = useState(false);
  /* The long form, reached from the first-run screen by anybody who would
     rather build the whole survey now than start with one number. */
  /* One shot, on the very first Today: the screen the journal was just handed
     over on. The last act of first run ends on a card flying into a timeline,
     and landing on a dashboard that simply *appears* would drop the thread —
     this carries the movement one screen further and then never runs again. */
  const [justBegan, setJustBegan] = useState(false);
  /* Which flare the detail screen is showing. Kept here rather than in the URL
     for the same reason every other screen's parameter is: this app has no
     router, and a deep link into a record that may have been deleted on another
     device is a 404 waiting to happen. */
  const [episodeId, setEpisodeId] = useState(null);
  /* The cross-feature glue: a set of dates a finding is currently
     illuminating, and the sentence that says which finding. Tapping an insight,
     an experiment half or a lab period fills it; every surface that draws a day
     reads it. It lives here rather than in each screen because the whole point
     is that it survives navigation — light up a fortnight on Insights, go to
     History, and the same fortnight is lit. */
  const [lit, setLit] = useState(null); // { dates: Set<string>, label: string }
  /* Whether a context fetch is in flight, so the settings card can say so and
     two effects can never race each other into the same window. */
  const contextBusy = useRef(false);
  /* Bumped when the AI setup wizard finishes with "analyse". The dashboard
     watches it and runs immediately, so finishing setup and seeing a result
     are one action rather than two screens apart. */
  const [aiAutoRun, setAiAutoRun] = useState(0);
  const [corrupt, setCorrupt] = useState(null); // { raw, detail } when saved data is unreadable
  const [viewerErr, setViewerErr] = useState(null);
  const [viewerBusy, setViewerBusy] = useState(false);
  // App lock: undefined = still loading, null = no PIN set, {salt,hash} = PIN set.
  // Off by default — one open profile, as today — until someone opts in via Settings.
  const [lock, setLock] = useState(undefined);
  const [unlocked, setUnlocked] = useState(false);
  const [lockFlow, setLockFlow] = useState(null); // null | "setup" | "change-verify" | "change-create" | "disable-verify"
  const saveTimer = useRef(null);
  const loaded = useRef(false);
  const screenRef = useRef(null);

  /* Colours live in a module-level token object (src/lib/theme.ts) that every
     `C.x` read resolves against, so a theme swap only needs the tree to render
     again — no context threading through several thousand lines of markup.
     This also picks up an OS light/dark flip while "Match system" is selected. */
  const [, setThemeTick] = useState(getTheme);
  useEffect(() => onThemeChange(setThemeTick), []);

  // real motion layer: Lenis smooth scrolling (no-op under reduced motion)
  useEffect(() => { initSmoothScroll(); }, []);

  /* How much of the screen the soft keyboard is covering, as a CSS variable.

     Chromium gets this for free from `interactive-widget=resizes-content` in
     the viewport meta — the layout viewport shrinks and everything sized in
     dvh follows. iOS Safari does not: it slides the *visual* viewport up and
     leaves fixed elements anchored where they were, so a bottom sheet's
     action row ends up behind the keys, which is the single most common way a
     web form on a phone gives itself away.

     Reading visualViewport and lifting the scrim by that much fixes it
     everywhere, and costs nothing where the meta tag already worked, because
     there the inset measures zero. */
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!vv) return;
    const apply = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      // Under ~80px is a URL bar collapsing, not a keyboard; moving for that
      // would make ordinary scrolling shift the sheet around.
      document.documentElement.style.setProperty("--fhj-kb", inset > 80 ? `${Math.round(inset)}px` : "0px");
    };
    apply();
    vv.addEventListener("resize", apply);
    vv.addEventListener("scroll", apply);
    return () => {
      vv.removeEventListener("resize", apply);
      vv.removeEventListener("scroll", apply);
    };
  }, []);
  /* How far "bring it into reach" moves the page, in px, kept on the root so
     the stylesheet and the gesture cannot disagree about it. A third of the
     viewport on a phone; capped, because a tablet does not need half a metre
     of empty space slid into view to put a header under a thumb. */
  useEffect(() => {
    const apply = () => document.documentElement.style.setProperty("--fhj-reach", `${reachDrop(window.innerHeight)}px`);
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, []);

  /* The phone's own Back means what the bar's Back means. Read through a ref
     so the listener is mounted once and still sees the current stack — a
     listener rebuilt on every navigation would re-arm the history buffer on
     every navigation too, and the entries would pile up. */
  const stackRef = useRef(navStack);
  stackRef.current = navStack;
  useEffect(() => onSystemBack(() => {
    if (!canGoBack(stackRef.current)) return false;
    navDir.current = -1;
    setNavStack(navBack(stackRef.current));
    return true;
  }), []);

  /* GSAP screen transition + scroll reset on navigation (pre-paint, no flash).
     The direction is the one the stack just moved in, mirrored for a left hand
     so the arrival always comes from the side the gesture pushed towards. */
  useLayoutEffect(() => {
    scrollToTop(true);
    const dir = navDir.current;
    navDir.current = 0;
    animateScreenChange(screenRef.current, dir, hand === "left" ? -34 : 34);
  }, [screen]);
  /* A screen change under a reached-down page would leave the new screen
     hanging halfway down the display. Arriving somewhere puts it back. */
  useEffect(() => { setReaching(false); }, [screen]);
  // belt-and-braces: editing screens are unreachable in the read-only viewer
  useEffect(() => {
    if (viewer && ["log", "settings", "setup", "fitbit"].includes(screen)) setScreen("dashboard");
  }, [viewer, screen]);

  // keep the module-level feedback helper in sync with saved prefs
  useEffect(() => {
    if (db?.profile?.prefs) {
      FB.prefs = db.profile.prefs;
      setSoundEnabled(db.profile.prefs.sound !== false);
    }
  }, [db?.profile?.prefs]);

  /* Hand the audio hardware back while the app is in the background. Without
     this, a phone keeps the output route open behind a locked screen. */
  useEffect(() => {
    const onVis = () => (document.hidden ? suspendSound() : resumeSound());
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    (async () => {
      if (viewer) { loaded.current = true; return; } // viewer starts empty, loads from a file
      const raw = await store.get(SKEY);
      let data = null;
      if (raw) { try { data = JSON.parse(raw); } catch (e) { data = null; } }
      if (raw && String(raw).trim()) {
        // data exists on this device — never silently discard it
        const check = data ? validateDatabase(data) : { ok: false, errors: ["Saved data isn't valid JSON."] };
        if (!check.ok) {
          setCorrupt({ raw: String(raw), detail: check.errors.slice(0, 3).join(" ") });
          return; // recovery screen decides what happens next
        }
      }
      if (!data || !data.profile) data = { profile: blankProfile(), entries: [], ack: false, onboarded: false };
      else if (data.onboarded === undefined) data.onboarded = true; // existing installs skip the wizard
      data = migrateDb(data);
      loaded.current = true;
      setDb(data);
    })();
  }, []);

  // App lock: the viewer never carries a real journal, so it's never locked.
  useEffect(() => {
    if (viewer) { setLock(null); return; }
    (async () => {
      const raw = await store.get(LOCK_KEY);
      let record = null;
      if (raw) { try { record = JSON.parse(raw); } catch (e) { record = null; } }
      setLock(record);
    })();
  }, [viewer]);

  // Re-lock whenever the app is backgrounded, so a PIN actually protects
  // against someone picking up the phone later — not just the first open.
  useEffect(() => {
    if (viewer || !lock) return;
    const onVisibility = () => { if (document.hidden) setUnlocked(false); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [viewer, lock]);

  useEffect(() => {
    if (viewer || !db || !loaded.current) return; // read-only viewer never persists
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { store.set(SKEY, JSON.stringify(db)); }, 500);
    return () => clearTimeout(saveTimer.current);
  }, [db]);

  /* ---------- cross-device sync ----------

     Deliberately *after* the save effect above and completely separate from it.
     The journal reaches disk on its own 500ms debounce whether or not sync
     exists, is on, is signed in, or can see a network — and `nudge()` below is
     a flag set on an object, not a request. That ordering is the whole reason
     a save can never be slowed down, blocked, or lost by anything to do with
     syncing. */
  const dbRef = useRef(db);
  dbRef.current = db;
  const [syncStatus, setSyncStatus] = useState(IDLE_STATUS);
  const [syncConfigured, setSyncConfigured] = useState(syncAvailable);
  const engineRef = useRef(null);
  if (!engineRef.current && !viewer) {
    engineRef.current = new SyncEngine({
      backend: new SupabaseBackend(),
      kv: { get: store.get, set: store.set, del: store.del },
      getDb: () => dbRef.current,
      /* Remote changes come in through the same setState every local edit uses,
         so they persist on the same debounce and re-render the same way. There
         is no second write path to keep in step. */
      applyDb: (next) => setDb(next),
      onStatus: setSyncStatus,
      photos: {
        listLocal: async () => Object.keys(await loadPhotoIndex()),
        read: async (id) => {
          const full = await loadPhotoData(id);
          if (!full) return null;
          return { full, thumb: (await loadThumbData(id)) || full };
        },
        write: async (id, blob) => {
          const ix = await loadPhotoIndex();
          if (ix[id]) return; // already here; never overwrite a local original
          await savePhotos([{ id, full: blob.full, thumb: blob.thumb, takenAt: new Date().toISOString() }]);
        },
      },
    });
    SYNC_ENGINE = engineRef.current;
  }

  useEffect(() => {
    const engine = engineRef.current;
    if (viewer || !engine) return;
    engine.start().catch(() => {});
    return () => engine.stop();
  }, [viewer]);

  /* One nudge per journal change. Coalesced inside the engine, so a burst of
     taps in Quick Log is one round trip and not fifteen. */
  useEffect(() => {
    if (viewer || !db || !loaded.current) return;
    engineRef.current?.nudge();
  }, [db, viewer]);

  // Push a tiny summary to the iOS Home Screen widget (no-op outside the
  // native shell — see src/lib/widgetBridge.ts). Same debounce as the save
  // above so rapid taps in Quick Log don't spam the App Group write.
  useEffect(() => {
    if (viewer || !db || !loaded.current) return;
    const t = setTimeout(() => {
      try {
        const entries = entriesFor(db);
        const tpl = getProfileTemplate(db.profile);
        const keyField = getField(tpl, tpl.keyMetric);
        const today = entryOn(entries, todayStr());
        const keyToday = keyField ? today?.answers[tpl.keyMetric] : null;
        const trend = keyField ? trendFor(entries, tpl.keyMetric, keyField.dir) : { status: "nodata" };
        const trendLabel = trend.status === "improving" ? "Improving"
          : trend.status === "worsening" ? "Worsening"
          : trend.status === "stable" ? "Steady" : "";
        syncWidgetSnapshot({
          streak: calcStreak(entries),
          todayLogged: !!today?.quickLogCompleted || !!today?.detailedLogCompleted,
          metricLabel: keyField ? keyField.label : "Log today",
          metricValue: typeof keyToday === "number" ? String(keyToday) : "—",
          trendLabel,
        });
      } catch (e) { /* widget sync is best-effort */ }
    }, 500);
    return () => clearTimeout(t);
  }, [db, viewer]);

  /* ---------- daily environmental context ----------

     The only effect in this app that makes a network request without being
     asked to, which is why every guard is in front of it:

     · `enabled` is false until somebody switches it on, and switching it off
       stops this on the next render. There is no queue to drain.
     · A location is asked for only when they chose `device`; a place they typed
       is used as-is, already coarse.
     · It runs at most once per app open per hour, and only when today's record
       is actually missing or stale — a phone left open all day does not sit
       there polling a weather service.
     · Coordinates are rounded before the request is built (see `coarse`), so
       the precise fix never leaves this function.

     Failures are silent by design. A journal whose weather did not load is a
     journal, and an error banner over somebody's health data because a
     forecast API had a bad minute would be the tail wagging the dog. */
  const contextRun = useRef(0);
  useEffect(() => {
    if (viewer || !db || !db.onboarded) return;
    const consent = db.profile.context;
    if (!consent?.enabled || consent.location === "off") return;
    if (contextBusy.current) return;
    /* Once an hour at most, per app open. */
    if (Date.now() - contextRun.current < 3600 * 1000) return;

    const today = todayStr();
    const rows = db.context || [];
    if (!needsRefresh(contextOn(rows, today), today, today)) return;

    let cancelled = false;
    contextBusy.current = true;
    contextRun.current = Date.now();
    (async () => {
      try {
        const place = consent.location === "manual"
          ? (consent.place ? { lat: consent.place.lat, lon: consent.place.lon } : null)
          : await currentCoords();
        if (!place || cancelled) return;
        /* How far back to fill: enough to cover the days this journal has but
           the weather does not, capped at the provider's own window. */
        const missing = entriesFor(db).filter((e) => !contextOn(rows, e.date)).length;
        const { rows: fetched } = await fetchContext(place, Math.min(60, Math.max(7, missing)));
        if (cancelled || !fetched.length) return;
        setDb((prev) => ({ ...prev, context: mergeContexts(prev.context || [], fetched) }));
      } catch (e) {
        /* Offline, permission refused, provider down — all the same here. */
      } finally {
        contextBusy.current = false;
      }
    })();
    return () => { cancelled = true; contextBusy.current = false; };
  }, [viewer, db?.onboarded, db?.profile?.context?.enabled, db?.profile?.context?.location, db?.context?.length]);

  // Tapping the iOS widget opens straight to today's Quick Log (no-op on web).
  useEffect(() => {
    if (viewer) return;
    return onWidgetDeepLink(() => { setLogDate(todayStr()); setLogMode("quick"); setLogPhotos(false); setScreen("log"); });
  }, [viewer]);

  // Home Screen shortcuts ("Log today") arrive as ?screen=log. Consumed once,
  // after the journal has loaded, then wiped from the address bar so a refresh
  // doesn't drag the user back out of wherever they navigated to.
  const deepLinked = useRef(false);
  useEffect(() => {
    if (viewer || !db || !db.onboarded || deepLinked.current) return;
    deepLinked.current = true;
    const target = screenFromSearch(typeof window === "undefined" ? "" : window.location.search);
    if (!target) return;
    if (target === "log") { setLogDate(todayStr()); setLogMode("quick"); setLogPhotos(false); }
    if (target === "report") setReportParams({ type: "week" });
    setScreen(target);
    clearDeepLink();
  }, [viewer, db]);

  /* Reminders, browser layer. Only fires while the page is alive, which is
     exactly what the settings copy promises — the calendar file is what covers
     a closed browser.

     One timer, always armed for whichever reminder is next rather than one
     timer per reminder: with five meal reminders that would be five live
     timeouts re-created on every database write. A reminder whose job is
     already done for today stays silent. */
  useEffect(() => {
    if (viewer || !db || !db.onboarded) return;
    if (notificationPermission() !== "granted") return;
    const reminders = readReminders(db.profile);
    if (!reminders.some((r) => r.enabled)) return;

    let timer = null;
    const arm = () => {
      const due = nextReminderDue(reminders);
      if (!due) return;
      timer = setTimeout(() => {
        if (!alreadyDone(db, due.reminder)) showReminderNotification(reminderMessage(due.reminder));
        arm(); // roll forward to the next one
      }, due.ms);
    };
    arm();
    return () => { if (timer) clearTimeout(timer); };
  }, [viewer, db]);

  // Ask the browser to stop evicting this origin's storage. Chrome usually
  // grants it silently for installed / returning visitors; a refusal is fine
  // and simply leaves the Settings card's manual button in play.
  useEffect(() => {
    if (viewer || !db || !db.onboarded) return;
    requestPersistentStorage().catch(() => {});
  }, [viewer, db?.onboarded]);

  const upsertEntry = (profileId, date, patch, mode) => {
    setDb((prev) => {
      const now = new Date().toISOString();
      const entries = [...prev.entries];
      const i = entries.findIndex((e) => e.profileId === profileId && e.date === date);
      /* A day exists in this journal because something was recorded on it.
         Skipping every question writes nulls — which is how the survey marks
         "asked and declined" — and creating a day out of nothing but declines
         would put a dot on the calendar, a day on the streak and a row in the
         export for a day nobody logged. An existing day still accepts a null:
         that is clearing an answer, which is a real edit. */
      if (i < 0 && !patchHasContent(patch)) return prev;
      const mergePhotos = (existing) => {
        if (!patch.photos) return existing || {};
        const merged = { ...(existing || {}), ...patch.photos };
        return Object.fromEntries(Object.entries(merged).filter(([, v]) => v != null));
      };
      if (i >= 0) {
        const e = entries[i];
        entries[i] = {
          ...e,
          answers: { ...e.answers, ...(patch.answers || {}) },
          photos: mergePhotos(e.photos),
          notes: patch.notes !== undefined ? patch.notes : e.notes,
          quickLogCompleted: e.quickLogCompleted || mode === "quick",
          detailedLogCompleted: e.detailedLogCompleted || mode === "detailed",
          auto: false, // any manual edit makes an imported day a "real" logged day
          updatedAt: now,
        };
      } else {
        entries.push({
          id: uid(), profileId, date,
          answers: patch.answers || {}, photos: mergePhotos(null), notes: patch.notes || "",
          quickLogCompleted: mode === "quick", detailedLogCompleted: mode === "detailed",
          createdAt: now, updatedAt: now,
        });
      }
      return { ...prev, entries };
    });
  };

  const updateProfile = (draft) => {
    setDb((prev) => ({
      ...prev,
      profile: {
        ...prev.profile, name: draft.name, modules: draft.modules, disabledFields: draft.disabledFields,
        /* Cleared on purpose when the box is emptied: "I'd rather not say" has
           to be a thing somebody can change their mind into. */
        birthYear: draft.birthYear,
        customQuestions: draft.customQuestions, fieldOrder: draft.fieldOrder, fieldOverrides: draft.fieldOverrides,
        keyMetric: draft.keyMetric ?? prev.profile.keyMetric,
        cameraTimer: draft.cameraTimer ?? prev.profile.cameraTimer ?? 3,
        updatedAt: new Date().toISOString(),
      },
    }));
  };

  const setPhotoBaseline = (fieldKey, photoId) => {
    setDb((prev) => ({
      ...prev,
      profile: {
        ...prev.profile,
        photoBaselines: { ...(prev.profile.photoBaselines || {}), [fieldKey]: photoId },
        updatedAt: new Date().toISOString(),
      },
    }));
  };

  const openViewerBackup = async (text) => {
    setViewerErr(null); setViewerBusy(true);
    try {
      const obj = JSON.parse(text);
      const v = validateBackup(obj);
      if (!v.ok) { setViewerErr(v.error); return; }
      await restoreBackup(obj, (next) => { loaded.current = true; setDb(next); });
    } catch (e) {
      setViewerErr("That file couldn't be read. It should be a .json backup exported from the app.");
    } finally { setViewerBusy(false); }
  };
  const openViewerDemo = () => {
    loaded.current = true;
    setDb(migrateDb({ ...genSampleData(), ack: true, onboarded: true }));
  };

  const handleUnlock = async (pin) => {
    const ok = await verifyPin(pin, lock);
    if (ok) { setUnlocked(true); feedback("save"); }
    return ok;
  };
  const handleForgotPin = async () => {
    if (window.confirm(
      "Forgot your PIN? This removes the PIN lock but keeps all your journal data safe on this device. " +
      "You can turn a new PIN on anytime in Settings."
    )) {
      await store.del(LOCK_KEY);
      setLock(null);
      setUnlocked(true);
    }
  };
  const handleCreatePin = async (pin) => {
    const record = await createPinRecord(pin);
    await store.set(LOCK_KEY, JSON.stringify(record));
    setLock(record);
    setUnlocked(true);
    setLockFlow(null);
    feedback("save");
    return true;
  };
  const handleVerifyForChange = async (pin) => {
    const ok = await verifyPin(pin, lock);
    if (ok) setLockFlow("change-create");
    return ok;
  };
  const handleVerifyForDisable = async (pin) => {
    const ok = await verifyPin(pin, lock);
    if (ok) {
      await store.del(LOCK_KEY);
      setLock(null);
      setLockFlow(null);
      feedback("save");
    }
    return ok;
  };

  // App lock gates come first — before onboarding/corrupt-data/viewer screens,
  // since those can surface raw journal content too.
  /* The arrival, once. Declared here with the other effects rather than beside
     the JSX it animates: everything below this point sits under early returns
     (first run, the lock screen, recovery), and a hook after one of those is
     the "rendered more hooks than during the previous render" crash this file
     has already paid for once — see the note on ReportScreen. */
  useEffect(() => {
    if (!justBegan) return;
    const t = setTimeout(() => {
      animateStepIn(screenRef.current);
      setJustBegan(false);
    }, 30);
    return () => clearTimeout(t);
  }, [justBegan]);

  if (!viewer && lock === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg, color: C.sub }}>
        <div className="font-display text-lg">{APP_NAME}…</div>
      </div>
    );
  }
  if (!viewer && lock && !unlocked) {
    return (
      <LockScreen key="unlock-gate" mode="verify" title="Enter your PIN" subtitle="Health Journal is locked on this device."
        tint={db?.profile ? getProfileTemplate(db.profile).color : undefined}
        onSubmit={handleUnlock} onForgot={handleForgotPin} />
    );
  }

  if (viewer && !db) {
    return <ViewerLanding onFileText={openViewerBackup} onDemo={openViewerDemo} error={viewerErr} busy={viewerBusy} />;
  }

  if (corrupt) {
    return (
      <RecoveryScreen raw={corrupt.raw} detail={corrupt.detail}
        onStartFresh={() => {
          const fresh = migrateDb({ profile: blankProfile(), entries: [], ack: false, onboarded: false });
          loaded.current = true; setCorrupt(null); setDb(fresh);
        }} />
    );
  }

  if (!db) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg, color: C.sub }}>
        <div className="font-display text-lg">{APP_NAME}…</div>
      </div>
    );
  }

  if (!db.onboarded) {
    /* One writer for the whole first run. The profile, the first entry and
       the reminder all land together — the entry belongs to a profile that
       did not exist until this line, and a nudge for a journal that has not
       been created yet is a notification about nothing. */
    const beginJournal = (profile, dest, firstEntry) => {
      setDb((prev) => {
        const next = { ...prev, profile, ack: true, onboarded: true };
        if (firstEntry && firstEntry.key && firstEntry.value != null) {
          const now = new Date().toISOString();
          next.entries = [...(prev.entries || []), {
            id: uid(), profileId: profile.id, date: todayStr(),
            answers: { [firstEntry.key]: firstEntry.value }, photos: {},
            notes: (firstEntry.note || "").trim(),
            quickLogCompleted: true, detailedLogCompleted: false,
            createdAt: now, updatedAt: now,
          }];
        }
        return next;
      });
      if (dest === "log") { setLogDate(todayStr()); setLogMode("quick"); setLogPhotos(false); setScreen("log"); }
      else setScreen("dashboard");
      setJustBegan(true);
    };

    return (
      <>
        <AmbientBackdrop />
        <FirstRun
          packs={FIRST_RUN_PACKS()}
          extras={FIRST_RUN_EXTRAS}
          photoSubjects={FIRST_RUN_PHOTO_SUBJECTS}
          promises={PROMISES}
          Icon={Icon}
          BodyMap={BodyMap}
          spotLabel={spotLabel}
          appName={APP_NAME}
          disclaimer={DISCLAIMER}
          onLoadSample={() => { loadSampleData(setDb); setScreen("dashboard"); }}
          onComplete={(choice) => beginJournal(...firstRunProfile(choice))}
        />
      </>
    );
  }

  const profile = db.profile;
  const entries = entriesFor(db);
  const tpl = getProfileTemplate(profile);

  // Settings-driven PIN setup/change/disable flows — full-screen, same as unlock.
  if (!viewer && lockFlow === "setup") {
    return (
      <LockScreen key="setup" mode="create" title="Choose a PIN" subtitle="You'll need this PIN to open Health Journal on this device."
        tint={tpl.color} onSubmit={handleCreatePin} onCancel={() => setLockFlow(null)} />
    );
  }
  if (!viewer && lockFlow === "change-verify") {
    return (
      <LockScreen key="change-verify" mode="verify" title="Enter your current PIN" tint={tpl.color}
        onSubmit={handleVerifyForChange} onCancel={() => setLockFlow(null)} />
    );
  }
  if (!viewer && lockFlow === "change-create") {
    return (
      <LockScreen key="change-create" mode="create" title="Choose a new PIN" tint={tpl.color}
        onSubmit={handleCreatePin} onCancel={() => setLockFlow(null)} />
    );
  }
  if (!viewer && lockFlow === "disable-verify") {
    return (
      <LockScreen key="disable-verify" mode="verify" title="Enter your PIN to turn off the lock" tint={tpl.color}
        onSubmit={handleVerifyForDisable} onCancel={() => setLockFlow(null)} />
    );
  }

  const goHome = () => setScreen("dashboard");
  /* `opts.photos` opens straight into the camera session — what Quick Add's
     "Progress shot" tile has always claimed to do. */
  const goToLog = (d, opts) => {
    if (viewer) return;
    setLogDate(d); setLogMode("quick"); setLogPhotos(!!opts?.photos); setScreen("log");
  };
  const goReport = (type) => { setReportParams({ type }); setScreen("report"); };
  const openPack = (range) => { setPackParams({ range }); setScreen("pack"); };
  const openSavedReport = (savedId) => { setReportParams({ savedId }); setScreen("report"); };
  const deleteSavedReport = (id) => setDb((prev) => ({ ...prev, reports: (prev.reports || []).filter((r) => r.id !== id) }));
  /* The AI slice holds the opt-in flag, the last analysis, and which
     observations the user hid. The API key is deliberately NOT in here — it
     lives under its own storage key so it can never ride along in a backup. */
  const setAi = (updater) => setDb((prev) => {
    const cur = prev.ai || DEFAULT_AI;
    return { ...prev, ai: typeof updater === "function" ? updater(cur) : { ...cur, ...updater } };
  });
  /* Food and bowel logs are upserted by id, so editing a row and adding one
     are the same code path. Deletes take the photo with them — an orphaned
     blob is invisible storage the user can never reclaim. */
  /* Saving is optimistic and reversible. The sheet closes on the tap, the row
     is in the timeline before the next frame, and the receipt arrives as a
     toast carrying an Undo — which is strictly better than a confirmation
     step, because it charges only the people who actually made a mistake.

     Undo restores the whole slice as it was, including the food library:
     saving a meal teaches the library, so un-saving it has to un-teach exactly
     that much and nothing more. */
  const LOG_CAT = { food: "fhj-cat-food", bowel: "fhj-cat-bowel", routine: "fhj-cat-routine" };
  const SAVED_TEXT = {
    food: (log, isEdit) => (isEdit ? "Meal updated" : `Added to ${mealLabel(log.meal).toLowerCase()}`),
    bowel: (log, isEdit) => (isEdit ? "Entry updated" : "Bowel movement logged"),
    routine: (log, isEdit) =>
      log.skipped ? `${log.name} — skipped` : isEdit ? `${log.name} updated` : `${log.name} logged`,
  };
  const DELETED_TEXT = { food: "Meal deleted", bowel: "Entry deleted", routine: "Entry removed" };
  const upsertLog = (slice) => (log) => {
    let before = null;
    setDb((prev) => {
      const rows = prev[slice] || [];
      const i = rows.findIndex((r) => r.id === log.id);
      const next = i >= 0 ? rows.map((r) => (r.id === log.id ? log : r)) : [...rows, log];
      /* Saving a meal teaches the library, which is the entire reason the
         second time you eat something is one tap. Deletes deliberately don't
         un-teach it: a meal you logged and removed is still a food you might
         eat again. */
      const foods = slice === "food" ? rememberFood(prev.foods || [], log) : prev.foods;
      /* Logging a routine item counts against the item it came from, the same
         way saving a meal teaches the food library. Only on a first write —
         editing yesterday's dose is not another dose. */
      const routineItems = slice === "routine" && i < 0
        ? bumpItemUse(prev.routineItems || [], log.itemId)
        : prev.routineItems;
      before = { rows, foods: prev.foods, routineItems: prev.routineItems };
      return { ...prev, [slice]: next, foods, routineItems };
    });
    const isEdit = (db[slice] || []).some((r) => r.id === log.id);
    toast({
      text: SAVED_TEXT[slice](log, isEdit),
      cat: LOG_CAT[slice],
      undo: () => setDb((prev) => (before
        ? { ...prev, [slice]: before.rows, foods: before.foods, routineItems: before.routineItems }
        : prev)),
    });
  };
  const removeLog = (slice) => (log) => {
    /* A deletion has to be written down, not just performed. A row that is
       simply absent is indistinguishable from a row that hasn't arrived yet, so
       without a tombstone the next pull from another device brings it straight
       back. Harmless when sync is off — the list is swept and never read. */
    const deviceId = engineRef.current?.getDeviceId?.() || "local";
    setDb((prev) => addTombstone(
      { ...prev, [slice]: (prev[slice] || []).filter((r) => r.id !== log.id) },
      slice, log.id, deviceId
    ));
    engineRef.current?.noteDeleted?.(slice, log.id);
    let undone = false;
    toast({
      text: DELETED_TEXT[slice],
      icon: "trash",
      cat: LOG_CAT[slice],
      undo: () => {
        undone = true;
        setDb((prev) => ({
          ...prev,
          [slice]: [...(prev[slice] || []), log],
          /* Undo has to lift the tombstone too, or the row comes back here and
             is deleted again on the next sync. */
          tombstones: (prev.tombstones || []).filter((t) => !(t.kind === slice && t.id === log.id)),
        }));
        engineRef.current?.noteDeleted?.(slice, log.id);
      },
    });
    /* The photo blob outlives the toast rather than going with the row. An
       Undo that brought a meal back without its photo would be a worse lie
       than no Undo at all. */
    if (log.photoId) {
      setTimeout(() => { if (!undone) deletePhotos([log.photoId]).catch(() => {}); }, 9000);
    }
  };

  /* A handful of pills, logged as a handful. Every row lands in one write, so
     the whole thing is one toast and one Undo rather than four of each — and
     the item use-counts move with them, exactly as if each had been tapped. */
  const saveRoutineRows = (rows, label) => {
    if (!rows?.length) return;
    const logs = rows.map((r) => logFromItem(r.item, { date: r.date || todayStr(), slot: r.slot }));
    let before = null;
    setDb((prev) => {
      before = { routine: prev.routine || [], routineItems: prev.routineItems || [] };
      let routineItems = prev.routineItems || [];
      for (const log of logs) routineItems = bumpItemUse(routineItems, log.itemId);
      return { ...prev, routine: [...(prev.routine || []), ...logs], routineItems };
    });
    toast({
      text: `${logs.length} logged${label ? ` · ${label.toLowerCase()}` : ""}`,
      cat: "fhj-cat-routine",
      undo: () => setDb((prev) => (before ? { ...prev, ...before } : prev)),
    });
  };

  const setLibrary = (foods) => setDb((prev) => ({ ...prev, foods }));

  /* Routine items are the *plan*, not the history, so they are edited rather
     than logged: no toast-and-undo, because the sheet the user just pressed
     Save in is the receipt. Deleting one leaves every log it produced exactly
     as it was — each carries its own copy of the name and dose. */
  const saveRoutineItem = (item) => setDb((prev) => {
    const rows = prev.routineItems || [];
    const i = rows.findIndex((r) => r.id === item.id);
    return {
      ...prev,
      routineItems: i >= 0 ? rows.map((r) => (r.id === item.id ? item : r)) : [...rows, item],
    };
  });

  const deleteRoutineItem = (item) => {
    const deviceId = engineRef.current?.getDeviceId?.() || "local";
    setDb((prev) => addTombstone(
      { ...prev, routineItems: (prev.routineItems || []).filter((r) => r.id !== item.id) },
      "routineItem", item.id, deviceId
    ));
    engineRef.current?.noteDeleted?.("routineItem", item.id);
    toast({
      text: `${item.name} removed`,
      icon: "trash",
      cat: "fhj-cat-routine",
      undo: () => {
        setDb((prev) => ({
          ...prev,
          routineItems: [...(prev.routineItems || []), item],
          tombstones: (prev.tombstones || []).filter((t) => !(t.kind === "routineItem" && t.id === item.id)),
        }));
        engineRef.current?.noteDeleted?.("routineItem", item.id);
      },
    });
  };

  /* ---------- flares ----------
     Marked by hand, never detected. `startFlare` refuses a second open flare
     for the same metric and hands back the running one, so the button can only
     ever produce a state that means something. */
  const beginFlare = () => {
    const metric = getProfileTemplate(db.profile).keyMetric;
    let opened = null;
    setDb((prev) => {
      const r = startFlare(prev.episodes || [], { metric, start: todayStr() });
      opened = r;
      return r.refused ? prev : { ...prev, episodes: r.list };
    });
    if (opened?.refused) {
      setEpisodeId(opened.episode.id);
      setScreen("episode");
      return;
    }
    feedback("save");
    toast({
      text: "Flare started today",
      cat: "fhj-cat-symptom",
      undo: () => setDb((prev) => ({
        ...prev,
        episodes: removeEpisode(prev.episodes || [], opened.episode.id),
      })),
    });
  };

  const finishFlare = (id) => {
    let before = null;
    setDb((prev) => {
      before = prev.episodes || [];
      return { ...prev, episodes: endFlare(before, id, todayStr()) };
    });
    feedback("save");
    toast({
      text: "Flare ended today",
      cat: "fhj-cat-symptom",
      undo: () => setDb((prev) => (before ? { ...prev, episodes: before } : prev)),
    });
  };

  const patchEpisode = (id, patch) => setDb((prev) => ({
    ...prev, episodes: updateEpisode(prev.episodes || [], id, patch),
  }));

  /* ---------- sun sessions ----------

     A finished session is a record like any other log: written, toasted,
     undoable. It never recomputes itself from today's profile afterwards —
     see the header of lib/sun for why that rule is load-bearing. */

  const saveSunSession = (session) => {
    let before = null;
    setDb((prev) => {
      before = prev.sun || [];
      return { ...prev, sun: [...before, session] };
    });
    feedback("save");
    toast({
      text: `${minutesLabel(session.minutes)} outside`,
      cat: "fhj-cat-symptom",
      undo: () => setDb((prev) => (before ? { ...prev, sun: before } : prev)),
    });
  };

  const deleteSunSession = (id) => {
    const deviceId = engineRef.current?.getDeviceId?.() || "local";
    const row = (db.sun || []).find((s) => s.id === id);
    setDb((prev) => addTombstone(
      { ...prev, sun: (prev.sun || []).filter((s) => s.id !== id) }, "sun", id, deviceId
    ));
    engineRef.current?.noteDeleted?.("sun", id);
    toast({
      text: "Session removed",
      icon: "trash",
      cat: "fhj-cat-symptom",
      undo: () => setDb((prev) => ({
        ...prev,
        sun: row ? [...(prev.sun || []), row] : prev.sun,
        tombstones: (prev.tombstones || []).filter((t) => !(t.kind === "sun" && t.id === id)),
      })),
    });
  };

  /* ---------- labs ---------- */

  const saveLab = (input) => {
    const row = newLabResult(input);
    let before = null;
    setDb((prev) => {
      before = prev.labs || [];
      return { ...prev, labs: [...before, row] };
    });
    feedback("save");
    const series = labSeries([...(db.labs || []), row], row.test);
    const prevPoint = series.length > 1 ? series[series.length - 2] : null;
    toast({
      /* The toast says the *change*, because that is the thing somebody who
         has just typed in a number wants confirmed. */
      text: prevPoint
        ? `${row.name}: ${prevPoint.value} → ${row.value} ${row.unit}`
        : `${row.name} recorded`,
      cat: "fhj-cat-symptom",
      undo: () => setDb((prev) => (before ? { ...prev, labs: before } : prev)),
    });
  };

  const deleteLab = (id) => {
    const deviceId = engineRef.current?.getDeviceId?.() || "local";
    const row = (db.labs || []).find((r) => r.id === id);
    setDb((prev) => addTombstone(
      { ...prev, labs: (prev.labs || []).filter((r) => r.id !== id) }, "lab", id, deviceId
    ));
    engineRef.current?.noteDeleted?.("lab", id);
    toast({
      text: "Result removed",
      icon: "trash",
      cat: "fhj-cat-symptom",
      undo: () => setDb((prev) => ({
        ...prev,
        labs: row ? [...(prev.labs || []), row] : prev.labs,
        tombstones: (prev.tombstones || []).filter((t) => !(t.kind === "lab" && t.id === id)),
      })),
    });
  };

  /* ---------- experiments ---------- */

  const createExperiment = (input) => {
    const exp = newExperiment(input);
    setDb((prev) => ({ ...prev, experiments: [...(prev.experiments || []), exp] }));
    feedback("save");
    toast({ text: "Experiment started", cat: "fhj-cat-symptom" });
  };

  const archiveExperiment = (id) => {
    let before = null;
    setDb((prev) => {
      before = prev.experiments || [];
      return {
        ...prev,
        experiments: before.map((e) => (e.id === id ? { ...e, archived: true, updatedAt: new Date().toISOString() } : e)),
      };
    });
    toast({
      text: "Experiment archived",
      icon: "trash",
      undo: () => setDb((prev) => (before ? { ...prev, experiments: before } : prev)),
    });
  };

  const pinExperiment = (id, pinned) => setDb((prev) => ({
    ...prev,
    experiments: (prev.experiments || []).map((e) =>
      e.id === id ? { ...e, pinned, updatedAt: new Date().toISOString() } : e),
  }));

  /* ---------- illuminating days ----------

     One function, called from everywhere a finding can be tapped. It sets the
     lit set and drops the person on History, which is the surface where a set
     of days is most legible. Everything else that draws a day picks the set up
     on the way past. */

  const illuminate = (dates, label) => {
    if (!dates?.length) return;
    setLit({ dates: new Set(dates), label });
    feedback("select");
    setScreen("history");
  };
  const clearLit = () => setLit(null);

  const dropEpisode = (ep) => {
    const deviceId = engineRef.current?.getDeviceId?.() || "local";
    setDb((prev) => addTombstone(
      { ...prev, episodes: removeEpisode(prev.episodes || [], ep.id) },
      "episode", ep.id, deviceId
    ));
    engineRef.current?.noteDeleted?.("episode", ep.id);
    setScreen("insights");
    toast({
      text: `${ep.title} removed`,
      icon: "trash",
      cat: "fhj-cat-symptom",
      undo: () => {
        setDb((prev) => ({
          ...prev,
          episodes: [...(prev.episodes || []), ep],
          tombstones: (prev.tombstones || []).filter((t) => !(t.kind === "episode" && t.id === ep.id)),
        }));
        engineRef.current?.noteDeleted?.("episode", ep.id);
      },
    });
  };

  const openEpisodeScreen = (id) => { setEpisodeId(id); setScreen("episode"); };

  const pinMetrics = (keys) => setDb((prev) => ({
    ...prev,
    profile: {
      ...prev.profile,
      pinnedMetrics: keys.slice(0, 4),
      updatedAt: new Date().toISOString(),
    },
  }));

  const saveChartView = (view) => setDb((prev) => ({
    ...prev,
    profile: {
      ...prev.profile,
      chartView: sanitizeChartView(view),
      updatedAt: new Date().toISOString(),
    },
  }));

  /* "Not for me", remembered. Stored as a word rather than a boolean so a
     backup reads as something a person could understand, and absent until it
     happens so it never appears in one as a key nobody can explain. */
  const dismissImportInvite = () => setDb((prev) => ({
    ...prev,
    profile: { ...prev.profile, importOffered: "done", updatedAt: new Date().toISOString() },
  }));

  const setQuickAdd = (ids, order, opts) => setDb((prev) => ({
    ...prev,
    profile: {
      ...prev.profile,
      quickAdd: sanitizeQuickAdd(ids) ?? DEFAULT_QUICK_ADD,
      /* "manual" — the order holds still — is the default and what the editor
         and a dragged tile both write. "auto" is the switch in the editor, and
         the only thing that lets the row sort itself by use. */
      quickAddOrder: order === "auto" ? "auto" : "manual",
      /* Whether the hold-and-drag gesture has ever been used, which is the
         only thing the hint under the row is waiting on. Undefined rather than
         false until it happens, so it never appears in a backup as a key
         somebody has to work out the meaning of. */
      quickAddDragged: prev.profile.quickAddDragged === true || opts?.dragged === true
        ? true : undefined,
      updatedAt: new Date().toISOString(),
    },
  }));

  /* One vote per tap, stored on the profile so the ordering somebody has built
     up travels with their journal to a new device rather than starting over. */
  const noteActionUse = (id) => {
    if (viewer || !id) return;
    setDb((prev) => ({
      ...prev,
      profile: {
        ...prev.profile,
        actionStats: noteUse(sanitizeActionStats(prev.profile.actionStats), id, todayStr()),
        updatedAt: new Date().toISOString(),
      },
    }));
  };

  /* ---------- the shared derivations ----------

     Everything the new screens compare against, computed once per render
     rather than per screen. `seriesVariables` is the seam that lets an
     experiment put a weather reading next to a symptom rating without either
     side knowing about the other — see lib/series. */

  const sunSessions = db.sun || [];
  const contextRows = db.context || [];
  const labRows = db.labs || [];
  const todayContext = contextOn(contextRows, todayStr());
  /* Where the sun is drawn from. A place typed by hand wins over the last
     fetched fix, because it is the one somebody deliberately set. Absent when
     context is off, and every sun surface degrades to "time outside" only. */
  const activeCoords = profile.context?.enabled
    ? (profile.context.place
      ? { lat: profile.context.place.lat, lon: profile.context.place.lon }
      : todayContext?.coords || contextRows[contextRows.length - 1]?.coords || null)
    : null;

  const seriesSource = {
    entries,
    fields: tpl.fields,
    food: db.food || [],
    bowel: db.bowel || [],
    routine: db.routine || [],
    routineItems: db.routineItems || [],
    sun: sunSessions,
    context: contextRows,
    labs: labRows,
  };
  /* Deliberately not memoised, and deliberately not computed on every screen.

     This block sits *below* the lock-flow early returns above, so a hook here
     would be a conditional hook — the exact shape of the crash that took down
     the first report screen in 1.0 (see the addendum in docs/APP_STATE.md).
     Gating on the screen instead costs nothing and cannot introduce that bug:
     Today only ever needs the experiments somebody pinned, and the rest of the
     app needs none of it. */
  const wantsExperiments = screen === "experiments" || screen === "dashboard";
  const allVariables = wantsExperiments ? seriesVariables(seriesSource) : [];
  const experimentResults = wantsExperiments
    ? runAll(
        (db.experiments || []).filter((e) => screen === "experiments" || e.pinned),
        seriesSource
      )
    : [];
  const experimentSuggestions = screen === "experiments"
    ? suggestExperiments(seriesSource, { keyMetric: tpl.keyMetric, existing: db.experiments || [] })
    : [];
  const experimentStarters = screen === "experiments" ? availableStarters(seriesSource) : [];

  const todayProps = {
    profile, entries, openLog: goToLog, viewer, onPatch: upsertEntry,
    food: db.food || [], bowel: db.bowel || [], foods: db.foods || [],
    routine: db.routine || [], routineItems: db.routineItems || [],
    onUpdateLibrary: setLibrary,
    onSaveFood: upsertLog("food"), onDeleteFood: removeLog("food"),
    onSaveBowel: upsertLog("bowel"), onDeleteBowel: removeLog("bowel"),
    onSaveRoutine: upsertLog("routine"), onDeleteRoutine: removeLog("routine"),
    onLogRoutineRows: saveRoutineRows,
    goSettings: () => setScreen("settings"), goSetup: () => setScreen("setup"),
    goFood: () => setScreen("food"), goRoutine: () => setScreen("routine"),
    goInsights: () => setScreen("insights"),
    onUpdateQuickAdd: setQuickAdd, onUseAction: noteActionUse, ai: db.ai, syncStatus,
    /* Quick Add can start and end a flare, so Today needs the episodes and the
       two writers that Insights already had. Same functions — a flare started
       from a tile and one started from the chart are the same object. */
    episodes: db.episodes || [], onStartFlare: beginFlare, onEndFlare: finishFlare,
    /* 1.21: the sun surface, the day's weather, and whichever experiments the
       person pinned. Today shows them; it does not own any of them. */
    sun: db.sun || [], context: db.context || [], labs: db.labs || [],
    goSun: () => setScreen("sun"), goLabs: () => setScreen("labs"),
    goExperiments: () => setScreen("experiments"),
    goImport: () => setScreen("import"),
    onDismissImport: dismissImportInvite,
    pinnedExperiments: screen === "dashboard" ? experimentResults : [],
    onHighlight: illuminate,
  };

  const insightsProps = {
    profile, entries, openLog: goToLog, viewer,
    food: db.food || [], bowel: db.bowel || [],
    routine: db.routine || [], routineItems: db.routineItems || [],
    goExport: () => setScreen("export"), goSettings: () => setScreen("settings"),
    goSetup: () => setScreen("setup"), goGallery: () => setScreen("gallery"),
    goReport, reports: db.reports, openSavedReport, deleteSavedReport,
    ai: db.ai, setAi, aiAutoRun,
    episodes: db.episodes || [],
    onStartFlare: beginFlare, onEndFlare: finishFlare,
    onOpenEpisode: openEpisodeScreen, onPinMetrics: pinMetrics, onChartView: saveChartView,
    /* 1.21: the environment behind the days, and the three new destinations
       Insights can hand somebody off to. */
    context: db.context || [], sun: db.sun || [], labs: db.labs || [],
    onHighlight: illuminate,
    goSun: () => setScreen("sun"), goLabs: () => setScreen("labs"),
    goExperiments: () => setScreen("experiments"),
  };

  let content = null;
  if (screen === "dashboard") {
    content = <DashboardScreen {...todayProps} addOpen={addSheet} onCloseAdd={() => setAddSheet(false)} />;
  } else if (screen === "insights") {
    content = <InsightsScreen {...insightsProps} />;
  } else if (screen === "settings") {
    content = <SettingsScreen db={db} setDb={setDb} setAi={setAi} goHome={goHome} goSetup={() => setScreen("setup")}
      goExport={() => setScreen("export")}
      syncEngine={engineRef.current} syncStatus={syncStatus} syncConfigured={syncConfigured}
      onRefreshSyncConfig={() => setSyncConfigured(syncAvailable())}
      onAiSetupComplete={() => { setAiAutoRun((n) => n + 1); setScreen("dashboard"); }}
      goImport={() => setScreen("fitbit")} goNoteImport={() => setScreen("import")} lockEnabled={!!lock}
      onSetupPin={() => setLockFlow("setup")} onChangePin={() => setLockFlow("change-verify")}
      onDisablePin={() => setLockFlow("disable-verify")} />;
  } else if (screen === "setup") {
    content = <EditSetupScreen profile={profile} entries={entries} onSave={updateProfile} goBack={goHome} />;
  } else if (screen === "export") {
    content = <ExportScreen db={db} setDb={viewer ? null : setDb} goPack={openPack} />;
  } else if (screen === "pack") {
    content = (
      <AppointmentPackScreen db={db} setDb={viewer ? null : setDb} viewer={viewer}
        params={packParams} goBack={() => setScreen("export")} />
    );
  } else if (screen === "log") {
    content = (
      <LogScreen profile={profile} entries={entries} date={logDate} setDate={setLogDate}
        mode={logMode} setMode={setLogMode} onPatch={upsertEntry} startPhotos={logPhotos}
        onFinishQuick={goHome} onSetBaseline={setPhotoBaseline} />
    );
  } else if (screen === "food") {
    content = (
      <DiaryScreen
        food={db.food || []} foods={db.foods || []} goals={db.profile.goals}
        routine={db.routine || []} routineItems={db.routineItems || []}
        aiEnabled={!!db.ai?.enabled && !viewer}
        aiAuto={!!db.ai?.enabled && db.ai?.auto === true && !viewer}
        viewer={viewer}
        onLog={upsertLog("food")} onSaveLog={upsertLog("food")} onDeleteLog={removeLog("food")}
        onUpdateLibrary={setLibrary}
        onSaveRoutine={upsertLog("routine")} onDeleteRoutine={removeLog("routine")}
        onLogRoutineRows={saveRoutineRows} onSaveRoutineItem={saveRoutineItem}
        goRoutine={() => setScreen("routine")}
        onEditGoals={() => setScreen("settings")} />
    );
  } else if (screen === "routine") {
    content = (
      <RoutineScreen
        items={db.routineItems || []} viewer={viewer}
        onSaveItem={saveRoutineItem} onDeleteItem={deleteRoutineItem}
        goDiary={() => setScreen("food")} />
    );
  } else if (screen === "episode") {
    content = (
      <EpisodeDetailScreen
        profile={profile} entries={entries} episodes={db.episodes || []} episodeId={episodeId}
        food={db.food || []} bowel={db.bowel || []}
        routine={db.routine || []} routineItems={db.routineItems || []}
        openLog={goToLog} goBack={() => setScreen("insights")}
        onEnd={finishFlare} onUpdate={patchEpisode} onDelete={dropEpisode} viewer={viewer}
        context={db.context || []} onHighlight={illuminate} />
    );
  } else if (screen === "sun") {
    content = (
      <SunScreen
        coords={activeCoords}
        today={todayStr()}
        sessions={db.sun || []}
        skin={profile.sun?.skin}
        exposure={profile.sun?.exposure}
        wake={profile.sun?.wake}
        age={profileAge(profile) ?? undefined}
        forecastUV={todayContext?.uvMax ?? null}
        cloudCover={undefined}
        viewer={viewer}
        onSave={saveSunSession}
        onDelete={viewer ? undefined : deleteSunSession}
        onOpenSettings={() => setScreen("settings")}
        onFeedback={feedback}
        highlight={lit?.dates}
      />
    );
  } else if (screen === "experiments") {
    content = (
      <ExperimentsScreen
        results={experimentResults}
        suggestions={experimentSuggestions}
        starters={experimentStarters}
        variables={allVariables}
        viewer={viewer}
        onCreate={createExperiment}
        onArchive={archiveExperiment}
        onPin={pinExperiment}
        onHighlight={illuminate}
        onFeedback={feedback}
      />
    );
  } else if (screen === "labs") {
    content = (
      <LabsScreen
        labs={db.labs || []}
        sun={db.sun || []}
        context={db.context || []}
        episodes={db.episodes || []}
        routineItems={db.routineItems || []}
        today={todayStr()}
        viewer={viewer}
        onSave={saveLab}
        onDelete={deleteLab}
        onHighlight={illuminate}
        onFeedback={feedback}
      />
    );
  } else if (screen === "calendar") {
    content = <CalendarScreen profile={profile} entries={entries} openLog={goToLog} />;
  } else if (screen === "history") {
    content = (
      <HistoryScreen
        profile={profile} entries={entries}
        food={db.food || []} bowel={db.bowel || []} routine={db.routine || []}
        openLog={goToLog} viewer={viewer} syncStatus={syncStatus}
        goInsights={() => setScreen("insights")} goDiary={() => setScreen("food")}
        goExport={() => setScreen("export")} goGallery={() => setScreen("gallery")}
        goSettings={() => setScreen("settings")} goSetup={() => setScreen("setup")}
        goSun={() => setScreen("sun")} goLabs={() => setScreen("labs")}
        goExperiments={() => setScreen("experiments")}
        context={contextRows} sun={sunSessions} labs={labRows}
        lit={lit} onClearLit={clearLit} />
    );
  } else if (screen === "fitbit") {
    content = <FitbitImportScreen db={db} setDb={setDb} goBack={() => setScreen("settings")} />;
  } else if (screen === "import") {
    content = (
      <NoteImportScreen db={db} setDb={setDb} aiEnabled={!!db.ai?.enabled && !viewer}
        goBack={goHome} goSettings={() => setScreen("settings")} openLog={goToLog} />
    );
  } else if (screen === "gallery") {
    content = <PhotoGalleryScreen profile={profile} entries={entries} tpl={tpl} onSetBaseline={setPhotoBaseline} goBack={goHome} />;
  } else if (screen === "report") {
    content = <ReportScreen db={db} setDb={setDb} params={reportParams} goBack={goHome} />;
  } else {
    content = <DashboardScreen {...todayProps} addOpen={addSheet} onCloseAdd={() => setAddSheet(false)} />;
  }

  /* The tab-level screens draw their own heading, so the shared header would
     only repeat it. The Diary earns its place on that list the same way: its
     sticky day bar *is* the header, and stacking a second one above it cost
     56px on the longest page in the app to say "Diary" twice. Every other
     screen is somewhere you navigated *into* and wants the title and the way
     back. */
  const showHeader = screen !== "dashboard" && screen !== "insights" && screen !== "food"
    && screen !== "history" && screen !== "experiments" && screen !== "labs";
  /* Every screen id that can reach here needs an entry. "food" and "fitbit"
     were missing, which rendered the header with an empty <h1> and the survey
     name orphaned underneath it. */
  const screenTitle = {
    log: "Daily Log", calendar: "Calendar", export: "Export Data", settings: "Settings",
    setup: "Edit Survey / Tracking Setup", gallery: "Photo Progress", food: "Diary",
    routine: "Your Routine", episode: "Flare", pack: "Appointment Pack", history: "History",
    fitbit: "Import Health Data", import: "Import Your Notes",
    sun: "Sun & Outdoor Light", experiments: "Experiments", labs: "Labs & Measurements",
    report: reportParams.savedId ? "Saved Report" : (reportParams.type === "month" ? "Monthly Report" : "Weekly Report"),
  }[screen] || APP_NAME;

  return (
    <div className="min-h-screen" style={{ background: C.bg, color: C.ink }}>
      <AmbientBackdrop />
      {/* Keyboard and screen-reader users land on the nav-skip before the
          header controls; it stays out of the way until it's focused. */}
      <a href="#main" className="fhj-skip">Skip to main content</a>
      {/* The app is a phone-shaped column, and it should stay one: every screen
          here is a list you read top to bottom, and a 1440px-wide list is not
          an improvement. The Detailed Log is the exception, and the only one —
          it is a *form* with forty fields in seven groups, and laid out one
          field per row in a 448px ribbon it wasted the whole screen to show a
          fraction of itself. Widening it there is the difference between
          scrolling a form and seeing one. Below 900px this class does nothing
          at all, so nothing about the phone changes. */}
      <div ref={shellRef}
        className={"fhj-shell relative" + (screen === "log" && logMode === "detailed" ? " is-wide" : "")
          + (reaching ? " is-reaching" : "")}
        /* Room for the bar, plus room for the Back pill above it when there
           is one — without this the last card on a screen sits under it. */
        style={{ paddingBottom: canBack ? "8.75rem" : "6rem", zIndex: 1 }}>
        {showHeader && (
          <header className="sticky top-0 z-20 px-4 py-3 flex items-center gap-3"
            style={{
              background: C.bg,
              borderBottom: `1px solid ${C.line}`,
              /* The header sits over scrolling content; a light blur keeps the
                 title legible without a hard bar across the screen. */
              backdropFilter: "saturate(140%) blur(8px)",
            }}>
            {/* Still here, and still the obvious thing to reach for — but no
                longer the *only* way out: the same Back is on the bar, on the
                side edge, and on the phone's own back button. It also goes
                where you came from now rather than always to Today. */}
            <button onClick={canBack ? goBack : goHome}
              aria-label={canBack ? `Back to ${screenLabel(backTo)}` : "Back to dashboard"}
              className="fhj-icon-btn" style={{ width: "2.5rem", height: "2.5rem" }}>
              <Icon name={canBack ? "left" : "home"} size={18} color={C.sub} />
            </button>
            {screen !== "settings" && (
              <SyncAlert status={syncStatus} onOpen={() => setScreen("settings")} />
            )}
            <div className="flex-1 min-w-0">
              <h1 className="font-display text-lg leading-tight truncate">
                {screen === "log" ? (logDate === todayStr() ? "Today" : fmtNice(logDate)) : screenTitle}
              </h1>
              {screen === "log" && logDate !== todayStr() ? (
                <button type="button" onClick={() => { feedback("nav"); setLogDate(todayStr()); }}
                  className="text-[11px] font-semibold" style={{ color: C.accentText }}>
                  Jump to today
                </button>
              ) : (
                <div className="text-[11px] truncate" style={{ color: C.subtle }}>{tpl.label}</div>
              )}
            </div>
            {/* The day pager rides in the header rather than owning a row of
                its own underneath one that already named the screen. */}
            {screen === "log" && !viewer && (
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => { feedback("nav"); setLogDate(addDays(logDate, -1)); }}
                  aria-label="previous day" className="fhj-icon-btn"
                  style={{ width: "2.5rem", height: "2.5rem" }}>
                  <Icon name="left" size={16} color={C.sub} />
                </button>
                <button onClick={() => { feedback("nav"); setLogDate(addDays(logDate, 1)); }}
                  aria-label="next day" disabled={logDate === todayStr()} className="fhj-icon-btn"
                  style={{ width: "2.5rem", height: "2.5rem" }}>
                  <Icon name="right" size={16} color={C.sub} />
                </button>
              </div>
            )}
            {/* Settings is in the header now, on every screen that has one —
                it used to be a tab, and a preference is not somewhere you go
                every day. */}
            {screen !== "settings" && !viewer && (
              <button onClick={() => setScreen("settings")} aria-label="settings" className="fhj-icon-btn shrink-0"
                style={{ width: "2.5rem", height: "2.5rem" }}>
                <Icon name="gear" size={18} color={C.sub} />
              </button>
            )}
            {viewer && <span className="fhj-badge fhj-badge-neutral">Read-only</span>}
          </header>
        )}

        <ErrorBoundary onRecover={goHome}>
          <main id="main" key={screen} ref={screenRef} tabIndex={-1} style={{ outline: "none" }}>{content}</main>
        </ErrorBoundary>

        {!db.ack && (
          <DisclaimerModal onAck={() => setDb((prev) => ({ ...prev, ack: true }))} />
        )}

        <ToastHost />

      </div>

      {/* Outside the shell on purpose, all three of them.

          The shell is what moves — it slides sideways under an edge-back drag
          and downwards when somebody pulls the page into reach — and a
          `position: fixed` child of a transformed element stops being fixed to
          the viewport and starts being fixed to its moving parent. The bar
          would ride away with the page it is supposed to be steering. */}
      {reaching && (
        <button type="button" className="fhj-reach-catch" aria-label="Put the screen back"
          onClick={() => { feedback("tap"); setReaching(false); }} />
      )}

      <EdgeBack enabled={canBack && !reaching} hand={hand} shellRef={shellRef} onBack={goBack} />

      <ThumbNav
        screen={screen} canBack={canBack} backLabel={screenLabel(backTo)}
        destinations={destinationsFor({ viewer, exclude: [] })}
        hand={hand} viewer={viewer} Icon={Icon}
        onBack={() => { feedback("nav"); goBack(); }}
        onGo={(id) => { if (screen !== id) feedback("nav"); setScreen(id); }}
        onAdd={() => { feedback("nav"); setScreen("dashboard"); setAddSheet(true); }}
        onFlipHand={flipHand}
        onReach={() => setReaching(true)}
        onTop={() => { feedback("nav"); setReaching(false); scrollToTop(); }} />
    </div>
  );
}

/* Test-only handle: pure functions exercised by the Node unit tests.
   Harmless at runtime — the artifact still uses the default export. */
export const __internals = {
  SyncCard, SyncSetupFlow, SyncBadge, SyncAlert, syncLine, PrivacyCard, reportResult,
  pickReportRange, buildReport, pickPairs, computeInsightsWindow,
  medianDefaultFor, yesterdayToggleFor, longestRunInRange, recentNotes,
  availableReportCards, cardIncluded, migrateDb, genSampleData,
  getProfileTemplate, mondayOf, priorRange, REPORT_COPY, REPORT_CARD_CATALOG,
  packHistoryDays, TEMPLATES, reportSummaryRows,
  parseGoogleFitDailyCSV, parseGoogleFitHourlyCSV, parseGoogleFitSessionJSON,
  parseFitbitFiles, mergeFitbitData, kgToLb,
  validateBackup, buildFullBackup, storageUsage, photosOlderThan, scrubPhotoRefs, photoLegendRows,
  lastValueFor, depsFor,
  wideTable, toCSV, metaCols, serialize, buildPhotoItems, blankProfile,
  entriesFor, calcStreak, avgWindow, SCHEMA_VERSION,
  SwipeDeck, FinishCelebration, feedback, FB, hapticsSupported,
  rangeForOffset, offsetOfPeriod, minPeriodOffset, ReportScreen,
  DEFAULT_PREFS, LEGACY_PREFS, categoryOf, CATEGORY_META, CATEGORY_ORDER,
  QUICK_ADD_TILES, DEFAULT_QUICK_ADD, defaultQuickAdd, quickAddTile, tileSupported,
  quickAddContext, resolveQuickAdd, firstRunQuickAdd, FIRST_RUN_EXTRAS, amountWithUnit,
  scaleHaptic, HAPTIC_PATTERNS, HAPTIC_SCALE, HAPTIC_LEVELS,
  /* 1.21 — the parts the suites reach for directly. The screens themselves are
     driven through the app, not mounted in isolation: the point of the release
     is that the five systems talk to each other, and a test that mounts one of
     them alone would pass while the wiring was broken. */
  DailyContextCard, SunProfileCard, TodayContextCard, ContextSection, PinnedExperiment,
  currentCoords, contextLineFor,
};

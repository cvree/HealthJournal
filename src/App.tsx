// @ts-nocheck — this file is the migrated single-file artifact, written as
// untyped JS. Incremental typing is planned (see README roadmap); new code in
// src/lib and src/components is fully typechecked.
import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, CartesianGrid, ComposedChart, Area, Cell,
} from "recharts";
import * as XLSX from "xlsx";
import { initSmoothScroll, scrollToTop, animateScreenIn, animateStepIn, animateFinish, flingCard, promoteCard, initReportReveal, slideFrom, prefersReducedMotion, lockPageScroll } from "./lib/motion";
import AmbientBackdrop from "./components/AmbientBackdrop";
import AppearancePanel from "./components/AppearancePanel";
import RecoveryScreen from "./components/RecoveryScreen";
import ViewerLanding from "./components/ViewerLanding";
import LockScreen from "./components/LockScreen";
import { sanitizeCustomField } from "./lib/questions";
import { validateDatabase } from "./lib/validate";
import {
  serialize, csvEscape, toCSV, buildWideTable, metaCols as metaColsTyped,
  buildFoodTable, buildBowelTable, logsInRange,
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
import {
  MEALS, mealLabel, mealForTime, UNITS, BRISTOL, bristolLabel, BOWEL_COLORS,
  BOWEL_CONSISTENCY, BOWEL_AMOUNTS, SEVERITY_0_3, severityLabel,
  NUTRIENTS, NUTRIENT_KEYS, nutrientDef, formatNutrient,
  newFoodLog, newBowelLog, resolveNutrient, effectiveNutrition, hasAiValues,
  hasUserEdits, acceptEstimate, discardEstimate,
  foodOn, bowelOn, dayTotals, DERIVED_METRICS, derivedMetric, isDerivedKey,
  availableDerivedMetrics, foodSummary, bowelSummary,
  sanitizeFoodLogs, sanitizeBowelLogs, sanitizeFoodItems, sanitizeGoals,
  localTime, prettyTime, localDate,
  newFoodItem, rememberFood, logFromFoodItem, scaleNutrition,
  browseFoods, toggleFavorite, goalProgress, hasGoals,
  bowelSuggestion, applyBowelSuggestion, aiFilledBowelFields,
} from "./lib/tracking";
import {
  hasStoredKey, loadConnection, saveConnection, clearKey, maskKey, testConnection,
  buildAnalysisInput, summariseInput, runPatternAnalysis, strengthLabel, looksLikeKey,
  PROVIDERS, providerOf, OPENAI_NOTE,
  analyseFood, analyseBowelPhoto, summariseFoodRequest,
} from "./lib/ai";

/* ============================================================
   Health Journal
   Private, mobile-first, on-device health tracking.
   Not medical advice. Tracks possible patterns only.
   ============================================================ */

/* The name users see. Backup files still carry the original app string as
   their magic value (see BACKUP_APP_IDS) so journals exported before the
   rename keep restoring. */
export const APP_NAME = "Health Journal";
export const APP_VERSION = "1.10.0";

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
  meds:     { label: "Medications & supplements", icon: "star", color: "#7A6FD0" },
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
  const keyMetric = fields.find((f) => f.k === primary.keyMetric && f.dashboard !== false)
    ? primary.keyMetric
    : (dashboardMetrics[0] || chartMetrics[0] || fields.find((f) => f.type === "scale")?.k || null);
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

  return { profile, entries, ack: false };
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
function seriesFor(entries, key, days) {
  const t0 = todayStr();
  const byDate = new Map(entries.map((e) => [e.date, e]));
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = addDays(t0, -i);
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
function weeklyAverages(entries, key, weeks = 6) {
  const t0 = todayStr();
  const out = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const end = addDays(t0, -(w * 7));
    const start = addDays(end, -6);
    const vals = entries.filter((e) => e.date >= start && e.date <= end)
      .map((e) => e.answers[key]).filter((v) => typeof v === "number");
    out.push({ d: fmtShort(end), v: vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null });
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
    sunrise: <g><path {...p} d="M12 4v3M5.6 9.6 7 11M18.4 9.6 17 11M3 17h18M6.5 17a5.5 5.5 0 0 1 11 0" /><path {...p} d="M9.5 6.5 12 4l2.5 2.5" /></g>,
    snack: <g><circle {...p} cx="12" cy="12" r="8.5" /><path {...p} d="M9 10.5v.4M15 10.5v.4M8.8 15a4.2 4.2 0 0 0 6.4 0" /></g>,
    drink: <g><path {...p} d="M6 4h12l-1.4 15.2a2 2 0 0 1-2 1.8H9.4a2 2 0 0 1-2-1.8z" /><path {...p} d="M6.6 10h10.8" /></g>,
    camera: <g><path {...p} d="M4 8h3l1.4-2h7.2L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" /><circle {...p} cx="12" cy="13.5" r="3.4" /></g>,
    clock: <g><circle {...p} cx="12" cy="12" r="8.5" /><path {...p} d="M12 7.2V12l3.2 2" /></g>,
    edit: <path {...p} d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17zM13.5 6.5l3 3" />,
    minus: <path {...p} d="M5 12h14" />,
    star: <path {...p} d="M12 4.2l2.35 4.76 5.25.77-3.8 3.7.9 5.23L12 16.2l-4.7 2.46.9-5.23-3.8-3.7 5.25-.77z" />,
    starFilled: <path d="M12 4.2l2.35 4.76 5.25.77-3.8 3.7.9 5.23L12 16.2l-4.7 2.46.9-5.23-3.8-3.7 5.25-.77z" fill={color} stroke={color} strokeWidth="1.6" strokeLinejoin="round" />,
    bell: <g><path {...p} d="M6 9a6 6 0 0 1 12 0c0 3.5.8 5.2 1.6 6.2.4.5 0 1.3-.7 1.3H5.1c-.7 0-1.1-.8-.7-1.3C5.2 14.2 6 12.5 6 9z" /><path {...p} d="M10 20a2 2 0 0 0 4 0" /></g>,
    target: <g><circle {...p} cx="12" cy="12" r="8.5" /><circle {...p} cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1.6" fill={color} stroke="none" /></g>,
    search: <g><circle {...p} cx="11" cy="11" r="6.5" /><path {...p} d="M16 16l4.5 4.5" /></g>,
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
function ScaleInput({ field, value, onChange, ghost = null }) {
  const lowLbl = field.dir === "pos" ? "1 · low" : "1 · none";
  const highLbl = field.dir === "pos" ? "10 · great" : "10 · severe";
  const set = (n) => {
    if (value === n) { feedback("erase"); onChange(null); return; }
    place("scale", n, 10);
    onChange(n);
  };
  return (
    <div className="py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <span className="text-sm font-medium">{field.label}</span>
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

function ToggleInput({ field, value, onChange, tint }) {
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
    <div className="py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${C.line}` }}>
      <span className="text-sm font-medium">{field.label}</span>
      <div className="flex gap-1.5">{opt("No", false)}{opt("Yes", true)}</div>
    </div>
  );
}

function ChipsInput({ field, value, onChange, tint }) {
  const sel = Array.isArray(value) ? value : [];
  const toggle = (opt) => {
    if (field.single) { onChange(sel.includes(opt) ? [] : [opt]); return; }
    onChange(sel.includes(opt) ? sel.filter((o) => o !== opt) : [...sel, opt]);
  };
  return (
    <div className="py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
      <div className="text-sm font-medium mb-2">{field.label}</div>
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
function NumberInput({ field, value, onChange, ghost = null }) {
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
    <div className="py-3 flex items-center justify-between gap-2" style={{ borderBottom: `1px solid ${C.line}` }}>
      <span className="text-sm font-medium">{field.label}</span>
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

function FieldInput({ field, value, onChange, tint, ghost = null }) {
  if (field.type === "scale") return <ScaleInput field={field} value={value} onChange={onChange} ghost={ghost} />;
  if (field.type === "toggle") return <ToggleInput field={field} value={value} onChange={onChange} tint={tint} />;
  if (field.type === "chips") return <ChipsInput field={field} value={value} onChange={onChange} tint={tint} />;
  if (field.type === "number") return <NumberInput field={field} value={value} onChange={onChange} ghost={ghost} />;
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
          Photos stay on this device. Ratings are personal tracking, not a medical assessment.
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
  const skipBatch = () => { feedback("tap"); for (const f of chunks[page]) set(f.k, null); goNext(); };

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
        <button onClick={() => {
          const s = calcStreak(entries);
          feedback(s > 0 && s % 7 === 0 ? "milestone" : "save");
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

/* Overlay up to four metrics on one 30-day chart. Scale (1–10) metrics share a
   fixed axis; mixing in number metrics (steps, weight…) switches to an auto
   axis with a gentle note that units differ. */
function MultiMetricChart({ entries, fields, tint }) {
  const palette = CHART_PALETTE(tint);
  const series = fields.map((f) => seriesFor(entries, f.k, 30));
  const data = series[0].map((p, i) => {
    const row = { d: p.d };
    fields.forEach((f, j) => { row["m" + j] = series[j][i] ? series[j][i].v : null; });
    return row;
  });
  const anyData = fields.some((_, j) => series[j].some((p) => p.v != null));
  const allScale = fields.every((f) => f.type === "scale");
  if (!anyData) return <ChartEmpty title="No answers for these metrics in the last 30 days." />;
  return (
    <>
      <div className="flex flex-wrap gap-x-3.5 gap-y-1.5 mb-2.5">
        {fields.map((f, j) => (
          <span key={f.k} className="flex items-center gap-1.5 text-[11px]" style={{ color: C.sub }}>
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: palette[j] }} />
            {f.label}
          </span>
        ))}
      </div>
      <div style={{ width: "100%", height: 210 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 10, right: 8, left: -2, bottom: 0 }}>
            <CartesianGrid stroke={C.grid} vertical={false} strokeDasharray="2 5" />
            <XAxis dataKey="d" tickFormatter={fmtShort} minTickGap={30}
              tick={axisTick()} axisLine={false} tickLine={false} tickMargin={8} />
            <YAxis domain={allScale ? [1, 10] : ["auto", "auto"]}
              tick={axisTick()} axisLine={false} tickLine={false} width={34} />
            <Tooltip
              labelFormatter={(d) => fmtNice(d)}
              formatter={(v, name) => {
                const j = Number(String(name).slice(1));
                const f = fields[j];
                return [f?.unit ? `${v} ${f.unit}` : v, f ? f.label : name];
              }}
              {...tooltipProps()} />
            {fields.map((f, j) => (
              <Line key={f.k} type="monotone" dataKey={"m" + j} stroke={palette[j]} strokeWidth={2.25}
                strokeLinecap="round" strokeLinejoin="round"
                /* Dots only on hover: four overlaid series with a dot per day
                   is 120 marks on a 340px-wide chart, which reads as noise. */
                dot={false}
                activeDot={{ r: 4, fill: palette[j], stroke: C.card, strokeWidth: 2 }}
                connectNulls {...chartAnim()} animationBegin={j * 90} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {!allScale && (
        <div className="text-[10px] mt-0.5" style={{ color: C.sub }}>
          These metrics use different units but share one axis — compare shapes, not heights.
        </div>
      )}
    </>
  );
}

function MetricChart({ entries, field, color }) {
  const data = seriesFor(entries, field.k, 30);
  const isScale = field.type === "scale";
  const numeric = data.filter((p) => p.v != null).length;
  if (numeric < 3) {
    return (
      <ChartEmpty title={numeric === 0
        ? `No “${field.label}” answers in the last 30 days.`
        : `Only ${numeric} day${numeric === 1 ? "" : "s"} logged — the trend line appears at 3.`} />
    );
  }
  /* Gradient ids must be unique per chart or a second chart on the same screen
     inherits the first one's fill. */
  const fadeId = `fhjFade_${String(field.k).replace(/\W/g, "_")}`;
  return (
    <div style={{ width: "100%", height: 210 }}>
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 10, right: 8, left: -2, bottom: 0 }}>
          <ChartFade id={fadeId} color={color} />
          <CartesianGrid stroke={C.grid} vertical={false} strokeDasharray="2 5" />
          <XAxis dataKey="d" tickFormatter={fmtShort} minTickGap={30}
            tick={axisTick()} axisLine={false} tickLine={false} tickMargin={8} />
          <YAxis domain={isScale ? [1, 10] : ["auto", "auto"]}
            tick={axisTick()} axisLine={false} tickLine={false} width={34} />
          <Tooltip
            labelFormatter={(d) => fmtNice(d)}
            formatter={(v, name) => [
              field.unit ? `${v} ${field.unit}` : v,
              name === "v" ? field.label : "7-day avg",
            ]}
            {...tooltipProps()} />
          <Area type="monotone" dataKey="v" stroke="none" fill={`url(#${fadeId})`}
            connectNulls {...chartAnim()} />
          <Line type="monotone" dataKey="avg" stroke={C.avgLine} strokeWidth={1.5} strokeOpacity={0.85}
            strokeDasharray="4 5" dot={false} connectNulls {...chartAnim()} />
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2.5}
            strokeLinecap="round" strokeLinejoin="round"
            dot={{ r: 2, fill: color, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: color, stroke: C.card, strokeWidth: 2.5 }}
            connectNulls {...chartAnim()} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function WeeklyBars({ entries, field, color }) {
  const data = weeklyAverages(entries, field.k, 6);
  const isScale = field.type === "scale";
  const last = data.length - 1;
  return (
    <div style={{ width: "100%", height: 118 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 6, right: 8, left: -2, bottom: 0 }}>
          <XAxis dataKey="d" tick={axisTick()} axisLine={false} tickLine={false} tickMargin={6} />
          <YAxis domain={isScale ? [0, 10] : ["auto", "auto"]}
            tick={axisTick()} axisLine={false} tickLine={false} width={34} />
          <Tooltip formatter={(v) => [field.unit ? `${v} ${field.unit}` : v, "weekly avg"]}
            cursor={{ fill: C.faint }} {...tooltipProps()} />
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
                  app. Everything else in {APP_NAME} stays on this device either way.
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
   Insights — everything the app has worked out
   ============================================================

   This used to be the second half of the dashboard, below the fold. Splitting
   it out is the single change that makes logging feel fast: the first screen
   of the app now answers "what do I do next", and this one answers "what is
   happening", instead of one 4.7-screen scroll trying to do both and leading
   with a stat that is blank until you have logged. */

function InsightsScreen({ profile, entries, openLog, goExport, goGallery, goReport, reports, openSavedReport, deleteSavedReport, goSetup, goSettings, viewer, ai, setAi, aiAutoRun, food = [], bowel = [] }) {
  const tpl = getProfileTemplate(profile);
  const keyField = getField(tpl, tpl.keyMetric);
  const [metrics, setMetrics] = useState(() => [tpl.chartMetrics[0]]);
  /* A derived metric has to look like a survey question to the chart, the
     picker and the axis formatter. This is the one place the two kinds meet;
     everything downstream just sees a field. */
  const fieldFor = (k) => {
    const f = getField(tpl, k);
    if (f) return f;
    const m = derivedMetric(k);
    return m ? { k: m.k, label: m.label, type: "number", dir: m.dir, unit: m.unit, sec: m.sec, derived: true } : null;
  };
  const selFields = metrics.map(fieldFor).filter(Boolean);
  const metricField = selFields[0] || keyField;
  const toggleMetric = (k) => setMetrics((prev) =>
    prev.includes(k)
      ? (prev.length > 1 ? prev.filter((x) => x !== k) : prev)          // keep at least one
      : (prev.length >= 4 ? [...prev.slice(0, 3), k] : [...prev, k])); // compare up to 4
  /* Every chartable metric is offered, not just the first few that happen to
     fit — the picker scrolls, and says so. */
  /* Food and bowel logs are many-per-day, so they reach the chart as derived
     daily metrics. Only the ones with real data behind them are offered — a
     picker full of permanently flat lines is worse than a short picker. */
  const chartDates = useMemo(() => {
    const out = [];
    for (let i = 29; i >= 0; i--) out.push(addDays(todayStr(), -i));
    return out;
  }, []);
  const derived = useMemo(
    () => availableDerivedMetrics(food, bowel, chartDates),
    [food, bowel, chartDates]
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
     has food or bowel data, with derived metrics folded in as answers. Kept
     separate from `entries` so streaks, the calendar and exports are unchanged
     by a day that only has a meal on it. */
  const chartEntries = useMemo(() => {
    if (!derived.length) return entries;
    const byDate = new Map(entries.map((e) => [e.date, e]));
    const dates = new Set([...entries.map((e) => e.date), ...chartDates]);
    const out = [];
    for (const date of [...dates].sort()) {
      const base = byDate.get(date);
      const answers = { ...(base?.answers || {}) };
      let any = !!base;
      for (const m of derived) {
        const v = m.value({ food, bowel, date });
        if (v != null) { answers[m.k] = v; any = true; }
      }
      if (any) out.push({ ...(base || { id: `d_${date}`, date }), date, answers });
    }
    return out;
  }, [entries, derived, food, bowel, chartDates]);

  const today = entryOn(entries, todayStr());
  const streak = calcStreak(entries);
  const keyToday = today?.answers[tpl.keyMetric];
  const avg7 = avgWindow(entries, tpl.keyMetric, 7);
  const avg30 = avgWindow(entries, tpl.keyMetric, 30);
  const insights = useMemo(() => computeInsights(tpl, entries), [tpl, entries]);
  const recent = [...entries].reverse().slice(0, 5);
  const photoFields = useMemo(() => tpl.fields.filter((f) => f.type === "photo"), [tpl]);
  const photoItems = useMemo(() => buildPhotoItems(tpl, entries), [tpl, entries]);

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

      {/* today summary — the one number the whole app is built around */}
      <Card className="!p-5 mt-3" style={{ padding: "1.25rem" }}>
        <div className="flex items-start justify-between gap-3">
          {/* Wraps rather than truncates: a long metric name is the whole
              point of this line, and "Today · Overall skin sev…" helps nobody. */}
          <div className="fhj-eyebrow min-w-0 leading-snug pt-0.5">Today · {keyField.label}</div>
          <Badge tone={streak > 0 ? "accent" : "neutral"}>
            {streak > 0 ? `${streak}-day streak` : "no streak yet"}
          </Badge>
        </div>
        {/* Until today is logged there is no today number, and a 3.25rem em-dash
            is a large, confident way of saying nothing. The card falls back to
            the 7-day average — which is a real answer to "how am I doing" — and
            offers the tap that would fill the gap in. */}
        <div className="flex items-end justify-between gap-4 mt-2.5">
          <div className="min-w-0">
            <div className="font-display text-[3.25rem] leading-none tabular-nums"
              style={{ color: keyToday != null ? colorFor(keyToday, keyField.dir) : (avg7 != null ? C.sub : C.muted) }}>
              {keyToday != null ? <CountUp value={keyToday} /> : (avg7 != null ? fmt1(avg7) : "—")}
            </div>
            <div className="text-[11.5px] mt-2" style={{ color: C.subtle }}>
              {keyToday != null ? "logged today" : (avg7 != null ? "7-day average" : "nothing logged yet")}
            </div>
          </div>
          <div className="text-right shrink-0 flex flex-col gap-1.5">
            {keyToday != null && (
              <div className="text-xs" style={{ color: C.subtle }}>
                7-day avg <b className="tabular-nums ml-0.5" style={{ color: C.ink }}>{fmt1(avg7)}</b>
              </div>
            )}
            <div className="text-xs" style={{ color: C.subtle }}>
              30-day avg <b className="tabular-nums ml-0.5" style={{ color: C.ink }}>{fmt1(avg30)}</b>
            </div>
          </div>
        </div>
        {keyToday == null && !viewer && (
          <Button variant="outline" block className="mt-4" onClick={() => openLog(todayStr())}>
            Log today
          </Button>
        )}
        <TodayNutritionStrip food={food} date={todayStr()} />
      </Card>

      {/* ---------- Trends ---------- */}
      <div className="fhj-section mt-6 fhj-cat-symptom">
        <h2 className="fhj-section-title">Trends</h2>
        <span className="text-[11px]" style={{ color: C.subtle }}>Last 30 days</span>
      </div>
      <Card>
        <MetricPicker
          options={metricOptions}
          selected={metrics}
          onToggle={toggleMetric}
          max={4}
          label="Metrics to chart"
        />
        {selFields.length > 1
          ? <MultiMetricChart entries={chartEntries} fields={selFields} tint={tpl.color} />
          : <MetricChart entries={chartEntries} field={metricField} color={tpl.color} />}
        <div className="fhj-caption mt-2">
          {selFields.length > 1
            ? "One line per metric — touch the chart for a day's values"
            : "Solid line: daily · dashed line: 7-day average"}
        </div>
        <div className="fhj-eyebrow mt-5 mb-1">
          Weekly averages{selFields.length > 1 ? ` — ${metricField.label}` : ""}
        </div>
        <WeeklyBars entries={chartEntries} field={metricField} color={tpl.color} />
      </Card>

      {/* week-over-week comparison cards — the same question as the chart
          above, asked at a coarser resolution */}
      <div className="fhj-eyebrow mt-5 mb-2">This week vs last week</div>
      <div className="grid grid-cols-2 gap-2">
        {tpl.dashboardMetrics.map((k) => {
          const f = getField(tpl, k);
          const t = trendFor(entries, k, f.dir);
          return (
            <Card key={k} className="!p-3.5" style={{ padding: "0.875rem" }}>
              <div className="text-xs font-medium truncate" style={{ color: C.sub }}>{f.label}</div>
              <div className="font-display text-2xl leading-none mt-2 tabular-nums">{fmt1(t.a)}</div>
              <div className="mt-1.5"><TrendArrow trend={t} dir={f.dir} /></div>
            </Card>
          );
        })}
      </div>

      {/* ---------- Possible Patterns ----------
          Locally calculated, plus optional AI observations. */}
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
              <Button variant="secondary" block onClick={() => openLog(todayStr())}>Go to today's log</Button>
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
   Calendar screen
   ============================================================ */

function CalendarScreen({ profile, entries, openLog }) {
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
    return (
      <div className="px-4 pb-8 pt-4">
        <EmptyState icon="calendar" title="Nothing logged yet"
          text="Your calendar fills in as you log. Each day gets a colored dot from your key metric."
          actionLabel="Log today" onAction={() => openLog(todayStr())} />
      </div>
    );
  }

  return (
    <div className="px-4 pb-8 pt-3">
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
function wideTable(profile, entries, food = []) {
  return buildWideTable(getProfileTemplate(profile), profile, entries, food);
}

function ExportScreen({ db, setDb }) {
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
  const count = inRange.length;
  const stamp = `${bounds.start === "0000-01-01" ? "all-time" : bounds.start + "_to_" + bounds.end}`;

  const exportCSV = () => {
    const { header, rows } = wideTable(profile, inRange, foodInRange);
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
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(readme), "README");

    const profRows = [{
      profile_id: profile.id, profile_name: profile.name,
      profile_template: getProfileTemplate(profile).label,
      created_at: profile.createdAt, updated_at: profile.updatedAt,
      entries_in_export: count,
    }];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(profRows), "Profile");

    const { header, rows } = wideTable(profile, inRange, foodInRange);
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

function SettingsScreen({ db, setDb, goHome, goSetup, goImport, goExport, lockEnabled, onSetupPin, onChangePin, onDisablePin, setAi, onAiSetupComplete, syncEngine, syncStatus, syncConfigured, onRefreshSyncConfig }) {
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
          Everything is stored privately on this device. Export gives you CSV, Excel, and JSON backups.
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
        syncOn={!!syncStatus && syncStatus.phase !== "off"} syncEmail={syncStatus?.email} />
      <p className="text-[11px] mt-4 text-center" style={{ color: C.subtle }}>
        {APP_NAME} {APP_VERSION} ·{" "}
        {syncStatus && syncStatus.phase !== "off"
          ? "saved on this device, encrypted across yours."
          : "your data stays on this device."}
      </p>
    </div>
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
function PrivacyCard({ aiEnabled = false, aiAuto = false, syncOn = false, syncEmail = null }) {
  const [open, setOpen] = useState(false);
  const facts = [
    syncOn
      ? ["Signed in for sync", `Sync across devices is on${syncEmail ? `, using ${syncEmail}` : ""}. That email is the only thing identifying you, and it exists so your own devices can find each other. Turning sync off removes it from this device and leaves your journal untouched.`]
      : ["No account", "There's no sign-up, no email, no password. Nothing identifies you to anyone."],
    syncOn
      ? ["Encrypted before it's uploaded", "Your entries are sealed on this device with a key derived from your sync passphrase, which is never sent anywhere. The server holds dates and unreadable blocks. Because the app is delivered over the web, this can't protect you from someone who controls the site itself — and no HIPAA or medical-records claim is made."]
      : ["No server", "Your entries, photos, and reports are written to this browser's storage and never uploaded. There is no backend to upload them to."],
    ["No tracking", "No analytics, no cookies, no advertising or third-party scripts of any kind."],
    // This claim has to track reality, not the ideal. Turning on AI
    // observations adds exactly one outbound call — the card says so, on the
    // card, rather than leaving a promise standing that is no longer true.
    aiAuto
      ? ["Photos are sent as you attach them", "AI observations are on, and so is letting AI fill in the log. A photo you attach to a meal or a bowel entry is sent to your AI provider for a reading as soon as you add it, without a confirmation each time — that is what the switch in Settings turned on, and turning it back off restores the confirm step. Everything else still stays on this device."]
      : aiEnabled
        ? ["One network call, on request", "AI observations are on. Nothing is sent automatically: each analysis you ask for sends a summary of your logged numbers to your AI provider, and shows you exactly what before it goes. Everything else still stays here, and the rest of the app works offline."]
        : syncOn
          ? ["Still offline-first", "Saving never waits for the network. Everything is written here first and sent afterwards, so a full day logged in airplane mode is normal — it catches up when you're back."]
          : ["No network", "After the app loads once, it makes no network requests. Fonts ship with the app. You can log a full day in airplane mode. (Turning on the optional AI observations or sync in Settings is what changes this.)"],
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
  const [modules, setModules] = useState(new Set(profile.modules?.length ? profile.modules : []));
  const [disabledFields, setDisabledFields] = useState(new Set(profile.disabledFields || []));
  const [customQuestions, setCustomQuestions] = useState(profile.customQuestions || []);
  const [order, setOrder] = useState(profile.fieldOrder || []);
  const [overrides, setOverrides] = useState(profile.fieldOverrides || {});
  const [cameraTimer, setCameraTimer] = useState(profile.cameraTimer ?? 3);
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    onSave({
      name: name.trim(), modules: Array.from(modules), disabledFields: Array.from(disabledFields),
      customQuestions, fieldOrder: order, fieldOverrides: overrides, cameraTimer,
    });
  }, [name, modules, disabledFields, customQuestions, order, overrides, cameraTimer]); // eslint-disable-line

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
        className="fhj-input mt-2 mb-6" />

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
  /* An empty meal is one row, not a card with a header, a dash and an add
     button under it. Five of those took 425px to say nothing five times —
     more than half a phone screen, on the screen you open when you have not
     eaten yet. The whole row is the add target when there is nothing in it. */
  if (!logs.length) {
    const Row = viewer ? "div" : "button";
    return (
      <Card className="!p-0 mb-2" style={{ padding: 0 }}>
        <Row
          {...(viewer ? {} : { type: "button", onClick: onAdd, "aria-label": `Add food to ${def?.label || "meal"}` })}
          className="w-full flex items-center gap-2 px-3.5 py-2.5 text-left">
          <span className="fhj-tl-dot shrink-0" style={{ width: "1.5rem", height: "1.5rem" }}>
            <Icon name={def?.icon || "food"} size={12} color="currentColor" />
          </span>
          <span className="flex-1 text-sm font-bold" style={{ color: C.ink }}>{def?.label || "Meal"}</span>
          {!viewer && (
            <span className="flex items-center gap-1 text-[12.5px] font-semibold shrink-0" style={{ color: C.accentText }}>
              <Icon name="plus" size={13} color={C.accentText} /> Add food
            </span>
          )}
        </Row>
      </Card>
    );
  }

  return (
    <Card className="!p-0 mb-2.5" style={{ padding: 0 }}>
      <div className="flex items-center justify-between gap-2 px-3.5 pt-3 pb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="fhj-tl-dot" style={{ width: "1.5rem", height: "1.5rem" }}>
            <Icon name={def?.icon || "food"} size={12} color="currentColor" />
          </span>
          <span className="text-sm font-bold" style={{ color: C.ink }}>{def?.label || "Meal"}</span>
        </div>
        <span className="text-[11px] tabular-nums shrink-0" style={{ color: C.subtle }}>
          {kcal == null ? "—" : `${formatNutrient("calories", kcal)} kcal`}
        </span>
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

      {!viewer && (
        <button type="button" onClick={onAdd}
          className="w-full flex items-center gap-2 px-3.5 py-2.5 text-[13px] font-semibold"
          style={{ borderTop: `1px solid ${C.line}`, color: C.accentText }}>
          <Icon name="plus" size={14} color={C.accentText} /> Add food
        </button>
      )}
    </Card>
  );
}

function FoodScreen({
  food, foods, goals, onLog, onSaveLog, onDeleteLog, onUpdateLibrary,
  onEditGoals, aiEnabled, aiAuto, viewer,
}) {
  const [date, setDate] = useState(todayStr());
  const [picker, setPicker] = useState(null); // meal id
  const [sheet, setSheet] = useState(null);   // log being edited, or { meal } for new
  const rows = foodOn(food, date);
  const totals = dayTotals(food, date);
  const progress = goalProgress(goals, totals);
  const calGoal = goals?.calories;
  const isToday = date === todayStr();

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

  return (
    <div className="px-4 pb-8 pt-3 fhj-cat-food">
      {/* date pager */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <button className="fhj-icon-btn" onClick={() => setDate(addDays(date, -1))} aria-label="previous day">
          <Icon name="left" size={16} color={C.sub} />
        </button>
        <div className="text-center min-w-0">
          <div className="text-sm font-bold truncate" style={{ color: C.ink }}>
            {isToday ? "Today" : fmtNice(date)}
          </div>
          {isToday && <div className="text-[10.5px]" style={{ color: C.subtle }}>{fmtNice(date)}</div>}
        </div>
        <button className="fhj-icon-btn" onClick={() => setDate(addDays(date, 1))}
          disabled={date >= todayStr()} aria-label="next day">
          <Icon name="right" size={16} color={C.sub} />
        </button>
      </div>

      {/* the day's totals */}
      <Card className="mb-4">
        <div className={`flex gap-4 ${calGoal ? "items-center" : "items-start"}`}>
          {calGoal ? (
            <CalorieRing eaten={totals.calories} goal={calGoal} />
          ) : (
            <div className="shrink-0">
              {/* A 4xl em-dash beside a "Set daily targets" link read as a
                  broken layout rather than as an empty day. */}
              <div className="font-display text-4xl leading-none tabular-nums"
                style={{ color: totals.calories != null ? C.ink : C.muted }}>
                {totals.calories != null ? formatNutrient("calories", totals.calories) : "0"}
              </div>
              <div className="text-[11px] mt-1" style={{ color: C.subtle }}>
                kcal {isToday ? "today" : "this day"}
              </div>
            </div>
          )}
          <div className="flex-1 min-w-0 flex flex-col gap-2">
            {progress.filter((p) => p.k !== "calories").length > 0 ? (
              progress.filter((p) => p.k !== "calories").slice(0, 3).map((p) => (
                <GoalBar key={p.k} progress={p} />
              ))
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
              </div>
            )}
          </div>
        </div>
        {/* Its own row under the numbers, not a small link floating beside a
            4xl digit — beside it, the two never shared a baseline and the card
            read as three things that had come loose. */}
        {progress.length === 0 && !viewer && (
          <button onClick={() => { feedback("nav"); onEditGoals(); }}
            className="w-full mt-3 pt-3 flex items-center justify-between gap-2 text-left"
            style={{ borderTop: `1px solid ${C.line}`, minHeight: "var(--fhj-tap)" }}>
            <span className="text-[12.5px] font-semibold" style={{ color: C.accentText }}>
              Set daily targets
            </span>
            <Icon name="right" size={13} color={C.accentText} />
          </button>
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

      {MEALS.map((m) => (
        <MealSection key={m.id} meal={m.id} viewer={viewer}
          logs={rows.filter((r) => r.meal === m.id)}
          onAdd={() => setPicker(m.id)}
          onOpenLog={(l) => !viewer && setSheet(l)} />
      ))}

      {!viewer && yesterdayRows.length > 0 && rows.length === 0 && (
        <Button variant="secondary" block icon="refresh" className="mt-3" onClick={copyYesterday}>
          Copy {yesterdayRows.length} item{yesterdayRows.length === 1 ? "" : "s"} from yesterday
        </Button>
      )}

      {rows.length === 0 && (
        <p className="text-[11.5px] leading-relaxed mt-4 text-center" style={{ color: C.subtle }}>
          Nothing logged for this day yet. Foods you save build up as you go — after a week or so,
          most meals are one tap.
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
    id: "photo", cat: "fhj-cat-photo", icon: "camera", label: "Photo",
    sub: "Progress shot", desc: "Needs at least one photo question in your setup",
  },
  {
    id: "diary", cat: "fhj-cat-food", icon: "target", label: "Food diary",
    sub: "The whole day", desc: "Jumps to the day's meals and totals",
  },
];

const DEFAULT_QUICK_ADD = ["checkin", "food", "bowel", "photo"];

const quickAddTile = (id) => QUICK_ADD_TILES.find((t) => t.id === id);

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

/** The ids to draw, after the user's choice and what their setup can actually
    support are both accounted for. */
function resolveQuickAdd(profile, { hasPhotoField }) {
  const chosen = sanitizeQuickAdd(profile?.quickAdd) ?? DEFAULT_QUICK_ADD;
  return chosen.filter((id) => (id === "photo" ? hasPhotoField : true));
}

function QuickAdd({ ids, checkedIn, actions }) {
  const tiles = ids.map(quickAddTile).filter((t) => t && actions[t.id]);
  if (!tiles.length) return null;

  return (
    <div className="fhj-tiles">
      {tiles.map((t) => {
        const done = t.id === "checkin" && checkedIn;
        return (
          <button key={t.id} type="button"
            /* The third channel. Sound needs a speaker and haptics need a
               motor; this reaches the person who has neither — and on the
               most-tapped control in the app, that matters most. */
            onClick={(e) => { feedback("quickadd", { el: e.currentTarget }); actions[t.id](); }}
            className={`fhj-tile fhj-pop ${t.cat}${done ? " is-done" : ""}`}>
            <span className="fhj-tile-icon">
              <Icon name={done ? "check" : t.icon} size={17} color="currentColor" />
            </span>
            <span>
              <span className="fhj-tile-label block">{t.label}</span>
              <span className="fhj-tile-sub block">
                {t.id === "checkin" && checkedIn ? "Done today" : t.sub}
              </span>
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
function QuickAddEditor({ profile, hasPhotoField, onSave, onClose }) {
  const [order, setOrder] = useState(
    () => sanitizeQuickAdd(profile?.quickAdd) ?? DEFAULT_QUICK_ADD
  );
  const available = QUICK_ADD_TILES.filter((t) => (t.id === "photo" ? hasPhotoField : true));
  const off = available.filter((t) => !order.includes(t.id));

  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    feedback("tap");
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
        Pick the buttons you want on the dashboard, in the order you want them.
      </p>

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

      {!hasPhotoField && (
        <p className="text-[11px] leading-relaxed mb-3" style={{ color: C.subtle }}>
          The Photo tile isn't offered because your setup has no photo question in it. Add one in
          Edit Setup and it will appear here.
        </p>
      )}

      <div className="flex gap-2 mt-4">
        <Button variant="ghost" size="sm" onClick={() => { feedback("tap"); setOrder(DEFAULT_QUICK_ADD); }}>
          Reset
        </Button>
        <div className="flex-1" />
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={() => { feedback("save"); onSave(order); }}>Save</Button>
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

function TodayTimeline({ entry, tpl, food, bowel, date, onOpenEntry, onOpenFood, onOpenBowel }) {
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
function greetingFor(d = new Date()) {
  const h = d.getHours();
  if (h < 5) return "Still up";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
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
      <div className="fhj-scroller fhj-cat-food" role="list" aria-label="Log a food again">
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
      </div>
    </>
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
    streak > 0 ? { label: "streak", value: `${streak} days` } : null,
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

function DashboardScreen({ profile, entries, openLog, goSettings, goSetup, goFood, goInsights, onUpdateQuickAdd, viewer, ai, food, bowel, foods, onUpdateLibrary, onSaveFood, onDeleteFood, onSaveBowel, onDeleteBowel, syncStatus }) {
  const tpl = getProfileTemplate(profile);
  const keyField = getField(tpl, tpl.keyMetric);
  const today = entryOn(entries, todayStr());
  const streak = calcStreak(entries);
  const photoFields = useMemo(() => tpl.fields.filter((f) => f.type === "photo"), [tpl]);

  /* Which log sheet is open, if any. `null` = closed; an object carries the
     row being edited (or {} for a new one). */
  const [foodSheet, setFoodSheet] = useState(null);
  const [foodPicker, setFoodPicker] = useState(null); // meal id
  const [bowelSheet, setBowelSheet] = useState(null);
  const [quickAddEditor, setQuickAddEditor] = useState(false);
  const aiEnabled = !!ai?.enabled && !viewer;
  const aiAuto = aiEnabled && ai?.auto === true;

  /* Quick Add: which tiles, and what each one does. The catalogue and the
     handlers are kept apart on purpose — a tile with no handler here simply
     doesn't render, so the viewer build and a setup without photo questions
     both drop the tiles they can't honour without any extra conditionals. */
  const quickAddIds = resolveQuickAdd(profile, { hasPhotoField: photoFields.length > 0 });
  const quickAddActions = {
    checkin: () => openLog(todayStr()),
    food: () => setFoodPicker(mealForTime(localTime())),
    drink: () => setFoodPicker("drink"),
    bowel: () => setBowelSheet({}),
    photo: photoFields.length > 0 ? () => openLog(todayStr(), { photos: true }) : null,
    diary: goFood || null,
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
            {viewer ? "Read-only viewer · nothing is saved" : greetingFor()}
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

      {/* ---------- Quick Add ----------
          First thing under the header, every time. This is what the app is
          for; everything else on this screen is a report on it. */}
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
            <QuickAdd ids={quickAddIds} checkedIn={!!today} actions={quickAddActions} />
          ) : (
            <button type="button" onClick={() => { feedback("tap"); setQuickAddEditor(true); }}
              className="w-full text-[12px] leading-relaxed px-3 py-3 rounded-xl text-left"
              style={{ background: C.faint, border: `1px dashed ${C.lineStrong}`, color: C.subtle }}>
              No Quick Add buttons — tap to choose some.
            </button>
          )}

          <RepeatRow
            library={foods}
            onOpenPicker={() => setFoodPicker(mealForTime(localTime()))}
            onLog={(item) => {
              const time = localTime();
              onSaveFood(logFromFoodItem(item, { date: todayStr(), time, meal: mealForTime(time), servings: 1 }));
            }} />
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
        entry={today} tpl={tpl} food={food} bowel={bowel} date={todayStr()}
        onOpenEntry={openLog}
        onOpenFood={(f) => !viewer && setFoodSheet(f)}
        onOpenBowel={(b) => !viewer && setBowelSheet(b)} />

      <GlanceCard tpl={tpl} keyField={keyField} entry={today} food={food}
        streak={streak} onOpen={goInsights} />

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
      {quickAddEditor && (
        <QuickAddEditor
          profile={profile}
          hasPhotoField={photoFields.length > 0}
          onSave={(ids) => { onUpdateQuickAdd?.(ids); setQuickAddEditor(false); }}
          onClose={() => setQuickAddEditor(false)} />
      )}
    </div>
  );
}

/* ============================================================
   App shell
   ============================================================ */

/* =====================================================================
   Onboarding — first-run setup wizard
   Welcome/disclaimer → pick packs → tune questions → photo spots (body
   map) → weight & progress photos → finish. Produces one profile via
   buildOnboardProfile(). Existing installs skip this (onboarded flag).
   ===================================================================== */

const ONBOARD_PACKS = [
  { key: "eczema", desc: "Itch, dryness, flare areas, sleep, stress, possible triggers" },
  { key: "carnivore", desc: "Adherence, foods, weight, energy, digestion, cravings" },
  { key: "pots", desc: "Dizziness, heart rate, standing tolerance, hydration, flares" },
  { key: "ibs", desc: "Gut symptoms, bathroom tracking, foods, stress, possible triggers" },
  { key: "migraine", desc: "Headache severity, attacks, sensitivities, sleep, hydration" },
  { key: "allergy", desc: "Reaction severity, hives, flushing, foods, antihistamines" },
  { key: "fatigue", desc: "Fatigue, brain fog, crashes, pacing, activity capacity" },
  { key: "autoimmune", desc: "Symptoms, joint pain, stiffness, flares, medication" },
  { key: "thyroid", desc: "Energy, mood, weight, heart rate, medication" },
  { key: "joint", desc: "Pain, stiffness, painful areas, movement, exercise" },
  { key: "wellness", desc: "Wellbeing, mood, energy, sleep, habits — a gentle default" },
];

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
  ["device", "Your journal is written to this device and read back from it. There is no server holding it."],
  ["eye", "No analytics, no trackers, no ads. Nobody is counting your taps."],
  ["download", "Export the whole thing to a spreadsheet whenever you want. It's your data, in a file you keep."],
  ["trash", "Delete everything, permanently, from Settings. No 'contact us to close your account'."],
];

/* The setup, named. Seven dots told someone they were on the fourth of seven
   somethings; these tell them what the fourth one is and what is left after it,
   which is the difference between a progress bar and an agenda. */
const ONBOARD_STEPS = [
  { key: "welcome", label: "Welcome" },
  { key: "look", label: "Look" },
  { key: "focus", label: "Focus" },
  { key: "questions", label: "Questions" },
  { key: "photos", label: "Photos" },
  { key: "body", label: "Body" },
  { key: "done", label: "Done" },
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

  return {
    id: "p_self", name: (sel.name || "").trim(), modules: [...sel.modules],
    disabledFields: disabled, customQuestions: custom, fieldOrder: [], fieldOverrides: overrides,
    photoBaselines: {}, cameraTimer: 3, prefs: { ...DEFAULT_PREFS }, createdAt: now, updatedAt: now,
  };
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

function OnboardingWizard({ onComplete, onLoadSample }) {
  const [step, setStep] = useState(0);
  const [mods, setMods] = useState([]);
  const [enabled, setEnabled] = useState(new Set());
  const known = useRef(new Set());
  const [spots, setSpots] = useState([]);
  const [weightOn, setWeightOn] = useState(false);
  const [weightTouched, setWeightTouched] = useState(false);
  const [progressAngles, setProgressAngles] = useState([]);
  const [progressTouched, setProgressTouched] = useState(false);
  const [name, setName] = useState("");
  const [customs, setCustoms] = useState([]);
  const scrollRef = useRef(null);
  const bodyRef = useRef(null);
  const railRef = useRef(null);

  /* One way to change step, so the sound, the scroll and the entrance can never
     disagree about which of the three happened. The pitch climbs with the step
     — the last screen of the setup resolves an octave above the first — which
     is a small thing that makes a seven-screen form feel like it is going
     somewhere rather than repeating. */
  const go = (next) => {
    if (next === step) return;
    if (next > step) place("step", next + 1, ONBOARD_STEPS.length);
    else feedback("nav");
    setStep(next);
  };

  /* The name, used. Twice, deliberately: once on the screen straight after it
     was typed, so the app is visibly listening, and once at the end, where the
     setup being handed over is theirs. Greeting on all seven would be a bit
     desperate. */
  const firstName = name.trim().split(/\s+/)[0] || "";
  const greet = firstName ? (
    <div className="fhj-greet">Nice to meet you, {firstName}.</div>
  ) : null;

  const tint = mods.length ? TEMPLATES[mods[0]].color : C.accent;
  const merged = useMemo(() => mergedPackFields(mods), [mods]);
  const tunable = useMemo(() => merged.filter((f) => f.type !== "photo" && f.k !== "weight"), [merged]);

  /* Keep the enabled set in step with the chosen packs: a question the wizard
     has never offered before arrives switched on, and one it has offered keeps
     whatever the user decided about it.

     `seen` has to be read into a local *before* the ref is replaced. It used to
     be read inside the updater, and an updater passed to setState does not run
     during the effect — it runs later, during the re-render, by which time
     `known.current = keys` had already executed. Every key therefore looked
     like one the user had already seen and ruled on, the "preserve their
     choice" branch won, and the choice it preserved was the empty set from
     before any pack existed. The visible result was that picking a pack turned
     on nothing at all: the estimate read "0 quick questions", every question
     chip was grey, and the only way forward from step 3 of first-run setup was
     to notice the disabled button and go tap "Track everything". */
  useEffect(() => {
    const keys = new Set(tunable.map((f) => f.k));
    const seen = known.current;
    known.current = keys;
    setEnabled((prev) => {
      const next = new Set();
      for (const k of keys) { if (!seen.has(k) || prev.has(k)) next.add(k); }
      return next;
    });
    const hasCarni = mods.includes("carnivore");
    if (!weightTouched) setWeightOn(hasCarni);
    if (!progressTouched) setProgressAngles(hasCarni ? ["Front", "Side", "Back"] : []);
  }, [mods]); // eslint-disable-line

  useEffect(() => {
    scrollRef.current?.scrollTo?.(0, 0);
    window.scrollTo(0, 0);
    animateStepIn(bodyRef.current);
    /* Keep the step you are on inside the rail's visible run, so the fade at
       its end only ever covers steps you aren't on. `block: "nearest"` stops
       this from scrolling the page as a side effect of scrolling the rail. */
    railRef.current
      ?.querySelector('[aria-current="step"]')
      ?.scrollIntoView?.({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [step]);

  /* live daily-check-in estimate */
  const quickCount = tunable.filter((f) => f.quick && enabled.has(f.k)).length + (weightOn ? 1 : 0)
    + customs.filter((f) => f.type !== "photo" && f.quick !== false).length;
  const photoCount = spots.length + progressAngles.length + customs.filter((f) => f.type === "photo").length;
  const secs = 8 + quickCount * 6 + photoCount * 15;
  const timeLabel = secs < 75 ? "under a minute" : `about ${Math.round(secs / 60)} min`;
  const estimatePill = (
    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
      style={{ background: C.faint, color: C.ink }}>
      {quickCount} quick question{quickCount === 1 ? "" : "s"}{photoCount ? ` · ${photoCount} photo${photoCount === 1 ? "" : "s"}` : ""} · {timeLabel} a day
    </div>
  );

  const toggleSpot = (s) => setSpots((prev) => {
    const i = prev.findIndex((x) => x.part === s.part && (x.side || "") === (s.side || ""));
    return i >= 0 ? prev.filter((_, j) => j !== i) : [...prev, s];
  });

  const finish = (dest) => {
    /* The one moment in the setup that gets the full chord. It is the only
       thing here the user will never do again. */
    feedback("complete");
    onComplete(
      buildOnboardProfile({ modules: mods, enabledKeys: enabled, spots, weightOn, progressAngles, name, customs }),
      dest
    );
  };

  const chipBtn = (on, label, onClick, key) => (
    <button key={key || label} onClick={onClick}
      className="px-3 py-2 rounded-full text-sm font-medium inline-flex items-center gap-1.5"
      style={{ background: on ? tint : C.faint, color: on ? readableInk(tint) : C.ink, minHeight: 40 }}>
      {on && <Icon name="check" size={13} color={readableInk(tint)} />}{label}
    </button>
  );

  /* ---------- step bodies ---------- */
  let body = null; let actions = null;

  if (step === 0) {
    /* The name moved here from the last screen, and that is the whole point of
       it. Asked at the end it was a label on a profile nobody looks at. Asked
       first, it is the one thing every screen after this can use — the setup
       stops being a form and starts being a conversation with someone whose
       name it knows, and the person filling it in can see that happen from the
       second screen onward.

       It stays optional, and skipping it costs nothing: the greeting simply
       doesn't appear. An onboarding step that can't be skipped is a toll. */
    body = (
      <div className="pt-8">
        <div className="fhj-hello">Health Journal</div>
        <div className="font-display text-3xl leading-tight mb-2">Your health, in your own words.</div>
        <p className="text-sm leading-relaxed mb-5" style={{ color: C.sub }}>
          Build a daily check-in that fits <i>your</i> situation — a couple of taps a day, trends over time,
          and everything stays privately on this device.
        </p>

        <div className="mb-5">
          <label className="fhj-label" htmlFor="fhj-onboard-name">What should this app call you?</label>
          <input id="fhj-onboard-name" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Optional — a first name is plenty"
            autoComplete="given-name" className="fhj-input" />
        </div>

        {/* Trust, as five things that are true about the build rather than as a
            paragraph about how much we value privacy. Every line here is a
            claim the user can check from inside the app on day one, which is
            the only kind worth printing on a first-run screen. */}
        <Card className="mb-4">
          <div className="fhj-eyebrow mb-2.5">What this app does, and doesn't</div>
          <ul className="fhj-promises">
            {PROMISES.map(([icon, text]) => (
              <li key={text}>
                <span className="fhj-promise-mark"><Icon name={icon} size={13} color={C.good} /></span>
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="mb-4">
          <div className="fhj-eyebrow mb-2">Before you start</div>
          <p className="text-sm leading-relaxed">{DISCLAIMER}</p>
          <p className="text-sm leading-relaxed mt-2" style={{ color: C.sub }}>
            The app highlights <i>possible patterns</i> in what you log. It never concludes that something caused a symptom.
          </p>
        </Card>
      </div>
    );
    actions = (
      <div className="flex flex-col gap-2">
        <button onClick={() => go(1)} className="fhj-btn fhj-btn-primary fhj-btn-block">I understand — set me up</button>
        <button onClick={onLoadSample} className="w-full py-2.5 rounded-xl text-sm font-medium"
          style={{ background: C.faint, color: C.sub }}>Just exploring? Load example data</button>
      </div>
    );
  } else if (step === 1) {
    /* Appearance comes before anything else on purpose. Every screen after
       this one is already wearing the choice, so the setup itself is the
       preview — and the one question a first-run screen can ask that costs
       nothing to answer and nothing to get wrong is "which of these do you
       like?". Nothing here is load-bearing; all of it is in Settings too. */
    body = (
      <>
        <div>
          {greet}
          <div className="font-display text-2xl mb-1">Make it yours</div>
          <p className="text-sm" style={{ color: C.sub }}>
            Pick a look. The rest of the setup will use it, so you can see what you're choosing.
            You can change any of this later in Settings.
          </p>
        </div>
        <Card className="mt-4">
          <AppearancePanel onChoice={() => feedback("select")} />
        </Card>
      </>
    );
    actions = (
      <button onClick={() => go(2)} className="fhj-btn fhj-btn-primary fhj-btn-block">
        Continue
      </button>
    );
  } else if (step === 2) {
    body = (
      <>
        <div className="font-display text-2xl mb-1">What do you want to track?</div>
        <p className="text-sm mb-4" style={{ color: C.sub }}>Pick one or more. You can change everything later in Edit Setup.</p>
        <div className="flex flex-col gap-3">
          {ONBOARD_PACKS.map(({ key, desc }) => {
            const t = TEMPLATES[key];
            const on = mods.includes(key);
            const qn = t.fields.filter((f) => f.quick && f.type !== "photo").length;
            return (
              <button key={key}
                onClick={() => setMods((prev) => on ? prev.filter((m) => m !== key) : [...prev, key])}
                className="text-left rounded-2xl p-4 flex items-start gap-3"
                style={{ background: C.card, border: `2px solid ${on ? t.color : C.line}` }}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: on ? t.color : C.faint }}>
                  {on ? <Icon name="check" size={17} color={readableInk(t.color)} /> : <div className="w-3 h-3 rounded-full" style={{ background: t.color }} />}
                </div>
                <div className="min-w-0">
                  <div className="font-display text-lg leading-snug">{t.label}</div>
                  <div className="text-sm mt-0.5" style={{ color: C.sub }}>{desc}</div>
                  <div className="text-[11px] mt-1 font-medium" style={{ color: t.color }}>{qn} quick questions ready to go</div>
                </div>
              </button>
            );
          })}
        </div>
        <div className="text-[11px] mt-4 leading-relaxed" style={{ color: C.sub }}>
          Shared questions (like sleep or stress) are only asked once, even across packs. You can add your own questions on the next step.
        </div>
      </>
    );
    actions = (
      <button onClick={() => go(3)} disabled={!mods.length}
        className="fhj-btn fhj-btn-primary fhj-btn-block">
        {mods.length ? "Continue" : "Pick at least one to continue"}
      </button>
    );
  } else if (step === 3) {
    const sections = [];
    for (const mk of mods) {
      const t = TEMPLATES[mk];
      const mine = tunable.filter((f) => f.module === mk);
      if (!mine.length) continue;
      const bySec = [];
      for (const f of mine) {
        let g = bySec.find((x) => x.sec === (f.sec || "Other"));
        if (!g) { g = { sec: f.sec || "Other", fields: [] }; bySec.push(g); }
        g.fields.push(f);
      }
      sections.push({ mk, label: t.label, color: t.color, groups: bySec });
    }
    const allKeys = tunable.map((f) => f.k);
    const essentials = () => setEnabled(new Set(tunable.filter((f) => f.quick).map((f) => f.k)));
    const everything = () => setEnabled(new Set(allKeys));
    body = (
      <>
        <div className="font-display text-2xl mb-1">Build your daily check-in</div>
        <p className="text-sm mb-2" style={{ color: C.sub }}>
          Tap questions on or off, or add your own. Photos and weight come next.
        </p>
        <div className="mb-3">{estimatePill}</div>
        <div className="flex gap-2 mb-4">
          <button onClick={essentials} className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: C.faint }}>Keep it quick</button>
          <button onClick={everything} className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: C.faint }}>Track everything</button>
        </div>
        {sections.map((s) => (
          <div key={s.mk} className="mb-4">
            <div className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: s.color }}>{s.label}</div>
            {s.groups.map((g) => (
              <div key={g.sec} className="mb-2.5">
                <div className="text-[11px] mb-1.5" style={{ color: C.sub }}>{g.sec}</div>
                <div className="flex flex-wrap gap-1.5">
                  {g.fields.map((f) => {
                    const on = enabled.has(f.k);
                    return (
                      <button key={f.k}
                        onClick={() => setEnabled((prev) => { const n = new Set(prev); on ? n.delete(f.k) : n.add(f.k); return n; })}
                        className="px-3 py-2 rounded-full text-sm font-medium inline-flex items-center gap-1.5"
                        style={{ background: on ? s.color : C.faint, color: on ? readableInk(s.color) : C.sub, minHeight: 40 }}>
                        {on && <Icon name="check" size={13} color={readableInk(s.color)} />}{f.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ))}
        <div className="mb-4">
          <div className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: C.sub }}>Your own questions</div>
          {customs.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {customs.map((f) => (
                <button key={f.k} onClick={() => setCustoms((prev) => prev.filter((x) => x.k !== f.k))}
                  className="px-3 py-2 rounded-full text-sm font-medium inline-flex items-center gap-1.5"
                  style={{ background: tint, color: readableInk(tint), minHeight: 40 }}>
                  {f.label} <Icon name="x" size={12} color={readableInk(tint)} />
                </button>
              ))}
            </div>
          )}
          <AddCustomQuestion onAdd={(input) => setCustoms((prev) => [...prev, buildCustomField(input, prev.length)])} />
        </div>
      </>
    );
    actions = (
      <button onClick={() => go(4)} disabled={!enabled.size}
        className="fhj-btn fhj-btn-primary fhj-btn-block">
        {enabled.size ? "Continue" : "Keep at least one question"}
      </button>
    );
  } else if (step === 4) {
    body = (
      <>
        <div className="font-display text-2xl mb-1">Problem spots to photograph</div>
        <p className="text-sm mb-1" style={{ color: C.sub }}>
          Tap the body where you'd like photo check-ins — the app lines each shot up with your last one so changes are easy to see. Totally optional.
        </p>
        <div className="mb-2">{estimatePill}</div>
        <Card className="mb-3">
          <BodyMap spots={spots} onToggle={toggleSpot} tint={tint} />
          <div className="flex flex-wrap gap-1.5 justify-center mt-1">
            {chipBtn(spots.some((s) => s.part === "Back"), "Back of body", () => toggleSpot({ part: "Back", side: "" }))}
          </div>
        </Card>
        {spots.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {spots.map((s) => (
              <button key={s.part + s.side} onClick={() => toggleSpot(s)}
                className="px-3 py-1.5 rounded-full text-sm font-medium inline-flex items-center gap-1.5"
                style={{ background: tint, color: readableInk(tint) }}>
                {spotLabel(s)} <Icon name="x" size={12} color={readableInk(tint)} />
              </button>
            ))}
          </div>
        )}
        {spots.length === 0 && (
          <p className="text-[11px]" style={{ color: C.sub }}>No spots selected — you can add photo questions any time in Edit Setup.</p>
        )}
      </>
    );
    actions = (
      <button onClick={() => go(5)} className="fhj-btn fhj-btn-primary fhj-btn-block">
        {spots.length ? "Continue" : "Skip for now"}
      </button>
    );
  } else if (step === 5) {
    const progressOn = progressAngles.length > 0;
    body = (
      <>
        <div className="font-display text-2xl mb-1">Weight &amp; progress photos</div>
        <p className="text-sm mb-3" style={{ color: C.sub }}>Optional — great for diet or fitness goals.</p>
        <Card className="mb-3">
          <button onClick={() => { setWeightTouched(true); setWeightOn((v) => !v); }}
            className="w-full flex items-center justify-between gap-3 text-left">
            <div>
              <div className="font-semibold text-sm">Track weight daily</div>
              <div className="text-[12px] mt-0.5" style={{ color: C.sub }}>A quick number entry in your check-in.</div>
            </div>
            <div className="w-12 h-7 rounded-full p-1 shrink-0" style={{ background: weightOn ? tint : C.line }}>
              <div className="w-5 h-5 rounded-full bg-white" style={{ marginLeft: weightOn ? "auto" : 0, transition: "margin 120ms" }} />
            </div>
          </button>
        </Card>
        <Card>
          <button onClick={() => { setProgressTouched(true); setProgressAngles(progressOn ? [] : ["Front", "Side", "Back"]); }}
            className="w-full flex items-center justify-between gap-3 text-left">
            <div>
              <div className="font-semibold text-sm">Progress photos</div>
              <div className="text-[12px] mt-0.5" style={{ color: C.sub }}>
                Full-body photos over time{weightOn ? ", captioned with your weight" : ""}.
              </div>
            </div>
            <div className="w-12 h-7 rounded-full p-1 shrink-0" style={{ background: progressOn ? tint : C.line }}>
              <div className="w-5 h-5 rounded-full bg-white" style={{ marginLeft: progressOn ? "auto" : 0, transition: "margin 120ms" }} />
            </div>
          </button>
          {progressOn && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {["Front", "Side", "Back"].map((ang) => chipBtn(
                progressAngles.includes(ang), ang,
                () => { setProgressTouched(true); setProgressAngles((prev) => prev.includes(ang) ? prev.filter((a) => a !== ang) : [...prev, ang]); },
                ang
              ))}
            </div>
          )}
        </Card>
        <div className="mt-3">{estimatePill}</div>
      </>
    );
    actions = (
      <button onClick={() => go(6)} className="fhj-btn fhj-btn-primary fhj-btn-block">
        Continue
      </button>
    );
  } else {
    const setupLabel = mods.map((mk) => TEMPLATES[mk].label).join(" + ");
    /* The first three questions, by name. The estimate pill has been counting
       them the whole way through, but a count is an abstraction — "9 quick
       questions" could be anything. Seeing the actual words the app will ask
       tomorrow morning is what turns a setup screen into a thing that was
       built, and it is the last chance to notice it asks the wrong ones. */
    const preview = tunable
      .filter((f) => f.quick && enabled.has(f.k))
      .slice(0, 3)
      .map((f) => f.label);
    body = (
      <>
        <div>
          <div className="font-display text-2xl mb-1">
            {firstName ? `You're all set, ${firstName}.` : "You're all set"}
          </div>
          <p className="text-sm" style={{ color: C.sub }}>
            Here is the check-in you just built. Everything stays on this device.
          </p>
        </div>

        <Card className="mt-4">
          <div className="font-display text-lg mb-2" style={{ color: tint }}>{setupLabel}</div>
          <div className="text-sm leading-relaxed">
            <div>• {quickCount} quick question{quickCount === 1 ? "" : "s"} — {timeLabel} a day</div>
            {customs.length > 0 && <div>• {customs.length} question{customs.length === 1 ? "" : "s"} of your own</div>}
            {spots.length > 0 && <div>• Photo check-ins: {spots.map(spotLabel).join(", ")}</div>}
            {weightOn && <div>• Daily weight</div>}
            {progressAngles.length > 0 && <div>• Progress photos: {progressAngles.join(" · ").toLowerCase()}</div>}
          </div>
          {preview.length > 0 && (
            <div className="fhj-preview">
              <div className="fhj-eyebrow mb-1.5">Tomorrow morning, it asks</div>
              {preview.map((label) => <div key={label} className="fhj-preview-row">{label}</div>)}
              {quickCount > preview.length && (
                <div className="fhj-preview-more">…and {quickCount - preview.length} more</div>
              )}
            </div>
          )}
        </Card>

        <p className="text-[11.5px] leading-relaxed mt-4" style={{ color: C.subtle }}>
          Nothing here is permanent. Every question, photo spot and setting on these screens can be
          changed, added or removed later from Edit Setup — including all of it at once.
        </p>
      </>
    );
    actions = (
      <div className="flex flex-col gap-2">
        <button onClick={() => finish("log")} className="fhj-btn fhj-btn-primary fhj-btn-block">
          Start my first check-in
        </button>
        <button onClick={() => finish("dashboard")} className="w-full py-2.5 rounded-xl text-sm font-medium" style={{ background: C.faint }}>
          Go to my dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: C.bg, color: C.ink, fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}>
      {/* The setup screens run over the real backdrop, so the choice made on
          step 1 is visible for the rest of the flow rather than described. */}
      <AmbientBackdrop />
      <div ref={scrollRef} className="max-w-md mx-auto px-4 relative" style={{ paddingBottom: "9.5rem", zIndex: 1 }}>
        {/* Seven anonymous dots told someone they were on the fourth of seven
            somethings. The rail names them: what this screen is, what is left,
            and — because every step behind you is tappable — a way back to any
            answer without walking the whole flow in reverse. */}
        <div className="sticky top-0 z-20 pt-4 pb-2 flex items-center gap-2.5" style={{ background: C.bg }}>
          {step > 0 ? (
            <button onClick={() => go(step - 1)} aria-label="back"
              className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
              style={{ background: C.card, border: `1px solid ${C.line}` }}>
              <Icon name="left" size={17} color={C.sub} />
            </button>
          ) : <div className="w-9 h-9 shrink-0" />}
          <ol ref={railRef} className="fhj-rail" aria-label={`Setup step ${step + 1} of ${ONBOARD_STEPS.length}`}>
            {ONBOARD_STEPS.map((s, i) => {
              const state = i === step ? "current" : i < step ? "done" : "todo";
              return (
                <li key={s.key}>
                  <button type="button" data-state={state} disabled={i > step}
                    aria-current={i === step ? "step" : undefined}
                    onClick={() => go(i)}
                    style={i <= step ? { "--fhj-rail-on": tint } : undefined}>
                    <span className="fhj-rail-dot" aria-hidden="true" />
                    <span className="fhj-rail-label">{s.label}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
        <div ref={bodyRef}>{body}</div>
      </div>
      <div className="fixed bottom-0 left-0 right-0 z-30" style={{ background: `linear-gradient(transparent, ${C.bg} 35%)` }}>
        <div className="max-w-md mx-auto px-4 pb-4 pt-5">{actions}</div>
      </div>
    </div>
  );
}

/* Five tabs, ordered by how often a thumb reaches for them.

   Export used to hold a permanent slot here and Insights had none, which had
   it backwards: exporting is something you do before an appointment, a few
   times a year, and trends are what you open the app to look at. Export now
   lives at the foot of Insights and in Settings — two places, both of them
   where someone would go looking for it — and the tab it vacated went to the
   screen that earns a daily visit. */
const NAV = [
  { id: "dashboard", label: "Today", icon: "home" },
  { id: "log", label: "Log", icon: "log" },
  { id: "food", label: "Food", icon: "food" },
  { id: "insights", label: "Insights", icon: "trends" },
  { id: "calendar", label: "Calendar", icon: "calendar" },
];

/* Forward migration — safe to run on every load; only fills gaps. */
const SCHEMA_VERSION = 2;
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
  if (d.profile.goals) d.profile.goals = sanitizeGoals(d.profile.goals);
  /* Same reasoning as the food logs: this arrives from a backup file as often
     as from the editor, and an unknown tile id would render as a gap. */
  if (d.profile.quickAdd !== undefined) d.profile.quickAdd = sanitizeQuickAdd(d.profile.quickAdd);
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
  const [screen, setScreen] = useState("dashboard");
  const [logDate, setLogDate] = useState(todayStr());
  const [logMode, setLogMode] = useState("quick");
  const [logPhotos, setLogPhotos] = useState(false);
  const [reportParams, setReportParams] = useState({ type: "week" });
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
  // GSAP screen transition + scroll reset on navigation (pre-paint, no flash)
  useLayoutEffect(() => { scrollToTop(true); animateScreenIn(screenRef.current); }, [screen]);
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
        customQuestions: draft.customQuestions, fieldOrder: draft.fieldOrder, fieldOverrides: draft.fieldOverrides,
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
    return (
      <OnboardingWizard
        onLoadSample={() => { loadSampleData(setDb); setScreen("dashboard"); }}
        onComplete={(profile, dest) => {
          setDb((prev) => ({ ...prev, profile, ack: true, onboarded: true }));
          if (dest === "log") { setLogDate(todayStr()); setLogMode("quick"); setLogPhotos(false); setScreen("log"); }
          else setScreen("dashboard");
        }}
      />
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
  const LOG_CAT = { food: "fhj-cat-food", bowel: "fhj-cat-bowel" };
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
      before = { rows, foods: prev.foods };
      return { ...prev, [slice]: next, foods };
    });
    const isEdit = (db[slice] || []).some((r) => r.id === log.id);
    toast({
      text: slice === "food"
        ? (isEdit ? "Meal updated" : `Added to ${mealLabel(log.meal).toLowerCase()}`)
        : (isEdit ? "Entry updated" : "Bowel movement logged"),
      cat: LOG_CAT[slice],
      undo: () => setDb((prev) => (before ? { ...prev, [slice]: before.rows, foods: before.foods } : prev)),
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
      text: slice === "food" ? "Meal deleted" : "Entry deleted",
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

  const setLibrary = (foods) => setDb((prev) => ({ ...prev, foods }));

  const setQuickAdd = (ids) => setDb((prev) => ({
    ...prev,
    profile: {
      ...prev.profile,
      quickAdd: sanitizeQuickAdd(ids) ?? DEFAULT_QUICK_ADD,
      updatedAt: new Date().toISOString(),
    },
  }));

  const todayProps = {
    profile, entries, openLog: goToLog, viewer,
    food: db.food || [], bowel: db.bowel || [], foods: db.foods || [],
    onUpdateLibrary: setLibrary,
    onSaveFood: upsertLog("food"), onDeleteFood: removeLog("food"),
    onSaveBowel: upsertLog("bowel"), onDeleteBowel: removeLog("bowel"),
    goSettings: () => setScreen("settings"), goSetup: () => setScreen("setup"),
    goFood: () => setScreen("food"), goInsights: () => setScreen("insights"),
    onUpdateQuickAdd: setQuickAdd, ai: db.ai, syncStatus,
  };

  const insightsProps = {
    profile, entries, openLog: goToLog, viewer,
    food: db.food || [], bowel: db.bowel || [],
    goExport: () => setScreen("export"), goSettings: () => setScreen("settings"),
    goSetup: () => setScreen("setup"), goGallery: () => setScreen("gallery"),
    goReport, reports: db.reports, openSavedReport, deleteSavedReport,
    ai: db.ai, setAi, aiAutoRun,
  };

  let content = null;
  if (screen === "dashboard") {
    content = <DashboardScreen {...todayProps} />;
  } else if (screen === "insights") {
    content = <InsightsScreen {...insightsProps} />;
  } else if (screen === "settings") {
    content = <SettingsScreen db={db} setDb={setDb} setAi={setAi} goHome={goHome} goSetup={() => setScreen("setup")}
      goExport={() => setScreen("export")}
      syncEngine={engineRef.current} syncStatus={syncStatus} syncConfigured={syncConfigured}
      onRefreshSyncConfig={() => setSyncConfigured(syncAvailable())}
      onAiSetupComplete={() => { setAiAutoRun((n) => n + 1); setScreen("dashboard"); }}
      goImport={() => setScreen("fitbit")} lockEnabled={!!lock}
      onSetupPin={() => setLockFlow("setup")} onChangePin={() => setLockFlow("change-verify")}
      onDisablePin={() => setLockFlow("disable-verify")} />;
  } else if (screen === "setup") {
    content = <EditSetupScreen profile={profile} entries={entries} onSave={updateProfile} goBack={goHome} />;
  } else if (screen === "export") {
    content = <ExportScreen db={db} setDb={viewer ? null : setDb} />;
  } else if (screen === "log") {
    content = (
      <LogScreen profile={profile} entries={entries} date={logDate} setDate={setLogDate}
        mode={logMode} setMode={setLogMode} onPatch={upsertEntry} startPhotos={logPhotos}
        onFinishQuick={goHome} onSetBaseline={setPhotoBaseline} />
    );
  } else if (screen === "food") {
    content = (
      <FoodScreen
        food={db.food || []} foods={db.foods || []} goals={db.profile.goals}
        aiEnabled={!!db.ai?.enabled && !viewer}
        aiAuto={!!db.ai?.enabled && db.ai?.auto === true && !viewer}
        viewer={viewer}
        onLog={upsertLog("food")} onSaveLog={upsertLog("food")} onDeleteLog={removeLog("food")}
        onUpdateLibrary={setLibrary}
        onEditGoals={() => setScreen("settings")} />
    );
  } else if (screen === "calendar") {
    content = <CalendarScreen profile={profile} entries={entries} openLog={goToLog} />;
  } else if (screen === "fitbit") {
    content = <FitbitImportScreen db={db} setDb={setDb} goBack={() => setScreen("settings")} />;
  } else if (screen === "gallery") {
    content = <PhotoGalleryScreen profile={profile} entries={entries} tpl={tpl} onSetBaseline={setPhotoBaseline} goBack={goHome} />;
  } else if (screen === "report") {
    content = <ReportScreen db={db} setDb={setDb} params={reportParams} goBack={goHome} />;
  } else {
    content = <DashboardScreen {...todayProps} />;
  }

  /* Both tab-level screens draw their own heading, so the shared header would
     only repeat it. Every other screen is somewhere you navigated *into* and
     wants the title and the way back. */
  const showHeader = screen !== "dashboard" && screen !== "insights";
  /* Every screen id that can reach here needs an entry. "food" and "fitbit"
     were missing, which rendered the header with an empty <h1> and the survey
     name orphaned underneath it. */
  const screenTitle = {
    log: "Daily Log", calendar: "Calendar", export: "Export Data", settings: "Settings",
    setup: "Edit Survey / Tracking Setup", gallery: "Photo Progress", food: "Food Diary",
    fitbit: "Import Health Data",
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
      <div className={"fhj-shell relative" + (screen === "log" && logMode === "detailed" ? " is-wide" : "")}
        style={{ paddingBottom: "6rem", zIndex: 1 }}>
        {showHeader && (
          <header className="sticky top-0 z-20 px-4 py-3 flex items-center gap-3"
            style={{
              background: C.bg,
              borderBottom: `1px solid ${C.line}`,
              /* The header sits over scrolling content; a light blur keeps the
                 title legible without a hard bar across the screen. */
              backdropFilter: "saturate(140%) blur(8px)",
            }}>
            <button onClick={goHome} aria-label="Back to dashboard" className="fhj-icon-btn"
              style={{ width: "2.5rem", height: "2.5rem" }}>
              <Icon name="home" size={18} color={C.sub} />
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

        <nav className="fixed bottom-0 left-0 right-0 z-30" aria-label="Main">
          <div className="max-w-md mx-auto px-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
            <div className="flex rounded-2xl overflow-hidden"
              style={{ background: C.card, border: `1px solid ${C.line}`, boxShadow: C.shadowLg }}>
              {(viewer ? NAV.filter((n) => n.id !== "log") : NAV).map((n) => {
                const active = screen === n.id;
                const color = active ? C.accentText : C.sub;
                return (
                  <button key={n.id}
                    onClick={() => { if (screen !== n.id) feedback("nav"); setScreen(n.id); }}
                    aria-current={active ? "page" : undefined}
                    className="flex-1 flex flex-col items-center justify-center gap-1 relative"
                    style={{ minHeight: 56, background: active ? C.accentSoft : "transparent" }}>
                    {/* A 2px cap rather than a filled pill: the active tab is
                        obvious without the nav turning into a block of colour. */}
                    <span aria-hidden="true" className="absolute top-0 rounded-full"
                      style={{
                        height: 2, width: active ? "1.75rem" : 0,
                        background: C.accent,
                        transition: "width 220ms cubic-bezier(0.22,1,0.36,1)",
                      }} />
                    <Icon name={n.icon} size={19} color={color} />
                    <span className="text-[10px] font-medium" style={{ color }}>{n.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </nav>
      </div>
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
  scaleHaptic, HAPTIC_PATTERNS, HAPTIC_SCALE, HAPTIC_LEVELS,
};

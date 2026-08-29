# Bellwether — brand

Everything visual is generated from one file. `python3 brand/build.py` redraws
the mark and writes every asset the app and the store need, so the icon on a
phone, the favicon in a tab, and the card on a shared link cannot drift apart.

## The name

A bellwether is the lead sheep of a flock, the one wearing the bell. You hear it
before you can see what the flock is doing. That is the whole promise of a
symptom journal: the small thing in week one that you only recognise as a signal
in week nine, because you wrote it down.

It is spelled **bellwether** — *bell* + *wether*, an old word for a castrated
ram. Not "bellweather." The misspelling is common enough to be worth a note in
the style guide: it is a bell, not the weather.

**Say "Bellwether" wherever a name is needed.** The longer
`Bellwether: Symptom Journal` exists only where a store listing needs the
category attached to satisfy search.

## The mark

A histogram whose envelope is a bell.

One shape doing three jobs at once. It is the **bell** of the name. It is a
**distribution**, which is a thing the app genuinely plots rather than a
borrowed graphic. And the single gold bar sits on the **rising shoulder, two
steps before the peak** — the early sign, arriving while there is still time for
it to be useful.

That gold bar is the entire idea, so it is placed by arithmetic rather than by
eye: bar heights are a real gaussian, and the marked bar is indexed from the
centre. Redrawing the mark at a different bar count keeps the meaning intact.

What it deliberately is not: a notification bell. That was drawn, looked at, and
thrown away — it is the single most generic shape in software, and it said
nothing about what this app does.

## Palette

Inherited from `src/lib/theme.ts`, so the icon and the app it opens look like
the same object.

| Token | Hex | Use |
|---|---|---|
| Ink | `#141519` | The ground. The app's dark background. |
| Ink raised | `#1F2128` | Top of the ground gradient. |
| Paper | `#F2EFE8` | The bars. Warm off-white, never pure white. |
| Paper shadow | `#CFCABF` | Foot of the bars, so they have weight. |
| Gold | `#DCBB78` | The signal. One bar, one rule, nothing else. |
| Blue | `#8FB0E3` | A 14% glow behind the mark. Never a fill. |

**The discipline that matters: gold appears once.** It is the early sign. If it
starts marking buttons and links it stops meaning anything, and the icon loses
the thing that makes it legible at 40 pixels.

## Type

**Fraunces** for the wordmark and display text — already a dependency
(`@fontsource-variable/fraunces`), high-contrast, slightly literary, and it
keeps the product from reading as a clinical dashboard. System sans for body
copy and UI.

## Assets

| File | Size | Notes |
|---|---|---|
| `brand/icon.svg` | vector | The master. Redraw from here. |
| `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png` | 1024² | RGB, **no alpha** — Apple rejects transparency |
| `public/pwa-192.png`, `pwa-512.png` | 192², 512² | Opaque |
| `public/pwa-512-maskable.png` | 512² | 14% padding, so a circular crop keeps the bars |
| `public/apple-touch-icon.png` | 180² | Opaque; iOS renders alpha as black |
| `public/favicon.svg` | vector | Corner radius baked in — nothing masks a tab icon |
| `public/og-image.png` | 1200×630 | Mark, wordmark, and the line |

Every raster is rendered at 1024 and downscaled with Lanczos rather than drawn
at its final size: Chromium enforces a minimum window and clips anything
smaller, and downsampling from a large master antialiases better anyway.

## Voice

The line is **"The early sign, written down."**

Quiet, concrete, and never promising a diagnosis — which is also a legal
position, not only a stylistic one. The app declines to name conditions by
design, and the writing should never imply otherwise. Describe what it records,
not what it concludes.

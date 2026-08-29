#!/usr/bin/env python3
"""Renders every Bellwether brand asset from one geometry definition.

The mark is a bell curve with a marker on its rising left shoulder — a bell,
a distribution, and the early sign that arrives before the peak, which is the
whole argument of the product. Everything below is derived from that one shape
so the icon, the favicon and the social card cannot drift apart.

Run: python3 brand/build.py
"""
import subprocess, tempfile, os, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"

# Soft Clinical, inherited from src/lib/theme.ts — the icon and the app it opens
# should look like the same object.
INK     = "#141519"   # deep warm ground, the app's dark background
INK_2   = "#1F2128"   # a half-step up, for a gradient with somewhere to go
PAPER   = "#F2EFE8"   # the warm off-white the journal is written on
PAPER_D = "#CFCABF"   # paper in shadow, for the curve's underside
GOLD    = "#DCBB78"   # theme `warn` — the struck bell, the signal
BLUE    = "#8FB0E3"   # theme accent, used sparingly


def mark(size=1024, pad=0.0, ground=True, radius=0.0, bars=7, sigma=1.5):
    """The mark on a `size` square. `pad` is the fraction of the square kept
    empty on every side — 0 for the App Store icon (iOS masks its own corners),
    more for a maskable PWA icon whose corners get cropped to a circle.

    A histogram whose envelope is a bell. One shape carrying the whole product:
    the bell of the name, the distribution the app actually plots, and — in the
    single gold bar on the rising shoulder, well before the peak — the early
    sign a bellwether exists to give. Bar heights are a real gaussian rather
    than a drawn approximation, so the silhouette is the curve.
    """
    import math
    s = size
    inner = s * (1 - 2 * pad)
    o = s * pad
    u = inner / 1024.0
    def X(v): return o + v * u
    def Y(v): return o + v * u

    base_y, peak_y = 734, 214
    span = base_y - peak_y
    bw, gap = 96, 24                       # bar width and gutter, in mark units
    pitch = bw + gap
    total = bars * bw + (bars - 1) * gap
    x0 = 512 - total / 2

    # The one bar that is not paper-coloured: two steps left of centre, high
    # enough to carry weight, low enough to still be visibly on the way up.
    signal = bars // 2 - 2

    rects = []
    for i in range(bars):
        k = i - bars // 2
        h = max(math.exp(-(k * k) / (2 * sigma * sigma)) * span, 84)
        x, y = x0 + i * pitch, base_y - h
        r = bw / 2                          # a dome, not a chamfer
        fill = GOLD if i == signal else "url(#c)"
        rects.append(
            f'<path d="M {X(x)},{Y(base_y)} L {X(x)},{Y(y + r)} '
            f'Q {X(x)},{Y(y)} {X(x + r)},{Y(y)} L {X(x + bw - r)},{Y(y)} '
            f'Q {X(x + bw)},{Y(y)} {X(x + bw)},{Y(y + r)} '
            f'L {X(x + bw)},{Y(base_y)} Z" fill="{fill}"/>')

    rx = f'rx="{radius * s}"' if radius else ""
    bg = f'<rect width="{s}" height="{s}" {rx} fill="url(#g)"/>' if ground else ""

    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{s}" height="{s}" viewBox="0 0 {s} {s}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="{INK_2}"/>
      <stop offset="1" stop-color="{INK}"/>
    </linearGradient>
    <linearGradient id="c" x1="0" y1="{Y(peak_y)}" x2="0" y2="{Y(base_y)}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="{PAPER}"/>
      <stop offset="1" stop-color="{PAPER_D}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.55">
      <stop offset="0" stop-color="{BLUE}" stop-opacity="0.14"/>
      <stop offset="1" stop-color="{BLUE}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  {bg}
  <rect width="{s}" height="{s}" {rx} fill="url(#glow)"/>
  {"".join(rects)}
  <rect x="{X(x0 - 26)}" y="{Y(base_y)}" width="{(total + 52) * u}" height="{11 * u}"
        rx="{5.5 * u}" fill="{PAPER}" opacity="0.24"/>
</svg>'''


def render(svg, w, h, opaque_bg=None):
    """SVG -> PIL image via headless Chromium.

    Always rasterised large and downscaled by the caller rather than rendered
    at the target size: Chromium enforces a minimum window and clips anything
    smaller, and Lanczos from a 1024px master beats a native small render for
    antialiasing anyway."""
    import tempfile
    from PIL import Image
    with tempfile.TemporaryDirectory() as d:
        html = Path(d) / "i.html"
        html.write_text(
            f'<html><body style="margin:0;background:transparent">{svg}</body></html>')
        shot = Path(d) / "o.png"
        subprocess.run([
            CHROME, "--headless", "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
            "--default-background-color=00000000",
            f"--screenshot={shot}", f"--window-size={w},{h}", f"file://{html}",
        ], check=True, capture_output=True)
        im = Image.open(shot).convert("RGBA").crop((0, 0, w, h))
    if opaque_bg:
        flat = Image.new("RGB", im.size, opaque_bg)
        flat.paste(im, mask=im.split()[3])
        im = flat
    return im


def icon(target, pad=0.0, opaque_bg=INK, master=1024):
    """One square icon at `target` px, rasterised at `master` and downscaled."""
    from PIL import Image
    im = render(mark(master, pad=pad), master, master, opaque_bg=opaque_bg)
    return im if target == master else im.resize((target, target), Image.LANCZOS)


def wordmark_card(w=1200, h=630):
    """The social card. Uses Fraunces from node_modules so the wordmark is set
    in the same face the app uses, rather than in whatever the renderer had."""
    font = (ROOT / "node_modules/@fontsource-variable/fraunces/files/"
                   "fraunces-latin-wght-normal.woff2")
    face = (f"@font-face{{font-family:'Fraunces';src:url('file://{font}') format('woff2');"
            f"font-weight:100 900;}}") if font.exists() else ""
    m = mark(300, ground=True, radius=0.2237)
    return f'''<html><head><meta charset="utf-8"><style>
{face}
html,body{{margin:0;padding:0}}
body{{width:{w}px;height:{h}px;background:linear-gradient(160deg,{INK_2},{INK} 62%);
  display:flex;align-items:center;gap:64px;padding:0 96px;box-sizing:border-box;
  font-family:'Fraunces',ui-serif,Georgia,serif;color:{PAPER}}}
.mk{{flex:0 0 auto;filter:drop-shadow(0 24px 48px rgba(0,0,0,.45))}}
h1{{font-size:104px;line-height:1;margin:0 0 18px;font-weight:600;letter-spacing:-.02em}}
p{{font-size:33px;line-height:1.45;margin:0;color:#B9BCC4;
  font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;max-width:19ch}}
.rule{{width:84px;height:7px;border-radius:4px;background:{GOLD};margin:26px 0 0}}
</style></head><body><div class="mk">{m}</div><div>
<h1>Bellwether</h1>
<p>A private symptom journal. The early sign, written down.</p>
<div class="rule"></div>
</div></body></html>'''


if __name__ == "__main__":
    from PIL import Image
    out = []

    # Master SVG, kept in the repo so the mark can be redrawn or handed to a
    # designer without running anything.
    (ROOT / "brand/icon.svg").write_text(mark(1024))
    icon(1024).save(ROOT / "brand/preview-1024.png"); out.append("brand/preview-1024.png")

    # iOS marketing icon: exactly 1024, RGB, no alpha — Apple rejects any of
    # those three being wrong, and check-store-ready.mjs re-checks it.
    ios = ROOT / "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"
    icon(1024, opaque_bg=INK).convert("RGB").save(ios); out.append(str(ios.relative_to(ROOT)))

    # PWA + Safari. Opaque, because iOS does not composite alpha in a home
    # screen icon and a transparent one comes out black.
    for name, px, pad in [("pwa-192.png", 192, 0.0),
                          ("pwa-512.png", 512, 0.0),
                          ("pwa-512-maskable.png", 512, 0.14),
                          ("apple-touch-icon.png", 180, 0.0)]:
        f = ROOT / "public" / name
        icon(px, pad=pad, opaque_bg=INK).convert("RGB").save(f)
        out.append(f"public/{name}")

    # Favicon: the SVG itself, with the corner radius baked in since nothing
    # masks it for us in a browser tab.
    (ROOT / "public/favicon.svg").write_text(mark(64, radius=0.2237))
    out.append("public/favicon.svg")

    og = render(wordmark_card(), 1200, 630, opaque_bg=INK).convert("RGB")
    og.save(ROOT / "public/og-image.png"); out.append("public/og-image.png")

    for f in out:
        pth = ROOT / f
        print(f"  {f:52s} {pth.stat().st_size:>8,} bytes")

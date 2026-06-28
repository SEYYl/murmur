#!/usr/bin/env python3
"""Generate Murmur favicon in multiple sizes."""
import os, math
from PIL import Image, ImageDraw, ImageFont

OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend")
SIZES = [16, 32, 48, 64, 96, 128, 180, 192, 512]

# Brand gradient colors
C1 = (167, 139, 250)  # purple #a78bfa
C2 = (244, 114, 182)  # pink    #f472b6


def lerp_color(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def draw_moon(draw, cx, cy, r, fill):
    """Draw a crescent moon at center (cx,cy) with radius r."""
    # Outer circle
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=fill)
    # Inner circle (offset slightly down-right to create crescent)
    inner_offset = int(r * 0.35)
    inner_r = int(r * 0.85)
    # Clip the inner circle using the same fill as background -> transparent approach
    # Actually, on a transparent bg, we draw the crescent as a filled path
    # Better: draw outer circle, then overlay a slightly smaller offset circle in a masking way
    # Since we can't do boolean ops easily, let's use an arc approach
    pass


def gen_png(size, path):
    """Generate a single PNG favicon at given size."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Background circle with gradient
    # Pillow doesn't do radial gradients natively, so we approximate
    cx = cy = size // 2
    r = size // 2 - max(1, size // 32)

    # Draw gradient circle
    for y in range(size):
        for x in range(size):
            dx, dy = x - cx, y - cy
            dist = math.hypot(dx, dy)
            if dist > r:
                continue
            # Normalized distance from top-left to bottom-right for linear gradient
            t = (x + y) / (size * 2) * 1.0
            t = max(0.0, min(1.0, t))
            col = lerp_color(C1, C2, t)
            # Slight darkening at edge
            edge_t = dist / r
            if edge_t > 0.7:
                factor = 1.0 - (edge_t - 0.7) * 0.6
                col = tuple(int(c * factor) for c in col)
            img.putpixel((x, y), col + (255,))

    # Moon
    moon_r = int(size * 0.32)
    moon_cx = cx - int(size * 0.08)
    moon_cy = cy - int(size * 0.04)

    # Draw outer moon circle
    draw.ellipse(
        [moon_cx - moon_r, moon_cy - moon_r, moon_cx + moon_r, moon_cy + moon_r],
        fill=(255, 255, 255, 230),
    )
    # Draw inner circle to create crescent (offset right-down)
    inner_r = int(moon_r * 0.78)
    inner_ox = moon_cx + int(moon_r * 0.32)
    inner_oy = moon_cy + int(moon_r * 0.15)
    # To get a proper crescent, draw background-colored circle over part of the moon
    # We'll draw the background approximation and blend
    # Simpler: just use white for the crescent, let the inner circle be transparent-ish
    # Actually let's redraw: outer moon in white, then carve out inner with bg color
    # But we can't easily do bg color on transparent. Let me use a different approach:
    # Draw moon + inner carve-out circle
    
    # Actually, simplest: draw the outer moon, then draw a slightly offset
    # circle in the moon's color that overlaps, creating the crescent shape
    # The "inner" offset circle carves out the full moon
    
    # First, let me get the moon color
    moon_col = (255, 255, 255, 240)
    
    # Full moon
    draw.ellipse(
        [moon_cx - moon_r, moon_cy - moon_r, moon_cx + moon_r, moon_cy + moon_r],
        fill=moon_col,
    )
    
    # Carve out inner circle by putting transparent pixels
    carve_r = int(moon_r * 0.78)
    carve_x = moon_cx + int(moon_r * 0.30)
    carve_y = moon_cy + int(moon_r * 0.12)
    
    for y in range(max(0, carve_y - carve_r), min(size, carve_y + carve_r + 1)):
        for x in range(max(0, carve_x - carve_r), min(size, carve_x + carve_r + 1)):
            d = math.hypot(x - carve_x, y - carve_y)
            if d <= carve_r:
                # Check if original pixel was white (moon)
                px = img.getpixel((x, y))
                if px[3] > 0 and px[0] > 200:  # It's in the moon area
                    # Feather edge
                    edge = d / carve_r
                    if edge > 0.85:
                        alpha = int(255 * (edge - 0.85) / 0.15)  # gradient carve
                        bg_col = (0, 0, 0, 0)
                        # Blend carved alpha with background transparent
                        moon_px = img.getpixel((x, y))
                        result_a = max(0, moon_px[3] - alpha)
                        result_a = max(0, result_a)
                        if result_a > 0:
                            # Recompute color as if blending away
                            t = alpha / moon_px[3] if moon_px[3] > 0 else 1
                            r_col = int(moon_px[0] * (1 - t))
                            g_col = int(moon_px[1] * (1 - t))
                            b_col = int(moon_px[2] * (1 - t))
                            img.putpixel((x, y), (max(0, r_col), max(0, g_col), max(0, b_col), result_a))
                        else:
                            img.putpixel((x, y), (0, 0, 0, 0))
                    else:
                        img.putpixel((x, y), (0, 0, 0, 0))

    # Stars / sparkle dots
    stars = [
        (int(size * 0.72), int(size * 0.22), 1),
        (int(size * 0.80), int(size * 0.40), 1),
        (int(size * 0.60), int(size * 0.16), 1),
        (int(size * 0.78), int(size * 0.55), 0),
    ]
    for sx, sy, st in stars:
        sr = max(1, int(size / 48) + st * 1)
        draw.ellipse(
            [sx - sr, sy - sr, sx + sr, sy + sr],
            fill=(255, 255, 255, 180),
        )

    # Sound wave (M murmur whisper) - stylized "m" shape at bottom
    if size >= 48:
        base_y = int(size * 0.78)
        base_x = int(size * 0.5)
        wave_w = int(size * 0.30)
        wave_h = int(size * 0.12)
        
        # Left wave
        lx = base_x - wave_w
        draw.arc(
            [lx, base_y - wave_h, lx + wave_w, base_y + wave_h],
            start=30, end=150, fill=(255, 255, 255, 100), width=max(1, size // 32)
        )
        # Right wave
        rx = base_x
        draw.arc(
            [rx, base_y - wave_h, rx + wave_w, base_y + wave_h],
            start=30, end=150, fill=(255, 255, 255, 100), width=max(1, size // 32)
        )

    img.save(path, "PNG")
    return img


def gen_ico(sizes_list, path):
    """Generate ICO file with multiple sizes."""
    imgs = []
    for s in sorted(set(sizes_list)):
        p = f"/tmp/favicon_{s}.png"
        gen_png(s, p)
        imgs.append(Image.open(p).convert("RGBA"))
    imgs[0].save(
        path,
        format="ICO",
        sizes=[(i.width, i.height) for i in imgs],
        append_images=imgs[1:],
    )
    for s in sorted(set(sizes_list)):
        p = f"/tmp/favicon_{s}.png"
        if os.path.exists(p):
            os.remove(p)


def gen_svg(path):
    """Generate SVG favicon."""
    svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#a78bfa"/>
      <stop offset="1" stop-color="#f472b6"/>
    </linearGradient>
  </defs>
  <!-- Background -->
  <circle cx="32" cy="32" r="32" fill="url(#g)"/>
  <!-- Crescent moon -->
  <path d="M40 16A18 18 0 1 0 50 36A14 14 0 0 1 40 16Z" fill="#fff" opacity=".92"/>
  <!-- Stars -->
  <circle cx="46" cy="14" r="1.5" fill="#fff" opacity=".7"/>
  <circle cx="50" cy="26" r="1" fill="#fff" opacity=".5"/>
  <circle cx="38" cy="12" r="1" fill="#fff" opacity=".6"/>
  <!-- Sound whisper (stylized M for Murmur) -->
  <path d="M22 42 Q28 36 32 42 Q36 36 42 42" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" opacity=".35"/>
  <path d="M26 46 Q30 42 32 46 Q34 42 38 46" stroke="#fff" stroke-width="1.5" fill="none" stroke-linecap="round" opacity=".25"/>
</svg>"""
    with open(path, "w", encoding="utf-8") as f:
        f.write(svg)
    print(f"  SVG → {path}")


if __name__ == "__main__":
    print("🎨 Generating Murmur favicons...")
    
    # SVG
    svg_path = os.path.join(OUT_DIR, "favicon.svg")
    gen_svg(svg_path)
    
    # Multi-size ICO
    ico_path = os.path.join(OUT_DIR, "favicon.ico")
    gen_ico([16, 32, 48, 64], ico_path)
    print(f"  ICO → {ico_path}")
    
    # PNGs for various purposes
    for s in SIZES:
        name = "favicon.png" if s == 32 else f"favicon-{s}x{s}.png"
        p = os.path.join(OUT_DIR, name)
        gen_png(s, p)
        print(f"  PNG {s}x{s} → {p}")
    
    # Apple touch icon (180x180)
    at_path = os.path.join(OUT_DIR, "apple-touch-icon.png")
    gen_png(180, at_path)
    print(f"  Apple Touch → {at_path}")
    
    print("✅ Done!")
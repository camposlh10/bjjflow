"""
BJJ Flow logo: a crimson belt tied in a knot, with the black rank bar and two
white degree stripes on each tail, on the app's near-black background.

Colours are the app palette (mobile/src/theme/theme.ts): background #0D0D10,
primary #E63946, text #F4F4F5.

    python -I make_logo.py            # writes every asset next to the app
"""
import os
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.dirname(HERE)
DESKTOP_PUBLIC = os.path.join(ASSETS, '..', '..', 'desktop', 'public')

BG = (13, 13, 16)
BG_LIFT = (28, 28, 34)
CRIMSON = (230, 57, 70)
CRIMSON_LIGHT = (246, 92, 103)
CRIMSON_DARK = (166, 30, 43)
KNOT = (200, 42, 55)
BAR = (13, 13, 16)
STRIPE = (244, 244, 245)

S = 4  # supersampling factor
BAND_Y = 286      # top of the waist band
PIVOT_Y = 388     # where the tails hang from (under the knot)
N = 1024 * S


def px(v):
    return int(round(v * S))


def vertical_gradient(w, h, top, bottom):
    img = Image.new('RGB', (w, h), top)
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(1, h - 1)
        d.line([(0, y), (w, y)], fill=tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3)))
    return img


def background():
    """Near-black with a soft lift in the middle, so the mark sits in light."""
    img = Image.new('RGB', (N, N), BG)
    glow = Image.new('L', (N, N), 0)
    ImageDraw.Draw(glow).ellipse([px(130), px(110), px(894), px(874)], fill=255)
    glow = glow.filter(ImageFilter.GaussianBlur(px(150)))
    img.paste(Image.new('RGB', (N, N), BG_LIFT), (0, 0), glow)
    return img


def tail(angle):
    """One hanging belt end, drawn upright then rotated about its top centre."""
    w, h = 120, 440
    layer = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    x0, y0 = 512 - w / 2, PIVOT_Y
    body = vertical_gradient(px(w), px(h), CRIMSON, CRIMSON_DARK).convert('RGBA')
    mask = Image.new('L', body.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, px(w) - 1, px(h) - 1], radius=px(22), fill=255)
    layer.paste(body, (px(x0), px(y0)), mask)
    d = ImageDraw.Draw(layer)
    # Rank bar near the tip, with two degree stripes.
    bar_top = y0 + h - 168
    d.rectangle([px(x0), px(bar_top), px(x0 + w), px(bar_top + 112)], fill=BAR)
    for sx in (x0 + 30, x0 + 70):
        d.rectangle([px(sx), px(bar_top), px(sx + 20), px(bar_top + 112)], fill=STRIPE)
    # Re-apply the rounded outline so the bar doesn't square off the corners.
    clip = Image.new('L', (N, N), 0)
    ImageDraw.Draw(clip).rounded_rectangle([px(x0), px(y0), px(x0 + w), px(y0 + h)], radius=px(22), fill=255)
    layer.putalpha(Image.composite(layer.getchannel('A'), Image.new('L', (N, N), 0), clip))
    # A crimson edge keeps the black rank bar inside the belt on a dark background.
    ImageDraw.Draw(layer).rounded_rectangle([px(x0), px(y0), px(x0 + w), px(y0 + h)], radius=px(22),
                                            outline=CRIMSON, width=px(7))
    return layer.rotate(angle, resample=Image.BICUBIC, center=(px(512), px(PIVOT_Y)))


def band(full_width):
    """The part of the belt around the waist."""
    layer = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    x0, x1 = (-20, 1044) if full_width else (150, 874)
    y0, h = BAND_Y, 124
    body = vertical_gradient(px(x1 - x0), px(h), CRIMSON_LIGHT, CRIMSON_DARK).convert('RGBA')
    mask = Image.new('L', body.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, body.size[0] - 1, body.size[1] - 1],
                                           radius=0 if full_width else px(30), fill=255)
    layer.paste(body, (px(x0), px(y0)), mask)
    # A thin stitch line along the belt.
    d = ImageDraw.Draw(layer)
    for y in (y0 + 22, y0 + h - 22):
        x = x0 + (0 if full_width else 24)
        while x < x1 - (0 if full_width else 24):
            d.rectangle([px(x), px(y), px(x + 16), px(y + 3)], fill=CRIMSON_LIGHT + (150,))
            x += 30
    return layer


def knot():
    layer = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    top, bottom = BAND_Y - 26, BAND_Y + 124 + 26
    box = [px(512 - 96), px(top), px(512 + 96), px(bottom)]
    d.rounded_rectangle(box, radius=px(30), fill=KNOT)
    # The belt wrapping over the knot: a band across its middle.
    mid = (top + bottom) / 2
    d.rectangle([px(512 - 96), px(mid - 30), px(512 + 96), px(mid + 30)], fill=CRIMSON)
    d.line([(px(512 - 96), px(mid - 30)), (px(512 + 96), px(mid - 30))], fill=CRIMSON_LIGHT, width=px(4))
    d.line([(px(512 - 96), px(mid + 30)), (px(512 + 96), px(mid + 30))], fill=CRIMSON_DARK, width=px(4))
    d.rounded_rectangle(box, radius=px(30), outline=CRIMSON_LIGHT, width=px(6))
    return layer


def shadow(layer, blur=26, offset=14, strength=150):
    a = layer.getchannel('A').filter(ImageFilter.GaussianBlur(px(blur)))
    a = a.point(lambda v: v * strength // 255)
    out = Image.new('RGBA', layer.size, (0, 0, 0, 0))
    out.putalpha(a)
    return out.transform(layer.size, Image.AFFINE, (1, 0, 0, 0, 1, -px(offset)))


def mark(full_width=True):
    """The belt on a transparent canvas."""
    tails = Image.alpha_composite(tail(21), tail(-21))
    belt = Image.alpha_composite(band(full_width), knot())
    canvas = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    canvas = Image.alpha_composite(canvas, shadow(tails))
    canvas = Image.alpha_composite(canvas, tails)
    canvas = Image.alpha_composite(canvas, shadow(belt, blur=20, offset=10, strength=170))
    canvas = Image.alpha_composite(canvas, belt)
    return canvas


def shrink(img, size):
    return img.resize((size, size), Image.LANCZOS)


def fit(m, scale):
    """Centre the mark at `scale` of the canvas (for safe zones)."""
    small = m.resize((int(N * scale), int(N * scale)), Image.LANCZOS)
    out = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    o = (N - small.size[0]) // 2
    out.paste(small, (o, o), small)
    return out


def main():
    full = mark(full_width=True)
    contained = mark(full_width=False)

    icon = background().convert('RGBA')
    icon = Image.alpha_composite(icon, full)
    shrink(icon, 1024).convert('RGB').save(os.path.join(ASSETS, 'icon.png'))            # iOS: no alpha
    shrink(icon, 48).convert('RGB').save(os.path.join(ASSETS, 'favicon.png'))

    # Splash: the contained mark on transparent; the splash background is #0D0D10.
    shrink(fit(contained, 0.9), 1024).save(os.path.join(ASSETS, 'splash-icon.png'))

    # Android adaptive icon: mark inside the 66% safe zone, solid background.
    shrink(fit(contained, 0.66), 1024).save(os.path.join(ASSETS, 'android-icon-foreground.png'))
    Image.new('RGB', (1024, 1024), BG).save(os.path.join(ASSETS, 'android-icon-background.png'))
    mono = fit(contained, 0.66)
    white = Image.new('RGBA', mono.size, (255, 255, 255, 255))
    white.putalpha(mono.getchannel('A'))
    shrink(white, 1024).save(os.path.join(ASSETS, 'android-icon-monochrome.png'))

    # Brand files: the icon, and the mark alone for light/dark surfaces.
    shrink(icon, 512).convert('RGB').save(os.path.join(HERE, 'bjjflow-icon-512.png'))
    shrink(fit(contained, 0.92), 512).save(os.path.join(HERE, 'bjjflow-mark-512.png'))

    # CRM (desktop): favicon and a small logo for the sidebar/login.
    os.makedirs(DESKTOP_PUBLIC, exist_ok=True)
    shrink(icon, 64).convert('RGB').save(os.path.join(DESKTOP_PUBLIC, 'favicon.png'))
    shrink(icon, 256).convert('RGB').save(os.path.join(DESKTOP_PUBLIC, 'logo.png'))
    shrink(icon, 180).convert('RGB').save(os.path.join(DESKTOP_PUBLIC, 'apple-touch-icon.png'))
    print('ok')


if __name__ == '__main__':
    main()

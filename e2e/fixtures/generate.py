"""Generate deterministic image fixtures; requires Pillow, never network access.

Orientation files have DIFFERENT raw pixels/dimensions but must all display the
same upright 320 x 240 quadrants after applying their EXIF orientation tag.
Run: python e2e/fixtures/generate.py
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageOps

ROOT = Path(__file__).resolve().parent
upright = Image.new("RGB", (320, 240))
draw = ImageDraw.Draw(upright)
draw.rectangle((0, 0, 159, 119), fill=(230, 30, 40))
draw.rectangle((160, 0, 319, 119), fill=(20, 180, 60))
draw.rectangle((0, 120, 159, 239), fill=(30, 60, 220))
draw.rectangle((160, 120, 319, 239), fill=(230, 190, 30))

inverse = {
    2: Image.Transpose.FLIP_LEFT_RIGHT,
    3: Image.Transpose.ROTATE_180,
    4: Image.Transpose.FLIP_TOP_BOTTOM,
    5: Image.Transpose.TRANSPOSE,
    6: Image.Transpose.ROTATE_90,
    7: Image.Transpose.TRANSVERSE,
    8: Image.Transpose.ROTATE_270,
}
for orientation in range(1, 9):
    raw = upright.copy() if orientation == 1 else upright.transpose(inverse[orientation])
    exif = Image.Exif()
    exif[274] = orientation
    destination = ROOT / f"orientation-{orientation}.jpg"
    raw.save(destination, quality=98, subsampling=0, exif=exif)
    with Image.open(destination) as saved:
        normalized = ImageOps.exif_transpose(saved)
        assert normalized.size == upright.size
        for position in [(80, 60), (240, 60), (80, 180), (240, 180)]:
            assert max(abs(a - b) for a, b in zip(normalized.getpixel(position), upright.getpixel(position))) <= 3

frames = [Image.new("RGBA", (32, 24), color) for color in ["red", "blue"]]
frames[0].save(ROOT / "animated.png", save_all=True, append_images=frames[1:], duration=120, loop=0)
frames[0].save(ROOT / "animated.webp", save_all=True, append_images=frames[1:], duration=120, loop=0, lossless=True)
(ROOT / "corrupt.jpg").write_bytes(bytes([0xFF, 0xD8, 0xFF, 0xE0]) + b"truncated jpeg fixture")
print("Generated 8 EXIF fixtures, animated PNG/WebP and one corrupt JPEG.")

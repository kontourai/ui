#!/usr/bin/env python3
"""Outline the "Kontour" wordmark from the vendored Fraunces face.

Prints the wordmark's width and SVG path data as JSON. The result is committed
in react/src/brand-mark-paths.ts and icons/kontour-wordmark.svg, so this script
is provenance, not a build step: nothing in `npm run verify` runs it. Re-run it
only for an explicit identity change, then paste the output into
brand-mark-paths.ts and run `node scripts/check-marks.mjs --write` to rewrite
the SVG files from it.

Needs fonttools, brotli and uharfbuzz (`pip install fonttools brotli uharfbuzz`).

Fraunces is under the SIL Open Font License 1.1 (tokens/fonts/OFL-Fraunces.txt).
Clause 5 exempts "any document created using the Font Software" from the
license, and the family declares no Reserved Font Name, so outlines of one word
may ship as artwork without the font or its license terms.
"""
import json
import pathlib
import sys
from io import BytesIO

import uharfbuzz as hb
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
TEXT = "Kontour"
# The display cut: Fraunces' largest optical size at semibold.
LOCATION = {"wght": 600, "opsz": 144}
# The wordmark shares the symbols' 24-unit-high frame: caps run from y=4.5 to
# the baseline at y=19.5.
CAP_TOP, BASELINE = 4.5, 19.5

font = instantiateVariableFont(TTFont(ROOT / "tokens/fonts/fraunces-latin.woff2"), LOCATION)
font.flavor = None
buffer = BytesIO()
font.save(buffer)

hb_font = hb.Font(hb.Face(buffer.getvalue()))
buf = hb.Buffer()
buf.add_str(TEXT)
buf.guess_segment_properties()
hb.shape(hb_font, buf, {"kern": True, "liga": True})

glyphs = font.getGlyphSet()
order = font.getGlyphOrder()
scale = (BASELINE - CAP_TOP) / font["OS/2"].sCapHeight


def fmt(value):
    return f"{value:.2f}".rstrip("0").rstrip(".")


pen = SVGPathPen(glyphs, ntos=fmt)
# Start at the first glyph's left side bearing so the ink begins at x=0.
x = -font["hmtx"][order[buf.glyph_infos[0].codepoint]][1]
ink_right = 0
for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
    name = order[info.codepoint]
    glyphs[name].draw(TransformPen(pen, (scale, 0, 0, -scale, (x + pos.x_offset) * scale, BASELINE - pos.y_offset * scale)))
    advance, lsb = font["hmtx"][name]
    glyf = font["glyf"][name]
    ink_right = max(ink_right, x + pos.x_offset + lsb + (glyf.xMax - glyf.xMin))
    x += pos.x_advance

json.dump({"text": TEXT, "location": LOCATION, "width": round(ink_right * scale + 0.005, 2), "d": pen.getCommands()}, sys.stdout)
sys.stdout.write("\n")

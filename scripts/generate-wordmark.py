#!/usr/bin/env python3
"""Outline the "Kontour" wordmark from the vendored Fraunces face.

    python3 scripts/generate-wordmark.py           # print width and path data as JSON
    python3 scripts/generate-wordmark.py --check   # compare with the committed path data

The result is committed in react/src/brand-mark-paths.ts, and
icons/kontour-wordmark.svg is generated from that module, so this script is
provenance, not a build step: `npm run verify` does not need Python. Where
fontTools is installed, tests/unit/wordmark-provenance.test.mjs runs --check, so
the committed outline cannot drift from the font unnoticed; where it is not,
that test is skipped and says so.

Re-run without --check only for an explicit identity change, then paste the
output into brand-mark-paths.ts and run `node scripts/check-marks.mjs --write`.

Needs fontTools and brotli (`pip install fonttools brotli`). The committed
outline was first produced with fontTools 4.66.1, brotli 1.2.0 and uharfbuzz
0.56.2 (for kerning) on Python 3.12. Kerning is now read from the font's GPOS
table here instead, which needs no shaping engine and reproduces that outline
byte for byte with fontTools 4.63.0 and 4.66.1.

Fraunces is under the SIL Open Font License 1.1 (tokens/fonts/OFL-Fraunces.txt).
Clause 5 exempts "any document created using the Font Software" from the
license, and the family declares no Reserved Font Name, so outlines of one word
may ship as artwork without the font or its license terms.
"""
import json
import pathlib
import re
import sys

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
cmap = font.getBestCmap()
names = [cmap[ord(char)] for char in TEXT]


def pair_kerning(left, right):
    """The `kern` feature's advance adjustment for one glyph pair, in font units.

    Reads GPOS pair positioning directly: the first lookup with a subtable that
    covers the pair applies, as in a shaping engine. The wordmark is plain
    left-to-right Latin with no ligatures or contextual forms, so this is the
    only shaping it needs.
    """
    gpos = font["GPOS"].table
    lookups = sorted({index for record in gpos.FeatureList.FeatureRecord if record.FeatureTag == "kern" for index in record.Feature.LookupListIndex})
    for index in lookups:
        for subtable in gpos.LookupList.Lookup[index].SubTable:
            if subtable.LookupType == 9:
                subtable = subtable.ExtSubTable
            if subtable.LookupType != 2 or left not in subtable.Coverage.glyphs:
                continue
            value = None
            if subtable.Format == 1:
                pairs = subtable.PairSet[subtable.Coverage.glyphs.index(left)].PairValueRecord
                value = next((pair.Value1 for pair in pairs if pair.SecondGlyph == right), None)
                if value is None:
                    continue
            else:
                first = subtable.ClassDef1.classDefs.get(left, 0)
                second = subtable.ClassDef2.classDefs.get(right, 0)
                value = subtable.Class1Record[first].Class2Record[second].Value1
            return (value.XAdvance or 0) if value is not None else 0
    return 0


glyphs = font.getGlyphSet()
scale = (BASELINE - CAP_TOP) / font["OS/2"].sCapHeight


def fmt(value):
    return f"{value:.2f}".rstrip("0").rstrip(".")


pen = SVGPathPen(glyphs, ntos=fmt)
# Start at the first glyph's left side bearing so the ink begins at x=0.
x = -font["hmtx"][names[0]][1]
ink_right = 0
for position, name in enumerate(names):
    glyphs[name].draw(TransformPen(pen, (scale, 0, 0, -scale, x * scale, BASELINE)))
    advance, lsb = font["hmtx"][name]
    glyf = font["glyf"][name]
    ink_right = max(ink_right, x + lsb + (glyf.xMax - glyf.xMin))
    x += advance + (pair_kerning(name, names[position + 1]) if position + 1 < len(names) else 0)

result = {"text": TEXT, "location": LOCATION, "width": round(ink_right * scale + 0.005, 2), "d": pen.getCommands()}

if "--check" in sys.argv:
    source = (ROOT / "react/src/brand-mark-paths.ts").read_text()
    committed_d = re.search(r"""const WORDMARK =\s*'<g fill="currentColor"><path d="([^"]+)"/></g>';""", source)
    committed_width = re.search(r"const WORDMARK_WIDTH = ([\d.]+);", source)
    committed_text = re.search(r'const WORDMARK_TEXT = "([^"]+)";', source)
    if not (committed_d and committed_width and committed_text):
        sys.exit("generate-wordmark: could not find WORDMARK, WORDMARK_WIDTH and WORDMARK_TEXT in react/src/brand-mark-paths.ts.")
    problems = []
    if committed_text.group(1) != TEXT:
        problems.append(f'WORDMARK_TEXT is "{committed_text.group(1)}"; this script outlines "{TEXT}".')
    if float(committed_width.group(1)) != result["width"]:
        problems.append(f"WORDMARK_WIDTH is {committed_width.group(1)}; the font gives {result['width']}.")
    if committed_d.group(1) != result["d"]:
        problems.append("WORDMARK path data differs from the outline of the vendored Fraunces face.")
    if problems:
        sys.exit("generate-wordmark --check failed:\n  " + "\n  ".join(problems))
    print(f'Wordmark provenance check passed: "{TEXT}" at {LOCATION} matches the committed outline ({len(result["d"])} characters, width {result["width"]}).')
else:
    json.dump(result, sys.stdout)
    sys.stdout.write("\n")

/**
 * Vendors the brand font faces referenced by `tokens/tokens.css` into `tokens/fonts/`
 * and regenerates `tokens/fonts.css` with self-hosted `@font-face` rules.
 *
 * Run manually when a family, weight, or upstream release needs refreshing:
 *   node scripts/vendor-fonts.mjs
 *
 * Requires network access. Not part of `npm run verify` — the committed output is
 * the contract, and `check:tokens` / `check:pack` guard it.
 */
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "tokens", "fonts");

// Google Fonts only serves woff2 to browsers that advertise support.
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * Fraunces and Hanken Grotesk are variable fonts. Google serves the *same* file for
 * every weight of a variable family, so requesting the individual weights the tokens
 * use would ship the identical payload four or five times over. One variable file per
 * unicode subset is both smaller and covers every weight.
 */
const googleFamilies = [
  {
    id: "fraunces",
    family: "Fraunces",
    slug: "fraunces",
    // opsz stays variable so optical sizing keeps working at display sizes.
    query: "Fraunces:opsz,wght@9..144,100..900",
    licenseFile: "OFL-Fraunces.txt",
    licenseUrl: "https://raw.githubusercontent.com/google/fonts/main/ofl/fraunces/OFL.txt",
  },
  {
    id: "hanken-grotesk",
    family: "Hanken Grotesk",
    slug: "hanken-grotesk",
    query: "Hanken+Grotesk:wght@100..900",
    licenseFile: "OFL-HankenGrotesk.txt",
    licenseUrl: "https://raw.githubusercontent.com/google/fonts/main/ofl/hankengrotesk/OFL.txt",
  },
];

const googleSubsets = ["latin", "latin-ext"];

/**
 * IBM Plex carries the Reserved Font Name "Plex", and OFL clause 5 restricts that name
 * on modified versions. Subsetting is a modification, so the mono faces come from IBM's
 * own published woff2 artefacts rather than a re-subset copy.
 */
const ibmPlexMono = {
  package: "@ibm/plex-mono",
  version: "2.5.0",
  slug: "ibm-plex-mono",
  family: "IBM Plex Mono",
  licenseFile: "OFL-IBMPlexMono.txt",
  // Weights the tokens layer and react/styles.css actually ask for.
  weights: [
    { weight: 400, style: "Regular" },
    { weight: 500, style: "Medium" },
    { weight: 600, style: "SemiBold" },
  ],
  // Latin1 + Latin2 matches the latin / latin-ext coverage vendored for the other families.
  subsets: ["Latin1", "Latin2"],
};

const faces = [];

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

for (const family of googleFamilies) {
  const css = await fetchText(`https://fonts.googleapis.com/css2?family=${family.query}&display=swap`, {
    "user-agent": BROWSER_UA,
  });

  for (const block of parseGoogleCss(css)) {
    if (!googleSubsets.includes(block.subset)) continue;
    const file = `${family.slug}-${block.subset}.woff2`;
    await writeFile(path.join(outDir, file), await fetchBinary(block.url, { "user-agent": BROWSER_UA }));
    faces.push({
      family: family.family,
      file,
      weight: block.weight,
      unicodeRange: block.unicodeRange,
      comment: `${family.family} · ${block.subset}`,
    });
  }

  await writeFile(path.join(outDir, family.licenseFile), await fetchText(family.licenseUrl));
}

const plexDir = await extractNpmPackage(ibmPlexMono.package, ibmPlexMono.version);
try {
  const splitDir = path.join(plexDir, "package", "fonts", "split", "woff2");
  for (const { weight, style } of ibmPlexMono.weights) {
    const styleCss = await readFile(path.join(splitDir, `IBMPlexMono-${style}.css`), "utf8");
    const ranges = parseIbmCss(styleCss);
    for (const subset of ibmPlexMono.subsets) {
      const source = `IBMPlexMono-${style}-${subset}.woff2`;
      const file = `${ibmPlexMono.slug}-${weight}-${subset.toLowerCase()}.woff2`;
      await writeFile(path.join(outDir, file), await readFile(path.join(splitDir, source)));
      faces.push({
        family: ibmPlexMono.family,
        file,
        weight: String(weight),
        unicodeRange: ranges.get(subset),
        comment: `${ibmPlexMono.family} ${weight} · ${subset}`,
      });
    }
  }
  await writeFile(
    path.join(outDir, ibmPlexMono.licenseFile),
    await readFile(path.join(splitDir, "license.txt"), "utf8"),
  );
} finally {
  await rm(plexDir, { recursive: true, force: true });
}

await writeFile(path.join(root, "tokens", "fonts.css"), renderFontsCss(faces));

const written = (await readdir(outDir)).sort();
console.log(`Vendored ${faces.length} font faces into tokens/fonts/ (${written.length} files).`);

function renderFontsCss(entries) {
  const header = [
    "/*",
    " * Self-hosted brand faces for the --k-font-* tokens.",
    " *",
    " * Generated by scripts/vendor-fonts.mjs — edit that script, not this file.",
    " * No remote requests: a consumer with `default-src 'self'` gets the brand type.",
    " * Licences ship alongside the files in tokens/fonts/.",
    " */",
    "",
    "",
  ].join("\n");

  const blocks = entries.map((entry) =>
    [
      `/* ${entry.comment} */`,
      "@font-face {",
      `  font-family: "${entry.family}";`,
      "  font-style: normal;",
      `  font-weight: ${entry.weight};`,
      "  font-display: swap;",
      `  src: url("./fonts/${entry.file}") format("woff2");`,
      `  unicode-range: ${entry.unicodeRange};`,
      "}",
    ].join("\n"),
  );

  return `${header}${blocks.join("\n\n")}\n`;
}

function parseGoogleCss(css) {
  const blocks = [];
  const pattern = /\/\*\s*([a-z0-9-]+)\s*\*\/\s*@font-face\s*\{([^}]*)\}/g;
  let match;
  while ((match = pattern.exec(css)) !== null) {
    const [, subset, body] = match;
    blocks.push({
      subset,
      weight: required(/font-weight:\s*([^;]+);/, body, "font-weight"),
      url: required(/url\(([^)]+)\)/, body, "src url"),
      unicodeRange: required(/unicode-range:\s*([^;}]+)[;}]?/, body, "unicode-range"),
    });
  }
  if (blocks.length === 0) throw new Error("No @font-face blocks parsed from Google Fonts CSS.");
  return blocks;
}

function parseIbmCss(css) {
  const ranges = new Map();
  const pattern = /\/\*\s*Subset:\s*([A-Za-z0-9]+)\s*\*\/\s*@font-face\s*\{([^}]*)\}/g;
  let match;
  while ((match = pattern.exec(css)) !== null) {
    ranges.set(match[1], required(/unicode-range:\s*([^;}]+)[;}]?/, match[2], "unicode-range"));
  }
  if (ranges.size === 0) throw new Error("No subsets parsed from IBM Plex CSS.");
  return ranges;
}

function required(pattern, source, label) {
  const match = pattern.exec(source);
  if (!match) throw new Error(`Could not read ${label} from font CSS block.`);
  return match[1].trim();
}

async function extractNpmPackage(name, version) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "kontour-ui-fonts-"));
  const { stdout } = await execFileAsync("npm", ["pack", `${name}@${version}`, "--silent", "--pack-destination", dir], {
    cwd: dir,
  });
  const tarball = path.join(dir, stdout.trim().split("\n").pop().trim());
  await execFileAsync("tar", ["xzf", tarball, "-C", dir]);
  return dir;
}

async function fetchText(url, headers = {}) {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`GET ${url} failed: ${response.status}`);
  return response.text();
}

async function fetchBinary(url, headers = {}) {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`GET ${url} failed: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

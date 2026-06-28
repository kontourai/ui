export type SemanticTone = "positive" | "caution" | "negative" | "active" | "neutral";

export interface ToneMatcher {
  tone: SemanticTone;
  pattern: RegExp;
}

export const toneMatchers: ToneMatcher[] = [
  // Family vocabulary (CK4): Veritas readiness + Surface claim words that products
  // previously hard-coded downstream (e.g. station-tones.ts) now resolve here.
  // Existing words keep their tone; this only adds previously-unmatched terms.
  { tone: "negative", pattern: /(failed|blocked|stale|error|rejected|bad|disconnected|disconnect|failing|missing|disputed)/i },
  { tone: "positive", pattern: /(passed|(?<!un)verified|fresh|completed|accepted|resolved|connected|good|success|satisfied)/i },
  { tone: "caution", pattern: /(open|waiting|pending|warn|warning|hold|escalated|advisory|recheckable|unverified|assumed)/i },
  { tone: "active", pattern: /(running|current|active|in-review|connecting|proposed)/i },
];

export function toneForValue(value: string | null | undefined, fallback: SemanticTone = "neutral"): SemanticTone {
  const normalized = String(value ?? "");
  return toneMatchers.find(({ pattern }) => pattern.test(normalized))?.tone ?? fallback;
}

export function toneClass(tone: SemanticTone): `tone-${SemanticTone}` {
  return `tone-${tone}`;
}

export function normalizedClassSuffix(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "unknown";
}

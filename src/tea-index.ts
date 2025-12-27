import { Tea } from "./api_clients/happy-earth.ts";

/* tea-recommender.ts
   Deterministic tea recommender optimized for very short, informal queries (~5 words).

   Features:
   - BM25 (title/description/productType) for lexical matching
   - Vibe translation layer: casual words -> qualities + constraints + query expansions
   - Quality parsing with negation/intensity + OR handling
   - Two-stage ranking: BM25 topK -> quality-aware rerank
   - Explainable results

   Usage:
     const r = createTeaRecommender(TEAS);
     const results = r.recommend("cozy bedtime", { topN: 3 });
*/

export type RecommendOpts = {
  onlyAvailable?: boolean; // default true
  topN?: number; // default 1
  minScore?: number; // default 0.25
  stage1TopK?: number; // default 80
};

export type Recommendation = {
  tea: Tea & { id: string };
  score: number;
  debug: {
    bm25: { title: number; description: number; type: number; total: number };
    qualities: {
      positiveMatched: string[];
      positiveMissed: string[];
      negativeHit: string[];
      negativeRespected: string[];
      orSatisfied: string[];
    };
    constraints: string[];
    reasons: string[];
    expandedQueryTokens: string[];
  };
};

type BuiltTea = Tea & {
  id: string;
  normTitle: string;
  normDesc: string;
  normType: string;

  tfTitle: Map<number, number>;
  tfDesc: Map<number, number>;
  tfType: Map<number, number>;
  lenTitle: number;
  lenDesc: number;
  lenType: number;
};

type BM25Index = {
  termToId: Map<string, number>;
  idToTerm: string[];
  dfTitle: Uint32Array;
  dfDesc: Uint32Array;
  dfType: Uint32Array;
  N: number;
  avgLenTitle: number;
  avgLenDesc: number;
  avgLenType: number;
  k1: number;
  b: number;
};

type BuiltIndex = {
  version: number;
  generatedAt: string;
  teas: BuiltTea[];
  bm25: BM25Index;
  qualityLexicon: Record<string, string[]>;
};

const VERSION = 3;

const DEFAULT_OPTS: Required<RecommendOpts> = {
  onlyAvailable: true,
  topN: 1,
  minScore: 0.25,
  stage1TopK: 80,
};

// ===== Your glossary seeds =====
const QUALITY_SEEDS: Record<string, string[]> = {
  aroma: ["aroma", "fragrance", "nose", "bouquet", "scent"],
  astringent: [
    "astringent",
    "astringency",
    "tannic",
    "tannin",
    "brisk",
    "mouth-drying",
    "drying",
  ],
  body: [
    "body",
    "fullness",
    "weight",
    "mouthfeel",
    "light-bodied",
    "medium-bodied",
    "full-bodied",
  ],
  bright: ["bright", "lively", "crisp", "refreshing"],
  character: ["character", "signature", "distinctive"],
  clean: ["clean", "pure", "clear"],
  finish: ["finish", "aftertaste", "lingering", "long finish"],
  flowery: [
    "flowery",
    "floral",
    "flower",
    "jasmine",
    "rose",
    "orchid",
    "honeysuckle",
    "lavender",
  ],
  full: ["full", "hefty", "round", "robust", "bold", "substantial"],
  malty: ["malty", "malt", "assam"],
  muscatel: ["muscatel", "darjeeling", "grapey", "grape"],
  smooth: ["smooth", "silky", "mellow", "velvety", "round-bodied"],
  soft: ["soft", "lush", "gentle", "delicate", "subtle"],
  thick: ["thick", "viscous", "rich", "syrupy", "creamy"],
  vegetal: [
    "vegetal",
    "grassy",
    "herby",
    "marine",
    "seaweed",
    "umami",
    "savory",
  ],
};

// Gentle complement boosts when the user avoids something.
const QUALITY_COMPLEMENTS: Record<string, string[]> = {
  astringent: ["smooth", "soft"],
  malty: ["bright", "clean"],
};

// ===== Starter list: casual user vocabulary -> our system =====
const VIBE_MAP: Record<
  string,
  {
    want?: string[];
    avoid?: string[];
    softAvoid?: string[];
    typeMust?: string[];
    addTokens?: string[];
  }
> = {
  // Mood / use-case
  cozy: {
    want: ["smooth", "soft", "full"],
    addTokens: ["comforting", "mellow"],
  },
  comforting: {
    want: ["smooth", "soft", "full"],
    addTokens: ["cozy", "mellow"],
  },
  relaxing: {
    want: ["soft", "smooth"],
    typeMust: ["herbal"],
    addTokens: ["calming", "soothing"],
  },
  calming: {
    want: ["soft", "smooth"],
    typeMust: ["herbal"],
    addTokens: ["soothing"],
  },
  soothing: {
    want: ["soft", "smooth"],
    typeMust: ["herbal"],
    addTokens: ["calming"],
  },
  bedtime: {
    want: ["soft", "smooth"],
    typeMust: ["herbal"],
    addTokens: ["caffeine-free"],
  },
  sleepy: {
    want: ["soft", "smooth"],
    typeMust: ["herbal"],
    addTokens: ["caffeine-free"],
  },
  warming: { want: ["full"], addTokens: ["spice", "ginger", "cinnamon"] },
  refreshing: { want: ["bright", "clean"], addTokens: ["crisp", "fresh"] },
  fresh: { want: ["bright", "clean"], addTokens: ["crisp", "refreshing"] },
  uplifting: { want: ["bright"], addTokens: ["lively"] },
  energizing: { typeMust: ["black", "green"], addTokens: ["brisk"] },
  focus: { typeMust: ["green", "matcha"], addTokens: ["bright"] },
  morning: { typeMust: ["black", "green"], addTokens: ["bright"] },

  // Strength / mouthfeel
  light: {
    want: ["bright"],
    softAvoid: ["thick", "full"],
    addTokens: ["delicate"],
  },
  delicate: { want: ["soft"], softAvoid: ["full"], addTokens: ["gentle"] },
  gentle: { want: ["soft", "smooth"], softAvoid: ["astringent"] },
  strong: {
    want: ["full"],
    softAvoid: ["soft"],
    addTokens: ["bold", "robust"],
  },
  bold: { want: ["full"], addTokens: ["robust"] },
  robust: { want: ["full"], addTokens: ["bold"] },
  rich: { want: ["thick", "full"], addTokens: ["creamy", "smooth"] },
  creamy: { want: ["thick", "smooth"], addTokens: ["rich"] },

  // Simple taste
  sweet: { want: ["soft", "smooth"], addTokens: ["honey", "vanilla"] },
  dessert: {
    want: ["smooth", "full"],
    addTokens: ["vanilla", "chocolate", "honey"],
  },
  mellow: { want: ["soft", "smooth"], addTokens: ["round"] },
  smooth: { want: ["smooth"], addTokens: ["silky"] },

  // Bitterness (people say bitter more than “astringent”)
  bitter: { avoid: ["astringent"], addTokens: ["tannic", "brisk"] },

  // Common notes / flavors
  floral: { want: ["flowery"], addTokens: ["jasmine", "rose", "honeysuckle"] },
  flowery: { want: ["flowery"], addTokens: ["floral"] },
  fruity: { addTokens: ["fruit", "berry", "citrus"] },
  citrus: { addTokens: ["lemon", "orange", "bergamot"] },
  lemony: { addTokens: ["lemon", "citrus"] },
  orangey: { addTokens: ["orange", "citrus"] },
  vanilla: { addTokens: ["vanilla", "sweet", "creamy"] },
  honey: { addTokens: ["honey", "sweet"] },
  mint: {
    want: ["clean", "bright"],
    addTokens: ["mint", "peppermint", "spearmint"],
  },
  minty: {
    want: ["clean", "bright"],
    addTokens: ["mint", "peppermint", "spearmint"],
  },
  spicy: {
    want: ["full"],
    addTokens: ["ginger", "cinnamon", "cardamom", "clove"],
  },
  gingery: { want: ["full"], addTokens: ["ginger", "spice"] },
  cinnamon: { want: ["full"], addTokens: ["cinnamon", "spice"] },
  chocolatey: { want: ["full"], addTokens: ["chocolate", "cocoa", "toasty"] },
  nutty: { want: ["full"], addTokens: ["nutty", "toasty", "roasted"] },
  toasty: { want: ["full"], addTokens: ["toasty", "roasted"] },
  smoky: { want: ["full"], addTokens: ["smoky", "smoke"] },
  earthy: { want: ["full"], addTokens: ["earthy", "wood", "mushroom"] },
  grassy: { want: ["vegetal"], addTokens: ["herby", "vegetal"] },
  umami: { want: ["vegetal"], addTokens: ["savory", "marine", "seaweed"] },
  savory: { want: ["vegetal"], addTokens: ["umami", "marine"] },

  // Seasonal nudges
  summer: {
    want: ["bright", "clean"],
    addTokens: ["refreshing", "citrus", "mint"],
  },
  winter: {
    want: ["full"],
    addTokens: ["spice", "ginger", "cinnamon", "cozy"],
  },
};

// ===== Query parsing helpers =====
const NEGATION_WORDS = new Set([
  "no",
  "not",
  "without",
  "avoid",
  "minus",
  "skip",
]);
const SOFT_NEGATION_WORDS = new Set(["low", "less", "lighter"]);

const INTENSIFIERS: Record<string, number> = {
  very: 1.35,
  really: 1.35,
  extremely: 1.5,
  super: 1.45,
  quite: 1.15,
  slightly: 0.75,
  little: 0.8,
  bit: 0.85,
  mildly: 0.85,
};

// Tea type-ish constraints
const TYPE_HINTS = [
  { key: "green", terms: ["green"] },
  { key: "black", terms: ["black"] },
  { key: "oolong", terms: ["oolong"] },
  { key: "white", terms: ["white"] },
  { key: "herbal", terms: ["herbal", "tisane"] },

  // Pu-erh variants users actually type:
  {
    key: "pu-erh",
    terms: ["pu-erh", "puerh", "puer", "pu erh", "pu'er", "pu’er"],
  },

  { key: "matcha", terms: ["matcha"] },
];

function extractTypeMustFromQuery(query: string): Set<string> {
  const q = normalize(query);
  const out = new Set<string>();

  for (const th of TYPE_HINTS) {
    if (th.terms.some((term) => containsPhrase(q, term))) out.add(th.key);
  }

  return out;
}

// BM25 stopwords (keep small—short queries)
const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "but",
  "with",
  "without",
  "not",
  "no",
  "to",
  "for",
  "of",
  "in",
  "on",
  "at",
  "from",
  "i",
  "im",
  "i'm",
  "want",
  "looking",
  "like",
  "something",
  "please",
]);

function normalize(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeQuery(text: string): string[] {
  return normalize(text).replace(/[-_]/g, " ").split(" ").filter(Boolean);
}

function tokenizeBM25(text: string): string[] {
  const t = normalize(text).replace(/[-_]/g, " ");
  return t
    .split(" ")
    .map((w) => w.trim())
    .filter((w) =>
      w.length >= 3 && /^[a-z0-9]+$/i.test(w) && !STOPWORDS.has(w)
    );
}

function containsPhrase(text: string, phrase: string): boolean {
  const t = " " + normalize(text) + " ";
  const p = " " + normalize(phrase) + " ";
  return t.includes(p);
}

function stableIdFromTitle(title: string): string {
  const s = normalize(title);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `tea_${(h >>> 0).toString(16)}`;
}

// ===== Lexicon expansion (small + memory-friendly) =====
// Adds up to a few SINGLE tokens near seed tokens.
function expandQualityLexicon(teas: BuiltTea[]): Record<string, string[]> {
  const dfGlobal = new Map<string, number>();
  for (const tea of teas) {
    const uniq = new Set(
      tokenizeBM25(tea.normTitle + " " + tea.normDesc + " " + tea.normType),
    );
    for (const tok of uniq) dfGlobal.set(tok, (dfGlobal.get(tok) ?? 0) + 1);
  }

  const N = teas.length;
  const MAX_DF = Math.max(6, Math.floor(N * 0.22));
  const MIN_CO = 3;
  const WINDOW = 6;
  const MAX_EXPANSIONS = 8;

  const out: Record<string, string[]> = {};

  for (const [quality, seeds] of Object.entries(QUALITY_SEEDS)) {
    const seedTokens = new Set(seeds.flatMap((s) => tokenizeBM25(s)));
    const co = new Map<string, number>();

    for (const tea of teas) {
      const toks = tokenizeBM25(
        tea.normTitle + " " + tea.normDesc + " " + tea.normType,
      );
      for (let i = 0; i < toks.length; i++) {
        if (!seedTokens.has(toks[i])) continue;
        const start = Math.max(0, i - WINDOW);
        const end = Math.min(toks.length, i + WINDOW + 1);
        for (let k = start; k < end; k++) {
          if (k === i) continue;
          const w = toks[k];
          if (!w || STOPWORDS.has(w) || seedTokens.has(w)) continue;
          const dfg = dfGlobal.get(w) ?? 0;
          if (dfg < 2 || dfg > MAX_DF) continue;
          co.set(w, (co.get(w) ?? 0) + 1);
        }
      }
    }

    const expansions = Array.from(co.entries())
      .filter(([, c]) => c >= MIN_CO)
      .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))
      .map(([w]) => w)
      .slice(0, MAX_EXPANSIONS);

    out[quality] = Array.from(new Set([...seeds, ...expansions]));
  }

  return out;
}

// ===== BM25 building =====
function buildBM25Index(teas: BuiltTea[]): BM25Index {
  const termToId = new Map<string, number>();
  const idToTerm: string[] = [];

  const addTerm = (t: string) => {
    if (!termToId.has(t)) {
      termToId.set(t, idToTerm.length);
      idToTerm.push(t);
    }
    return termToId.get(t)!;
  };

  // Vocab from all fields
  for (const tea of teas) {
    for (const tok of tokenizeBM25(tea.normTitle)) addTerm(tok);
    for (const tok of tokenizeBM25(tea.normDesc)) addTerm(tok);
    for (const tok of tokenizeBM25(tea.normType)) addTerm(tok);
  }

  const V = idToTerm.length;
  const dfTitle = new Uint32Array(V);
  const dfDesc = new Uint32Array(V);
  const dfType = new Uint32Array(V);

  let totalLenTitle = 0;
  let totalLenDesc = 0;
  let totalLenType = 0;

  for (const tea of teas) {
    const titleToks = tokenizeBM25(tea.normTitle);
    const descToks = tokenizeBM25(tea.normDesc);
    const typeToks = tokenizeBM25(tea.normType);

    tea.tfTitle = new Map();
    tea.tfDesc = new Map();
    tea.tfType = new Map();

    for (const tok of titleToks) {
      const id = termToId.get(tok)!;
      tea.tfTitle.set(id, (tea.tfTitle.get(id) ?? 0) + 1);
    }
    for (const tok of descToks) {
      const id = termToId.get(tok)!;
      tea.tfDesc.set(id, (tea.tfDesc.get(id) ?? 0) + 1);
    }
    for (const tok of typeToks) {
      const id = termToId.get(tok)!;
      tea.tfType.set(id, (tea.tfType.get(id) ?? 0) + 1);
    }

    tea.lenTitle = titleToks.length;
    tea.lenDesc = descToks.length;
    tea.lenType = typeToks.length;

    totalLenTitle += tea.lenTitle;
    totalLenDesc += tea.lenDesc;
    totalLenType += tea.lenType;

    for (const id of new Set(titleToks.map((t) => termToId.get(t)!))) {
      dfTitle[id] += 1;
    }
    for (const id of new Set(descToks.map((t) => termToId.get(t)!))) {
      dfDesc[id] += 1;
    }
    for (const id of new Set(typeToks.map((t) => termToId.get(t)!))) {
      dfType[id] += 1;
    }
  }

  const N = teas.length;
  return {
    termToId,
    idToTerm,
    dfTitle,
    dfDesc,
    dfType,
    N,
    avgLenTitle: totalLenTitle / Math.max(N, 1),
    avgLenDesc: totalLenDesc / Math.max(N, 1),
    avgLenType: totalLenType / Math.max(N, 1),
    k1: 1.2,
    b: 0.75,
  };
}

function bm25ScoreField(
  qTermIds: number[],
  tf: Map<number, number>,
  df: Uint32Array,
  docLen: number,
  avgLen: number,
  N: number,
  k1: number,
  b: number,
): number {
  if (qTermIds.length === 0) return 0;

  let score = 0;
  const denomNorm = (1 - b) + b * (docLen / Math.max(avgLen, 1e-6));

  for (const termId of qTermIds) {
    const f = tf.get(termId) ?? 0;
    if (f <= 0) continue;

    const dfi = df[termId] || 0;
    const idf = Math.log(1 + (N - dfi + 0.5) / (dfi + 0.5));

    const numer = f * (k1 + 1);
    const denom = f + k1 * denomNorm;
    score += idf * (numer / denom);
  }

  return score;
}

// ===== Intent parsing =====
type QualityIntent = {
  must: Map<string, number>;
  orGroups: Array<Map<string, number>>;
  avoid: Set<string>;
  softAvoid: Set<string>;
  typeMust: Set<string>;
};

function extractIntent(
  query: string,
  lexicon: Record<string, string[]>,
): QualityIntent {
  const q = normalize(query);
  const parts = q.split(/\s+or\s+/g).map((p) => p.trim()).filter(Boolean);

  const parseClause = (clause: string) => {
    const clauseTokens = clause.split(" ").filter(Boolean);
    const foundMust = new Map<string, number>();
    const foundAvoid = new Set<string>();
    const foundSoftAvoid = new Set<string>();

    const typeMust = new Set<string>();
    for (const th of TYPE_HINTS) {
      if (th.terms.some((t) => containsPhrase(clause, t))) typeMust.add(th.key);
    }

    for (const [quality, phrases] of Object.entries(lexicon)) {
      let matchPhrase: string | null = null;
      for (const phrase of phrases) {
        if (containsPhrase(clause, phrase)) {
          matchPhrase = phrase;
          break;
        }
      }
      if (!matchPhrase) continue;

      const phraseTokens = tokenizeBM25(matchPhrase);
      const first = phraseTokens[0];
      const idx = first ? clauseTokens.indexOf(first) : -1;

      const beforeWindow = idx >= 0
        ? clauseTokens.slice(Math.max(0, idx - 3), idx)
        : clauseTokens.slice(-3);
      const hardNeg = beforeWindow.some((w) => NEGATION_WORDS.has(w));
      const softNeg = beforeWindow.some((w) => SOFT_NEGATION_WORDS.has(w));
      const notToo = clause.includes("not too") &&
        (idx >= 0 ? clause.indexOf("not too") < clause.indexOf(first) : false);

      let mult = 1.0;
      const last2 = beforeWindow.slice(-2);
      for (const w of last2) {
        if (INTENSIFIERS[w] != null) mult *= INTENSIFIERS[w];
      }

      if (hardNeg || notToo) foundAvoid.add(quality);
      else if (softNeg) foundSoftAvoid.add(quality);
      else foundMust.set(quality, mult);
    }

    return { foundMust, foundAvoid, foundSoftAvoid, typeMust };
  };

  if (parts.length <= 1) {
    const c = parseClause(q);
    return {
      must: c.foundMust,
      orGroups: [],
      avoid: c.foundAvoid,
      softAvoid: c.foundSoftAvoid,
      typeMust: c.typeMust,
    };
  }

  const orGroups: Array<Map<string, number>> = [];
  const avoid = new Set<string>();
  const softAvoid = new Set<string>();
  const typeMust = new Set<string>();

  for (const part of parts) {
    const c = parseClause(part);
    for (const a of c.foundAvoid) avoid.add(a);
    for (const a of c.foundSoftAvoid) softAvoid.add(a);
    for (const tm of c.typeMust) typeMust.add(tm);
    if (c.foundMust.size > 0) orGroups.push(c.foundMust);
  }

  const must = new Map<string, number>();
  if (orGroups.length > 1) {
    const allKeys = new Set<string>();
    for (const g of orGroups) for (const k of g.keys()) allKeys.add(k);
    for (const k of allKeys) {
      let inAll = true;
      let mult = 1.0;
      for (const g of orGroups) {
        if (!g.has(k)) {
          inAll = false;
          break;
        }
        mult *= g.get(k)!;
      }
      if (inAll) must.set(k, Math.min(mult, 1.6));
    }
  }

  return { must, orGroups, avoid, softAvoid, typeMust };
}

function applyVibesToIntent(query: string, intent: QualityIntent): string[] {
  const toks = tokenizeQuery(query);
  const extra: string[] = [];

  for (const t of toks) {
    const vibe = VIBE_MAP[t];
    if (!vibe) continue;

    for (const q of vibe.want ?? []) {
      const existing = intent.must.get(q) ?? 1.0;
      intent.must.set(q, Math.max(existing, 1.0));
    }
    for (const q of vibe.avoid ?? []) intent.avoid.add(q);
    for (const q of vibe.softAvoid ?? []) intent.softAvoid.add(q);
    for (const ty of vibe.typeMust ?? []) intent.typeMust.add(ty);
    for (const tok of vibe.addTokens ?? []) extra.push(tok);
  }

  const q = normalize(query);
  // Common user patterns
  if (
    q.includes("not bitter") || q.includes("no bitter") ||
    q.includes("avoid bitter")
  ) {
    intent.softAvoid.add("astringent");
  }
  if (
    q.includes("caffeine free") || q.includes("no caffeine") ||
    q.includes("decaf")
  ) {
    intent.typeMust.add("herbal"); // proxy unless you have caffeine data
  }

  return extra;
}

function expandQueryTokens(tokens: string[]): string[] {
  const out = new Set(tokens);
  for (const t of tokens) {
    const vibe = VIBE_MAP[t];
    if (!vibe) continue;
    for (const extra of vibe.addTokens ?? []) out.add(extra);
  }
  return Array.from(out).slice(0, 28);
}

function teaMatchesTypeConstraint(tea: BuiltTea, typeKey: string): boolean {
  const blob = `${tea.normTitle} ${tea.normDesc} ${tea.normType}`;

  if (typeKey === "pu-erh") {
    return (
      containsPhrase(blob, "pu-erh") ||
      containsPhrase(blob, "puerh") ||
      containsPhrase(blob, "puer") ||
      containsPhrase(blob, "pu erh") ||
      containsPhrase(blob, "pu'er") ||
      containsPhrase(blob, "pu’er")
    );
  }

  return containsPhrase(tea.normType, typeKey) || containsPhrase(blob, typeKey);
}

function teaMatchesQuality(
  tea: BuiltTea,
  quality: string,
  lexicon: Record<string, string[]>,
): boolean {
  const phrases = lexicon[quality] ?? [];
  for (const p of phrases) {
    if (containsPhrase(tea.normTitle, p)) return true;
    if (containsPhrase(tea.normDesc, p)) return true;
    if (containsPhrase(tea.normType, p)) return true;
  }
  return false;
}

function qualityScore(
  tea: BuiltTea,
  intent: QualityIntent,
  lexicon: Record<string, string[]>,
) {
  const POS_BASE = 0.9;
  const OR_BASE = 0.7;
  const NEG_PENALTY = 1.8;
  const SOFT_NEG_PENALTY = 0.9;

  let bonus = 0;
  let penalty = 0;

  const positiveMatched: string[] = [];
  const positiveMissed: string[] = [];
  const negativeHit: string[] = [];
  const negativeRespected: string[] = [];
  const orSatisfied: string[] = [];
  const reasons: string[] = [];

  for (const [q, mult] of intent.must.entries()) {
    const hit = teaMatchesQuality(tea, q, lexicon);
    if (hit) {
      positiveMatched.push(q);
      bonus += POS_BASE * mult;
      reasons.push(`Matched ${q}${mult !== 1 ? ` (x${mult.toFixed(2)})` : ""}`);
    } else {
      positiveMissed.push(q);
    }
  }

  for (const group of intent.orGroups) {
    let bestHit: { q: string; mult: number } | null = null;
    for (const [q, mult] of group.entries()) {
      if (teaMatchesQuality(tea, q, lexicon)) {
        if (!bestHit || mult > bestHit.mult) bestHit = { q, mult };
      }
    }
    if (bestHit) {
      orSatisfied.push(bestHit.q);
      bonus += OR_BASE * bestHit.mult;
      reasons.push(`Satisfied OR via ${bestHit.q}`);
    }
  }

  for (const q of intent.avoid) {
    if (teaMatchesQuality(tea, q, lexicon)) {
      negativeHit.push(q);
      penalty += NEG_PENALTY;
      reasons.push(`Avoid hit: ${q}`);
    } else {
      negativeRespected.push(q);
    }
  }

  for (const q of intent.softAvoid) {
    if (teaMatchesQuality(tea, q, lexicon)) {
      negativeHit.push(q);
      penalty += SOFT_NEG_PENALTY;
      reasons.push(`Soft-avoid hit: ${q}`);
    } else {
      negativeRespected.push(q);
    }
  }

  for (const avoided of intent.avoid) {
    const comps = QUALITY_COMPLEMENTS[avoided] ?? [];
    for (const c of comps) {
      if (intent.avoid.has(c) || intent.softAvoid.has(c)) continue;
      if (teaMatchesQuality(tea, c, lexicon)) bonus += 0.15;
    }
  }

  const denom = Math.max(intent.must.size + intent.orGroups.length, 1);
  bonus = bonus / Math.sqrt(denom);

  return {
    bonus,
    penalty,
    positiveMatched,
    positiveMissed,
    negativeHit,
    negativeRespected,
    orSatisfied,
    reasons: reasons.slice(0, 10),
  };
}

// ===== Public API =====
export function createTeaRecommender(rawTeas: Tea[]) {
  const teas: BuiltTea[] = rawTeas.map((t) => ({
    ...t,
    id: stableIdFromTitle(t.title),
    normTitle: normalize(t.title),
    normDesc: normalize(t.description),
    normType: normalize(t.productType ?? ""),
    tfTitle: new Map(),
    tfDesc: new Map(),
    tfType: new Map(),
    lenTitle: 0,
    lenDesc: 0,
    lenType: 0,
  }));

  const qualityLexicon = expandQualityLexicon(teas);
  const bm25 = buildBM25Index(teas);

  const index: BuiltIndex = {
    version: VERSION,
    generatedAt: new Date().toISOString(),
    teas,
    bm25,
    qualityLexicon,
  };

  return {
    index,
    recommend: (query: string, opts?: RecommendOpts) =>
      recommendTea(index, query, opts),
  };
}

export function recommendTea(
  index: BuiltIndex,
  query: string,
  opts?: RecommendOpts,
): Recommendation[] {
  const options = { ...DEFAULT_OPTS, ...(opts ?? {}) };
  const qNorm = normalize(query);

  // 1) Intent from qualities/negation/or/type
  const intent = extractIntent(qNorm, index.qualityLexicon);

  for (const t of extractTypeMustFromQuery(qNorm)) intent.typeMust.add(t);

  // 2) Vibe translation
  const extraFromVibes = applyVibesToIntent(qNorm, intent);

  // 3) Query tokens + expansion (critical for very short queries)
  const baseTokens = tokenizeBM25(qNorm);
  const expandedTokens = expandQueryTokens([
    ...baseTokens,
    ...extraFromVibes,
    ...tokenizeQuery(qNorm),
  ]);
  // note: tokenizeQuery adds short tokens like "minty" if user typed it

  const {
    termToId,
    dfTitle,
    dfDesc,
    dfType,
    N,
    avgLenTitle,
    avgLenDesc,
    avgLenType,
    k1,
    b,
  } = index.bm25;

  const qTermIds: number[] = [];
  for (const t of expandedTokens) {
    const id = termToId.get(t);
    if (id != null) qTermIds.push(id);
  }

  // Hard filter: availability + type constraints
  const filtered = index.teas.filter((t) => {
    if (options.onlyAvailable && !t.available) return false;
    if (intent.typeMust.size > 0) {
      for (const typeKey of intent.typeMust) {
        if (!teaMatchesTypeConstraint(t, typeKey)) return false;
      }
    }
    return true;
  });

  // Stage 1 BM25
  const stage1 = filtered.map((t) => {
    const sTitle = bm25ScoreField(
      qTermIds,
      t.tfTitle,
      dfTitle,
      t.lenTitle,
      avgLenTitle,
      N,
      k1,
      b,
    );
    const sDesc = bm25ScoreField(
      qTermIds,
      t.tfDesc,
      dfDesc,
      t.lenDesc,
      avgLenDesc,
      N,
      k1,
      b,
    );
    const sType = bm25ScoreField(
      qTermIds,
      t.tfType,
      dfType,
      t.lenType,
      avgLenType,
      N,
      k1,
      b,
    );

    const total = 2.2 * sTitle + 1.0 * sDesc + 0.7 * sType;
    return {
      tea: t,
      bm25: { title: sTitle, description: sDesc, type: sType, total },
    };
  });

  stage1.sort((a, b) => b.bm25.total - a.bm25.total);
  const candidates = stage1.slice(0, Math.max(5, options.stage1TopK));

  // Stage 2 rerank with qualities
  const reranked = candidates.map((c) => {
    const q = qualityScore(c.tea, intent, index.qualityLexicon);

    // small phrase boost for ultra-short queries
    let phraseBoost = 0;
    if (qNorm.length >= 3 && qNorm.length <= 28) {
      if (containsPhrase(c.tea.normTitle, qNorm)) phraseBoost += 0.35;
      else if (containsPhrase(c.tea.normDesc, qNorm)) phraseBoost += 0.18;
    }

    const score = c.bm25.total + q.bonus - q.penalty + phraseBoost;

    const constraints: string[] = [];
    for (const tm of intent.typeMust) constraints.push(`type:${tm}`);

    const reasons = [
      ...q.reasons,
      ...(constraints.length ? [`Constraints: ${constraints.join(", ")}`] : []),
    ].slice(0, 10);

    return {
      tea: c.tea,
      score,
      bm25: c.bm25,
      qualities: q,
      constraints,
      reasons,
    };
  });

  reranked.sort((a, b) => b.score - a.score);

  const top = reranked.slice(0, options.topN);
  const gated = top.filter((r) => r.score >= options.minScore);
  const final = gated.length ? gated : reranked.slice(0, 1);

  return final.map((r) => ({
    tea: {
      id: r.tea.id,
      title: r.tea.title,
      description: r.tea.description,
      thumbnail: r.tea.thumbnail,
      available: r.tea.available,
      productType: r.tea.productType,
    },
    score: r.score,
    debug: {
      bm25: r.bm25,
      qualities: {
        positiveMatched: r.qualities.positiveMatched,
        positiveMissed: r.qualities.positiveMissed,
        negativeHit: r.qualities.negativeHit,
        negativeRespected: r.qualities.negativeRespected,
        orSatisfied: r.qualities.orSatisfied,
      },
      constraints: r.constraints,
      reasons: r.reasons,
      expandedQueryTokens: expandedTokens,
    },
  }));
}

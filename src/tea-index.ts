import { Tea } from "./services/TeaStore.ts";

/** Options for tea recommendation queries. */
export type RecommendOpts = {
  /** Filter to only available teas. Default: true */
  onlyAvailable?: boolean;
  /** Maximum number of recommendations to return. Default: 1 */
  topN?: number;
  /** Minimum score threshold for results. Default: 0.1 */
  minScore?: number;
};

/** A tea recommendation result with scoring details for debugging. */
export type Recommendation = {
  tea: Tea & { id: string };
  /** Combined score from text matching + query understanding. */
  score: number;
  /** Tags that matched the search query. */
  matchedTags: string[];
  /** Debugging information explaining how the score was computed. */
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

// ============================================================================
// Synonyms: map user vocabulary to search terms
// ============================================================================

const SYNONYMS: Record<string, string[]> = {
  // Moods / occasions
  cozy: ["comforting", "warming", "smooth", "mellow"],
  relaxing: ["calming", "soothing", "chamomile", "lavender"],
  bedtime: ["sleepy", "calming", "chamomile", "caffeine-free"],
  morning: ["energizing", "bright", "brisk", "breakfast"],
  energizing: ["bright", "brisk", "bold", "strong"],
  refreshing: ["bright", "crisp", "cool", "light"],

  // Taste qualities
  smooth: ["mellow", "silky", "soft", "gentle"],
  bold: ["strong", "robust", "full-bodied", "intense"],
  light: ["delicate", "subtle", "mild", "gentle"],
  rich: ["full", "deep", "complex", "layered"],
  sweet: ["honey", "caramel", "vanilla", "fruity"],
  bitter: ["astringent", "tannic", "brisk"],

  // Flavors
  floral: ["flowery", "jasmine", "rose", "orchid", "honeysuckle", "lavender"],
  fruity: ["berry", "citrus", "apple", "peach", "tropical"],
  citrus: ["lemon", "orange", "bergamot", "grapefruit"],
  spicy: ["cinnamon", "ginger", "cardamom", "clove", "chai"],
  earthy: ["woody", "mushroom", "forest", "moss"],
  nutty: ["almond", "hazelnut", "chestnut", "toasty"],
  minty: ["mint", "peppermint", "spearmint", "cool"],
  chocolatey: ["chocolate", "cocoa", "cacao"],
  creamy: ["milky", "buttery", "smooth", "velvety"],
  smoky: ["smoke", "campfire", "lapsang"],
  grassy: ["vegetal", "green", "fresh", "spring"],
  malty: ["malt", "biscuit", "bread", "toast"],

  // Seasons
  summer: ["iced", "refreshing", "light", "citrus", "mint"],
  winter: ["warming", "spicy", "chai", "cinnamon", "cozy"],
  autumn: ["spicy", "apple", "cinnamon", "warm"],
  spring: ["floral", "light", "fresh", "green"],
};

// Tea types and their common spellings
const TEA_TYPES: Record<string, string[]> = {
  green: ["green"],
  black: ["black"],
  oolong: ["oolong", "wulong"],
  white: ["white"],
  herbal: ["herbal", "tisane", "caffeine-free", "caffeine free"],
  "pu-erh": ["pu-erh", "puerh", "puer", "pu erh", "pu'er"],
  matcha: ["matcha"],
  rooibos: ["rooibos", "red bush"],
};

// Words that negate the following term
const NEGATION_WORDS = new Set(["no", "not", "without", "avoid", "non"]);

// Words to ignore in queries
const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "is",
  "are",
  "was",
  "were",
  "i",
  "me",
  "my",
  "want",
  "looking",
  "for",
  "something",
  "like",
  "would",
  "please",
  "can",
  "you",
  "recommend",
  "suggest",
  "find",
  "tea",
  "teas",
  "drink",
  "have",
  "get",
  "try",
  "need",
  "some",
]);

// ============================================================================
// Text processing
// ============================================================================

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/['']/g, "'")
    .replace(/[^\w\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string): string[] {
  return normalize(text)
    .split(/[\s-]+/)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

/** Generates a stable ID from a tea title using FNV-1a hash. */
export function stableId(title: string): string {
  let hash = 0x811c9dc5;
  for (const char of normalize(title)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return `tea_${(hash >>> 0).toString(16)}`;
}

// ============================================================================
// Index building
// ============================================================================

type IndexedTea = {
  tea: Tea;
  id: string;
  tokens: Set<string>;
  text: string;
  tags: string[];
};

type Index = {
  teas: IndexedTea[];
  idf: Map<string, number>;
};

function buildIndex(teas: Tea[]): Index {
  const docFreq = new Map<string, number>();

  const indexed = teas.map((tea) => {
    const tagsText = tea.tags.join(" ");
    const text = normalize(
      `${tea.title} ${tea.description} ${tea.productType ?? ""} ${tagsText}`,
    );
    const tokens = new Set(tokenize(text));

    for (const token of tokens) {
      docFreq.set(token, (docFreq.get(token) ?? 0) + 1);
    }

    return { tea, id: stableId(tea.title), tokens, text, tags: tea.tags };
  });

  // Compute IDF: log(N / df) - higher for rarer terms
  const idf = new Map<string, number>();
  const N = teas.length;
  for (const [term, df] of docFreq) {
    idf.set(term, Math.log((N + 1) / (df + 1)) + 1);
  }

  return { teas: indexed, idf };
}

// ============================================================================
// Query parsing
// ============================================================================

type ParsedQuery = {
  wantTerms: string[];
  avoidTerms: string[];
  typeConstraints: string[];
  expandedTokens: string[];
};

function parseQuery(query: string): ParsedQuery {
  const normalized = normalize(query);
  const words = normalized.split(/\s+/);

  const wantTerms: string[] = [];
  const avoidTerms: string[] = [];
  const typeConstraints: string[] = [];
  const expandedTokens = new Set<string>();

  let negateNext = false;

  for (const word of words) {
    if (NEGATION_WORDS.has(word)) {
      negateNext = true;
      continue;
    }

    if (STOPWORDS.has(word)) continue;

    // Check for tea type
    for (const [type, variants] of Object.entries(TEA_TYPES)) {
      if (variants.some((v) => normalized.includes(v))) {
        typeConstraints.push(type);
      }
    }

    // Expand synonyms
    const synonyms = SYNONYMS[word] ?? [];
    const allTerms = [word, ...synonyms];

    for (const term of allTerms) {
      expandedTokens.add(term);
      if (negateNext) {
        avoidTerms.push(term);
      } else {
        wantTerms.push(term);
      }
    }

    negateNext = false;
  }

  // Handle compound phrases
  if (normalized.includes("caffeine free") || normalized.includes("decaf")) {
    typeConstraints.push("herbal");
  }

  return {
    wantTerms,
    avoidTerms,
    typeConstraints: [...new Set(typeConstraints)],
    expandedTokens: [...expandedTokens],
  };
}

// ============================================================================
// Scoring
// ============================================================================

function scoreTea(
  tea: IndexedTea,
  query: ParsedQuery,
  idf: Map<string, number>,
): {
  score: number;
  matched: string[];
  avoided: string[];
  reasons: string[];
  matchedTags: string[];
} {
  let score = 0;
  const matched: string[] = [];
  const avoided: string[] = [];
  const reasons: string[] = [];
  const matchedTags = new Set<string>();

  // Score wanted terms
  for (const term of query.wantTerms) {
    const termIdf = idf.get(term) ?? 1;

    // Exact token match
    if (tea.tokens.has(term)) {
      score += termIdf * 2;
      matched.push(term);
      reasons.push(`Matched: ${term}`);
    } // Substring match (for compound words)
    else if (tea.text.includes(term)) {
      score += termIdf;
      matched.push(term);
      reasons.push(`Contains: ${term}`);
    }

    // Check if any tags match the term
    for (const tag of tea.tags) {
      if (tag === term || tag.includes(term) || term.includes(tag)) {
        matchedTags.add(tag);
        score += termIdf * 1.5;
        reasons.push(`Tag match: ${tag}`);
      }
    }
  }

  // Penalize avoided terms
  for (const term of query.avoidTerms) {
    if (tea.tokens.has(term) || tea.text.includes(term)) {
      score -= 3;
      avoided.push(term);
      reasons.push(`Avoid hit: ${term}`);
    }
  }

  // Bonus for title matches
  const titleLower = normalize(tea.tea.title);
  for (const term of query.wantTerms) {
    if (titleLower.includes(term)) {
      score += 1.5;
      reasons.push(`Title match: ${term}`);
    }
  }

  return { score, matched, avoided, reasons, matchedTags: [...matchedTags] };
}

function matchesTypeConstraint(tea: IndexedTea, typeKey: string): boolean {
  const variants = TEA_TYPES[typeKey] ?? [typeKey];
  return variants.some((v) => tea.text.includes(v));
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Creates a tea recommender. Call once with all teas,
 * then use the returned `recommend` method for queries.
 */
export function createTeaRecommender(teas: Tea[]) {
  const index = buildIndex(teas);

  return {
    index,
    recommend: (query: string, opts?: RecommendOpts) =>
      recommend(index, query, opts),
  };
}

/**
 * Recommends teas matching a natural language query.
 * Handles synonyms, negations ("not bitter"), and tea type constraints.
 */
export function recommendTea(
  index: { teas: IndexedTea[]; idf: Map<string, number> },
  query: string,
  opts?: RecommendOpts,
): Recommendation[] {
  return recommend(index, query, opts);
}

function recommend(
  index: Index,
  query: string,
  opts?: RecommendOpts,
): Recommendation[] {
  const options = {
    onlyAvailable: true,
    topN: 1,
    minScore: 0.1,
    ...opts,
  };

  const parsed = parseQuery(query);

  // Filter by availability and type constraints
  let candidates = index.teas;

  if (options.onlyAvailable) {
    candidates = candidates.filter((t) => t.tea.available);
  }

  if (parsed.typeConstraints.length > 0) {
    candidates = candidates.filter((t) =>
      parsed.typeConstraints.every((type) => matchesTypeConstraint(t, type))
    );
  }

  // Score all candidates
  const scored = candidates.map((tea) => {
    const result = scoreTea(tea, parsed, index.idf);
    return { tea, ...result };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Take top N above threshold
  const results = scored
    .slice(0, options.topN)
    .filter((r) => r.score >= options.minScore);

  // If nothing above threshold, return best match anyway
  const final = results.length > 0 ? results : scored.slice(0, 1);

  return final.map((r) => ({
    tea: {
      id: r.tea.id,
      title: r.tea.tea.title,
      description: r.tea.tea.description,
      thumbnail: r.tea.tea.thumbnail,
      available: r.tea.tea.available,
      productType: r.tea.tea.productType,
      tags: r.tea.tea.tags,
    },
    score: r.score,
    matchedTags: r.matchedTags,
    debug: {
      bm25: { title: 0, description: 0, type: 0, total: r.score },
      qualities: {
        positiveMatched: r.matched,
        positiveMissed: parsed.wantTerms.filter((t) => !r.matched.includes(t)),
        negativeHit: r.avoided,
        negativeRespected: parsed.avoidTerms.filter((t) =>
          !r.avoided.includes(t)
        ),
        orSatisfied: [],
      },
      constraints: parsed.typeConstraints.map((t) => `type:${t}`),
      reasons: r.reasons.slice(0, 10),
      expandedQueryTokens: parsed.expandedTokens,
    },
  }));
}

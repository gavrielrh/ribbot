import { Product } from "./schemas/shopify.ts";

/**
 * All known tags that can be assigned to teas.
 * This includes both Shopify tags and inferred tags.
 */
export const KNOWN_TAGS = [
  // Tea types
  "black",
  "green",
  "herbal",
  "matcha",
  "oolong",
  "pu-erh",
  "rooibos",
  "white",
  // Tea styles
  "chai",
  "earl-grey",
  "sencha",
  // Caffeine
  "caffeinated",
  "caffeine-free",
  // Flavors
  "chocolatey",
  "citrus",
  "creamy",
  "earthy",
  "floral",
  "fruity",
  "grassy",
  "malty",
  "minty",
  "nutty",
  "smoky",
  "spicy",
  "sweet",
  // Key ingredients
  "bergamot",
  "chamomile",
  "ginger",
  "hibiscus",
  "jasmine",
  "lavender",
  "turmeric",
  // Body/Strength
  "aromatic",
  "bold",
  "brisk",
  "crisp",
  "delicate",
  "rich",
  "smooth",
  // Health/Wellness
  "antioxidant",
  "detox",
  "digestive",
  "immune-support",
  "stress-relief",
  // Seasons
  "autumn",
  "summer",
  "winter",
  // Occasions
  "afternoon",
  "bedtime",
  "energizing",
  "morning",
  "relaxing",
  // Serving style
  "iced-tea",
  "latte-friendly",
  // Quality/Sourcing
  "high-mountain",
  "organic",
  "single-estate",
  // Origins (from Shopify + inferred)
  "assam",
  "china",
  "darjeeling",
  "himalayan",
  "indian",
  "japan",
  "nepal",
  "sri lanka",
  "taiwan",
  "yunnan",
  // Harvest (from Shopify)
  "first flush",
  "second flush",
  "spring teas",
  "spring teas 2023",
  "spring teas 2024",
  "spring teas 2025",
  // Other (from Shopify)
  "house blends",
  "new",
  "raw",
  "ripe",
  // Processing
  "roasted",
] as const;

export type KnownTag = typeof KNOWN_TAGS[number];

// Tea type detection patterns
const TYPE_PATTERNS: Record<string, string[]> = {
  black: [
    "black tea",
    "breakfast",
    "assam",
    "darjeeling",
    "ceylon",
    "earl grey",
    "english breakfast",
    "keemun",
    "lapsang",
    "yunnan",
    "dianhong",
    "congou",
    "chai",
    "hao ya",
  ],
  green: [
    "green tea",
    "sencha",
    "gunpowder",
    "dragonwell",
    "longjing",
    "gyokuro",
    "genmaicha",
    "hojicha",
    "kukicha",
    "bancha",
    "bi luo chun",
  ],
  oolong: [
    "oolong",
    "wulong",
    "dong ding",
    "tieguanyin",
    "da hong pao",
    "milk oolong",
    "jinxuan",
    "alishan",
  ],
  white: ["white tea", "silver needle", "bai mu dan", "pai mu tan", "shou mei"],
  herbal: [
    "herbal",
    "tisane",
    "caffeine-free",
    "rooibos",
    "chamomile",
    "hibiscus",
    "echinacea",
    "mugwort",
    "valerian",
    "passionflower",
    "lemon balm",
    "peppermint tea",
    "spearmint tea",
    "ginger tea",
  ],
  "pu-erh": ["pu-erh", "puerh", "pu'er", "pu er", "shou", "sheng"],
  rooibos: ["rooibos", "red bush", "redbush"],
  matcha: ["matcha"],
};

// Tea style patterns
const STYLE_PATTERNS: Record<string, string[]> = {
  chai: ["chai", "masala chai", "spiced tea"],
  "earl-grey": ["earl grey", "earl-grey", "bergamot"],
  sencha: ["sencha", "fukamushi", "asamushi"],
};

// Caffeine patterns
const CAFFEINE_PATTERNS = {
  "caffeine-free": [
    "caffeine-free",
    "caffeine free",
    "decaf",
    "herbal",
    "tisane",
    "rooibos",
    "chamomile",
    "hibiscus",
    "peppermint",
    "echinacea",
    "mugwort",
    "valerian",
  ],
  caffeinated: [
    "black tea",
    "green tea",
    "oolong",
    "white tea",
    "pu-erh",
    "matcha",
    "yerba mate",
    "chai",
    "keemun",
    "assam",
    "darjeeling",
    "ceylon",
    "sencha",
    "gyokuro",
    "longjing",
    "jinxuan",
    "alishan",
  ],
};

// Flavor detection patterns
const FLAVOR_PATTERNS: Record<string, string[]> = {
  floral: [
    "jasmine",
    "rose",
    "lavender",
    "orchid",
    "honeysuckle",
    "flower",
    "chrysanthemum",
    "osmanthus",
    "violet",
    "hibiscus",
    "elderflower",
  ],
  fruity: [
    "berry",
    "apple",
    "peach",
    "mango",
    "fruit",
    "tropical",
    "strawberry",
    "raspberry",
    "blueberry",
    "cherry",
    "plum",
    "apricot",
    "pear",
    "grape",
    "passionfruit",
    "lychee",
    "guava",
    "papaya",
    "pineapple",
  ],
  citrus: [
    "lemon",
    "orange",
    "bergamot",
    "citrus",
    "grapefruit",
    "lime",
    "tangerine",
    "yuzu",
    "mandarin",
    "clementine",
  ],
  spicy: [
    "cinnamon",
    "ginger",
    "cardamom",
    "clove",
    "chai",
    "spice",
    "pepper",
    "turmeric",
    "nutmeg",
    "anise",
    "star anise",
    "masala",
    "aromatic spice",
    "zesty",
  ],
  minty: ["mint", "peppermint", "spearmint", "menthol"],
  earthy: [
    "earthy",
    "woody",
    "forest",
    "mushroom",
    "bark",
    "moss",
    "soil",
    "leather",
  ],
  nutty: [
    "almond",
    "hazelnut",
    "nutty",
    "chestnut",
    "walnut",
    "pecan",
    "cashew",
    "toasty",
    "roasted nut",
  ],
  smoky: ["smoke", "smoky", "lapsang", "campfire", "charcoal"],
  malty: ["malt", "malty", "breakfast", "assam", "biscuit", "bread", "toast"],
  sweet: [
    "honey",
    "caramel",
    "vanilla",
    "sweet",
    "maple",
    "sugar",
    "molasses",
    "toffee",
    "butterscotch",
    "sweetness",
  ],
  chocolatey: ["chocolate", "cocoa", "cacao", "mocha"],
  creamy: ["cream", "milk", "butter", "buttery", "velvety", "silky", "latte"],
  grassy: ["grassy", "vegetal", "green", "fresh cut", "hay", "herbaceous"],
};

// Ingredient patterns (specific botanicals)
const INGREDIENT_PATTERNS: Record<string, string[]> = {
  bergamot: ["bergamot"],
  chamomile: ["chamomile", "camomile"],
  ginger: ["ginger", "zingy"],
  hibiscus: ["hibiscus"],
  jasmine: ["jasmine"],
  lavender: ["lavender"],
  turmeric: ["turmeric", "curcumin"],
};

// Body/Strength patterns
const BODY_PATTERNS: Record<string, string[]> = {
  aromatic: ["aromatic", "aroma", "fragrant", "fragrance", "scented"],
  bold: [
    "bold",
    "strong",
    "robust",
    "full-bodied",
    "full bodied",
    "intense",
    "powerful",
  ],
  brisk: ["brisk", "lively", "bright", "vibrant"],
  crisp: ["crisp", "clean", "clear"],
  delicate: ["delicate", "subtle", "mild", "gentle", "light", "soft"],
  rich: ["rich", "deep", "complex", "layered", "nuanced"],
  smooth: ["smooth", "mellow", "rounded", "balanced"],
};

// Health/Wellness patterns
const HEALTH_PATTERNS: Record<string, string[]> = {
  antioxidant: [
    "antioxidant",
    "antioxidants",
    "polyphenol",
    "catechin",
    "egcg",
  ],
  detox: ["detox", "cleanse", "cleansing", "purify", "purifying"],
  digestive: ["digestive", "digestion", "stomach", "belly", "tummy", "gut"],
  "immune-support": [
    "immune",
    "immunity",
    "cold",
    "flu",
    "vitamin c",
    "echinacea",
  ],
  "stress-relief": ["stress", "anxiety", "tension", "unwind", "de-stress"],
};

// Season patterns
const SEASON_PATTERNS: Record<string, string[]> = {
  winter: ["winter", "warming", "cozy", "comfort", "comforting", "hearty"],
  summer: ["summer", "cooling", "iced", "cold brew"],
  autumn: ["autumn", "fall", "harvest", "pumpkin", "apple cider"],
};

// Origin patterns (inferred from descriptions)
const ORIGIN_PATTERNS: Record<string, string[]> = {
  himalayan: ["himalayan", "himalayas", "himalaya"],
  indian: ["india", "indian", "assam", "darjeeling"],
  yunnan: ["yunnan", "yunnanese"],
};

// Sourcing/Quality patterns
const SOURCING_PATTERNS: Record<string, string[]> = {
  "high-mountain": [
    "high mountain",
    "high-mountain",
    "mountain",
    "altitude",
    "elevated",
  ],
  organic: ["organic", "certified organic"],
  "single-estate": [
    "estate",
    "single estate",
    "single-estate",
    "garden",
    "single garden",
  ],
};

// Serving style patterns
const SERVING_PATTERNS: Record<string, string[]> = {
  "iced-tea": ["iced", "cold brew", "cold-brew", "chilled"],
  "latte-friendly": ["latte", "milk tea", "with milk"],
};

// Processing patterns
const PROCESSING_PATTERNS: Record<string, string[]> = {
  roasted: ["roasted", "roast", "toasted", "fired", "baked"],
};

// Occasion patterns
const OCCASION_PATTERNS: Record<string, string[]> = {
  afternoon: ["afternoon", "midday", "mid-day"],
  morning: ["breakfast", "morning", "energizing", "brisk", "wake"],
  bedtime: [
    "sleepy",
    "sleep",
    "calming",
    "chamomile",
    "lavender",
    "bedtime",
    "night",
    "dream",
    "slumber",
    "valerian",
    "passionflower",
  ],
  relaxing: [
    "calm",
    "soothing",
    "relaxing",
    "peaceful",
    "zen",
    "tranquil",
    "serene",
    "meditation",
    "stress",
  ],
  energizing: [
    "energizing",
    "energy",
    "bright",
    "brisk",
    "bold",
    "strong",
    "invigorate",
    "uplift",
    "refresh",
  ],
};

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/['']/g, "'").replace(/\s+/g, " ").trim();
}

/**
 * Extracts tags from a Shopify product's tags field.
 * Handles both string (comma-separated) and array formats.
 */
export function extractShopifyTags(product: Product): string[] {
  const tags = product.tags;
  if (!tags) return [];

  if (Array.isArray(tags)) {
    return tags.map((t) => normalizeText(t)).filter((t) => t.length > 0);
  }

  if (typeof tags === "string") {
    return tags
      .split(",")
      .map((t) => normalizeText(t))
      .filter((t) => t.length > 0);
  }

  return [];
}

function matchesPatterns(text: string, patterns: string[]): boolean {
  const normalized = normalizeText(text);
  return patterns.some((pattern) => normalized.includes(pattern));
}

type TeaLike = {
  title: string;
  description: string;
  productType: string | null;
};

/**
 * Infers tags from a tea's title, description, and productType.
 * Returns an array of inferred tag strings.
 */
export function inferTags(tea: TeaLike): string[] {
  const searchText = normalizeText(
    `${tea.title} ${tea.description} ${tea.productType ?? ""}`,
  );
  const tags: Set<string> = new Set();

  // Infer tea type tags
  for (const [tag, patterns] of Object.entries(TYPE_PATTERNS)) {
    if (matchesPatterns(searchText, patterns)) {
      tags.add(tag);
    }
  }

  // Infer tea style tags
  for (const [tag, patterns] of Object.entries(STYLE_PATTERNS)) {
    if (matchesPatterns(searchText, patterns)) {
      tags.add(tag);
    }
  }

  // Infer caffeine tags
  if (matchesPatterns(searchText, CAFFEINE_PATTERNS["caffeine-free"])) {
    tags.add("caffeine-free");
  } else if (matchesPatterns(searchText, CAFFEINE_PATTERNS.caffeinated)) {
    tags.add("caffeinated");
  }

  // Infer flavor tags
  for (const [tag, patterns] of Object.entries(FLAVOR_PATTERNS)) {
    if (matchesPatterns(searchText, patterns)) {
      tags.add(tag);
    }
  }

  // Infer ingredient tags
  for (const [tag, patterns] of Object.entries(INGREDIENT_PATTERNS)) {
    if (matchesPatterns(searchText, patterns)) {
      tags.add(tag);
    }
  }

  // Infer body/strength tags
  for (const [tag, patterns] of Object.entries(BODY_PATTERNS)) {
    if (matchesPatterns(searchText, patterns)) {
      tags.add(tag);
    }
  }

  // Infer health/wellness tags
  for (const [tag, patterns] of Object.entries(HEALTH_PATTERNS)) {
    if (matchesPatterns(searchText, patterns)) {
      tags.add(tag);
    }
  }

  // Infer season tags
  for (const [tag, patterns] of Object.entries(SEASON_PATTERNS)) {
    if (matchesPatterns(searchText, patterns)) {
      tags.add(tag);
    }
  }

  // Infer origin tags
  for (const [tag, patterns] of Object.entries(ORIGIN_PATTERNS)) {
    if (matchesPatterns(searchText, patterns)) {
      tags.add(tag);
    }
  }

  // Infer sourcing/quality tags
  for (const [tag, patterns] of Object.entries(SOURCING_PATTERNS)) {
    if (matchesPatterns(searchText, patterns)) {
      tags.add(tag);
    }
  }

  // Infer serving style tags
  for (const [tag, patterns] of Object.entries(SERVING_PATTERNS)) {
    if (matchesPatterns(searchText, patterns)) {
      tags.add(tag);
    }
  }

  // Infer processing tags
  for (const [tag, patterns] of Object.entries(PROCESSING_PATTERNS)) {
    if (matchesPatterns(searchText, patterns)) {
      tags.add(tag);
    }
  }

  // Infer occasion tags
  for (const [tag, patterns] of Object.entries(OCCASION_PATTERNS)) {
    if (matchesPatterns(searchText, patterns)) {
      tags.add(tag);
    }
  }

  return [...tags];
}

/**
 * Combines Shopify tags with inferred tags, deduplicating.
 */
export function getAllTags(product: Product, tea: TeaLike): string[] {
  const shopifyTags = extractShopifyTags(product);
  const inferredTags = inferTags(tea);

  const allTags = new Set([...shopifyTags, ...inferredTags]);
  return [...allTags].sort();
}

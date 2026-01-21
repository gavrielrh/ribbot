/**
 * CLI tool for testing tea recommendations without Discord.
 *
 * Usage:
 *   deno run --allow-net src/cli.ts recommend "floral green tea"
 *   deno run --allow-net src/cli.ts validate
 *   deno run --allow-net src/cli.ts tags
 */

import { createTeaRecommender, type Recommendation } from "./tea-index.ts";
import { getAllTags } from "./tea-tags.ts";
import {
  TYPE_DENY_LIST,
  TAGS_DENY_LIST,
  TITLE_DENY_LIST,
  VENDOR_DENY_LIST,
} from "./tea-filters.ts";
import { htmlToMarkdown } from "./format.ts";
import type { Tea } from "./services/TeaStore.ts";

const BASE_URL = "https://happyearthtea.com";

function productHasTag(product: any, tag: string): boolean {
  if (!product.tags) return false;
  if (typeof product.tags === "string") return product.tags.includes(tag);
  if (Array.isArray(product.tags)) return product.tags.some((t: string) => t === tag);
  return false;
}

function filterTeas(products: any[]): any[] {
  return products
    .filter((product) => !TITLE_DENY_LIST.some((title) => product.title?.includes(title)))
    .filter((product) => !TAGS_DENY_LIST.some((tag) => productHasTag(product, tag)))
    .filter((product) => !TYPE_DENY_LIST.some((type) => product.product_type === type))
    .filter((product) => !VENDOR_DENY_LIST.some((vendor) => product.vendor === vendor));
}

function getThumbnail(product: any): string | null {
  const variants = product.variants;
  if (variants && Array.isArray(variants)) {
    const variantWithSource = variants.find((variant: any) => variant.featured_image?.src);
    if (variantWithSource) {
      return variantWithSource.featured_image.src;
    }
  }
  return null;
}

function isAvailable(product: any): boolean {
  const variants = product.variants;
  if (variants && Array.isArray(variants)) {
    return Boolean(variants.at(0)?.available);
  }
  return false;
}

function productToTea(product: any): Tea {
  const tea = {
    title: product.title || "",
    description: htmlToMarkdown(product.body_html || ""),
    thumbnail: getThumbnail(product),
    available: isAvailable(product),
    productType: product.product_type ?? null,
    tags: [] as string[],
  };
  tea.tags = getAllTags(product, tea);
  return tea;
}

async function fetchAllProducts(): Promise<any[]> {
  const allProducts: any[] = [];
  let page = 1;
  while (page < 100) {
    const url = `${BASE_URL}/products.json?page=${page}&limit=250`;
    const response = await fetch(url);
    const json = await response.json();
    if (!json.products || json.products.length === 0) break;
    allProducts.push(...json.products);
    page++;
  }
  return allProducts;
}

async function loadTeas(): Promise<Tea[]> {
  console.log("Fetching teas from Shopify...");
  const products = await fetchAllProducts();
  const filteredProducts = filterTeas(products);
  const teas = filteredProducts.map(productToTea);
  console.log(`Loaded ${teas.length} teas\n`);
  return teas;
}

function formatMatchReason(rec: Recommendation): string {
  const reasons = rec.debug.reasons;
  const parts: string[] = [];

  // Extract title matches
  const titleMatches = reasons
    .filter((r) => r.startsWith("Title match:"))
    .map((r) => r.replace("Title match: ", ""));
  if (titleMatches.length > 0) {
    parts.push(`title: ${titleMatches.join(", ")}`);
  }

  // Extract text/token matches (excluding title matches to avoid duplication)
  const textMatches = reasons
    .filter((r) => r.startsWith("Matched:") || r.startsWith("Contains:"))
    .map((r) => r.replace("Matched: ", "").replace("Contains: ", ""))
    .filter((t) => !titleMatches.includes(t));
  if (textMatches.length > 0) {
    parts.push(`text: ${textMatches.join(", ")}`);
  }

  // Add matched tags
  if (rec.matchedTags.length > 0) {
    parts.push(`tags: ${rec.matchedTags.join(", ")}`);
  }

  return parts.length > 0 ? parts.join(" | ") : "(no specific matches)";
}

async function runRecommend(query: string, topN: number = 5) {
  const teas = await loadTeas();
  const recommender = createTeaRecommender(teas);

  console.log(`Query: "${query}"\n`);
  console.log("=".repeat(60));

  const results = recommender.recommend(query, { topN, onlyAvailable: false });

  if (results.length === 0) {
    console.log("No recommendations found.");
    return;
  }

  for (const rec of results) {
    console.log(`\n**${rec.tea.title}**`);
    console.log(`Score: ${rec.score.toFixed(2)}`);
    console.log(`Why: ${formatMatchReason(rec)}`);
    console.log(`Description: ${rec.tea.description.slice(0, 150)}...`);
    console.log("-".repeat(60));
  }
}

async function runValidate() {
  const teas = await loadTeas();
  const recommender = createTeaRecommender(teas);

  console.log("=== VALIDATION: Checking if all teas can be found ===\n");

  const issues: string[] = [];
  const tagCoverage = new Map<string, number>();

  for (const tea of teas) {
    // Check if tea can be found by its title
    const byTitle = recommender.recommend(tea.title, { topN: 5, onlyAvailable: false });
    const foundByTitle = byTitle.some(r => r.tea.title === tea.title);

    if (!foundByTitle) {
      issues.push(`NOT FOUND BY TITLE: ${tea.title}`);
    }

    // Check if tea can be found by its type
    if (tea.productType) {
      const byType = recommender.recommend(tea.productType, { topN: 20, onlyAvailable: false });
      const foundByType = byType.some(r => r.tea.title === tea.title);
      if (!foundByType) {
        issues.push(`NOT IN TOP 20 FOR TYPE "${tea.productType}": ${tea.title}`);
      }
    }

    // Track tag coverage
    for (const tag of tea.tags) {
      tagCoverage.set(tag, (tagCoverage.get(tag) || 0) + 1);
    }
  }

  // Check tag searchability
  console.log("Checking tag searchability...\n");
  const tagIssues: string[] = [];

  for (const [tag, count] of tagCoverage.entries()) {
    if (count >= 3) { // Only check tags with 3+ teas
      const results = recommender.recommend(tag, { topN: 10, onlyAvailable: false });
      const matchCount = results.filter(r => r.tea.tags.includes(tag)).length;

      if (matchCount === 0) {
        tagIssues.push(`TAG "${tag}" (${count} teas): No matches in top 10 results`);
      } else if (matchCount < Math.min(3, count)) {
        tagIssues.push(`TAG "${tag}" (${count} teas): Only ${matchCount} matches in top 10`);
      }
    }
  }

  // Report results
  if (issues.length === 0) {
    console.log("✓ All teas can be found by title");
    console.log("✓ All teas appear in their type searches");
  } else {
    console.log("ISSUES FOUND:\n");
    for (const issue of issues) {
      console.log(`  - ${issue}`);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("\nTAG SEARCHABILITY:\n");

  if (tagIssues.length === 0) {
    console.log("✓ All tags return relevant results");
  } else {
    for (const issue of tagIssues) {
      console.log(`  - ${issue}`);
    }
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("\nSUMMARY:");
  console.log(`  Total teas: ${teas.length}`);
  console.log(`  Total unique tags: ${tagCoverage.size}`);
  console.log(`  Title search issues: ${issues.filter(i => i.startsWith("NOT FOUND")).length}`);
  console.log(`  Type search issues: ${issues.filter(i => i.startsWith("NOT IN TOP")).length}`);
  console.log(`  Tag search issues: ${tagIssues.length}`);
}

async function runTags() {
  const teas = await loadTeas();

  console.log("=== TAG COVERAGE REPORT ===\n");

  const tagCounts = new Map<string, number>();

  for (const tea of teas) {
    for (const tag of tea.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    }
  }

  const sortedTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]);

  for (const [tag, count] of sortedTags) {
    const bar = "█".repeat(Math.ceil(count / 2));
    console.log(`${tag.padEnd(20)} ${count.toString().padStart(3)} ${bar}`);
  }

  const avgTags = teas.reduce((sum, t) => sum + t.tags.length, 0) / teas.length;
  console.log(`\nTotal unique tags: ${tagCounts.size}`);
  console.log(`Average tags per tea: ${avgTags.toFixed(1)}`);
}

// Main
const command = Deno.args[0];
const args = Deno.args.slice(1);

switch (command) {
  case "recommend":
    if (args.length === 0) {
      console.log("Usage: deno run --allow-net src/cli.ts recommend <query> [topN]");
      Deno.exit(1);
    }
    await runRecommend(args[0], parseInt(args[1]) || 5);
    break;

  case "validate":
    await runValidate();
    break;

  case "tags":
    await runTags();
    break;

  default:
    console.log("Tea Recommendation CLI");
    console.log("");
    console.log("Commands:");
    console.log("  recommend <query> [topN]  - Get tea recommendations");
    console.log("  validate                  - Validate all teas are findable");
    console.log("  tags                      - Show tag coverage report");
    console.log("");
    console.log("Examples:");
    console.log('  deno run --allow-net src/cli.ts recommend "floral green tea"');
    console.log('  deno run --allow-net src/cli.ts recommend "relaxing bedtime" 10');
    console.log("  deno run --allow-net src/cli.ts validate");
    Deno.exit(0);
}

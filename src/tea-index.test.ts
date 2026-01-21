import { assertEquals, assertGreater } from "@std/assert";
import { createTeaRecommender } from "./tea-index.ts";
import type { Tea } from "./services/TeaStore.ts";

const mockTeas: Tea[] = [
  {
    title: "Earl Grey Supreme",
    description: "A bold and aromatic black tea with bergamot notes. Full-bodied and smooth.",
    thumbnail: null,
    available: true,
    productType: "Black Tea",
    tags: ["black", "caffeinated", "citrus", "creamy"],
  },
  {
    title: "Jasmine Green",
    description: "A delicate and flowery green tea with jasmine blossoms. Light and refreshing.",
    thumbnail: null,
    available: true,
    productType: "Green Tea",
    tags: ["green", "caffeinated", "floral"],
  },
  {
    title: "Chamomile Dreams",
    description: "A calming herbal tea with chamomile flowers. Smooth and soothing for bedtime.",
    thumbnail: null,
    available: true,
    productType: "Herbal Tea",
    tags: ["herbal", "caffeine-free", "creamy", "bedtime", "relaxing"],
  },
  {
    title: "Assam Bold",
    description: "A malty and robust black tea from Assam. Strong and astringent with brisk notes.",
    thumbnail: null,
    available: true,
    productType: "Black Tea",
    tags: ["black", "caffeinated", "malty", "morning", "energizing"],
  },
  {
    title: "Peppermint Fresh",
    description: "A bright and clean herbal tea with fresh peppermint leaves.",
    thumbnail: null,
    available: false,
    productType: "Herbal Tea",
    tags: ["herbal", "caffeine-free", "minty"],
  },
];

Deno.test("createTeaRecommender returns a recommender object", () => {
  const recommender = createTeaRecommender(mockTeas);
  assertEquals(typeof recommender.recommend, "function");
  assertEquals(typeof recommender.index, "object");
});

Deno.test("recommend returns results for a valid query", () => {
  const recommender = createTeaRecommender(mockTeas);
  const results = recommender.recommend("black tea", { topN: 3 });

  assertGreater(results.length, 0);
  assertEquals(results.length <= 3, true);
});

Deno.test("recommend filters out unavailable teas by default", () => {
  const recommender = createTeaRecommender(mockTeas);
  const results = recommender.recommend("peppermint", { topN: 5 });

  const titles = results.map((r) => r.tea.title);
  assertEquals(titles.includes("Peppermint Fresh"), false);
});

Deno.test("recommend includes unavailable teas when onlyAvailable is false", () => {
  const recommender = createTeaRecommender(mockTeas);
  const results = recommender.recommend("peppermint", {
    topN: 5,
    onlyAvailable: false,
  });

  const titles = results.map((r) => r.tea.title);
  assertEquals(titles.includes("Peppermint Fresh"), true);
});

Deno.test("recommend respects type constraints for green tea", () => {
  const recommender = createTeaRecommender(mockTeas);
  const results = recommender.recommend("green tea flowery", { topN: 3 });

  if (results.length > 0) {
    const topResult = results[0];
    assertEquals(topResult.tea.productType?.toLowerCase().includes("green"), true);
  }
});

Deno.test("recommend handles bedtime/herbal queries", () => {
  const recommender = createTeaRecommender(mockTeas);
  const results = recommender.recommend("bedtime", { topN: 3 });

  if (results.length > 0) {
    const topResult = results[0];
    assertEquals(topResult.tea.productType?.toLowerCase().includes("herbal"), true);
  }
});

Deno.test("recommend returns empty array for impossible constraints", () => {
  const recommender = createTeaRecommender(mockTeas);
  const results = recommender.recommend("pu-erh", { topN: 3 });

  assertEquals(results.length === 0 || results[0].score < 0.5, true);
});

Deno.test("recommendation includes debug information", () => {
  const recommender = createTeaRecommender(mockTeas);
  const results = recommender.recommend("smooth black tea", { topN: 1 });

  if (results.length > 0) {
    const debug = results[0].debug;
    assertEquals(typeof debug.bm25, "object");
    assertEquals(typeof debug.qualities, "object");
    assertEquals(Array.isArray(debug.expandedQueryTokens), true);
  }
});

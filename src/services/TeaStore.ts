import { Cache, Context, Duration, Effect, Layer, Option } from "effect";
import {
  NetworkError,
  ParseError,
  ShopifyError,
  TeaNotFoundError,
  TimeoutError,
} from "../errors.ts";
import { productHasTag, ShopifyClient } from "./ShopifyClient.ts";
import { Product } from "../schemas/shopify.ts";
import { htmlToMarkdown } from "../format.ts";
import {
  createTeaRecommender,
  type Recommendation,
  type RecommendOpts,
  stableId,
} from "../tea-index.ts";
import {
  TAGS_DENY_LIST,
  TITLE_DENY_LIST,
  TYPE_DENY_LIST,
  VENDOR_DENY_LIST,
} from "../tea-filters.ts";
import { getAllTags } from "../tea-tags.ts";

const BASE_URL = "https://happyearthtea.com";

/** A tea product with normalized fields for display and search. */
export type Tea = {
  title: string;
  description: string;
  thumbnail: string | null;
  available: boolean;
  productType: string | null;
  tags: string[];
};

function getThumbnail(product: Product): string | null {
  const variants = product.variants;
  if (variants && Array.isArray(variants)) {
    const variantWithSource = variants.find((variant) =>
      variant.featured_image?.src
    );
    if (variantWithSource) {
      return variantWithSource.featured_image!.src!;
    }
  }
  return null;
}

function isAvailable(product: Product): boolean {
  const variants = product.variants;
  if (variants && Array.isArray(variants)) {
    return Boolean(variants.at(0)?.available);
  }
  return false;
}

function filterTeas(products: readonly Product[]): Product[] {
  return [...products]
    .filter((product) =>
      !TITLE_DENY_LIST.some((title) => product.title?.includes(title))
    )
    .filter((product) =>
      !TAGS_DENY_LIST.some((tag) => productHasTag(product, tag))
    )
    .filter((product) =>
      !TYPE_DENY_LIST.some((type) => product.product_type === type)
    )
    .filter((product) =>
      !VENDOR_DENY_LIST.some((vendor) => product.vendor === vendor)
    );
}

function productToTea(product: Product): Tea {
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

/**
 * Service for fetching and caching tea products from Shopify.
 * Provides caching (1 hour TTL), search indexing, and recommendations.
 */
export class TeaStore extends Context.Tag("TeaStore")<
  TeaStore,
  {
    /** Returns all teas from the cache, fetching from Shopify if needed. */
    getTeas: () => Effect.Effect<
      readonly Tea[],
      ShopifyError | ParseError | NetworkError | TimeoutError
    >;
    /** Returns a specific tea by title (case-insensitive). */
    getTea: (
      title: string,
    ) => Effect.Effect<
      Tea,
      TeaNotFoundError | ShopifyError | ParseError | NetworkError | TimeoutError
    >;
    /** Returns a specific tea by its stable ID. */
    getTeaById: (
      id: string,
    ) => Effect.Effect<
      Tea,
      TeaNotFoundError | ShopifyError | ParseError | NetworkError | TimeoutError
    >;
    /** Returns a tea wrapped in Option, never fails. */
    getTeaOption: (title: string) => Effect.Effect<Option.Option<Tea>, never>;
    /** Forces a cache refresh from Shopify. */
    refreshTeas: () => Effect.Effect<
      readonly Tea[],
      ShopifyError | ParseError | NetworkError | TimeoutError
    >;
    /** Returns tea recommendations for a natural language query. */
    recommend: (
      query: string,
      opts?: RecommendOpts,
    ) => Effect.Effect<
      Recommendation[],
      ShopifyError | ParseError | NetworkError | TimeoutError
    >;
  }
>() {}

export const TeaStoreLive = Layer.effect(
  TeaStore,
  Effect.gen(function* () {
    const shopify = yield* ShopifyClient;

    const teaCache = yield* Cache.make({
      lookup: (_key: string) =>
        Effect.gen(function* () {
          yield* Effect.logInfo("Fetching teas from Shopify (cache miss)");
          const products = yield* shopify.getAllProducts(BASE_URL);
          const filteredProducts = filterTeas(products);
          const teas = filteredProducts.map(productToTea);
          yield* Effect.logInfo(`Cached ${teas.length} teas`);
          return teas;
        }),
      capacity: 1,
      timeToLive: Duration.hours(1),
    });

    let teaIndex: Map<string, Tea> = new Map();
    let teaIdIndex: Map<string, Tea> = new Map();
    let recommender: ReturnType<typeof createTeaRecommender> | null = null;

    const rebuildIndex = (teas: readonly Tea[]) => {
      teaIndex = new Map(teas.map((tea) => [tea.title.toLowerCase(), tea]));
      teaIdIndex = new Map(teas.map((tea) => [stableId(tea.title), tea]));
      recommender = createTeaRecommender([...teas]);
    };

    return {
      getTeas: () =>
        Effect.gen(function* () {
          const teas = yield* teaCache.get("teas");
          rebuildIndex(teas);
          return teas;
        }),

      getTea: (title: string) =>
        Effect.gen(function* () {
          if (teaIndex.size === 0) {
            const teas = yield* teaCache.get("teas");
            rebuildIndex(teas);
          }
          const tea = teaIndex.get(title.toLowerCase());
          if (!tea) {
            return yield* Effect.fail(new TeaNotFoundError({ title }));
          }
          return tea;
        }),

      getTeaById: (id: string) =>
        Effect.gen(function* () {
          if (teaIdIndex.size === 0) {
            const teas = yield* teaCache.get("teas");
            rebuildIndex(teas);
          }
          const tea = teaIdIndex.get(id);
          if (!tea) {
            return yield* Effect.fail(new TeaNotFoundError({ title: id }));
          }
          return tea;
        }),

      getTeaOption: (title: string) =>
        Effect.gen(function* () {
          if (teaIndex.size === 0) {
            const teas = yield* Effect.catchAll(
              teaCache.get("teas"),
              () => Effect.succeed([] as readonly Tea[]),
            );
            rebuildIndex(teas);
          }
          const tea = teaIndex.get(title.toLowerCase());
          return tea ? Option.some(tea) : Option.none();
        }),

      refreshTeas: () =>
        Effect.gen(function* () {
          yield* Effect.logInfo("Forcing tea cache refresh");
          yield* teaCache.invalidateAll;
          const teas = yield* teaCache.get("teas");
          rebuildIndex(teas);
          return teas;
        }),

      recommend: (query: string, opts?: RecommendOpts) =>
        Effect.gen(function* () {
          if (!recommender) {
            const teas = yield* teaCache.get("teas");
            rebuildIndex(teas);
          }
          return recommender!.recommend(query, opts);
        }),
    };
  }),
);

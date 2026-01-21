import { Context, Duration, Effect, Layer, Schedule } from "effect";
import { NetworkError, ShopifyError, TimeoutError, ParseError } from "../errors.ts";
import { Product, decodeProductsResponse } from "../schemas/shopify.ts";

const MAX_PRODUCTS_PER_PAGE = 250;

const retryPolicy = Schedule.exponential(Duration.seconds(1)).pipe(
  Schedule.compose(Schedule.recurs(3)),
);

/**
 * HTTP client for fetching products from a Shopify storefront.
 * Handles pagination, retries with exponential backoff, and timeouts.
 */
export class ShopifyClient extends Context.Tag("ShopifyClient")<
  ShopifyClient,
  {
    /** Fetches a single page of products (up to 250). */
    getProducts: (
      baseUrl: string,
      page?: number,
    ) => Effect.Effect<readonly Product[], ShopifyError | ParseError | NetworkError | TimeoutError>;
    /** Fetches all products by paginating through the entire catalog. */
    getAllProducts: (
      baseUrl: string,
    ) => Effect.Effect<readonly Product[], ShopifyError | ParseError | NetworkError | TimeoutError>;
  }
>() {}

const fetchWithRetry = (
  url: string,
): Effect.Effect<Response, NetworkError | TimeoutError> =>
  Effect.tryPromise({
    try: () => fetch(url),
    catch: (error) =>
      new NetworkError({
        message: String(error),
        url,
      }),
  }).pipe(
    Effect.retry(retryPolicy),
    Effect.timeout(Duration.seconds(30)),
    Effect.catchTag("TimeoutException", () =>
      Effect.fail(
        new TimeoutError({
          message: "Request timed out after 30 seconds",
          url,
        }),
      )
    ),
  );

const getProductsImpl = (
  baseUrl: string,
  page = 1,
): Effect.Effect<readonly Product[], ShopifyError | ParseError | NetworkError | TimeoutError> =>
  Effect.gen(function* () {
    const url = `${baseUrl}/products.json?page=${page}&limit=${MAX_PRODUCTS_PER_PAGE}`;

    yield* Effect.logDebug(`Fetching products from ${url}`);

    const response = yield* fetchWithRetry(url);

    if (!response.ok) {
      return yield* Effect.fail(
        new ShopifyError({
          message: `HTTP ${response.status}: ${response.statusText}`,
          url,
        }),
      );
    }

    const json = yield* Effect.tryPromise({
      try: () => response.json(),
      catch: (error) =>
        new ShopifyError({
          message: `Failed to parse JSON: ${error}`,
          url,
        }),
    });

    const decoded = yield* decodeProductsResponse(json);

    yield* Effect.logDebug(`Fetched ${decoded.products.length} products from page ${page}`);

    return decoded.products;
  });

const getAllProductsImpl = (
  baseUrl: string,
): Effect.Effect<readonly Product[], ShopifyError | ParseError | NetworkError | TimeoutError> =>
  Effect.gen(function* () {
    const allProducts: Product[] = [];
    let page = 1;
    const MAX_PAGES = 100;

    yield* Effect.logInfo(`Fetching all products from ${baseUrl}`);

    while (page < MAX_PAGES) {
      const products = yield* getProductsImpl(baseUrl, page);
      if (products.length === 0) break;
      allProducts.push(...products);
      page += 1;
    }

    yield* Effect.logInfo(`Fetched ${allProducts.length} total products`);

    return allProducts;
  });

export const ShopifyClientLive = Layer.succeed(ShopifyClient, {
  getProducts: getProductsImpl,
  getAllProducts: getAllProductsImpl,
});

/** Checks if a Shopify product has a specific tag (handles both string and array formats). */
export function productHasTag(product: Product, tag: string): boolean {
  if (!product.tags) {
    return false;
  }
  if (typeof product.tags === "string") {
    return product.tags.includes(tag);
  }
  if (Array.isArray(product.tags)) {
    return product.tags.some((productTag) => productTag === tag);
  }
  return false;
}

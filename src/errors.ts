import { Data, ParseResult } from "effect";

/** Thrown when the Shopify API returns an error or unexpected response. */
export class ShopifyError extends Data.TaggedError("ShopifyError")<{
  message: string;
  url: string;
}> {}

/** Thrown when the Wikidata API returns an error or unexpected response. */
export class WikidataError extends Data.TaggedError("WikidataError")<{
  message: string;
  query: string;
}> {}

/** Thrown when a tea with the specified title cannot be found in the store. */
export class TeaNotFoundError extends Data.TaggedError("TeaNotFoundError")<{
  title: string;
}> {}

/** Thrown when a PocketBase operation fails (auth, query, update, etc.). */
export class PocketBaseError extends Data.TaggedError("PocketBaseError")<{
  message: string;
  operation: string;
}> {}

/** Thrown when a network request fails (connection error, DNS failure, etc.). */
export class NetworkError extends Data.TaggedError("NetworkError")<{
  message: string;
  url: string;
}> {}

/** Thrown when a network request exceeds the configured timeout. */
export class TimeoutError extends Data.TaggedError("TimeoutError")<{
  message: string;
  url: string;
}> {}

/** Re-exported from Effect for schema validation errors. */
export type ParseError = ParseResult.ParseError;

/** Thrown when data fails schema validation (e.g., invalid API response shape). */
export class ValidationError extends Data.TaggedError("ValidationError")<{
  message: string;
  issues: unknown[];
}> {}

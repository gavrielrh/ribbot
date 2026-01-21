import { Duration, Effect, Logger, LogLevel, Option, Schedule } from "effect";
import {
  NetworkError,
  ParseError,
  TimeoutError,
  WikidataError,
} from "../errors.ts";
import {
  decodeWikidataEntitiesResponse,
  decodeWikidataSearchResponse,
  decodeWikipediaRedirectResponse,
  WikidataEntity,
} from "../schemas/wikidata.ts";

const WIKIDATA_FAMILY_RANK_QID = "Q35409";
const MAX_LEVELS = 10;

export type PlantFamily = {
  family: string;
  label: string;
  description: string;
};

type TaxonInfo = {
  rankQid: string | null;
  parentQid: string | null;
  label: string | null;
};

// Retry policy for external API calls
const retryPolicy = Schedule.exponential(Duration.seconds(1)).pipe(
  Schedule.compose(Schedule.recurs(3)),
);

const fetchJson = (
  url: string,
): Effect.Effect<unknown, WikidataError | NetworkError | TimeoutError> =>
  Effect.tryPromise({
    try: async () => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    },
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
      )),
  );

const getTitleRedirect = (
  title: string,
): Effect.Effect<
  Option.Option<string>,
  WikidataError | NetworkError | TimeoutError | ParseError
> =>
  Effect.gen(function* () {
    const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${
      encodeURIComponent(title)
    }&redirects&format=json`;

    const json = yield* fetchJson(url);
    const decoded = yield* decodeWikipediaRedirectResponse(json);

    const redirects = decoded.query.redirects;
    return redirects?.[0]?.to ? Option.some(redirects[0].to) : Option.none();
  }).pipe(
    Effect.catchAll(() => Effect.succeed(Option.none())),
  );

const getTaxonInfo = (
  qid: string,
): Effect.Effect<
  Option.Option<TaxonInfo>,
  WikidataError | NetworkError | TimeoutError | ParseError
> =>
  Effect.gen(function* () {
    const url =
      `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&props=claims|labels&languages=en&format=json`;
    const json = yield* fetchJson(url);

    const decoded = yield* decodeWikidataEntitiesResponse(json);

    const entity = decoded.entities[qid];
    if (!entity || !entity.claims) return Option.none();

    const rankQid = entity.claims.P105?.[0]?.mainsnak?.datavalue?.value?.id ??
      null;
    const parentQid = entity.claims.P171?.[0]?.mainsnak?.datavalue?.value?.id ??
      null;
    const label = entity.labels?.en?.value ?? null;

    return Option.some({ rankQid, parentQid, label });
  }).pipe(
    Effect.catchTag("ParseError", () => Effect.succeed(Option.none())),
    Effect.catchAll(() => Effect.succeed(Option.none())),
  );

const fetchTaxonChain = (
  entity: WikidataEntity,
): Effect.Effect<
  PlantFamily[],
  WikidataError | NetworkError | TimeoutError | ParseError
> =>
  Effect.gen(function* () {
    let currentQid = entity.id;
    const families: PlantFamily[] = [];
    const seenQids = new Set<string>();

    for (let i = 0; i < MAX_LEVELS; i++) {
      if (seenQids.has(currentQid)) break;
      seenQids.add(currentQid);

      const taxonInfoOption = yield* getTaxonInfo(currentQid);
      if (Option.isNone(taxonInfoOption)) break;

      const taxonInfo = taxonInfoOption.value;

      if (taxonInfo.rankQid === WIKIDATA_FAMILY_RANK_QID && taxonInfo.label) {
        families.push({
          family: taxonInfo.label,
          label: entity.label,
          description: entity.description,
        });
      }

      if (!taxonInfo.parentQid) break;
      currentQid = taxonInfo.parentQid;
    }

    return families;
  });

const filterPlantEntities = (
  _term: string,
  entities: readonly WikidataEntity[],
): WikidataEntity[] => {
  return [...entities];
};

const logMultipleMatches = (
  entities: WikidataEntity[],
): Effect.Effect<void, never> =>
  Effect.logDebug(
    `Multiple plant-related results found: ${entities.length} matches`,
  );

const getEntitiesFromWikipediaTitle = (
  title: string,
): Effect.Effect<
  Option.Option<WikidataEntity[]>,
  WikidataError | NetworkError | TimeoutError | ParseError
> =>
  Effect.gen(function* () {
    let formattedTitle = title.replace(/\s+/g, "_").toLowerCase();
    formattedTitle = formattedTitle.charAt(0).toUpperCase() +
      formattedTitle.slice(1);

    const titleRedirectOption = yield* getTitleRedirect(formattedTitle);
    if (Option.isSome(titleRedirectOption)) {
      formattedTitle = titleRedirectOption.value;
    }

    const searchUrl =
      `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${
        encodeURIComponent(formattedTitle)
      }&language=en&limit=20&format=json`;

    const json = yield* fetchJson(searchUrl);
    const decoded = yield* decodeWikidataSearchResponse(json);

    const results = decoded.search;

    if (results.length > 0) {
      const plantEntities = filterPlantEntities(formattedTitle, results);
      if (plantEntities.length > 0) {
        if (plantEntities.length > 1) {
          yield* logMultipleMatches(plantEntities);
        }
        return Option.some(plantEntities);
      }
    }
    return Option.none();
  });

export const getPlantFamilies = (
  plantName: string,
): Effect.Effect<
  Option.Option<PlantFamily[]>,
  WikidataError | NetworkError | TimeoutError | ParseError
> =>
  Effect.gen(function* () {
    yield* Effect.logDebug(`Looking up plant families for: ${plantName}`);

    const entitiesOption = yield* getEntitiesFromWikipediaTitle(plantName);
    if (Option.isNone(entitiesOption)) return Option.none();

    const entities = entitiesOption.value;
    const results = yield* Effect.all(
      entities.map((entity) => fetchTaxonChain(entity)),
      { concurrency: "unbounded" },
    );

    const allFamilies: PlantFamily[] = [];
    results.forEach((families) => {
      allFamilies.push(...families);
    });

    yield* Effect.logDebug(
      `Found ${allFamilies.length} families for ${plantName}`,
    );

    return allFamilies.length > 0 ? Option.some(allFamilies) : Option.none();
  });

if (import.meta.main) {
  const plantName = Deno.args[0] || "Rose";
  const program = Effect.gen(function* () {
    const familiesOption = yield* getPlantFamilies(plantName);
    if (Option.isSome(familiesOption)) {
      yield* Effect.logInfo(`Families for "${plantName}":`);
      for (const [index, family] of familiesOption.value.entries()) {
        yield* Effect.logInfo(
          `${
            index + 1
          }: ${family.family} - ${family.label} - ${family.description}`,
        );
      }
    } else {
      yield* Effect.logInfo(`No families found for "${plantName}".`);
    }
  }).pipe(
    Effect.catchAll((error) =>
      Effect.logError("Failed to look up plant families", { error }).pipe(
        Effect.flatMap(() => Effect.sync(() => Deno.exit(1))),
      )
    ),
    Effect.provide(Logger.minimumLogLevel(LogLevel.Info)),
  );
  Effect.runPromise(program);
}

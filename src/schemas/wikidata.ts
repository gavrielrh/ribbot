import { Schema } from "effect";

export class WikidataEntity
  extends Schema.Class<WikidataEntity>("WikidataEntity")({
    id: Schema.String,
    label: Schema.String,
    description: Schema.optionalWith(Schema.String, { default: () => "" }),
  }) {}

export class WikidataSearchResponse
  extends Schema.Class<WikidataSearchResponse>("WikidataSearchResponse")({
    search: Schema.Array(WikidataEntity),
  }) {}

export class WikidataClaimValue
  extends Schema.Class<WikidataClaimValue>("WikidataClaimValue")({
    id: Schema.optional(Schema.String),
  }) {}

const WikidataDataValue = Schema.Struct({
  value: Schema.optional(WikidataClaimValue),
});

const WikidataMainsnak = Schema.Struct({
  datavalue: Schema.optional(WikidataDataValue),
});

export class WikidataClaim
  extends Schema.Class<WikidataClaim>("WikidataClaim")({
    mainsnak: Schema.optional(WikidataMainsnak),
  }) {}

const WikidataLabel = Schema.Struct({
  value: Schema.String,
});

const WikidataLabels = Schema.Struct({
  en: Schema.optional(WikidataLabel),
});

const WikidataClaims = Schema.Struct({
  P105: Schema.optional(Schema.Array(WikidataClaim)), // taxon rank
  P171: Schema.optional(Schema.Array(WikidataClaim)), // parent taxon
});

export class WikidataEntityDetail
  extends Schema.Class<WikidataEntityDetail>("WikidataEntityDetail")({
    claims: Schema.optional(WikidataClaims),
    labels: Schema.optional(WikidataLabels),
  }) {}

export class WikidataEntitiesResponse
  extends Schema.Class<WikidataEntitiesResponse>("WikidataEntitiesResponse")({
    entities: Schema.Record({
      key: Schema.String,
      value: WikidataEntityDetail,
    }),
  }) {}

const WikipediaRedirect = Schema.Struct({
  to: Schema.String,
});

const WikipediaQuery = Schema.Struct({
  redirects: Schema.optional(Schema.Array(WikipediaRedirect)),
});

export class WikipediaRedirectResponse
  extends Schema.Class<WikipediaRedirectResponse>("WikipediaRedirectResponse")({
    query: WikipediaQuery,
  }) {}

export const decodeWikidataSearchResponse = Schema.decodeUnknown(
  WikidataSearchResponse,
);
export const decodeWikidataEntitiesResponse = Schema.decodeUnknown(
  WikidataEntitiesResponse,
);
export const decodeWikipediaRedirectResponse = Schema.decodeUnknown(
  WikipediaRedirectResponse,
);

// deno run --allow-net=wikidata.org getPlantFamilies.ts

const WIKIDATA_FAMILY_RANK_QID = "Q35409"; // Family rank QID
const MAX_LEVELS = 10; // Limit the number of levels to traverse

// Function to get all plant families for the specified plant
export async function getPlantFamilies(
  plantName: string,
): Promise<{ family: string; label: string; description: string }[] | null> {
  try {
    // Search for the plant and retrieve its entity ID
    const entities = await getEntitiesFromWikipediaTitle(plantName);
    if (!entities) return null;

    const allFamilies: {
      family: string;
      label: string;
      description: string;
    }[] = [];
    const entityPromises = entities.map((entity) => fetchTaxonChain(entity));

    // Wait for all entity taxon chains to be processed in parallel
    const results = await Promise.all(entityPromises);

    // Collect all families found in the results
    results.forEach((families) => {
      if (families) allFamilies.push(...families);
    });

    return allFamilies.length > 0 ? allFamilies : null;
  } catch (error) {
    console.error(`Error retrieving families for "${plantName}":`, error);
    return null;
  }
}

// Function to traverse the taxon chain for an entity and find all families
async function fetchTaxonChain(
  entity: any,
): Promise<{ family: string; label: string; description: string }[] | null> {
  let currentQid = entity.id;
  const families: { family: string; label: string; description: string }[] = [];
  const seenQids = new Set<string>();

  for (let i = 0; i < MAX_LEVELS; i++) {
    // Prevent revisiting the same QID
    if (seenQids.has(currentQid)) break;
    seenQids.add(currentQid);

    const taxonInfo = await getTaxonInfo(currentQid);
    if (!taxonInfo) return null;

    // If the rank is "family", store the family in the list
    if (taxonInfo.rankQid === WIKIDATA_FAMILY_RANK_QID) {
      families.push({
        family: taxonInfo.label!,
        label: entity.label,
        description: entity.description,
      });
    }

    if (!taxonInfo.parentQid) break; // No more parent
    currentQid = taxonInfo.parentQid;
  }

  return families.length > 0 ? families : null;
}

// Function to get the redirect information based on the title
async function getTitleRedirect(title: string): Promise<string | null> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${
    encodeURIComponent(title)
  }&redirects&format=json`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    const redirects = data.query.redirects;
    return redirects[0]?.to ?? null;
  } catch (err) {
    return null;
  }
}

// Function to search for entities related to the plant name and retrieve the entity IDs
async function getEntitiesFromWikipediaTitle(
  title: string,
): Promise<any[] | null> {
  let formattedTitle = title.replace(/\s+/g, "_").toLowerCase();
  formattedTitle = formattedTitle.charAt(0).toUpperCase() +
    formattedTitle.slice(1);
  const titleRedirect = await getTitleRedirect(formattedTitle);
  if (titleRedirect) {
    formattedTitle = titleRedirect;
  }

  const searchUrl =
    `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${
      encodeURIComponent(
        formattedTitle,
      )
    }&language=en&limit=20&format=json`;

  const searchResults = await fetchJson(searchUrl);

  if (searchResults.search.length > 0) {
    const plantEntities = filterPlantEntities(
      formattedTitle,
      searchResults.search,
    );
    if (plantEntities.length > 0) {
      if (plantEntities.length > 1) {
        logMultipleMatches(plantEntities);
      }
      return plantEntities || null;
    }
  }
  return null;
}

// Function to handle fetching JSON data
async function fetchJson(url: string): Promise<any> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch data from ${url}`);
  return await response.json();
}

// Function to filter plant-related entities based on label or description
function filterPlantEntities(term: string, entities: any[]): any[] {
  return entities;
}

// Function to log multiple plant-related matches
function logMultipleMatches(entities: any[]): void {
  console.log(`Multiple plant-related results found:`);
  entities.forEach((entity, index) => {
    console.log(`${index + 1}: ${entity.label} - ${entity.description}`);
  });
  console.log("Selecting the first match...");
}

// Function to retrieve taxon information (rank, parent, label) for a given QID
async function getTaxonInfo(
  qid: string,
): Promise<
  | { rankQid: string | null; parentQid: string | null; label: string | null }
  | null
> {
  const url =
    `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&props=claims|labels&languages=en&format=json`;
  const data = await fetchJson(url);

  const entity = data?.entities?.[qid];
  if (!entity || !entity.claims) return null;

  const rankQid = getWikidataClaimValue(entity.claims.P105);
  const parentQid = getWikidataClaimValue(entity.claims.P171);
  const label = entity.labels?.en?.value || null;

  return { rankQid, parentQid, label };
}

// Utility function to extract the first valid value (ID) from a Wikidata claim
function getWikidataClaimValue(claimArray: any[]): string | null {
  const claim = claimArray?.[0]?.mainsnak?.datavalue?.value;
  return claim?.id || null;
}

// Allow running via CLI
if (import.meta.main) {
  const plantName = Deno.args[0] || "Rose";
  getPlantFamilies(plantName).then((families) => {
    if (families) {
      console.log(`Families for "${plantName}":`);
      families.forEach((family, index) => {
        console.log(
          `${
            index + 1
          }: ${family.family} - ${family.label} - ${family.description}`,
        );
      });
    } else {
      console.log(`No families found for "${plantName}".`);
    }
  }).catch((err) => {
    console.error(err);
    Deno.exit(1);
  });
}

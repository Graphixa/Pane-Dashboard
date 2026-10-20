import generatedEntries from "./catalogue.generated.json";
import {
  mapCatalogueJson,
  type CatalogueEntry,
  type GeneratedCatalogueEntry,
} from "./mapUpstreamMetadata";

/**
 * Full native Dashboard Icons index shipped with the release. Import only via
 * `ensureCatalogue()` so the dashboard entry chunk does not embed this JSON.
 */
export const fullCatalogueEntries: readonly CatalogueEntry[] = mapCatalogueJson(
  generatedEntries as GeneratedCatalogueEntry[],
);

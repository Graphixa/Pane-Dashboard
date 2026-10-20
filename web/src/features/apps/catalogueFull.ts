import generatedEntries from "./catalogue.generated.json";
import {
  mapCatalogueJson,
  type GeneratedCatalogueEntry,
  type MappedCatalogueEntry,
} from "./catalogueMap";

/**
 * Full native Dashboard Icons index. Import only via `ensureFullCatalogue()` so
 * the dashboard entry chunk does not embed this JSON.
 */
export const fullCatalogueEntries: readonly MappedCatalogueEntry[] =
  mapCatalogueJson(generatedEntries as GeneratedCatalogueEntry[]);

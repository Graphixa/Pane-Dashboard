import { beforeEach, describe, expect, it } from "vitest";
import {
  appendRevealCount,
  applyCatalogueTileSelection,
  catalogueEntry,
  catalogueEntryForIcon,
  catalogueMatchesQuery,
  DASHBOARD_ICONS_REF,
  ensureFullCatalogue,
  filterCatalogueEntries,
  getActiveCatalogue,
  iconURL,
  initialRevealCount,
  isFullCatalogueReady,
  normalizeCatalogueSearch,
  orderCatalogueEntries,
  popularCatalogueEntries,
  resetCatalogueCacheForTests,
  resolveArtworkSlug,
  resolveIconFormat,
  slugToDisplayName,
  suggestIcon,
} from "./appCatalogue";
import { fullCatalogueEntries } from "./catalogueFull";
import { popularSlugs } from "./popularSlugs";

beforeEach(() => {
  resetCatalogueCacheForTests();
});

describe("catalogue metadata", () => {
  it("ships a popular seed without embedding the full index in the seed list", () => {
    expect(popularCatalogueEntries.length).toBeGreaterThan(40);
    expect(popularCatalogueEntries.length).toBeLessThan(200);
    expect(
      popularCatalogueEntries.some(
        (e) => e.slug.endsWith("-light") || e.slug.endsWith("-dark"),
      ),
    ).toBe(false);
    expect(getActiveCatalogue()).toBe(popularCatalogueEntries);
    expect(isFullCatalogueReady()).toBe(false);
  });

  it("lazy-loads the full catalogue chunk once", async () => {
    const full = await ensureFullCatalogue();
    expect(full.length).toBeGreaterThan(1000);
    expect(full).toBe(fullCatalogueEntries);
    expect(isFullCatalogueReady()).toBe(true);
    expect(getActiveCatalogue()).toBe(full);
    expect(await ensureFullCatalogue()).toBe(full);
    expect(
      full.some(
        (e) => e.slug.endsWith("-light") || e.slug.endsWith("-dark"),
      ),
    ).toBe(false);
  });

  it("derives display names from slug title-casing", () => {
    expect(slugToDisplayName("adguard-home")).toBe("Adguard Home");
    expect(slugToDisplayName("pi-hole")).toBe("Pi Hole");
    expect(slugToDisplayName("home-assistant")).toBe("Home Assistant");
    expect(catalogueEntry("adguard-home")?.displayName).toBe("Adguard Home");
  });

  it("matches search against slug, display name and aliases", async () => {
    await ensureFullCatalogue();
    const adguard = catalogueEntry("adguard-home")!;
    expect(catalogueMatchesQuery(adguard, "")).toBe(true);
    expect(catalogueMatchesQuery(adguard, "adguard")).toBe(true);
    expect(catalogueMatchesQuery(adguard, "Home")).toBe(true);
    expect(catalogueMatchesQuery(adguard, "zzz")).toBe(false);
    expect(catalogueMatchesQuery(catalogueEntry("pi-hole")!, "pihole")).toBe(
      true,
    );
  });

  it("normalises whitespace and separators for the same entry", () => {
    const adguard = catalogueEntry("adguard-home")!;
    expect(normalizeCatalogueSearch("AdGuard Home")).toBe("adguardhome");
    expect(normalizeCatalogueSearch("adguard-home")).toBe("adguardhome");
    expect(catalogueMatchesQuery(adguard, "AdGuard Home")).toBe(true);
    expect(catalogueMatchesQuery(adguard, "adguard-home")).toBe(true);
    expect(catalogueMatchesQuery(adguard, "adguardhome")).toBe(true);
    expect(catalogueMatchesQuery(adguard, "ad_guard home")).toBe(true);
  });

  it("orders popular pins first then alphabetical for empty query", async () => {
    await ensureFullCatalogue();
    const ordered = orderCatalogueEntries(getActiveCatalogue(), "");
    const pinsPresent = popularSlugs.filter((slug) => catalogueEntry(slug));
    expect(ordered.slice(0, pinsPresent.length).map((e) => e.slug)).toEqual(
      pinsPresent,
    );
    const afterPins = ordered.slice(pinsPresent.length);
    const afterSlugs = afterPins.map((e) => e.slug);
    expect(afterSlugs).toEqual([...afterSlugs].sort((a, b) => a.localeCompare(b)));
  });

  it("filters then ranks popular matches first when querying", async () => {
    await ensureFullCatalogue();
    const catalogue = getActiveCatalogue();
    const home = orderCatalogueEntries(catalogue, "home");
    expect(home.every((e) => catalogueMatchesQuery(e, "home"))).toBe(true);
    const pinHits = popularSlugs.filter((slug) =>
      home.some((e) => e.slug === slug),
    );
    expect(home.slice(0, pinHits.length).map((e) => e.slug)).toEqual(pinHits);
    expect(filterCatalogueEntries(catalogue, "zzz-no-match")).toEqual([]);
  });

  it("resolves artwork variants with base fallback", () => {
    const withVariants: Parameters<typeof resolveArtworkSlug>[0] = {
      slug: "demo",
      variants: { light: "demo-light", dark: "demo-dark" },
    };
    expect(resolveArtworkSlug(withVariants, "default")).toBe("demo");
    expect(resolveArtworkSlug(withVariants, "light")).toBe("demo-light");
    expect(resolveArtworkSlug(withVariants, "dark")).toBe("demo-dark");
    expect(resolveArtworkSlug({ slug: "plain" }, "light")).toBe("plain");
  });

  it("finds base entries from variant icon references", async () => {
    await ensureFullCatalogue();
    const entry = getActiveCatalogue().find((e) => e.variants?.light);
    expect(entry).toBeTruthy();
    const icon = `dashboard-icons:${entry!.variants!.light}`;
    expect(catalogueEntryForIcon(icon)?.slug).toBe(entry!.slug);
  });

  it("computes reveal budgets without skipping or reordering", () => {
    expect(initialRevealCount(100, 4, 3)).toBe(24);
    expect(initialRevealCount(10, 4, 3)).toBe(10);
    expect(appendRevealCount(24, 100, 4, 3)).toBe(36);
    expect(appendRevealCount(96, 100, 4, 3)).toBe(100);
  });
});

describe("applyCatalogueTileSelection", () => {
  const adguard = { slug: "adguard-home", displayName: "Adguard Home" };
  const plex = { slug: "plex", displayName: "Plex" };

  it.each([
    {
      label: "empty string",
      previousName: "",
      entry: adguard,
      expectedName: "Adguard Home",
    },
    {
      label: "spaces and tabs only",
      previousName: " \t  ",
      entry: adguard,
      expectedName: "Adguard Home",
    },
    {
      label: "custom typed name",
      previousName: "My DNS Server",
      entry: adguard,
      expectedName: "My DNS Server",
    },
    {
      label: "previously auto-filled name",
      previousName: "Plex",
      entry: adguard,
      expectedName: "Plex",
    },
    {
      label: "leading and trailing spaces preserved",
      previousName: "  Plex  ",
      entry: adguard,
      expectedName: "  Plex  ",
    },
  ])("$label", ({ previousName, entry, expectedName }) => {
    const previous = {
      id: "a1",
      name: previousName,
      url: "https://keep.example",
      icon: "dashboard-icons:plex",
      col: 2,
      row: 1,
      openInNewTab: false,
    };
    const next = applyCatalogueTileSelection(previous, entry);
    expect(next).toEqual({
      ...previous,
      icon: `dashboard-icons:${entry.slug}`,
      name: expectedName,
    });
  });

  it("persists a resolved artwork slug when provided", () => {
    const previous = { name: "", icon: "" };
    const next = applyCatalogueTileSelection(
      previous,
      { slug: "github", displayName: "Github" },
      "github-light",
    );
    expect(next.icon).toBe("dashboard-icons:github-light");
    expect(next.name).toBe("Github");
  });

  it("cleared name re-enables autofill on the next selection", () => {
    let draft = {
      name: "",
      icon: "",
      url: "",
      openInNewTab: true,
    };
    draft = applyCatalogueTileSelection(draft, plex);
    expect(draft.name).toBe("Plex");
    draft = { ...draft, name: "" };
    draft = applyCatalogueTileSelection(draft, adguard);
    expect(draft.name).toBe("Adguard Home");
    expect(draft.icon).toBe("dashboard-icons:adguard-home");
  });
});

describe("icon helpers", () => {
  it("builds pinned dashboard-icons CDN URLs for svg and png bases", () => {
    expect(DASHBOARD_ICONS_REF.length).toBeGreaterThan(7);
    expect(resolveIconFormat("plex")).toBe("svg");
    expect(resolveIconFormat("agentaia")).toBe("png");
    expect(iconURL("dashboard-icons:plex")).toBe(
      `https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons@${DASHBOARD_ICONS_REF}/svg/plex.svg`,
    );
    expect(iconURL("dashboard-icons:agentaia")).toBe(
      `https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons@${DASHBOARD_ICONS_REF}/png/agentaia.png`,
    );
    expect(iconURL("https://example.com/icon.png")).toBe(
      "https://example.com/icon.png",
    );
  });

  it("suggests catalogue slug matches for Docker import after full load", async () => {
    expect(suggestIcon("Plex")).toBe("dashboard-icons:plex");
    await ensureFullCatalogue();
    expect(suggestIcon("", "ghcr.io/linuxserver/sonarr:latest")).toBe(
      "dashboard-icons:sonarr",
    );
    expect(suggestIcon("pihole")).toBe("dashboard-icons:pi-hole");
    expect(suggestIcon("unknown-service")).toBe("");
  });
});

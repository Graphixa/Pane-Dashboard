// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  alternateIconFormat,
  appendRevealCount,
  applyCatalogueTileSelection,
  catalogueEntry,
  catalogueEntryForIcon,
  catalogueMatchesQuery,
  DASHBOARD_ICONS_REF,
  ensureCatalogue,
  filterCatalogueEntries,
  getActiveCatalogue,
  iconURL,
  iconURLForFormat,
  initialRevealCount,
  METADATA_URL,
  normalizeCatalogueSearch,
  orderCatalogueEntries,
  popularCatalogueEntries,
  refreshCatalogueIfStale,
  resetCatalogueCacheForTests,
  resolveArtworkSlug,
  resolveIconFormat,
  slugToDisplayName,
  suggestIcon,
} from "./appCatalogue";
import {
  CATALOGUE_CACHE_KEY,
  CATALOGUE_CACHE_TTL_MS,
  clearCatalogueCache,
  readCatalogueCache,
  writeCatalogueCache,
} from "./catalogueCache";
import { fullCatalogueEntries } from "./catalogueFull";
import { mapUpstreamMetadata } from "./mapUpstreamMetadata";

beforeEach(() => {
  resetCatalogueCacheForTests();
  clearCatalogueCache();
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
  });

  it("loads the release baseline via ensureCatalogue once", async () => {
    const full = await ensureCatalogue();
    expect(full.length).toBeGreaterThan(1000);
    expect(full).toBe(fullCatalogueEntries);
    expect(getActiveCatalogue()).toBe(full);
    expect(await ensureCatalogue()).toBe(full);
    expect(
      full.some(
        (e) => e.slug.endsWith("-light") || e.slug.endsWith("-dark"),
      ),
    ).toBe(false);
  });

  it("uses a fresh localStorage cache before the bundled chunk", async () => {
    const cached = [
      {
        slug: "cached-app",
        displayName: "Cached App",
        format: "svg" as const,
      },
    ];
    writeCatalogueCache(cached, Date.now());
    const full = await ensureCatalogue();
    expect(full).toEqual(cached);
    expect(getActiveCatalogue()).toEqual(cached);
  });

  it("derives display names from slug title-casing", () => {
    expect(slugToDisplayName("adguard-home")).toBe("Adguard Home");
    expect(slugToDisplayName("pi-hole")).toBe("Pi Hole");
    expect(slugToDisplayName("home-assistant")).toBe("Home Assistant");
    expect(catalogueEntry("adguard-home")?.displayName).toBe("Adguard Home");
  });

  it("matches search against slug, display name and aliases", async () => {
    await ensureCatalogue();
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
    await ensureCatalogue();
    const ordered = orderCatalogueEntries(getActiveCatalogue(), "");
    const pinsPresent = popularCatalogueEntries
      .map((e) => e.slug)
      .filter((slug) => catalogueEntry(slug));
    expect(ordered.slice(0, pinsPresent.length).map((e) => e.slug)).toEqual(
      pinsPresent,
    );
    const afterPins = ordered.slice(pinsPresent.length);
    const afterSlugs = afterPins.map((e) => e.slug);
    expect(afterSlugs).toEqual([...afterSlugs].sort((a, b) => a.localeCompare(b)));
  });

  it("filters then ranks popular matches first when querying", async () => {
    await ensureCatalogue();
    const catalogue = getActiveCatalogue();
    const home = orderCatalogueEntries(catalogue, "home");
    expect(home.every((e) => catalogueMatchesQuery(e, "home"))).toBe(true);
    const pinHits = popularCatalogueEntries
      .map((e) => e.slug)
      .filter((slug) => home.some((e) => e.slug === slug));
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
    await ensureCatalogue();
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

describe("catalogue refresh", () => {
  it("maps upstream metadata like the icon generator", () => {
    const entries = mapUpstreamMetadata({
      plex: { base: "svg", aliases: ["Plex Media Server"] },
      algo: { base: "png" },
      "algo-light": { base: "png" },
      "weird_slug": { base: "svg" },
    });
    expect(entries.map((e) => e.slug)).toEqual(["algo", "plex"]);
    expect(entries.find((e) => e.slug === "algo")?.format).toBe("png");
    expect(entries.find((e) => e.slug === "plex")?.aliases).toEqual([
      "Plex Media Server",
    ]);
  });

  it("skips refresh when the localStorage cache is fresh", async () => {
    writeCatalogueCache(
      [{ slug: "fresh", displayName: "Fresh", format: "svg" }],
      Date.now(),
    );
    const fetchImpl = vi.fn();
    expect(await refreshCatalogueIfStale(fetchImpl)).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(getActiveCatalogue()[0]?.slug).toBe("fresh");
  });

  it("fetches metadata when the cache is stale and updates the active catalogue", async () => {
    writeCatalogueCache(
      [{ slug: "old", displayName: "Old", format: "svg" }],
      Date.now() - CATALOGUE_CACHE_TTL_MS - 1,
    );
    await ensureCatalogue();
    expect(getActiveCatalogue()).toBe(fullCatalogueEntries);

    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        refreshed: { base: "png", aliases: ["Refreshed App"] },
        plex: { base: "svg" },
      }),
    })) as unknown as typeof fetch;

    const now = Date.now();
    const result = await refreshCatalogueIfStale(fetchImpl, now);
    expect(fetchImpl).toHaveBeenCalledWith(METADATA_URL);
    expect(result?.map((e) => e.slug)).toEqual(["plex", "refreshed"]);
    expect(getActiveCatalogue()).toBe(result);
    expect(resolveIconFormat("refreshed")).toBe("png");
    const stored = readCatalogueCache(undefined, now);
    expect(stored?.fresh).toBe(true);
    expect(stored?.payload.fetchedAt).toBe(now);
    expect(localStorage.getItem(CATALOGUE_CACHE_KEY)).toBeTruthy();
  });

  it("keeps the release baseline when refresh fails", async () => {
    await ensureCatalogue();
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 503,
    })) as unknown as typeof fetch;
    expect(await refreshCatalogueIfStale(fetchImpl)).toBeNull();
    expect(getActiveCatalogue()).toBe(fullCatalogueEntries);
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
  it("builds unpinned jsDelivr artwork URLs for svg and png bases", () => {
    expect(DASHBOARD_ICONS_REF.length).toBeGreaterThan(7);
    expect(resolveIconFormat("plex")).toBe("svg");
    expect(resolveIconFormat("agentaia")).toBe("png");
    expect(resolveIconFormat("algo")).toBe("png");
    expect(alternateIconFormat("svg")).toBe("png");
    expect(alternateIconFormat("png")).toBe("svg");
    expect(iconURL("dashboard-icons:plex")).toBe(
      "https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/plex.svg",
    );
    expect(iconURL("dashboard-icons:agentaia")).toBe(
      "https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/png/agentaia.png",
    );
    expect(iconURL("dashboard-icons:algo")).toBe(
      "https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/png/algo.png",
    );
    expect(iconURLForFormat("plex", "png")).toBe(
      "https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/png/plex.png",
    );
    expect(iconURL("https://example.com/icon.png")).toBe(
      "https://example.com/icon.png",
    );
  });

  it("suggests catalogue slug matches for Docker import after full load", async () => {
    expect(suggestIcon("Plex")).toBe("dashboard-icons:plex");
    await ensureCatalogue();
    expect(suggestIcon("", "ghcr.io/linuxserver/sonarr:latest")).toBe(
      "dashboard-icons:sonarr",
    );
    expect(suggestIcon("pihole")).toBe("dashboard-icons:pi-hole");
    expect(suggestIcon("unknown-service")).toBe("");
  });
});

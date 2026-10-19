import { describe, expect, it } from "vitest";
import {
  appendRevealCount,
  applyCatalogueTileSelection,
  catalogue,
  catalogueEntries,
  catalogueEntry,
  catalogueMatchesQuery,
  filterCatalogueEntries,
  iconURL,
  initialRevealCount,
  normalizeCatalogueSearch,
  suggestIcon,
} from "./icons";

describe("catalogue metadata", () => {
  it("keeps slug list aligned with curated entries", () => {
    expect(catalogue).toEqual(catalogueEntries.map((e) => e.slug));
    expect(new Set(catalogue).size).toBe(catalogue.length);
  });

  it("uses intentional product casing for well-known apps", () => {
    expect(catalogueEntry("adguard-home")?.displayName).toBe("AdGuard Home");
    expect(catalogueEntry("home-assistant")?.displayName).toBe("Home Assistant");
    expect(catalogueEntry("pihole")?.displayName).toBe("Pi-hole");
    expect(catalogueEntry("github")?.displayName).toBe("GitHub");
    expect(catalogueEntry("qbittorrent")?.displayName).toBe("qBittorrent");
  });

  it("matches search against slug, display name and aliases", () => {
    const adguard = catalogueEntry("adguard-home")!;
    expect(catalogueMatchesQuery(adguard, "")).toBe(true);
    expect(catalogueMatchesQuery(adguard, "adguard")).toBe(true);
    expect(catalogueMatchesQuery(adguard, "Home")).toBe(true);
    expect(catalogueMatchesQuery(adguard, "zzz")).toBe(false);
    expect(catalogueMatchesQuery(catalogueEntry("pihole")!, "pi-hole")).toBe(
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

  it("filters the full catalogue in deterministic order", () => {
    const empty = filterCatalogueEntries(catalogueEntries, "");
    expect(empty.map((e) => e.slug)).toEqual(catalogue);
    const home = filterCatalogueEntries(catalogueEntries, "home");
    expect(home.map((e) => e.slug)).toEqual(
      catalogueEntries
        .filter((e) => catalogueMatchesQuery(e, "home"))
        .map((e) => e.slug),
    );
    expect(filterCatalogueEntries(catalogueEntries, "zzz-no-match")).toEqual(
      [],
    );
  });

  it("computes reveal budgets without skipping or reordering", () => {
    expect(initialRevealCount(100, 4, 3)).toBe(24);
    expect(initialRevealCount(10, 4, 3)).toBe(10);
    expect(appendRevealCount(24, 100, 4, 3)).toBe(36);
    expect(appendRevealCount(96, 100, 4, 3)).toBe(100);
  });
});

describe("applyCatalogueTileSelection", () => {
  const adguard = { slug: "adguard-home", displayName: "AdGuard Home" };
  const plex = { slug: "plex", displayName: "Plex" };

  it.each([
    {
      label: "empty string",
      previousName: "",
      entry: adguard,
      expectedName: "AdGuard Home",
    },
    {
      label: "spaces and tabs only",
      previousName: " \t  ",
      entry: adguard,
      expectedName: "AdGuard Home",
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
    expect(draft.name).toBe("AdGuard Home");
    expect(draft.icon).toBe("dashboard-icons:adguard-home");
  });
});

describe("icon helpers", () => {
  it("builds dashboard-icons CDN URLs and passes through custom URLs", () => {
    expect(iconURL("dashboard-icons:plex")).toBe(
      "https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/plex.svg",
    );
    expect(iconURL("https://example.com/icon.png")).toBe(
      "https://example.com/icon.png",
    );
  });

  it("suggests exact catalogue slug matches for Docker import", () => {
    expect(suggestIcon("Plex")).toBe("dashboard-icons:plex");
    expect(suggestIcon("", "ghcr.io/linuxserver/sonarr:latest")).toBe(
      "dashboard-icons:sonarr",
    );
    expect(suggestIcon("unknown-service")).toBe("");
  });
});

import { useEffect, useState } from "react";
import type { Config } from "./model";
import { logoReference } from "./appearance";
import {
  brandShowsIcon,
  brandShowsTitle,
  resolveBuiltinIcon,
} from "./brandIcons";

export function HeaderBrand({ dashboard }: { dashboard: Config["dashboard"] }) {
  const [iconFailed, setIconFailed] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  useEffect(() => setIconFailed(false), [dashboard.icon]);
  useEffect(() => setLogoFailed(false), [dashboard.logo]);

  const name = dashboard.title.trim() || "pane.";
  const iconUrl =
    logoReference(dashboard.icon) && dashboard.icon ? dashboard.icon : undefined;
  const logoUrl =
    logoReference(dashboard.logo) && dashboard.logo ? dashboard.logo : undefined;
  const showIcon = brandShowsIcon(dashboard);
  const showWideLogo = Boolean(logoUrl) && !logoFailed;
  // Logo failure falls back to title when showTitle allows it (ignore logo presence).
  const showTitle =
    showWideLogo
      ? false
      : logoUrl && logoFailed
        ? dashboard.showTitle !== false
        : brandShowsTitle(dashboard);
  const Builtin = resolveBuiltinIcon(dashboard.builtinIcon);

  return (
    <>
      {showIcon ? (
        <span className="brand-mark" aria-hidden="true">
          {iconUrl && !iconFailed ? (
            <img
              src={iconUrl}
              alt=""
              referrerPolicy="no-referrer"
              onError={() => setIconFailed(true)}
            />
          ) : (
            <Builtin size={23} />
          )}
        </span>
      ) : null}
      {showWideLogo ? (
        <img
          className="brand-logo"
          src={logoUrl}
          alt={name}
          referrerPolicy="no-referrer"
          onError={() => setLogoFailed(true)}
        />
      ) : showTitle ? (
        <span className="brand-name" title={name}>
          {name}
        </span>
      ) : null}
    </>
  );
}

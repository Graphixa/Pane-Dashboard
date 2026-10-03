import { useEffect, useState } from "react";
import { LayoutGrid, Server, PanelsTopLeft } from "lucide-react";
import type { Config } from "./model";
import { imageReference } from "./appearance";

export function HeaderBrand({ dashboard }: { dashboard: Config["dashboard"] }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [dashboard.logo]);
  const name = dashboard.title.trim() || "pane.",
    url = imageReference(dashboard.logo) ? dashboard.logo : undefined;
  if (dashboard.branding === "logo" && url && !failed)
    return (
      <img
        className="brand-logo"
        src={url}
        alt={name}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    );
  const mark = url && dashboard.branding !== "logo" && !failed ? url : undefined;
  return (
    <>
      <span className="brand-mark" aria-hidden="true">
        {mark ? (
          <img
            src={mark}
            alt=""
            referrerPolicy="no-referrer"
            onError={() => setFailed(true)}
          />
        ) : dashboard.builtinIcon === "server" ? (
          <Server size={23} />
        ) : dashboard.builtinIcon === "panels" ? (
          <PanelsTopLeft size={23} />
        ) : (
          <LayoutGrid size={23} />
        )}
      </span>
      <span className="brand-name" title={name}>
        {name}
      </span>
    </>
  );
}

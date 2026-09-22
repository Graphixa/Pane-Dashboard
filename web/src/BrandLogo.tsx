import { useEffect, useState } from "react";
import { LayoutGrid, Server, PanelsTopLeft } from "lucide-react";
import type { Config } from "./model";
import { imageReference } from "./appearance";

export default function BrandLogo({
  url,
  builtin = "grid",
}: {
  url?: string;
  builtin?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  return (
    <span className="brand-mark" aria-hidden="true">
      {url && !failed ? (
        <img
          src={url}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : builtin === "server" ? (
        <Server size={23} />
      ) : builtin === "panels" ? (
        <PanelsTopLeft size={23} />
      ) : (
        <LayoutGrid size={23} />
      )}
    </span>
  );
}

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
  return (
    <>
      <BrandLogo
        url={dashboard.branding === "logo" ? undefined : url}
        builtin={dashboard.builtinIcon}
      />
      <span className="brand-name" title={name}>
        {name}
      </span>
    </>
  );
}

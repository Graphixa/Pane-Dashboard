import { useEffect, useState } from "react";
import { LayoutGrid } from "lucide-react";

export default function BrandLogo({ url }: { url?: string }) {
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
      ) : (
        <LayoutGrid size={23} />
      )}
    </span>
  );
}

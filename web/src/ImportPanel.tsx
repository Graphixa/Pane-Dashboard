import { useConfirmation } from "./design/components";
import { Button, FieldGroup, Label, Input, Checkbox, Select, SelectOption, Notice, Text, TextField, SelectField } from "./design/components";
import { useState } from "react";
import { parse } from "yaml";
import {
  App,
  Config,
  Pane,
  clone,
  freePosition,
  importApps,
  uid,
  validate,
} from "./model";
import {
  ensureCatalogue,
  refreshCatalogueIfStale,
  suggestIcon,
} from "./features/apps/appCatalogue";
type Candidate = {
  id: string;
  name: string;
  image: string;
  ports: { ip: string; port: number; privatePort: number }[];
};
type Selection = Candidate & { selected: boolean; url: string; icon: string };
async function previewConfig(data: unknown): Promise<Config> {
  const res = await fetch("/api/import/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const body = await res.json();
  if (!res.ok) throw Error(body.error || "Import could not be validated");
  validate(body);
  return body;
}
function address(host: string, port: number) {
  const h = host.trim();
  if (!h || /[\s/?#@]/.test(h)) return "";
  const bracketed = h.includes(":") && !h.startsWith("[") ? `[${h}]` : h;
  return `http://${bracketed}:${port}`;
}
export default function ImportPanel({
  config,
  imported,
  disabled = false,
}: {
  config: Config;
  imported: (c: Config, id?: string) => void;
  disabled?: boolean;
}) {
  const { confirm, confirmation } = useConfirmation();
const [source, setSource] = useState("file"),
    [error, setError] = useState(""),
    [preview, setPreview] = useState<Config | null>(null),
    [replacement, setReplacement] = useState(false),
    [host, setHost] = useState(window.location.hostname),
    [apps, setApps] = useState<Selection[]>([]),
    [busy, setBusy] = useState(false),
    [enabled, setEnabled] = useState<boolean | null>(null),
    [destination, setDestination] = useState("new"),
    [title, setTitle] = useState("");
  const scan = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/discovery/docker");
      const body = await r.json();
      if (!r.ok) throw Error(body.error);
      setEnabled(body.enabled);
      try {
        await ensureCatalogue();
        await refreshCatalogueIfStale();
      } catch {
        /* Seed catalogue still allows common icon suggestions. */
      }
      setApps(
        body.apps.map((a: Candidate) => ({
          ...a,
          selected: false,
          url: a.ports[0] ? address(host, a.ports[0].port) : "",
          icon: suggestIcon(a.name, a.image),
        })),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const patch = (i: number, update: Partial<Selection>) =>
    setApps(apps.map((a, j) => (j === i ? { ...a, ...update } : a)));
  return (
    <> {confirmation} <FieldGroup disabled={disabled}><div className="import-panel">
      <div
        className="choice-row finish-choices import-source"
        role="group"
        aria-label="Import source"
      >
        <Button
          type="button"
          aria-pressed={source === "file"}
          onClick={() => setSource("file")}
        >
          Layout file
        </Button>
        <Button
          type="button"
          aria-pressed={source === "docker"}
          onClick={() => setSource("docker")}
        >
          Docker
        </Button>
      </div>
      {source === "file" ? (
        <>
          <p className="section-description">
            Import a dashboard backup or shared pane template.
          </p>
          <Label>
            YAML or JSON file
            <Input
              type="file"
              accept=".yaml,.yml,.json"
              onChange={async (e) => {
                setPreview(null);
                setError("");
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  if (f.size > 8 * 1024 * 1024)
                    throw Error("File exceeds 8 MiB.");
                  const data = parse(await f.text(), { maxAliasCount: 0 });
                  if (data?.type === "pane-layout") {
                    if (
                      ![1, 2].includes(data.version) ||
                      Object.keys(data).some(
                        (k) =>
                          ![
                            "type",
                            "version",
                            "pane",
                            "appSize",
                            "width",
                          ].includes(k),
                      )
                    )
                      throw Error("Unsupported pane template.");
                    const test = await previewConfig({
                      ...config,
                      version: data.version,
                      dashboard: { ...config.dashboard, width: data.width },
                      appearance: {
                        ...config.appearance,
                        ...(data.version === 1
                          ? { appSize: data.appSize }
                          : {}),
                      },
                      items: [data.pane],
                    });
                    const p: Pane = clone(test.items[0]);
                    p.id = uid();
                    p.apps = p.apps.map((a) => ({
                      ...a,
                      id: uid(),
                      source: undefined,
                    }));
                    p.layout = freePosition(
                      config.items,
                      p.layout.w,
                      p.layout.h,
                      config.dashboard.width,
                    );
                    const n = clone(config);
                    n.items.push(p);
                    validate(n);
                    setPreview(n);
                    setReplacement(false);
                  } else {
                    setPreview(await previewConfig(data));
                    setReplacement(true);
                  }
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            />
          </Label>
          {preview && (
            <Notice>
              <Text as="h4" variant="label">{replacement ? "Replace dashboard" : "Add shared pane"}</Text>
              <Text variant="support">
                {preview.items.length} panes ·{" "}
                {preview.items.reduce((n, p) => n + p.apps.length, 0)} apps
                after import
              </Text>
              <ul>
                {preview.items.map((p) => (
                  <li key={p.id}>
                    {p.title || "Untitled pane"} — {p.apps.length} apps
                  </li>
                ))}
              </ul>
              <Text variant="support">
                Imported icon addresses will be contacted by your browser. Only
                import files you trust.
              </Text>
              <div className="ui-actions">
                <Button
                  variant="primary"
                  onClick={async () => {
                    try {
                      if (
                        replacement &&
                        !await confirm({
                          title: "Replace dashboard?",
                          description: "Replace your entire dashboard with this file? Download a backup first if needed.",
                          cancelLabel: "Cancel",
                          actionLabel: "Replace dashboard",
                        })
                      )
                        return;
                      imported(
                        preview,
                        replacement ? undefined : preview.items.at(-1)?.id,
                      );
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  Confirm import
                </Button>
              </div>
            </Notice>
          )}
        </>
      ) : (
        <>
          <Text variant="support">
            Discover containers, review their addresses, then select the apps
            you want to add.
          </Text>
          <Notice>
            Docker discovery is optional. Direct socket access is privileged,
            even with a read-only mount. Use a restricted socket proxy where
            possible.
          </Notice>
          <TextField
            label="Docker host address"
            value={host}
            placeholder="192.168.1.10"
            hint="Use a hostname or IP only. Review HTTPS, reverse-proxy and port choices below; detection does not prove a port serves a web app."
            onChange={(e) => {
              const next = e.target.value;
              setHost(next);
              setApps(
                apps.map((a) => ({
                  ...a,
                  url: a.ports[0] ? address(next, a.ports[0].port) : a.url,
                })),
              );
            }}
          />
          <Button disabled={busy} onClick={scan}>
            {busy ? "Scanning…" : "Scan Docker"}
          </Button>
          {enabled === false && (
            <Notice>
              Discovery is disabled. Configure PANE_DOCKER_ENDPOINT on the
              server; see README.md.
            </Notice>
          )}
          {enabled && !apps.length && <p>No running containers found.</p>}
          <div className="discovery-list">
            {apps.map((a, i) => {
              const exists = config.items.some((p) =>
                p.apps.some((x) => x.source?.id === a.id),
              );
              return (
                <article key={a.id}>
                  <Label className="check">
                    <Checkbox
                      checked={a.selected}
                      disabled={exists}
                      onCheckedChange={(checked) => patch(i, { selected: checked })}
                    />
                    <strong>{a.name}</strong>
                    {exists && <span className="badge">Already added</span>}
                  </Label>
                  <small>{a.image}</small>
                  {a.selected && (
                    <div className="discovery-fields">
                      <Label>
                        App name
                        <Input
                          value={a.name}
                          maxLength={100}
                          onChange={(e) => patch(i, { name: e.target.value })}
                        />
                      </Label>
                      {a.ports.length > 0 && (
                        <Label>
                          Published TCP port
                          <Select
                            onValueChange={(value) =>
                              patch(i, {
                                url: address(host, Number(value)),
                              })
                            }
                            defaultValue={a.ports[0].port}
                          >
                            {a.ports.map((p, j) => (
                              <SelectOption key={j} value={p.port}>
                                {p.port} → {p.privatePort} (
                                {p.ip || "all interfaces"})
                              </SelectOption>
                            ))}
                          </Select>
                        </Label>
                      )}
                      <Label>
                        App address
                        <Input
                          value={a.url}
                          onChange={(e) => patch(i, { url: e.target.value })}
                        />
                      </Label>
                      <Label>
                        Icon
                        <Input
                          value={a.icon}
                          onChange={(e) => patch(i, { icon: e.target.value })}
                        />
                      </Label>
                    </div>
                  )}
                  {a.ports.length === 0 && (
                    <p className="hint">
                      No published TCP port. Enter the web address manually.
                    </p>
                  )}
                  {a.ports.some(
                    (p) => p.ip === "127.0.0.1" || p.ip === "::1",
                  ) && (
                    <p className="hint">
                      Loopback-only binding: use a reverse proxy or another
                      reachable address.
                    </p>
                  )}
                </article>
              );
            })}
          </div>
          {apps.some((a) => a.selected) && (
            <>
              <SelectField
                label="Destination"
                value={destination}
                onValueChange={(value) => setDestination(value)}
              >
                <SelectOption value="new">Create new pane</SelectOption>
                {config.items.map((p) => (
                  <SelectOption value={p.id} key={p.id}>
                    {p.title || "Untitled pane"}
                  </SelectOption>
                ))}
              </SelectField>
              {destination === "new" && (
                <TextField
                  label="Pane title (optional)"
                  maxLength={100}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              )}
              <Button
                variant="primary"
                onClick={() => {
                  try {
                    const selected: App[] = apps
                      .filter((a) => a.selected)
                      .map((a) => {
                        if (!a.url)
                          throw Error(`Enter an address for ${a.name}.`);
                        return {
                          id: uid(),
                          name: a.name,
                          url: a.url,
                          icon: a.icon,
                          col: 0,
                          row: 0,
                          openInNewTab: true,
                          source: { provider: "docker", id: a.id },
                        };
                      });
                    const result = importApps(
                      config,
                      selected,
                      destination,
                      title,
                    );
                    imported(result.config, result.paneId);
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                Import {apps.filter((a) => a.selected).length} apps
              </Button>
            </>
          )}
        </>
      )}
      {error && (
        <Notice tone="error">{error}</Notice>
      )}
    </div></FieldGroup> </>
  );
}

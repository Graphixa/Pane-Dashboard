import { stringify } from "yaml";

/** Serialise a value as YAML and trigger a browser download. */
export function download(name: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob([stringify(value)], { type: "application/yaml" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

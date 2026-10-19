import { useEffect, useState } from "react";
import { Input, TextField } from "../../design/components";
import { parseIntegerInput } from "../../appearance";

/** Keep invalid keystrokes out of the draft; only commit in-range integers. */
export function IntegerField({
  label,
  value,
  min,
  max,
  onCommit,
  hint,
  hideLabel = false,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onCommit: (value: number) => void;
  hint?: string;
  /** When true, render a bare input (label lives outside, e.g. General split rows). */
  hideLabel?: boolean;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const parsed = parseIntegerInput(text, min, max);
  const error =
    parsed === undefined
      ? `Enter a whole number from ${min} to ${max}.`
      : undefined;
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setText(next);
    const n = parseIntegerInput(next, min, max);
    if (n !== undefined) onCommit(n);
  };
  const onBlur = () => {
    if (parseIntegerInput(text, min, max) === undefined) setText(String(value));
  };
  if (hideLabel) {
    return (
      <div className={error ? "settings-split-field settings-split-field--invalid" : "settings-split-field"}>
        <Input
          type="number"
          min={min}
          max={max}
          value={text}
          aria-label={label}
          aria-invalid={error ? true : undefined}
          onChange={onChange}
          onBlur={onBlur}
        />
        {error ? <span className="ui-field-error">{error}</span> : null}
      </div>
    );
  }
  return (
    <TextField
      label={label}
      type="number"
      min={min}
      max={max}
      value={text}
      hint={hint}
      error={error}
      onChange={onChange}
      onBlur={onBlur}
    />
  );
}

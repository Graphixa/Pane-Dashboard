import { Input, Select, useDisabled } from "./controls";
import {
  ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode,
  forwardRef, useId,
} from "react";

const classes = (...values: (string | undefined)[]) => values.filter(Boolean).join(" ");

export type TextRole = "title" | "section" | "label" | "body" | "support" | "caption";
type TextTag = "h1" | "h2" | "h3" | "h4" | "p" | "span";
/** Visual role and heading level are separate: choose the tag for document structure. */
export function Text({ as: Tag = "p", variant = "body", className, ...props }:
  HTMLAttributes<HTMLElement> & { as?: TextTag; variant?: TextRole }) {
  return <Tag {...props} className={classes("ui-text", `ui-text-${variant}`, className)} />;
}

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "quiet" | "danger" | "surface";
  busy?: boolean;
}>(function Button({ variant = "secondary", busy = false, disabled, type = "button", className, ...props }, ref) {
  const groupDisabled = useDisabled();
  return <button {...props} ref={ref} type={type} disabled={disabled || busy || groupDisabled}
    aria-busy={busy || undefined}
    className={classes("ui-button", `ui-button-${variant}`, className)} />;
});

/** label remains required even when the only visible content is an icon. */
export function IconButton({ label, className, ...props }:
  Omit<Parameters<typeof Button>[0], "aria-label"> & { label: string }) {
  return <Button {...props} aria-label={label} title={props.title ?? label}
    className={classes("ui-icon-button", className)} />;
}

type FieldProps = { label: string; hint?: string; error?: string };
type FieldControl = { id: string; "aria-describedby"?: string; "aria-invalid"?: true };
/** Use for a custom single control. Do not wrap interactive groups in a label. */
export function Field({ label, hint, error, id, describedBy, children }:
  FieldProps & { id?: string; describedBy?: string; children: (control: FieldControl) => ReactNode }) {
  const generated = useId();
  const controlId = id ?? generated;
  const description = classes(describedBy, hint ? `${controlId}-hint` : undefined,
    error ? `${controlId}-error` : undefined) || undefined;
  return <div className="ui-field">
    <label className="ui-field-label" htmlFor={controlId}>{label}</label>
    {children({ id: controlId, "aria-describedby": description, "aria-invalid": error ? true : undefined })}
    {hint && <p className="ui-field-hint" id={`${controlId}-hint`}>{hint}</p>}
    {error && <p className="ui-field-error" id={`${controlId}-error`} role="alert">{error}</p>}
  </div>;
}

export function TextField({ label, hint, error, id, className, "aria-describedby": describedBy, ...props }:
  Omit<InputHTMLAttributes<HTMLInputElement>, "children"> & FieldProps) {
  return <Field {...{ label, hint, error, id, describedBy }}>{control =>
    <Input {...props} {...control} aria-invalid={error ? true : props["aria-invalid"]}
      className={classes("ui-control", className)} />
  }</Field>;
}

export function SelectField({ label, hint, error, id, className, "aria-describedby": describedBy, children, ...props }:
  Parameters<typeof Select>[0] & FieldProps) {
  return <Field {...{ label, hint, error, id, describedBy }}>{control =>
    <Select {...props} {...control} aria-invalid={error ? true : props["aria-invalid"]}
      className={className}>{children}</Select>
  }</Field>;
}

export function Notice({ tone = "info", className, ...props }:
  HTMLAttributes<HTMLDivElement> & { tone?: "info" | "error" | "success" }) {
  return <div role={tone === "error" ? "alert" : "status"} {...props}
    className={classes("ui-notice", `ui-notice-${tone}`, className)} />;
}

export function Section({ title, description, children, className = "", level = "h2" }:
  { title: string; description?: string; children: ReactNode; className?: string; level?: "h2" | "h3" }) {
  const id = useId();
  return <section className={`ui-section ${className}`} aria-labelledby={id}>
    <Text as={level} variant="section" id={id}>{title}</Text>
    {description && <Text variant="support">{description}</Text>}
    <div className="ui-section-content">{children}</div>
  </section>;
}

export { Input, Label, Select, SelectOption, Switch, Checkbox, Range, Disclosure, FieldGroup } from "./controls";
export { Modal, Popover, DropdownMenu, Tooltip, useConfirmation } from "./overlays";
export type { ConfirmRequest } from "./overlays";
export { ThemeSurface } from "./surface";

import { Input, Select, useDisabled } from "./controls";
import { HelpTip } from "./help";
import {
  ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode,
  forwardRef, useId,
} from "react";

const classes = (...values: (string | undefined)[]) => values.filter(Boolean).join(" ");

export { HelpTip } from "./help";

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
    <div className="ui-field-heading">
      <label className="ui-field-label" htmlFor={controlId}>{label}</label>
      {hint && <HelpTip subject={label}>{hint}</HelpTip>}
    </div>
    {hint && <span id={`${controlId}-hint`} className="ui-visually-hidden">{hint}</span>}
    {children({ id: controlId, "aria-describedby": description, "aria-invalid": error ? true : undefined })}
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

export function Notice({ tone = "info", banner = false, className, children, ...props }:
  HTMLAttributes<HTMLDivElement> & {
    tone?: "info" | "error" | "success";
    /** Horizontal layout for message plus inline actions (dashboard banners). */
    banner?: boolean;
  }) {
  return <div role={tone === "error" ? "alert" : "status"} {...props}
    className={classes("ui-notice", `ui-notice-${tone}`, banner ? "ui-notice-banner" : undefined, className)}>
    {children}
  </div>;
}

export function Section({ title, description, tip, children, className = "", level = "h2" }:
  { title: string; description?: string; tip?: string; children: ReactNode; className?: string; level?: "h2" | "h3" }) {
  const id = useId();
  return <section className={`ui-section ${className}`} aria-labelledby={id}>
    <div className="ui-section-heading">
      <Text as={level} variant="section" id={id}>{title}</Text>
      {tip && <HelpTip subject={title}>{tip}</HelpTip>}
    </div>
    {description && <Text variant="support">{description}</Text>}
    <div className="ui-section-content">{children}</div>
  </section>;
}

/** Inset settings surface under a Section heading (Apple-style grouped rows). */
export function SettingsGroup({ children, className, density = "default" }: {
  children: ReactNode;
  className?: string;
  /** `compact` tightens row padding for preview-adjust sheets (~8–12 px). */
  density?: "default" | "compact";
}) {
  return <div className={classes("ui-settings-group", density === "compact" ? "ui-settings-group-compact" : undefined, className)}>{children}</div>;
}

/** Label left, control right inside a SettingsGroup. Omit label for a full-width control row. */
export function SettingsRow({ label, hint, action, children, className }: {
  label?: string;
  hint?: string;
  /** Optional control under the label (e.g. Customise). */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const hasCopy = Boolean(label || hint || action);
  return <div className={classes("ui-settings-row", hasCopy ? undefined : "ui-settings-row-fill", className)}>
    {hasCopy && <div className="ui-settings-row-copy">
      {(label || hint) && <div className="ui-settings-row-heading">
        {label && <span className="ui-settings-row-label">{label}</span>}
        {hint && label && <HelpTip subject={label}>{hint}</HelpTip>}
        {hint && !label && <HelpTip subject="This control">{hint}</HelpTip>}
      </div>}
      {action}
    </div>}
    <div className="ui-settings-row-control">{children}</div>
  </div>;
}

export { Input, Label, Select, SelectOption, Switch, SwitchRow, Checkbox, Range, Disclosure, FieldGroup, ScrollArea, Tabs, TabsList, TabsTrigger, TabsContent } from "./controls";
export { Modal, Popover, PopoverHead, ImagePopoverActions, DropdownMenu, useConfirmation } from "./overlays";
export type { ConfirmRequest } from "./overlays";
export {
  ColourField,
  ColourPopoverFields,
  hexToHsv,
  hsvToHex,
  parseHexInput,
  useDeferredColour,
} from "./colour";
export { ThemeSurface } from "./surface";

import { createContext, useContext, useId, ComponentProps, ReactNode, InputHTMLAttributes, LabelHTMLAttributes, FieldsetHTMLAttributes, Ref } from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import * as SliderPrimitive from '@radix-ui/react-slider';
import * as CollapsiblePrimitive from '@radix-ui/react-collapsible';
import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { Check, ChevronDown } from 'lucide-react';
import { HelpTip } from './help';
import { useSurface } from './surface';

const DisabledContext = createContext(false);
export const useDisabled = () => useContext(DisabledContext);
const LabelContext = createContext<string | undefined>(undefined);
export function FieldGroup({disabled, ...props}: FieldsetHTMLAttributes<HTMLFieldSetElement>) {
  const inherited = useContext(DisabledContext);
  return <DisabledContext.Provider value={inherited || !!disabled}><fieldset {...props} disabled={inherited || disabled} /></DisabledContext.Provider>;
}
/** A label owns its control ID, including composite Radix controls. */
export function Label({children, className = '', htmlFor, ...props}: LabelHTMLAttributes<HTMLLabelElement>) {
  const generated = useId();
  const id = htmlFor ?? generated;
  return <LabelContext.Provider value={id}><label {...props} htmlFor={id} className={`ui-label ${className}`}>{children}</label></LabelContext.Provider>;
}
export function Input({className = '', id, disabled, ...props}: InputHTMLAttributes<HTMLInputElement> & {ref?: React.Ref<HTMLInputElement>}) {
  const label = useContext(LabelContext), groupDisabled = useContext(DisabledContext);
  return <input {...props} id={id ?? label} disabled={disabled || groupDisabled} className={`ui-input ${className}`} />;
}
export function Select({children, value, defaultValue, onValueChange, className = '', id, style, 'aria-label': ariaLabel, 'aria-describedby': description, 'aria-invalid': invalid, disabled, required, name}: {
  children: ReactNode; value?: string | number; defaultValue?: string | number; onValueChange?: (value: string) => void;
  className?: string; id?: string; style?: React.CSSProperties; 'aria-label'?: string; 'aria-describedby'?: string; 'aria-invalid'?: React.AriaAttributes['aria-invalid']; disabled?: boolean; required?: boolean; name?: string;
}) {
  const label = useContext(LabelContext), groupDisabled = useContext(DisabledContext), surface = useSurface();
  return <SelectPrimitive.Root value={value === undefined ? undefined : String(value)} defaultValue={defaultValue === undefined ? undefined : String(defaultValue)} onValueChange={onValueChange} disabled={disabled || groupDisabled} required={required} name={name}>
    <SelectPrimitive.Trigger id={id ?? label} aria-label={ariaLabel} aria-describedby={description} aria-invalid={invalid} className={`ui-select ${className}`} style={style}>
      <SelectPrimitive.Value /><SelectPrimitive.Icon><ChevronDown size={16} aria-hidden="true" /></SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
    <SelectPrimitive.Portal><SelectPrimitive.Content {...surface} className="ui-select-content ui-overlay-surface" position="popper" sideOffset={6} collisionPadding={12}>
      <SelectPrimitive.ScrollUpButton className="ui-select-scroll">▲</SelectPrimitive.ScrollUpButton>
      <SelectPrimitive.Viewport>{children}</SelectPrimitive.Viewport>
      <SelectPrimitive.ScrollDownButton className="ui-select-scroll">▼</SelectPrimitive.ScrollDownButton>
    </SelectPrimitive.Content></SelectPrimitive.Portal>
  </SelectPrimitive.Root>;
}
export function SelectOption({value, children, disabled, style}: {value: string | number; children: ReactNode; disabled?: boolean; style?: React.CSSProperties}) {
  return <SelectPrimitive.Item style={style} value={String(value)} disabled={disabled} className="ui-select-option">
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText><SelectPrimitive.ItemIndicator><Check size={16} aria-hidden="true" /></SelectPrimitive.ItemIndicator>
  </SelectPrimitive.Item>;
}
export function Switch({id, disabled, className = '', ...props}: ComponentProps<typeof SwitchPrimitive.Root>) {
  const label = useContext(LabelContext), groupDisabled = useContext(DisabledContext);
  return <SwitchPrimitive.Root {...props} id={id ?? label} disabled={disabled || groupDisabled} className={`ui-switch ${className}`}><SwitchPrimitive.Thumb className="ui-switch-thumb" /></SwitchPrimitive.Root>;
}
export function Checkbox({id, disabled, className = '', onCheckedChange, ...props}: Omit<ComponentProps<typeof CheckboxPrimitive.Root>, 'onCheckedChange'> & {onCheckedChange?: (checked: boolean) => void}) {
  const label = useContext(LabelContext), groupDisabled = useContext(DisabledContext);
  return <CheckboxPrimitive.Root {...props} id={id ?? label} disabled={disabled || groupDisabled} onCheckedChange={v => onCheckedChange?.(v === true)} className={`ui-checkbox ${className}`}><CheckboxPrimitive.Indicator><Check size={14} aria-hidden="true" /></CheckboxPrimitive.Indicator></CheckboxPrimitive.Root>;
}
export function Range({
  label,
  value,
  min,
  max,
  unit = '',
  change,
  disabled,
  tip,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
  change: (value: number) => void;
  disabled?: boolean;
  tip?: string;
}) {
  const groupDisabled = useContext(DisabledContext), id = useId();
  return (
    <div className="ui-range">
      <div className="ui-range-label">
        <span className="ui-range-label-main">
          <span id={id}>{label}</span>
          {tip && <HelpTip subject={label}>{tip}</HelpTip>}
        </span>
        <output>
          {value}
          {unit}
        </output>
      </div>
      <SliderPrimitive.Root
        min={min}
        max={max}
        step={1}
        value={[value]}
        onValueChange={(v) => change(v[0])}
        disabled={disabled || groupDisabled}
        className="ui-slider"
      >
        <SliderPrimitive.Track className="ui-slider-track">
          <SliderPrimitive.Range className="ui-slider-range" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          className="ui-slider-thumb"
          aria-labelledby={id}
          aria-valuetext={`${value}${unit}`}
        />
      </SliderPrimitive.Root>
    </div>
  );
}
export function Disclosure({title, children, defaultOpen = false, open, onOpenChange}: {
  title: string; children: ReactNode; defaultOpen?: boolean; open?: boolean; onOpenChange?: (open: boolean) => void;
}) {
  const disabled = useContext(DisabledContext);
  return <CollapsiblePrimitive.Root
    defaultOpen={open === undefined ? defaultOpen : undefined}
    open={open}
    onOpenChange={onOpenChange}
    disabled={disabled}
    className="ui-disclosure"
  >
    <CollapsiblePrimitive.Trigger className="ui-disclosure-trigger">{title}<ChevronDown size={16} aria-hidden="true" /></CollapsiblePrimitive.Trigger>
    <CollapsiblePrimitive.Content className="ui-disclosure-content">{children}</CollapsiblePrimitive.Content>
  </CollapsiblePrimitive.Root>;
}
/** Themed Radix scrollport; prefer this over a raw overflow div when a visible scrollbar is needed. */
export function ScrollArea({
  children,
  className = '',
  orientation = 'vertical',
  viewportRef,
  type = 'hover',
  'aria-label': ariaLabel,
}: {
  children: ReactNode;
  className?: string;
  orientation?: 'vertical' | 'horizontal' | 'both';
  viewportRef?: Ref<HTMLDivElement>;
  type?: ComponentProps<typeof ScrollAreaPrimitive.Root>['type'];
  'aria-label'?: string;
}) {
  const showVertical = orientation === 'vertical' || orientation === 'both';
  const showHorizontal = orientation === 'horizontal' || orientation === 'both';
  /* Keep scrollbars mounted so overflow can reveal them; CSS hides data-state=hidden. */
  return <ScrollAreaPrimitive.Root type={type} className={`ui-scroll-area ${className}`}>
    <ScrollAreaPrimitive.Viewport ref={viewportRef} className="ui-scroll-area-viewport" aria-label={ariaLabel}>
      {children}
    </ScrollAreaPrimitive.Viewport>
    {showVertical && <ScrollAreaPrimitive.Scrollbar forceMount className="ui-scroll-area-scrollbar ui-scroll-area-scrollbar-vertical" orientation="vertical">
      <ScrollAreaPrimitive.Thumb className="ui-scroll-area-thumb" />
    </ScrollAreaPrimitive.Scrollbar>}
    {showHorizontal && <ScrollAreaPrimitive.Scrollbar forceMount className="ui-scroll-area-scrollbar ui-scroll-area-scrollbar-horizontal" orientation="horizontal">
      <ScrollAreaPrimitive.Thumb className="ui-scroll-area-thumb" />
    </ScrollAreaPrimitive.Scrollbar>}
    <ScrollAreaPrimitive.Corner className="ui-scroll-area-corner" />
  </ScrollAreaPrimitive.Root>;
}
/** Label left, switch right; id association without nesting the control in the label. */
export function Tabs({
  value,
  defaultValue,
  onValueChange,
  className = '',
  children,
}: {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  children: ReactNode;
}) {
  return <TabsPrimitive.Root value={value} defaultValue={defaultValue} onValueChange={onValueChange} className={`ui-tabs ${className}`}>{children}</TabsPrimitive.Root>;
}
export function TabsList({ className = '', children, 'aria-label': ariaLabel }: { className?: string; children: ReactNode; 'aria-label'?: string }) {
  return <TabsPrimitive.List className={`ui-tabs-list ${className}`} aria-label={ariaLabel}>{children}</TabsPrimitive.List>;
}
export function TabsTrigger({ value, className = '', children, disabled, title }: { value: string; className?: string; children: ReactNode; disabled?: boolean; title?: string }) {
  const groupDisabled = useContext(DisabledContext);
  return <TabsPrimitive.Trigger value={value} disabled={disabled || groupDisabled} className={`ui-tabs-trigger ${className}`} title={title}>{children}</TabsPrimitive.Trigger>;
}
export function TabsContent({ value, className = '', children }: { value: string; className?: string; children: ReactNode }) {
  return <TabsPrimitive.Content value={value} className={`ui-tabs-content ${className}`}>{children}</TabsPrimitive.Content>;
}

export function SwitchRow({label, hint, action, checked, onCheckedChange, disabled, id}: {
  label: string;
  hint?: string;
  /** Optional control under the label (e.g. Customise). */
  action?: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
}) {
  const generated = useId();
  const controlId = id ?? generated;
  const hintId = hint ? `${controlId}-hint` : undefined;
  return <div className="ui-switch-row">
    <div className="ui-switch-row-copy">
      <div className="ui-switch-row-heading">
        <label className="ui-switch-row-label" htmlFor={controlId}>{label}</label>
        {hint && <HelpTip subject={label}>{hint}</HelpTip>}
      </div>
      {hint && <span id={hintId} className="ui-visually-hidden">{hint}</span>}
      {action}
    </div>
    <Switch id={controlId} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} aria-describedby={hintId} />
  </div>;
}

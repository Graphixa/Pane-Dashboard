import { ThemeSurface } from "./components";
import { SelectOption } from "./components";
import { CSSProperties, useState } from "react";
import { ChevronDown, Plus, Settings2 } from "lucide-react";
import { appearanceStyle, UiFont, uiFonts } from "../appearance";
import {
  Button, Checkbox, ColourField, Disclosure, DropdownMenu, IconButton, ImagePopoverActions, Modal, Notice, Popover, PopoverHead,
  Range, ScrollArea, Section, Select, SelectField, SettingsGroup, SettingsRow, SwitchRow, Tabs, TabsContent, TabsList, TabsTrigger, Text, TextField, useConfirmation,
} from "./components";

/** Isolated examples: no useConfig, fetch, localStorage or dashboard mutations. */
export default function ComponentReference() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [font, setFont] = useState<UiFont>("geist");
  const [compact, setCompact] = useState(false);
  const [modal, setModal] = useState(false);
  const [bottomModal, setBottomModal] = useState(false);
  const [categoryModal, setCategoryModal] = useState(false);
  const [name, setName] = useState("Home services");
  const [count, setCount] = useState(0);
  const [selected, setSelected] = useState(false);
  const [paneSize, setPaneSize] = useState(18);
  const [labels, setLabels] = useState(true);
  const [blur, setBlur] = useState(16);
  const [opacity, setOpacity] = useState(40);
  const [openLinks, setOpenLinks] = useState("new");
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [imagePopoverOpen, setImagePopoverOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [checked, setChecked] = useState(true);
  const [sampleColour, setSampleColour] = useState("#7db7ff");
  const { confirm, confirmation } = useConfirmation();
  const style = { ...appearanceStyle({ theme, fontFamily: font }),
    "--pane-title-size": `${paneSize}px`, "--icon-size": "80px" } as CSSProperties;
  return <ThemeSurface className="design-reference" theme={theme} style={style}>
    {confirmation}
    <main className={`reference-content${compact ? " reference-compact" : ""}`}>
      <header className="reference-header">
        <Text as="h1" variant="title">Pane component reference</Text>
        <Text variant="support">The shared components and typography used by Pane. Examples use temporary sample data.</Text>
        <a href="/">Return to dashboard</a>
      </header>
      <Section title="Preview controls" description="Check every font and theme. Narrow preview constrains this page to 360 px; also test a real narrow browser viewport and zoom.">
        <div className="reference-grid">
          <SelectField label="Theme" value={theme} onValueChange={value => setTheme(value as "dark" | "light")}>
            <SelectOption value="dark">Midnight</SelectOption><SelectOption value="light">Daylight</SelectOption>
          </SelectField>
          <SelectField label="Font" value={font} onValueChange={value => setFont(value as UiFont)}>
            {uiFonts.map(f => <SelectOption key={f.id} value={f.id}>{f.label}</SelectOption>)}
          </SelectField>
        </div>
        <div className="reference-actions"><Button aria-pressed={compact} onClick={() => setCompact(!compact)}>Narrow preview</Button></div>
      </Section>
      <Section title="Typography" description="The HTML heading level follows the document outline; the visual variant follows its design role.">
        <div className="reference-specimen"><Text as="span" variant="title">Dialog or page title</Text><Text variant="caption">title · 24 / 600 / 1.3</Text></div>
        <div className="reference-specimen"><Text as="span" variant="section">Section heading</Text><Text variant="caption">section · 18 / 600 / 1.4</Text></div>
        <div className="reference-specimen"><Text as="span" variant="label">Field label or control</Text><Text variant="caption">label · 14 / 600 / 1.5</Text></div>
        <div className="reference-specimen"><Text>Body text explains what happens next in clear, direct language.</Text><Text variant="caption">body · 14 / 400 / 1.5</Text></div>
        <div className="reference-specimen"><Text variant="support">Supporting text provides one useful detail.</Text><Text variant="caption">support · 13 / 400 / 1.5</Text></div>
        <div className="reference-specimen"><Text variant="caption">Compact metadata · 12 / 400 / 1.5</Text></div>
      </Section>
      <Section title="Buttons and states" description="Use Tab to inspect focus. Disabled and busy actions cannot fire. Selected state is also conveyed through aria-pressed. Surface is for specialised artwork and navigation tiles.">
        <div className="reference-actions">
          <Button variant="primary" onClick={() => setCount(count + 1)}>Apply example</Button>
          <Button onClick={() => setModal(true)}>Open dialog</Button>
          <Button onClick={() => setBottomModal(true)}>Open bottom sheet</Button>
          <Button onClick={() => setCategoryModal(true)}>Open category sheet</Button>
          <Button variant="quiet" onClick={() => setCount(0)}>Reset example</Button>
          <Button variant="danger" onClick={() => setCount(0)}>Clear example</Button>
          <Button variant="surface" className="ui-settings-nav" type="button"><Settings2 size={18} aria-hidden="true" /><span>Settings nav</span></Button>
          <IconButton label="Open example settings" onClick={() => setModal(true)}><Settings2 size={18} aria-hidden="true" /></IconButton>
          <Button disabled>Unavailable</Button>
          <Button busy>Saving…</Button>
          <Button aria-pressed={selected} onClick={() => setSelected(!selected)}>Selected example</Button>
        </div>
        <Notice>Example applied {count} times. No dashboard changes are saved.</Notice>
        <Notice tone="error" banner>
          <span>Example save failed. Your changes are still available.</span>
          <div className="ui-actions"><Button>Retry save</Button></div>
        </Notice>
      </Section>
      <Section title="Tabs" description="Centred Radix tabs for mutually exclusive panes such as Static / Animated wallpaper shelves.">
        <Tabs defaultValue="static">
          <TabsList aria-label="Example wallpaper type">
            <TabsTrigger value="static">Static</TabsTrigger>
            <TabsTrigger value="animated">Animated</TabsTrigger>
          </TabsList>
          <TabsContent value="static"><Text variant="support">Static shelf example.</Text></TabsContent>
          <TabsContent value="animated"><Text variant="support">Animated shelf example.</Text></TabsContent>
        </Tabs>
      </Section>
      <Section title="Fields and validation">
        <div className="reference-grid">
          <TextField label="Dashboard name" hint="Use a short, recognisable name." value={name} onChange={e => setName(e.target.value)} />
          <SelectField label="Open links" defaultValue="new"><SelectOption value="new">In a new tab</SelectOption><SelectOption value="same">In this tab</SelectOption></SelectField>
          <TextField label="Invalid address example" defaultValue="service" error="Enter a full HTTP(S) address, such as https://example.com." />
          <TextField label="Disabled field" value="Read-only presentation" disabled />
        </div>
        <Notice tone="success">Example settings are ready.</Notice>
        <Notice tone="error">Example save failed. Your changes are still available.</Notice>
      </Section>
      <Section title="Settings groups" tip="Product Settings put help in a (?) tip beside the heading or label. This reference page still uses visible descriptions for longer guidance." description="Inset SettingsGroup surfaces under section headings. Comparable rows share stable label and control columns; omit the label for full-width controls. Narrow viewports stack the control under the label. Row and field hints use HelpTip.">
        <SettingsGroup>
          <SwitchRow label="Show app labels" hint="Names beneath app icons." checked={labels} onCheckedChange={setLabels} />
          <SettingsRow label="Open links" hint="Where app tiles open.">
            <Select aria-label="Open links" value={openLinks} onValueChange={setOpenLinks}>
              <SelectOption value="new">In a new tab</SelectOption>
              <SelectOption value="same">In this tab</SelectOption>
            </Select>
          </SettingsRow>
          <ColourField
            label="Accent colour"
            hint="Area and hue live-paint while dragging; draft commits after the drag settles."
            colour={sampleColour}
            onColour={setSampleColour}
          />
          <SettingsRow>
            <TextField label="Dashboard name" hint="Use a short, recognisable name." value={name} onChange={e => setName(e.target.value)} />
          </SettingsRow>
        </SettingsGroup>
      </Section>
      <Section title="Ranges" description="Range always stacks label and value above a full-width track. Consecutive Ranges in a group share track width with no internal divider. Optional tip sits beside the label.">
        <SettingsGroup>
          <Range label="Theme overlay" tip="Lightens or darkens the background to suit your theme." value={opacity} min={0} max={80} unit="%" change={setOpacity} />
          <Range label="Opacity" value={opacity} min={0} max={100} unit="%" change={setOpacity} />
          <Range label="Blur" value={blur} min={0} max={24} unit="px" change={setBlur} />
        </SettingsGroup>
      </Section>
      <Section title="Switches and disclosure" description="Settings-style rows keep the label left and control right.">
        <SwitchRow label="Show app labels" hint="Names beneath app icons." checked={labels} onCheckedChange={setLabels} />
        <label className="ui-label check"><Checkbox checked={checked} onCheckedChange={setChecked} /> Open in a new tab</label>
        <Disclosure title="Fine tuning">
          <Text variant="support">Disclosure content uses the same spacing as sections.</Text>
        </Disclosure>
      </Section>
      <Section title="Overlays" description="Popover sizes are compact (colour chips, live commit) and image (upload pickers, cancel restores). PopoverHead and ImagePopoverActions are shared chrome; commit semantics stay with the caller. ScrollArea themes overflow instead of a raw scrollbar.">
        <div className="reference-actions">
          <Popover label="Example popover" open={popoverOpen} onOpenChange={setPopoverOpen}
            trigger={<Button>Open popover <ChevronDown size={16} aria-hidden="true" /></Button>}>
            <PopoverHead title="Compact" closeLabel="Close compact popover" onClose={() => setPopoverOpen(false)} />
            <Text variant="support">Anchored content for compact choices.</Text>
          </Popover>
          <Popover label="Image popover" size="image" open={imagePopoverOpen} onOpenChange={setImagePopoverOpen}
            trigger={<Button>Open image popover <ChevronDown size={16} aria-hidden="true" /></Button>}>
            <PopoverHead title="Add image" closeLabel="Close image popover" onClose={() => setImagePopoverOpen(false)} />
            <Text variant="support">Wider surface for upload fields. Cancel restores the prior value.</Text>
            <ImagePopoverActions cancel={() => setImagePopoverOpen(false)} confirm={() => setImagePopoverOpen(false)} />
          </Popover>
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}
            trigger={<Button>Open menu <Plus size={16} aria-hidden="true" /></Button>}
            items={[
              { label: "Add pane", onSelect: () => setMenuOpen(false) },
              { label: "Close menu", onSelect: () => setMenuOpen(false) },
            ]} />
          <Button onClick={async () => {
            await confirm({
              title: "Delete app?",
              description: "Delete Plex? This removes it from the pane and cannot be undone.",
              cancelLabel: "Cancel",
              actionLabel: "Delete app",
            });
          }}>Delete confirmation</Button>
          <Button onClick={async () => {
            await confirm({
              title: "Discard changes?",
              description: "Discard unsaved settings changes?",
              cancelLabel: "Keep changes",
              actionLabel: "Discard",
            });
          }}>Discard confirmation</Button>
        </div>
        <ScrollArea orientation="horizontal" className="reference-scroll-strip" aria-label="Example horizontal scroll">
          <div className="reference-scroll-track">
            {["Dusk", "Ocean", "Forest", "Mist", "None", "Waves", "Aurora"].map((label) => (
              <Button key={label} variant="surface">{label}</Button>
            ))}
          </div>
        </ScrollArea>
      </Section>
      <Section title="Palette roles" description="These swatches use the same appearanceStyle palette resolver as the dashboard.">
        <div className="reference-colours">{["bg", "panel", "panel-high", "text", "muted", "accent", "accent-text", "line"].map(role =>
          <div key={role}><span className="reference-colour" style={{ background: `var(--${role})` }} /><Text variant="caption">{role}</Text></div>
        )}</div>
      </Section>
      <Section title="Pane geometry" description="Pane titles remain bold with a global 14–22 px size. App labels stay 13 px and icons stay 80 px.">
        <SelectField label="Pane title size" value={paneSize} onValueChange={value => setPaneSize(Number(value))}>
          {[14, 18, 22].map(size => <SelectOption key={size} value={size}>{size} px</SelectOption>)}
        </SelectField>
        <div className="reference-pane">
          <div className="pane-header"><h3 className="pane-title" title="Home services with a deliberately long pane title">Home services with a deliberately long pane title</h3></div>
          <div className="reference-pane-surface"><div className="artwork" aria-hidden="true">P</div><span className="app-name">Example app</span></div>
        </div>
      </Section>
      <Section title="Long content" description="Controls, notices and supporting text must wrap without hiding meaning or introducing page-level horizontal scrolling.">
        <TextField label="A deliberately long field label to check wrapping in narrow layouts" defaultValue="Example dashboard with a longer name" hint="A longer explanation should remain readable at increased zoom, without colliding with its neighbouring control or hiding the error message." />
        <div className="reference-actions"><Button>Action with a deliberately long label</Button></div>
        <Notice>Example: a configuration could not be saved because it changed in another session. Review the conflict before trying again.</Notice>
      </Section>
      {modal && <Modal title="Example dialog" close={() => setModal(false)} style={style}>
        <Section title="Shared form" level="h3" description="This is the production Modal component. Escape or Close returns to the reference page.">
          <TextField label="Example name" defaultValue="Pane" autoFocus />
          <div className="ui-actions"><Button onClick={() => setModal(false)}>Cancel</Button><Button variant="primary" onClick={() => setModal(false)}>Apply example</Button></div>
        </Section>
      </Modal>}
      {categoryModal && <Modal title="Nature" close={() => setCategoryModal(false)} onBack={() => setCategoryModal(false)}
        headerActions={<Button variant="quiet">Add media</Button>} placement="bottom" backdrop="none" style={style}
        footer={<div className="background-library-actions"><Text as="p" variant="support">Apply in Settings to save.</Text><Button variant="primary" onClick={() => setCategoryModal(false)}>Use wallpaper</Button></div>}>
        <Text as="p" variant="body">Back keeps the sheet open; Close dismisses. Used by Choose wallpaper category grids.</Text>
      </Modal>}
      {bottomModal && <Modal title="Example bottom sheet" close={() => setBottomModal(false)} placement="bottom" backdrop="none" style={style}
        footer={<Button variant="primary" onClick={() => setBottomModal(false)}>Done</Button>}>
        <Text variant="support">Bottom placement with no dimmed backdrop for live preview adjusters. Optional footer pins Done while the body scrolls.</Text>
        <SettingsGroup density="compact">
          <SettingsRow label="Style">
            <Select aria-label="Example style" defaultValue="a">
              <SelectOption value="a">Option A</SelectOption>
              <SelectOption value="b">Option B</SelectOption>
            </Select>
          </SettingsRow>
          <Range label="Intensity" value={40} min={0} max={100} unit="%" change={() => {}} />
        </SettingsGroup>
      </Modal>}
    </main>
  </ThemeSurface>;
}

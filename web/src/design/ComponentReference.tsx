import { CSSProperties, useState } from "react";
import { Settings2 } from "lucide-react";
import { appearanceStyle, UiFont, uiFonts } from "../appearance";
import Modal from "../Modal";
import { Button, IconButton, Notice, Section, SelectField, Text, TextField } from "./components";

/** Isolated examples: no useConfig, fetch, localStorage or dashboard mutations. */
export default function ComponentReference() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [font, setFont] = useState<UiFont>("geist");
  const [compact, setCompact] = useState(false);
  const [modal, setModal] = useState(false);
  const [name, setName] = useState("Home services");
  const [count, setCount] = useState(0);
  const [selected, setSelected] = useState(false);
  const [paneSize, setPaneSize] = useState(18);
  const style = { ...appearanceStyle({ theme, fontFamily: font }),
    "--pane-title-size": `${paneSize}px`, "--icon-size": "80px" } as CSSProperties;
  return <div className="design-reference" data-theme={theme} style={style}>
    <main className={`reference-content${compact ? " reference-compact" : ""}`}>
      <header className="reference-header">
        <Text as="h1" variant="title">Pane component reference</Text>
        <Text variant="support">The shared components and typography used by Pane. Examples use temporary sample data.</Text>
        <a href="/">Return to dashboard</a>
      </header>
      <Section title="Preview controls" description="Check every font and theme. Narrow preview constrains this page to 360 px; also test a real narrow browser viewport and zoom.">
        <div className="reference-grid">
          <SelectField label="Theme" value={theme} onChange={e => setTheme(e.target.value as "dark" | "light")}>
            <option value="dark">Midnight</option><option value="light">Daylight</option>
          </SelectField>
          <SelectField label="Font" value={font} onChange={e => setFont(e.target.value as UiFont)}>
            {uiFonts.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
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
      <Section title="Buttons and states" description="Use Tab to inspect focus. Disabled and busy actions cannot fire. Selected state is also conveyed through aria-pressed.">
        <div className="reference-actions">
          <Button variant="primary" onClick={() => setCount(count + 1)}>Apply example</Button>
          <Button onClick={() => setModal(true)}>Open dialog</Button>
          <Button variant="quiet" onClick={() => setCount(0)}>Reset example</Button>
          <Button variant="danger" onClick={() => setCount(0)}>Clear example</Button>
          <IconButton label="Open example settings" onClick={() => setModal(true)}><Settings2 size={18} aria-hidden="true" /></IconButton>
          <Button disabled>Unavailable</Button>
          <Button busy>Saving…</Button>
          <Button aria-pressed={selected} onClick={() => setSelected(!selected)}>Selected example</Button>
        </div>
        <Notice>Example applied {count} times. No dashboard changes are saved.</Notice>
      </Section>
      <Section title="Fields and validation">
        <div className="reference-grid">
          <TextField label="Dashboard name" hint="Use a short, recognisable name." value={name} onChange={e => setName(e.target.value)} />
          <SelectField label="Open links" defaultValue="new"><option value="new">In a new tab</option><option value="same">In this tab</option></SelectField>
          <TextField label="Invalid address example" defaultValue="service" error="Enter a full HTTP(S) address, such as https://example.com." />
          <TextField label="Disabled field" value="Read-only presentation" disabled />
        </div>
        <Notice tone="success">Example settings are ready.</Notice>
        <Notice tone="error">Example save failed. Your changes are still available.</Notice>
      </Section>
      <Section title="Palette roles" description="These swatches use the same appearanceStyle palette resolver as the dashboard.">
        <div className="reference-colours">{["bg", "panel", "panel-high", "text", "muted", "accent", "accent-text", "line"].map(role =>
          <div key={role}><span className="reference-colour" style={{ background: `var(--${role})` }} /><Text variant="caption">{role}</Text></div>
        )}</div>
      </Section>
      <Section title="Pane geometry" description="Pane titles remain bold with a global 14–22 px size. App labels stay 13 px and icons stay 80 px.">
        <SelectField label="Pane title size" value={paneSize} onChange={e => setPaneSize(Number(e.target.value))}>
          {[14, 18, 22].map(size => <option key={size} value={size}>{size} px</option>)}
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
          <div className="reference-actions"><Button onClick={() => setModal(false)}>Cancel</Button><Button variant="primary" onClick={() => setModal(false)}>Apply example</Button></div>
        </Section>
      </Modal>}
    </main>
  </div>;
}

// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Button, IconButton, Notice, Range, SelectField, SelectOption, SettingsGroup, SettingsRow, SwitchRow, TextField, useConfirmation } from "./components";

afterEach(cleanup);

it("connects labels, hints and errors with unique IDs and preserves external descriptions", () => {
  render(<><p id="external">External context</p>
    <TextField label="Name" hint="Short name" error="Name is required" aria-describedby="external" />
    <TextField label="Other name" />
    <SelectField label="Theme"><SelectOption value="dark">Midnight</SelectOption></SelectField>
  </>);
  const input = screen.getByLabelText("Name");
  expect(input.getAttribute("aria-invalid")).toBe("true");
  const ids = input.getAttribute("aria-describedby")!.split(" ");
  expect(ids.map(id => document.getElementById(id)?.textContent)).toEqual(["External context", "Short name", "Name is required"]);
  expect(input.id).not.toBe(screen.getByLabelText("Other name").id);
  expect(screen.getByRole("combobox", { name: "Theme" })).toBeTruthy();
});

it("keeps ordinary buttons from submitting forms and blocks busy actions", () => {
  const submit = vi.fn(e => e.preventDefault());
  const click = vi.fn();
  render(<form onSubmit={submit}><Button>Cancel</Button><Button busy onClick={click}>Saving</Button><Button type="submit">Apply</Button></form>);
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(submit).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Saving" }));
  expect(click).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Saving" }).getAttribute("aria-busy")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "Apply" }));
  expect(submit).toHaveBeenCalledOnce();
});

it("gives icon-only actions an accessible name", () => {
  render(<IconButton label="Open settings"><svg aria-hidden="true" /></IconButton>);
  expect(screen.getByRole("button", { name: "Open settings" })).toBeTruthy();
});

function DeleteConfirmExample({ onResult }: { onResult: (value: boolean) => void }) {
  const { confirm, confirmation } = useConfirmation();
  return <>
    {confirmation}
    <Button onClick={async () => onResult(await confirm({
      title: "Delete app?",
      description: "Delete Plex? This removes it from the pane and cannot be undone.",
      cancelLabel: "Cancel",
      actionLabel: "Delete app",
    }))}>Delete</Button>
  </>;
}

it("shows delete confirmation with cancel and delete actions, not discard copy", async () => {
  const onResult = vi.fn();
  render(<DeleteConfirmExample onResult={onResult} />);
  fireEvent.click(screen.getByRole("button", { name: "Delete" }));
  const dialog = await screen.findByRole("alertdialog");
  expect(dialog.textContent).toContain("Delete app?");
  expect(dialog.textContent).toContain("Delete Plex?");
  expect(screen.queryByRole("button", { name: "Keep changes" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Continue" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
  fireEvent.click(screen.getByRole("button", { name: "Delete" }));
  fireEvent.click(await screen.findByRole("button", { name: "Delete app" }));
  await waitFor(() => expect(onResult).toHaveBeenCalledWith(true));
});

function AcknowledgeExample({ onResult }: { onResult: (value: boolean) => void }) {
  const { confirm, confirmation } = useConfirmation();
  return <>
    {confirmation}
    <Button onClick={async () => onResult(await confirm({
      title: "Upload failed",
      description: "Choose a video up to 40 MiB.",
      actionLabel: "OK",
    }))}>Fail</Button>
  </>;
}

it("shows a single OK for dismiss-only alerts and restores focus on dismiss", async () => {
  const onResult = vi.fn();
  render(<AcknowledgeExample onResult={onResult} />);
  const trigger = screen.getByRole("button", { name: "Fail" });
  trigger.focus();
  fireEvent.click(trigger);
  const dialog = await screen.findByRole("alertdialog");
  expect(dialog.textContent).toContain("Upload failed");
  expect(dialog.textContent).toContain("Choose a video up to 40 MiB.");
  expect(screen.getAllByRole("button", { name: "OK" })).toHaveLength(1);
  expect(dialog.classList.contains("ui-confirm")).toBe(true);
  expect(document.querySelector(".ui-confirm-backdrop")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "OK" }));
  await waitFor(() => expect(onResult).toHaveBeenCalledWith(true));
  await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  expect(document.activeElement).toBe(trigger);
});

it("associates SwitchRow labels and optional hints with the switch control", () => {
  const change = vi.fn();
  render(<SwitchRow label="Show app labels" hint="Names beneath icons." checked={false} onCheckedChange={change} />);
  const control = screen.getByRole("switch", { name: "Show app labels" });
  expect(control.getAttribute("aria-describedby")).toBeTruthy();
  expect(document.getElementById(control.getAttribute("aria-describedby")!)?.textContent).toBe("Names beneath icons.");
  fireEvent.click(control);
  expect(change).toHaveBeenCalledWith(true);
});

it("renders stacked Range with label, value and accessible slider name", () => {
  const change = vi.fn();
  const { container } = render(
    <Range label="Blur" value={12} min={0} max={24} unit="px" change={change} />,
  );
  expect(screen.getByRole("slider", { name: "Blur" })).toBeTruthy();
  expect(container.querySelector(".ui-range-inline")).toBeNull();
  expect(container.querySelector(".ui-range-label")?.textContent).toContain("Blur");
  expect(container.querySelector(".ui-range-label output")?.textContent).toBe("12px");
});

it("stacks multiple Ranges in a SettingsGroup without an inline layout", () => {
  const change = vi.fn();
  const { container } = render(
    <SettingsGroup>
      <SettingsRow label="Effect"><span>Snow</span></SettingsRow>
      <SwitchRow label="Tint" checked onCheckedChange={() => {}} />
      <Range label="Speed" value={50} min={0} max={100} unit="%" change={change} />
      <Range label="Chromatic aberration" value={2} min={0} max={10} unit="px" change={change} />
    </SettingsGroup>,
  );
  const ranges = container.querySelectorAll(".ui-settings-group > .ui-range");
  expect(ranges).toHaveLength(2);
  expect(container.querySelector(".ui-range-inline")).toBeNull();
  for (const row of ranges) {
    expect(row.querySelector(".ui-range-label")).toBeTruthy();
    expect(row.querySelector(".ui-slider")).toBeTruthy();
  }
  expect(screen.getByRole("slider", { name: "Speed" })).toBeTruthy();
  expect(screen.getByRole("slider", { name: "Chromatic aberration" })).toBeTruthy();
});

it("renders Notice banners with alert semantics for errors", () => {
  render(<Notice tone="error" banner><span>Save failed</span><div className="ui-actions"><Button>Retry</Button></div></Notice>);
  expect(screen.getByRole("alert").textContent).toContain("Save failed");
  expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
});

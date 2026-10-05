// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Button, IconButton, SelectField, TextField } from "./components";

afterEach(cleanup);

it("connects labels, hints and errors with unique IDs and preserves external descriptions", () => {
  render(<><p id="external">External context</p>
    <TextField label="Name" hint="Short name" error="Name is required" aria-describedby="external" />
    <TextField label="Other name" />
    <SelectField label="Theme"><option>Midnight</option></SelectField>
  </>);
  const input = screen.getByLabelText("Name");
  expect(input.getAttribute("aria-invalid")).toBe("true");
  const ids = input.getAttribute("aria-describedby")!.split(" ");
  expect(ids.map(id => document.getElementById(id)?.textContent)).toEqual(["External context", "Short name", "Name is required"]);
  expect(input.id).not.toBe(screen.getByLabelText("Other name").id);
  expect(screen.getByLabelText("Theme").tagName).toBe("SELECT");
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

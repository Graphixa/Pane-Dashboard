import {
  SelectField,
  SelectOption,
  Text,
  TextField,
} from "../../design/components";
import type { Config } from "../../model";

export type AppPlacementFieldsProps = {
  config: Config;
  destination: string;
  col: number;
  row: number;
  onDestinationChange: (paneId: string) => void;
  onColChange: (col: number) => void;
  onRowChange: (row: number) => void;
};

/** Destination pane and 1-based column/row fields for Add/Edit app. */
export function AppPlacementFields({
  config,
  destination,
  col,
  row,
  onDestinationChange,
  onColChange,
  onRowChange,
}: AppPlacementFieldsProps) {
  const destinationPane = config.items.find((p) => p.id === destination);
  const placementSummary = `${destinationPane?.title || "Untitled pane"} · column ${col + 1}, row ${row + 1}`;

  return (
    <>
      <Text as="p" variant="support" className="ui-app-placement-summary">
        {placementSummary}
      </Text>
      <div className="fields">
        <SelectField
          label="Pane"
          value={destination}
          onValueChange={onDestinationChange}
        >
          {config.items.map((p) => (
            <SelectOption key={p.id} value={p.id}>
              {p.title || "Untitled pane"}
            </SelectOption>
          ))}
        </SelectField>
        <TextField
          label="Column (1-based)"
          type="number"
          min={1}
          required
          value={col + 1}
          onChange={(e) => onColChange(Number(e.target.value) - 1)}
        />
        <TextField
          label="Row (1-based)"
          type="number"
          min={1}
          required
          value={row + 1}
          onChange={(e) => onRowChange(Number(e.target.value) - 1)}
        />
      </div>
    </>
  );
}

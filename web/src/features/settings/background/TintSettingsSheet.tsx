import {
  Button,
  ColourField,
  Modal,
  Range,
  SettingsGroup,
} from "../../../design/components";
import type { Background } from "../../../appearance";

export function TintSettingsSheet({
  settings,
  onBackground,
  onClose,
}: {
  settings: Background;
  onBackground: (update: Partial<Background>) => void;
  onClose: () => void;
}) {
  const tint = settings.tint;
  if (!tint) return null;
  return (
    <Modal
      nested
      title="Tint"
      placement="bottom"
      backdrop="none"
      className="background-adjust-dialog"
      close={onClose}
      footer={
        <Button variant="primary" onClick={onClose}>
          Done
        </Button>
      }
    >
      <SettingsGroup density="compact">
        <ColourField
          label="Colour"
          colour={tint.colour}
          onColour={(colour) => onBackground({ tint: { ...tint, colour } })}
        />
        <Range
          label="Opacity"
          min={0}
          max={80}
          unit="%"
          value={tint.opacity}
          change={(opacity) => onBackground({ tint: { ...tint, opacity } })}
        />
      </SettingsGroup>
    </Modal>
  );
}

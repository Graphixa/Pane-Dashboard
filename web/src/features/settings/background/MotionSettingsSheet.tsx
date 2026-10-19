import {
  Button,
  Modal,
  Range,
  Select,
  SelectOption,
  SettingsGroup,
  SettingsRow,
} from "../../../design/components";
import {
  motionStyleLabels,
  motionStyles,
  type Background,
  type MotionStyle,
} from "../../../appearance";

export function MotionSettingsSheet({
  settings,
  onBackground,
  onClose,
}: {
  settings: Background;
  onBackground: (update: Partial<Background>) => void;
  onClose: () => void;
}) {
  const b = settings;
  return (
    <Modal
      nested
      title="Motion"
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
        <SettingsRow label="Style">
          <Select
            aria-label="Motion style"
            value={b.photoMotion.style}
            onValueChange={(style) =>
              onBackground({
                photoMotion: {
                  style: style as MotionStyle,
                  intensity: b.photoMotion.intensity,
                },
              })
            }
          >
            {motionStyles.map((id) => (
              <SelectOption key={id} value={id}>
                {motionStyleLabels[id]}
              </SelectOption>
            ))}
          </Select>
        </SettingsRow>
        <Range
          label="Intensity"
          min={0}
          max={100}
          unit="%"
          value={b.photoMotion.intensity}
          change={(intensity) =>
            onBackground({ photoMotion: { ...b.photoMotion, intensity } })
          }
        />
      </SettingsGroup>
    </Modal>
  );
}

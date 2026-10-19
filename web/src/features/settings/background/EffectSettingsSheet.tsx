import {
  Button,
  ColourField,
  Modal,
  Range,
  Select,
  SelectOption,
  SettingsGroup,
  SettingsRow,
} from "../../../design/components";
import {
  effectIds,
  effectLabels,
  type Background,
  type Effect,
  type EffectId,
} from "../../../appearance";
import { getEffectPack } from "../../../effects/registry";

export function EffectSettingsSheet({
  settings,
  lastEffect,
  onBackground,
  onClose,
}: {
  settings: Background;
  lastEffect: Effect | undefined;
  onBackground: (update: Partial<Background>) => void;
  onClose: () => void;
}) {
  const b = settings;
  if (!b.effect) return null;
  return (
    <Modal
      nested
      title="Screen Effects"
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
        <SettingsRow label="Effect">
          <Select
            aria-label="Screen effect"
            value={b.effect.id}
            onValueChange={(id) => {
              const pack = getEffectPack(id);
              if (!pack) return;
              const prev =
                lastEffect?.id === id ? lastEffect : undefined;
              const params: Record<string, string | number | boolean> = {
                ...(prev?.params ?? {}),
              };
              for (const c of pack.controls) {
                if (params[c.key] === undefined) params[c.key] = c.default;
              }
              onBackground({ effect: { id: id as EffectId, params } });
            }}
          >
            {effectIds.map((id) => (
              <SelectOption key={id} value={id}>
                {effectLabels[id]}
              </SelectOption>
            ))}
          </Select>
        </SettingsRow>
        {getEffectPack(b.effect.id)?.controls.map((c) =>
          c.type === "colour" ? (
            <ColourField
              key={c.key}
              label={c.label}
              colour={String(b.effect?.params[c.key] ?? c.default)}
              onColour={(colour) =>
                onBackground({
                  effect: {
                    id: b.effect!.id,
                    params: { ...b.effect!.params, [c.key]: colour },
                  },
                })
              }
            />
          ) : (
            <Range
              key={c.key}
              label={c.label}
              min={c.min}
              max={c.max}
              value={Number(b.effect?.params[c.key] ?? c.default)}
              change={(n) =>
                onBackground({
                  effect: {
                    id: b.effect!.id,
                    params: { ...b.effect!.params, [c.key]: n },
                  },
                })
              }
            />
          ),
        )}
      </SettingsGroup>
    </Modal>
  );
}

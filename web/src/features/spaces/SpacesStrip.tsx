import { Tabs, TabsList, TabsTrigger, Button } from "../../design/components";
import type { Space } from "../../model";

export function SpacesStrip({
  spaces,
  activeId,
  editing,
  onSelect,
  onNew,
  onManage,
}: {
  spaces: Space[];
  activeId: string;
  editing: boolean;
  onSelect: (id: string) => void;
  onNew?: () => void;
  onManage?: () => void;
}) {
  const showStrip = editing || spaces.length > 1;
  if (!showStrip) return null;
  return (
    <div className="spaces-strip">
      {spaces.length > 1 || editing ? (
        <Tabs
          value={activeId}
          onValueChange={onSelect}
          className="space-tabs"
        >
          <TabsList aria-label="Spaces">
            {spaces.map((s) => (
              <TabsTrigger key={s.id} value={s.id} title={s.name}>
                {s.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      ) : null}
      {editing && (
        <div className="spaces-strip-actions">
          {onNew && (
            <Button type="button" variant="quiet" onClick={onNew}>
              New space
            </Button>
          )}
          {onManage && (
            <Button type="button" variant="quiet" onClick={onManage}>
              Manage spaces
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

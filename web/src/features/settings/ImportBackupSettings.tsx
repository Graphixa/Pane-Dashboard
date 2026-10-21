import {
  Button,
  Notice,
  Section,
  SettingsGroup,
  SettingsRow,
} from "../../design/components";
import type { Config } from "../../model";
import { sanitiseExport } from "../../model";
import { download } from "../../utils/download";
import ImportPanel from "../../ImportPanel";

export default function ImportBackupSettings({
  config,
  blocked,
  busy,
  readOnly,
  imported,
  close,
  activeSpaceId,
}: {
  config: Config;
  blocked: boolean;
  busy: boolean;
  readOnly: boolean;
  imported: (c: Config, id?: string) => void;
  close: () => void;
  activeSpaceId?: string;
}) {
  return (
    <>
      {blocked && !readOnly && (
        <Notice>
          Apply or discard your settings changes before importing or exporting.
        </Notice>
      )}
      <Section
        level="h3"
        className="settings-section"
        title="Export"
        tip="Downloads use your saved dashboard."
      >
        <SettingsGroup>
          <SettingsRow
            label="Private backup"
            hint="Includes app addresses, Docker identities and uploaded images."
          >
            <Button
              type="button"
              disabled={blocked || busy}
              onClick={() => download("pane-backup.yaml", config)}
            >
              Download full backup
            </Button>
          </SettingsRow>
          <SettingsRow
            label="Share a layout"
            hint="Omits app addresses and Docker identities. Review images before sharing."
          >
            <Button
              type="button"
              disabled={blocked || busy}
              onClick={() =>
                download("pane-layout.yaml", sanitiseExport(config))
              }
            >
              Export shareable layout
            </Button>
          </SettingsRow>
        </SettingsGroup>
      </Section>
      <Section level="h3" className="settings-section" title="Import">
        {readOnly ? (
          <Notice>
            Use a wider desktop screen to import. Saved backups remain available
            when you can edit.
          </Notice>
        ) : (
          <SettingsGroup>
            <SettingsRow>
              <ImportPanel
                config={config}
                disabled={blocked || busy}
                activeSpaceId={activeSpaceId}
                imported={(c, id) => {
                  imported(c, id);
                  close();
                }}
              />
            </SettingsRow>
          </SettingsGroup>
        )}
      </Section>
    </>
  );
}

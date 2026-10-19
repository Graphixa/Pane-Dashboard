import type { ReactNode, RefObject } from "react";
import {
  Button,
  Modal,
  Notice,
  ScrollArea,
  Text,
} from "../../../design/components";
import { mediaRefEqual, type Background, type MediaRef } from "../../../appearance";
import type { ChooserView } from "./WallpaperCategoryGrid";

export type WallpaperChooserProps = {
  open: boolean;
  view: ChooserView;
  categoryTitle: string;
  settings: Background;
  sheetError: string;
  pendingRemove: MediaRef | null;
  bodyScrollRef: RefObject<HTMLDivElement | null>;
  headerActions: ReactNode;
  onDiscard: () => void;
  onBack?: () => void;
  onCommit: () => void;
  onKeepPending: () => void;
  onConfirmRemove: () => void;
  children: ReactNode;
};

/** Choose wallpaper bottom sheet shell (Browse / category views as children). */
export function WallpaperChooser({
  open,
  view,
  categoryTitle,
  settings: b,
  sheetError,
  pendingRemove,
  bodyScrollRef,
  headerActions,
  onDiscard,
  onBack,
  onCommit,
  onKeepPending,
  onConfirmRemove,
  children,
}: WallpaperChooserProps) {
  if (!open) return null;
  return (
    <Modal
      nested
      title={view === "browse" ? "Choose wallpaper" : categoryTitle}
      placement="bottom"
      backdrop="none"
      className="background-library-dialog"
      close={() => void onDiscard()}
      onBack={view === "browse" ? undefined : onBack}
      headerActions={headerActions}
      footer={
        <div className="background-library-actions">
          <Text as="p" variant="support" className="background-library-actions-note">
            Apply in Settings to save.
          </Text>
          <div className="ui-actions">
            <Button type="button" variant="primary" onClick={onCommit}>
              Use wallpaper
            </Button>
          </div>
        </div>
      }
    >
      {sheetError && (
        <Notice tone="error" className="background-library-sheet-notice">
          {sheetError}
        </Notice>
      )}
      {pendingRemove && (
        <Notice tone="error" banner className="background-library-sheet-notice">
          <span>
            {(b.wallpaper.kind === "image" || b.wallpaper.kind === "video") &&
            mediaRefEqual(b.wallpaper.media, pendingRemove)
              ? "Remove this item from the draft library? Your current wallpaper will become None until you choose another. Closing this sheet without Use wallpaper restores the previous draft; Settings Cancel restores the saved appearance."
              : "Remove this item from the draft library? Closing this sheet without Use wallpaper restores the previous draft; Settings Cancel restores the saved appearance. Files still referenced by the saved config are kept on disk."}
          </span>
          <div className="ui-actions">
            <Button type="button" onClick={onKeepPending}>
              Keep
            </Button>
            <Button type="button" variant="danger" onClick={onConfirmRemove}>
              Remove
            </Button>
          </div>
        </Notice>
      )}
      <div ref={bodyScrollRef} className="background-library-scroll-host">
        <ScrollArea
          className="background-library-body-scroll"
          type="auto"
          aria-label={view === "browse" ? "Wallpapers" : categoryTitle}
        >
          {children}
        </ScrollArea>
      </div>
    </Modal>
  );
}

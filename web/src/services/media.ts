import {
  assetIdFromMediaPath,
  extractVideoStillFromFile,
  putVideoPoster,
  seedVideoStillFromBlob,
} from "../videoStillCache";

export type StagedMedia = {
  sessionId: string;
  previewUrl: string;
  kind: "image" | "video";
  meta: {
    mime: string;
    width: number;
    height: number;
    name: string;
    bytes: number;
  };
};

/** Upload original bytes to staging. Preserves format; no JPEG conversion. */
export async function stageMediaUpload(file: File): Promise<StagedMedia> {
  const isVideo = file.type.startsWith("video/");
  const isImage = ["image/png", "image/jpeg", "image/webp"].includes(file.type);
  if (!isImage && !isVideo)
    throw Error("Choose a PNG, JPEG, WebP, WebM or MP4 file.");
  const limit = isVideo ? 40 * 1024 * 1024 : 12 * 1024 * 1024;
  if (file.size > limit)
    throw Error(
      isVideo
        ? "Choose a video up to 40 MiB."
        : "Choose an image up to 12 MiB.",
    );
  const res = await fetch("/api/media/upload", {
    method: "POST",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "X-Pane-Filename": file.name || "upload",
    },
    body: file,
  });
  const body = await res.json();
  if (!res.ok) throw Error(body.error || "Upload failed.");
  if (!body.sessionId || !body.previewUrl || !body.meta)
    throw Error("Invalid upload response.");
  return {
    sessionId: body.sessionId,
    previewUrl: body.previewUrl,
    kind: body.meta.kind,
    meta: body.meta,
  };
}

export type CommittedMedia = {
  path: string;
  name: string;
  kind: "image" | "video";
};

/** Commit staged upload into a durable asset; returns path plus stored display name. */
export async function commitStagedMedia(sessionId: string): Promise<CommittedMedia> {
  const res = await fetch("/api/media/commit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId }),
  });
  const body = await res.json();
  if (!res.ok) throw Error(body.error || "Could not save media.");
  if (!body.assetId) throw Error("Invalid commit response.");
  const kind: "image" | "video" =
    body.meta?.kind === "video" ? "video" : "image";
  return {
    path: `/media/assets/${body.assetId}`,
    name: typeof body.meta?.name === "string" && body.meta.name
      ? body.meta.name
      : "upload",
    kind,
  };
}

/** Upload and immediately commit so draft config holds durable asset paths. */
export async function prepareUpload(
  file: File,
  _kind: "icon" | "logo" | "background",
): Promise<CommittedMedia> {
  const staged = await stageMediaUpload(file);
  const committed = await commitStagedMedia(staged.sessionId);
  if (committed.kind === "video") {
    try {
      const still = await extractVideoStillFromFile(file);
      const assetId = assetIdFromMediaPath(committed.path);
      if (still && assetId) {
        seedVideoStillFromBlob(committed.path, still);
        await putVideoPoster(assetId, still);
      }
    } catch {
      // Soft-fail: upload already committed; hover backfill can store a poster later.
    }
  }
  return committed;
}

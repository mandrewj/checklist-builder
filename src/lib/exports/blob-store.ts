/**
 * Local "blob store" — writes export artifacts to a directory on disk
 * keyed by project/snapshot/format. Shape matches Vercel Blob (returns a
 * URL-ish handle) so the production swap is a driver change only.
 *
 * Layout: <BLOB_ROOT>/<projectId>/<snapshotId>/<format>.<ext>
 *
 * Note: on Vercel, /tmp is ephemeral per function instance — exports written
 * during one invocation may not be readable on the next. For persistence,
 * swap to @vercel/blob. This file is intentionally tiny so that swap is
 * trivial later.
 */

import { mkdir, writeFile, readFile, stat } from "node:fs/promises";
import path from "node:path";

// Lazy — evaluated on first call so module load doesn't trigger Turbopack's
// node-file-tracing of every file under cwd.
function blobRoot(): string {
  return process.env.BLOB_ROOT ?? "/tmp/checklist-builder-blob";
}

const EXT: Record<string, string> = {
  docx: "docx",
  csv: "csv",
  maps: "zip",
  dwc: "zip",
  json: "json",
};

export interface BlobHandle {
  key: string;
  url: string;
  bytes: number;
  contentType: string;
}

export async function putBlob(
  projectId: string,
  snapshotId: string,
  format: string,
  data: Buffer,
  contentType: string,
): Promise<BlobHandle> {
  const ext = EXT[format] ?? format;
  const key = `${projectId}/${snapshotId}/${format}.${ext}`;
  // Path is computed at runtime from caller-supplied ids; the
  // turbopackIgnore hint stops Turbopack from trying to NFT-trace every
  // possible file under cwd at build time.
  const abs = /*turbopackIgnore: true*/ path.join(blobRoot(), key);
  await mkdir(/*turbopackIgnore: true*/ path.dirname(abs), { recursive: true });
  await writeFile(abs, data);
  return {
    key,
    url: `blob://${key}`,
    bytes: data.byteLength,
    contentType,
  };
}

export async function getBlob(
  key: string,
): Promise<{ buffer: Buffer; bytes: number } | null> {
  const abs = /*turbopackIgnore: true*/ path.join(blobRoot(), key);
  try {
    const buf = await readFile(abs);
    const s = await stat(abs);
    return { buffer: buf, bytes: s.size };
  } catch {
    return null;
  }
}

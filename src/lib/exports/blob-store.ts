/**
 * Local-dev "blob store" — writes export artifacts to a directory on disk
 * keyed by project/snapshot/format. Shape matches Vercel Blob (returns a
 * URL-ish handle) so the production swap is a driver change only.
 *
 * Layout: /tmp/insectid-blob/<projectId>/<snapshotId>/<format>.<ext>
 */

import { mkdir, writeFile, readFile, stat } from "node:fs/promises";
import path from "node:path";

export const BLOB_ROOT = process.env.INSECTID_BLOB_ROOT ?? "/tmp/insectid-blob";

const EXT: Record<string, string> = {
  docx: "docx",
  csv: "csv",
  maps: "zip",
  dwc: "zip",
  json: "json",
};

export interface BlobHandle {
  key: string;       // relative path within BLOB_ROOT
  url: string;       // blob:// URL we persist in export_artifacts
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
  const key = path.join(projectId, snapshotId, `${format}.${ext}`);
  const abs = path.join(BLOB_ROOT, key);
  await mkdir(path.dirname(abs), { recursive: true });
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
  const abs = path.join(BLOB_ROOT, key);
  try {
    const buf = await readFile(abs);
    const s = await stat(abs);
    return { buffer: buf, bytes: s.size };
  } catch {
    return null;
  }
}

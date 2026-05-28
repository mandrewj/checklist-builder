/**
 * Export-artifact storage.
 *
 * Two backends, selected at runtime:
 *   - Vercel Blob — used when BLOB_READ_WRITE_TOKEN is present (production,
 *     and locally if you've pulled the token). Artifacts persist across
 *     function invocations, which /tmp does not.
 *   - Local filesystem — fallback for local dev with no token. Writes under
 *     BLOB_ROOT (defaults to /tmp/checklist-builder-blob).
 *
 * `putBlob` returns a `BlobHandle` whose `url` is persisted in
 * export_artifacts.blobUrl:
 *   - Vercel Blob → a https://…blob.vercel-storage.com/… URL
 *   - Local fs   → a blob://<key> pseudo-URL
 * `getBlob` accepts that stored value and fetches the bytes from whichever
 * backend produced it, so the download route can stay a single auth-gated
 * proxy regardless of backend.
 */

import { mkdir, writeFile, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { put } from "@vercel/blob";

function blobRoot(): string {
  return process.env.BLOB_ROOT ?? "/tmp/checklist-builder-blob";
}

function usingVercelBlob(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
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

  if (usingVercelBlob()) {
    // Deterministic key (no random suffix) + allowOverwrite so regenerating
    // the same snapshot/format replaces the old object instead of orphaning
    // it. The content is deterministic per (snapshot, format) anyway.
    const blob = await put(key, data, {
      access: "public",
      contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    return { key, url: blob.url, bytes: data.byteLength, contentType };
  }

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

/**
 * Fetch artifact bytes given the stored blobUrl. Handles both backends:
 * https URLs (Vercel Blob) are fetched; blob://<key> values are read from
 * disk. Returns null if the artifact can't be found.
 */
export async function getBlob(
  blobUrl: string,
): Promise<{ buffer: Buffer; bytes: number } | null> {
  if (/^https?:\/\//.test(blobUrl)) {
    try {
      const res = await fetch(blobUrl);
      if (!res.ok) return null;
      const buffer = Buffer.from(await res.arrayBuffer());
      return { buffer, bytes: buffer.byteLength };
    } catch {
      return null;
    }
  }

  const key = blobUrl.replace(/^blob:\/\//, "");
  const abs = /*turbopackIgnore: true*/ path.join(blobRoot(), key);
  try {
    const buf = await readFile(abs);
    const s = await stat(abs);
    return { buffer: buf, bytes: s.size };
  } catch {
    return null;
  }
}

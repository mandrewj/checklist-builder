import { pgEnum } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["Lead", "Contributor", "Reviewer"]);
export const inclusionEnum = pgEnum("inclusion", [
  "include",
  "exclude",
  "undecided",
]);
export const taxonSourceEnum = pgEnum("taxon_source", [
  "gbif",
  "inat",
  "manual",
  "merged",
]);
export const recordSourceEnum = pgEnum("record_source", [
  "gbif",
  "inat",
  "manual",
  "cite",
]);
export const recordStatusEnum = pgEnum("record_status", [
  "pending",
  "accepted",
  "rejected",
  "flagged",
]);
export const conflictResolutionEnum = pgEnum("conflict_resolution", [
  "gbif",
  "inat",
  "separate",
  "merged",
]);
export const exportFormatEnum = pgEnum("export_format", [
  "docx",
  "csv",
  "maps",
  "dwc",
  "json",
]);
export const ingestStatusEnum = pgEnum("ingest_status", [
  "pending",
  "running",
  "done",
  "failed",
]);

CREATE TYPE "public"."conflict_resolution" AS ENUM('gbif', 'inat', 'separate', 'merged');--> statement-breakpoint
CREATE TYPE "public"."export_format" AS ENUM('docx', 'csv', 'maps', 'dwc', 'json');--> statement-breakpoint
CREATE TYPE "public"."inclusion" AS ENUM('include', 'exclude', 'undecided');--> statement-breakpoint
CREATE TYPE "public"."ingest_status" AS ENUM('pending', 'running', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."record_source" AS ENUM('gbif', 'inat', 'manual', 'cite');--> statement-breakpoint
CREATE TYPE "public"."record_status" AS ENUM('pending', 'accepted', 'rejected', 'flagged');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('Lead', 'Contributor', 'Reviewer');--> statement-breakpoint
CREATE TYPE "public"."taxon_source" AS ENUM('gbif', 'inat', 'manual', 'merged');--> statement-breakpoint
CREATE TABLE "activity_log" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"parent_id" text,
	"ts" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"author_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "county_presence" (
	"project_id" text NOT NULL,
	"taxon_id" text NOT NULL,
	"county_fips" text NOT NULL,
	"n_records" integer NOT NULL,
	"has_cite_only" boolean DEFAULT false NOT NULL,
	CONSTRAINT "county_presence_project_id_taxon_id_county_fips_pk" PRIMARY KEY("project_id","taxon_id","county_fips")
);
--> statement-breakpoint
CREATE TABLE "export_artifacts" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"snapshot_id" text NOT NULL,
	"format" "export_format" NOT NULL,
	"blob_url" text NOT NULL,
	"bytes" integer,
	"generated_by" text NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"initials" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"taxon_query" jsonb NOT NULL,
	"region_codes" text[] NOT NULL,
	"ingest_filters" jsonb NOT NULL,
	"locked_at" timestamp with time zone,
	"locked_snapshot_id" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"project_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" "role" NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memberships_project_id_user_id_pk" PRIMARY KEY("project_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "taxa" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"scientific_name" text NOT NULL,
	"authority" text,
	"rank" text NOT NULL,
	"parent_id" text,
	"source" "taxon_source" NOT NULL,
	"external_ids" jsonb NOT NULL,
	"family" text,
	"subfamily" text,
	"included" "inclusion" DEFAULT 'undecided' NOT NULL,
	"inclusion_reasoning" text DEFAULT '',
	"inclusion_updated_at" timestamp with time zone,
	"inclusion_updated_by" text
);
--> statement-breakpoint
CREATE TABLE "records" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"taxon_id" text NOT NULL,
	"source" "record_source" NOT NULL,
	"external_id" text,
	"lat" double precision,
	"lng" double precision,
	"state_code" text,
	"county_fips" text,
	"observed_at" date,
	"collector" text,
	"image_url" text,
	"raw" jsonb,
	"status" "record_status" DEFAULT 'pending' NOT NULL,
	"flag_reason" text,
	"citation" text,
	"doi" text,
	"notes" text,
	"added_by" text,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_cite_citation" CHECK ("records"."source" <> 'cite' OR "records"."citation" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "taxon_conflicts" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"taxon_id" text,
	"gbif_name" text NOT NULL,
	"gbif_authority" text,
	"inat_name" text NOT NULL,
	"inat_authority" text,
	"gbif_records" integer DEFAULT 0 NOT NULL,
	"inat_records" integer DEFAULT 0 NOT NULL,
	"note" text DEFAULT '',
	"resolution" "conflict_resolution",
	"resolved_by" text,
	"resolved_at" timestamp with time zone,
	"custom_name" text
);
--> statement-breakpoint
CREATE TABLE "ingest_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"source" text NOT NULL,
	"status" "ingest_status" DEFAULT 'pending' NOT NULL,
	"cursor" text,
	"page_size" integer DEFAULT 300 NOT NULL,
	"fetched" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"error" text
);
--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "county_presence" ADD CONSTRAINT "county_presence_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "county_presence" ADD CONSTRAINT "county_presence_taxon_id_taxa_id_fk" FOREIGN KEY ("taxon_id") REFERENCES "public"."taxa"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_artifacts" ADD CONSTRAINT "export_artifacts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_artifacts" ADD CONSTRAINT "export_artifacts_generated_by_users_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "taxa" ADD CONSTRAINT "taxa_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "taxa" ADD CONSTRAINT "taxa_inclusion_updated_by_users_id_fk" FOREIGN KEY ("inclusion_updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "records" ADD CONSTRAINT "records_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "records" ADD CONSTRAINT "records_taxon_id_taxa_id_fk" FOREIGN KEY ("taxon_id") REFERENCES "public"."taxa"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "records" ADD CONSTRAINT "records_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "taxon_conflicts" ADD CONSTRAINT "taxon_conflicts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "taxon_conflicts" ADD CONSTRAINT "taxon_conflicts_taxon_id_taxa_id_fk" FOREIGN KEY ("taxon_id") REFERENCES "public"."taxa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "taxon_conflicts" ADD CONSTRAINT "taxon_conflicts_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingest_jobs" ADD CONSTRAINT "ingest_jobs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_activity_project_ts" ON "activity_log" USING btree ("project_id","ts" desc);--> statement-breakpoint
CREATE INDEX "idx_activity_actor" ON "activity_log" USING btree ("project_id","actor_id");--> statement-breakpoint
CREATE INDEX "idx_activity_action" ON "activity_log" USING btree ("project_id","action");--> statement-breakpoint
CREATE INDEX "idx_comments_target" ON "comments" USING btree ("project_id","target_type","target_id");--> statement-breakpoint
CREATE INDEX "idx_cp_taxon_county" ON "county_presence" USING btree ("taxon_id","county_fips");--> statement-breakpoint
CREATE INDEX "idx_exports_proj_snap" ON "export_artifacts" USING btree ("project_id","snapshot_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_users_email" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_projects_created_by" ON "projects" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "idx_projects_locked" ON "projects" USING btree ("locked_at") WHERE "projects"."locked_at" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_memberships_user" ON "memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_taxa_project" ON "taxa" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_taxa_name" ON "taxa" USING btree ("project_id","scientific_name");--> statement-breakpoint
CREATE INDEX "idx_taxa_included" ON "taxa" USING btree ("project_id","included");--> statement-breakpoint
CREATE INDEX "idx_records_project_taxon" ON "records" USING btree ("project_id","taxon_id");--> statement-breakpoint
CREATE INDEX "idx_records_county" ON "records" USING btree ("project_id","county_fips");--> statement-breakpoint
CREATE INDEX "idx_records_status" ON "records" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "idx_records_source" ON "records" USING btree ("project_id","source");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_records_external" ON "records" USING btree ("project_id","source","external_id");--> statement-breakpoint
CREATE INDEX "idx_conflicts_project" ON "taxon_conflicts" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_conflicts_open" ON "taxon_conflicts" USING btree ("project_id") WHERE "taxon_conflicts"."resolution" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_ingest_proj_status" ON "ingest_jobs" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "idx_ingest_running" ON "ingest_jobs" USING btree ("status") WHERE "ingest_jobs"."status" = 'running';
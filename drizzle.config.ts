import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle",
  schema: "./src/lib/db/schema",
  dialect: "postgresql",
  verbose: true,
  strict: true,
});

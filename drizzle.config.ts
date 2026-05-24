import { defineConfig } from "drizzle-kit";

// Generates SQL migrations into ./migrations, which `wrangler d1 migrations
// apply seatmap-real --local|--remote` then runs against D1.
//
// For remote `drizzle-kit push`/`studio` against D1, set CLOUDFLARE_ACCOUNT_ID,
// CLOUDFLARE_DATABASE_ID and CLOUDFLARE_D1_TOKEN in the environment.
export default defineConfig({
  schema: "./src/server/db/schema.ts",
  out: "./migrations",
  dialect: "sqlite",
  driver: "d1-http",
  dbCredentials: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? "",
    databaseId: process.env.CLOUDFLARE_DATABASE_ID ?? "",
    token: process.env.CLOUDFLARE_D1_TOKEN ?? "",
  },
});

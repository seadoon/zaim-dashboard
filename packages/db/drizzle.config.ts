import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/schema/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DB_PATH || "../../data/moneyforward.db",
  },
});

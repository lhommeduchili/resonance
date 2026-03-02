import { defineConfig } from "drizzle-kit";

export default defineConfig({
    schema: "./src/db/schema.ts",
    out: "./src/db/migrations",
    dialect: "postgresql",
    dbCredentials: {
        // For local dev, a standard local postgres url
        url: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/resonance",
    },
});

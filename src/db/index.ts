import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// For local development, set a default
const connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/resonance";

// Disable prefetch as recommended for serverless/Next.js edge, 
// though we use it natively in server.js, this is a safe default.
const queryClient = postgres(connectionString, { prepare: false });

export const db = drizzle(queryClient, { schema });

import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

// Don't throw error immediately - let the app start and show a better error message
if (!process.env.DATABASE_URL) {
  console.error(
    "⚠ WARNING: DATABASE_URL is not set. Database operations will fail.",
  );
  console.error("   Please set DATABASE_URL in your environment variables.");
}

export const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : null as any;

export const db = process.env.DATABASE_URL
  ? drizzle({ client: pool, schema })
  : null as any;

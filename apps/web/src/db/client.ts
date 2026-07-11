import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

const url = process.env.DATABASE_URL;
if (!url) {
  // Don't throw at import time — allow the app to boot for pages that don't need DB (e.g. login).
  // Server actions/queries that need the DB will throw when accessed.
  console.warn('DATABASE_URL not set — DB queries will fail.');
}

const sql = url ? neon(url) : null;
export const db = sql ? drizzle(sql, { schema }) : (null as unknown as ReturnType<typeof drizzle>);
export { schema };

import pg from "pg";
import type { AppConfig } from "../config/env.js";

export type DatabaseStatus = {
  ready: boolean;
  reason?: string;
};

export function createPool(config: AppConfig): pg.Pool | null {
  if (!config.DATABASE_URL) {
    return null;
  }

  return new pg.Pool({
    connectionString: config.DATABASE_URL,
    max: 5,
    connectionTimeoutMillis: 1500
  });
}

export async function checkDatabase(pool: pg.Pool | null): Promise<DatabaseStatus> {
  if (!pool) {
    return {
      ready: false,
      reason: "DATABASE_URL is not configured."
    };
  }

  try {
    await pool.query("select 1");
    return { ready: true };
  } catch (error) {
    return {
      ready: false,
      reason: error instanceof Error ? error.message : "Database readiness check failed."
    };
  }
}


import type pg from "pg";
import type { AppConfig } from "../config/env.js";
import type { createLogger } from "../config/logger.js";
import { createPool } from "./pool.js";
import { runMigrations, type MigrationRunSummary } from "./migrations.js";

type Logger = ReturnType<typeof createLogger>;

export type DatabaseHandle = {
  pool: pg.Pool | null;
  migrate: () => Promise<MigrationRunSummary | null>;
  close: () => Promise<void>;
};

export function createDatabase(config: AppConfig, logger: Logger): DatabaseHandle {
  const pool = createPool(config);

  return {
    pool,
    async migrate() {
      if (!pool) {
        logger.info("Database migrations skipped", { reason: "DATABASE_URL is not configured" });
        return null;
      }

      const summary = await runMigrations(pool);
      logger.info("Database migrations complete", {
        applied: summary.applied.length,
        skipped: summary.skipped.length
      });
      return summary;
    },
    async close() {
      await pool?.end();
    }
  };
}

import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type pg from "pg";

const defaultMigrationsDirectory = fileURLToPath(new URL("../../migrations/", import.meta.url));

export type MigrationFile = {
  filename: string;
  path: string;
  sql: string;
  checksum: string;
};

export type MigrationRunSummary = {
  applied: string[];
  skipped: string[];
};

export async function loadMigrationFiles(migrationsDirectory = defaultMigrationsDirectory): Promise<MigrationFile[]> {
  const filenames = (await readdir(migrationsDirectory))
    .filter((filename) => filename.endsWith(".sql"))
    .sort((left, right) => left.localeCompare(right));

  return Promise.all(
    filenames.map(async (filename) => {
      const migrationPath = path.join(migrationsDirectory, filename);
      const sql = await readFile(migrationPath, "utf8");

      return {
        filename,
        path: migrationPath,
        sql,
        checksum: createHash("sha256").update(sql).digest("hex")
      };
    })
  );
}

export async function runMigrations(pool: pg.Pool): Promise<MigrationRunSummary> {
  const migrations = await loadMigrationFiles();
  const client = await pool.connect();

  try {
    await client.query(`
      create table if not exists schema_migrations (
        filename text primary key,
        checksum text not null,
        applied_at timestamptz not null default now()
      )
    `);

    const existing = await client.query<{ filename: string; checksum: string }>(
      "select filename, checksum from schema_migrations"
    );
    const appliedChecksums = new Map(existing.rows.map((row) => [row.filename, row.checksum]));
    const summary: MigrationRunSummary = { applied: [], skipped: [] };

    for (const migration of migrations) {
      const existingChecksum = appliedChecksums.get(migration.filename);

      if (existingChecksum) {
        if (existingChecksum !== migration.checksum) {
          throw new Error(`Migration checksum mismatch for ${migration.filename}.`);
        }

        summary.skipped.push(migration.filename);
        continue;
      }

      await client.query("begin");
      try {
        await client.query(migration.sql);
        await client.query("insert into schema_migrations (filename, checksum) values ($1, $2)", [
          migration.filename,
          migration.checksum
        ]);
        await client.query("commit");
        summary.applied.push(migration.filename);
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
    }

    return summary;
  } finally {
    client.release();
  }
}

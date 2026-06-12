import { loadConfig } from "./config/env.js";
import { createLogger } from "./config/logger.js";
import { createDatabase } from "./db/lifecycle.js";
import { createServer } from "./http/server.js";

const config = loadConfig();
const logger = createLogger(config.LOG_LEVEL);
const database = createDatabase(config, logger);

async function main() {
  await database.migrate();
  const app = createServer(config, database.pool);

  const server = app.listen(config.ARTIFACT_REVIEW_SERVICE_PORT, config.ARTIFACT_REVIEW_SERVICE_HOST, () => {
    logger.info("Artifact Review service started", {
      host: config.ARTIFACT_REVIEW_SERVICE_HOST,
      port: config.ARTIFACT_REVIEW_SERVICE_PORT,
      version: "0.1.0"
    });
  });

  async function shutdown(signal: NodeJS.Signals) {
    logger.info("Artifact Review service shutting down", { signal });
    server.close(() => {
      void database.close().finally(() => process.exit(0));
    });
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

void main().catch((error: unknown) => {
  logger.error("Artifact Review service failed to start", {
    reason: error instanceof Error ? error.message : "Unknown startup failure"
  });
  void database.close().finally(() => process.exit(1));
});

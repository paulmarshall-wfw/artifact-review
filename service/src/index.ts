import { loadConfig } from "./config/env.js";
import { createLogger } from "./config/logger.js";
import { createPool } from "./db/pool.js";
import { createServer } from "./http/server.js";

const config = loadConfig();
const logger = createLogger(config.LOG_LEVEL);
const pool = createPool(config);
const app = createServer(config, pool);

const server = app.listen(config.ARTIFACT_REVIEW_SERVICE_PORT, config.ARTIFACT_REVIEW_SERVICE_HOST, () => {
  logger.info("Artifact Review service started", {
    host: config.ARTIFACT_REVIEW_SERVICE_HOST,
    port: config.ARTIFACT_REVIEW_SERVICE_PORT,
    version: "0.1.0"
  });
});

function shutdown(signal: NodeJS.Signals) {
  logger.info("Artifact Review service shutting down", { signal });
  server.close(() => {
    void pool?.end().finally(() => process.exit(0));
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);


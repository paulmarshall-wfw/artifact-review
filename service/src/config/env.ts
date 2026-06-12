import { z } from "zod";

const envSchema = z.object({
  ARTIFACT_REVIEW_SERVICE_HOST: z.string().default("127.0.0.1"),
  ARTIFACT_REVIEW_SERVICE_PORT: z.coerce.number().int().positive().default(4793),
  DATABASE_URL: z.string().optional(),
  INVOKE_PROVIDERS_REGISTRY_URL: z.string().url().optional(),
  INVOKE_PROVIDERS_PROFILE: z.string().optional(),
  ARTIFACT_REVIEW_DEMO_PROVIDER_MODE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info")
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return envSchema.parse(env);
}


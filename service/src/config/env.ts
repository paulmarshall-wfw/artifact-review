import { z } from "zod";
import { defaultLocalEnvPath, readLocalEnvFileSync, type LocalEnvValues } from "./localEnv.js";

const envSchema = z.object({
  ARTIFACT_REVIEW_SERVICE_HOST: z.string().default("127.0.0.1"),
  ARTIFACT_REVIEW_SERVICE_PORT: z.coerce.number().int().positive().default(4794),
  DATABASE_URL: z.string().optional(),
  INVOKE_PROVIDERS_REGISTRY_URL: z.string().url().optional(),
  INVOKE_PROVIDERS_PROFILE: z.string().optional(),
  ARTIFACT_REVIEW_DEMO_PROVIDER_MODE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info")
});

export type ConfigValueSource = "env" | "local-env" | "none";
export type AppConfigMetadata = {
  localEnvFilePath: string;
  sources: {
    DATABASE_URL: ConfigValueSource;
  };
};
export type AppConfig = z.infer<typeof envSchema> & AppConfigMetadata;

export type LoadConfigOptions = {
  localEnvFilePath?: string;
  useLocalEnvFile?: boolean;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env, options: LoadConfigOptions = {}): AppConfig {
  const localEnvFilePath = options.localEnvFilePath ?? defaultLocalEnvPath;
  const useLocalEnvFile = options.useLocalEnvFile ?? env === process.env;
  const localEnv = useLocalEnvFile ? readLocalEnvFileSync(localEnvFilePath) : {};
  const mergedEnv = mergeConfigSources(localEnv, env);

  return {
    ...envSchema.parse(mergedEnv),
    localEnvFilePath,
    sources: {
      DATABASE_URL: resolveConfigValueSource("DATABASE_URL", env, localEnv)
    }
  };
}

function mergeConfigSources(localEnv: LocalEnvValues, env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const merged: NodeJS.ProcessEnv = { ...localEnv };
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined) {
      merged[key] = value;
    }
  }
  return merged;
}

function resolveConfigValueSource(key: string, env: NodeJS.ProcessEnv, localEnv: LocalEnvValues): ConfigValueSource {
  if (hasConfiguredValue(env[key])) {
    return "env";
  }
  if (hasConfiguredValue(localEnv[key])) {
    return "local-env";
  }
  return "none";
}

function hasConfiguredValue(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

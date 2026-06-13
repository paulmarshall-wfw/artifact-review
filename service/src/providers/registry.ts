import type { AppConfig } from "../config/env.js";

export type RegistryProfile = {
  profileKey: string;
  displayName?: string;
  description?: string;
};

export type RegistryProviderConfig = {
  providerKey: string;
  displayName?: string;
  enabled: boolean;
  adapterKey?: string;
  model?: string;
  externalSend: boolean;
  requiredSecretRef?: string;
  capabilities: Array<{ key: string; displayName?: string }>;
};

export type RegistryLookupResult = {
  configured: boolean;
  profileKey: string | null;
  reachable: boolean;
  missingProfile: boolean;
  profile: RegistryProfile | null;
  providers: RegistryProviderConfig[];
  error: string | null;
};

export async function fetchRegistryLookup(
  config: AppConfig,
  profileKey: string | undefined,
  fetchImpl: typeof fetch = fetch
): Promise<RegistryLookupResult> {
  const registryUrl = config.INVOKE_PROVIDERS_REGISTRY_URL?.replace(/\/$/, "");
  if (!registryUrl || !profileKey) {
    return {
      configured: Boolean(registryUrl && profileKey),
      profileKey: profileKey ?? null,
      reachable: false,
      missingProfile: false,
      profile: null,
      providers: [],
      error: !registryUrl
        ? "INVOKE_PROVIDERS_REGISTRY_URL is not configured."
        : "No selected provider profile is configured."
    };
  }

  try {
    const profile = await requestRegistryJson<RegistryProfile>(
      fetchImpl,
      `${registryUrl}/profiles/${encodeURIComponent(profileKey)}`
    );
    const providers = await requestRegistryJson<RegistryProviderConfig[]>(
      fetchImpl,
      `${registryUrl}/profiles/${encodeURIComponent(profileKey)}/providers`
    );
    return {
      configured: true,
      profileKey,
      reachable: true,
      missingProfile: false,
      profile,
      providers,
      error: null
    };
  } catch (error) {
    return {
      configured: true,
      profileKey,
      reachable: false,
      missingProfile: error instanceof RegistryLookupError && error.errorClass === "missing_profile",
      profile: null,
      providers: [],
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

class RegistryLookupError extends Error {
  constructor(readonly errorClass: string, message: string) {
    super(message);
  }
}

async function requestRegistryJson<T>(fetchImpl: typeof fetch, url: string): Promise<T> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "GET",
      signal: AbortSignal.timeout(750)
    });
  } catch (error) {
    throw new RegistryLookupError(
      "registry_unavailable",
      error instanceof Error ? error.message : "Provider registry is unavailable."
    );
  }

  const payload = await readJson(response);
  if (!response.ok) {
    throw new RegistryLookupError(
      readErrorClass(payload),
      readErrorMessage(payload, `Registry request failed with HTTP ${response.status}.`)
    );
  }

  return payload as T;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text.trim()) {
    return null;
  }
  return JSON.parse(text) as unknown;
}

function readErrorClass(payload: unknown): string {
  if (payload && typeof payload === "object" && "errorClass" in payload) {
    const errorClass = (payload as { errorClass?: unknown }).errorClass;
    if (typeof errorClass === "string") {
      return errorClass;
    }
  }
  return "registry_unavailable";
}

function readErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object" && "message" in payload) {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === "string") {
      return message;
    }
  }
  return fallback;
}

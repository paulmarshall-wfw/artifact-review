import { RemoteRegistryClient, RegistryClientError } from "@invoke-providers/client";
import type { ProviderConfig } from "@invoke-providers/core";

export type RegistryProfile = {
  profileKey: string;
  displayName?: string;
  description?: string;
};

export type RegistryProviderConfig = ProviderConfig;

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
  configuredRegistryUrl: string | undefined,
  profileKey: string | undefined,
  fetchImpl: typeof fetch = fetch
): Promise<RegistryLookupResult> {
  const registryUrl = configuredRegistryUrl?.replace(/\/$/, "");
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
    const client = new RemoteRegistryClient({ baseUrl: registryUrl, profileKey, fetchImpl });
    const [profile, providers] = await Promise.all([client.getProfile(profileKey), client.listProviders()]);
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
      missingProfile: error instanceof RegistryClientError && error.errorClass === "missing_profile",
      profile: null,
      providers: [],
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

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
  registryUrl: string | null;
  profileKey: string | null;
  reachable: boolean;
  missingProfile: boolean;
  profiles: RegistryProfile[];
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
    const profiles = registryUrl ? await fetchRegistryProfiles(registryUrl, fetchImpl) : [];
    return {
      configured: Boolean(registryUrl && profileKey),
      registryUrl: registryUrl ?? null,
      profileKey: profileKey ?? null,
      reachable: Boolean(registryUrl && profiles.length > 0),
      missingProfile: false,
      profiles,
      profile: null,
      providers: [],
      error: !registryUrl
        ? "INVOKE_PROVIDERS_REGISTRY_URL is not configured."
        : "No selected provider profile is configured."
    };
  }

  try {
    const client = new RemoteRegistryClient({ baseUrl: registryUrl, profileKey, fetchImpl });
    const [profiles, profile, providers] = await Promise.all([
      client.listProfiles(),
      client.getProfile(profileKey),
      client.listProviders()
    ]);
    return {
      configured: true,
      registryUrl,
      profileKey,
      reachable: true,
      missingProfile: false,
      profiles,
      profile,
      providers,
      error: null
    };
  } catch (error) {
    return {
      configured: true,
      registryUrl,
      profileKey,
      reachable: false,
      missingProfile: error instanceof RegistryClientError && error.errorClass === "missing_profile",
      profiles: [],
      profile: null,
      providers: [],
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function fetchRegistryProfiles(registryUrl: string, fetchImpl: typeof fetch): Promise<RegistryProfile[]> {
  try {
    const client = new RemoteRegistryClient({ baseUrl: registryUrl, profileKey: "__profiles__", fetchImpl });
    return await client.listProfiles();
  } catch {
    return [];
  }
}

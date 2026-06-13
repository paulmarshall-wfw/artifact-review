import { type JsonValue, type Queryable } from "./types.js";

export type ProviderRuntimeSettings = {
  registryUrl?: string;
  selectedProviderProfileKey?: string;
  demoProviderMode?: boolean;
};

export class AppSettingsRepository {
  constructor(private readonly db: Queryable) {}

  async get<T extends JsonValue>(key: string): Promise<T | null> {
    const result = await this.db.query<{ value: JsonValue }>("select value from app_settings where key = $1", [key]);
    return (result.rows[0]?.value as T | undefined) ?? null;
  }

  async set(key: string, value: JsonValue): Promise<void> {
    await this.db.query(
      `
        insert into app_settings (key, value, updated_at)
        values ($1, $2, now())
        on conflict (key)
        do update set value = excluded.value, updated_at = now()
      `,
      [key, JSON.stringify(value)]
    );
  }

  async getSelectedProviderProfileKey(): Promise<string | undefined> {
    const value = await this.get<string>("selectedProviderProfileKey");
    return value ?? undefined;
  }

  async setSelectedProviderProfileKey(profileKey: string): Promise<void> {
    await this.set("selectedProviderProfileKey", profileKey);
  }

  async getProviderRuntimeSettings(): Promise<ProviderRuntimeSettings> {
    const [registryUrl, selectedProviderProfileKey, demoProviderMode] = await Promise.all([
      this.get<string | null>("providerRegistryUrl"),
      this.getSelectedProviderProfileKey(),
      this.get<boolean | null>("demoProviderMode")
    ]);

    return {
      registryUrl: registryUrl?.trim() || undefined,
      selectedProviderProfileKey,
      demoProviderMode: typeof demoProviderMode === "boolean" ? demoProviderMode : undefined
    };
  }

  async setProviderRuntimeSettings(settings: ProviderRuntimeSettings): Promise<void> {
    await Promise.all([
      this.set("providerRegistryUrl", settings.registryUrl?.trim() || null),
      this.set("selectedProviderProfileKey", settings.selectedProviderProfileKey?.trim() || null),
      this.set("demoProviderMode", settings.demoProviderMode ?? false)
    ]);
  }
}

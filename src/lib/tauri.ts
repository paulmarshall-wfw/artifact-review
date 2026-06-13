type TauriInternalsWindow = Window & {
  __TAURI_INTERNALS__?: unknown;
};

export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in (window as TauriInternalsWindow);
}

export async function selectExportDestination(defaultFileName: string): Promise<string | null> {
  if (!isTauriRuntime()) {
    return null;
  }

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<string | null>("select_export_destination", { defaultFileName });
}

export async function revealExportedFile(path: string): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }

  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("reveal_exported_file", { path });
}

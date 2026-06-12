export type ReadinessItem = {
  key: string;
  label: string;
  ready: boolean;
  reason?: string;
};

export type SetupReadiness = {
  ready: boolean;
  checks: ReadinessItem[];
};

const apiBase = import.meta.env.VITE_ARTIFACT_REVIEW_API_BASE ?? "";

export async function getSetupReadiness(): Promise<SetupReadiness> {
  const response = await fetch(`${apiBase}/api/setup-readiness`);
  if (!response.ok) {
    throw new Error(`Setup readiness failed with ${response.status}`);
  }
  return response.json() as Promise<SetupReadiness>;
}


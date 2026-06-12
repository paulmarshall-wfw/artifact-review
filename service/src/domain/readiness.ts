export type ReadinessCheck = {
  key: string;
  label: string;
  ready: boolean;
  reason?: string;
};

export type ReadinessResponse = {
  ready: boolean;
  checks: ReadinessCheck[];
};

export function combineReadiness(checks: ReadinessCheck[]): ReadinessResponse {
  return {
    ready: checks.every((check) => check.ready),
    checks
  };
}


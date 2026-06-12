const apiBase = process.env.VITE_ARTIFACT_REVIEW_API_BASE ?? "http://127.0.0.1:4793";

async function main() {
  const response = await fetch(`${apiBase}/health`);
  if (!response.ok) {
    throw new Error(`Health check failed with ${response.status}`);
  }

  const health = await response.json();
  console.log(JSON.stringify(health, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});


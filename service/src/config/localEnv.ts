import { readFileSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const defaultLocalEnvPath = path.resolve(process.cwd(), ".env");

export type LocalEnvValues = Record<string, string>;

export async function readLocalEnvFile(filePath = defaultLocalEnvPath): Promise<LocalEnvValues> {
  try {
    return parseLocalEnv(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

export function readLocalEnvFileSync(filePath = defaultLocalEnvPath): LocalEnvValues {
  try {
    return parseLocalEnv(readFileSync(filePath, "utf8"));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

export async function setLocalEnvValue(key: string, value: string | null, filePath = defaultLocalEnvPath): Promise<void> {
  const normalizedValue = value?.trim() ?? "";
  let content = "";
  try {
    content = await readFile(filePath, "utf8");
  } catch (error) {
    if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) {
      throw error;
    }
  }

  const lines = content ? content.split(/\r?\n/) : [];
  const assignment = `${key}=${formatLocalEnvValue(normalizedValue)}`;
  const existingIndex = lines.findIndex((line) => {
    const parsed = parseLocalEnvLine(line);
    return parsed?.key === key;
  });

  if (existingIndex >= 0) {
    lines[existingIndex] = assignment;
  } else {
    if (lines.length > 0 && lines[lines.length - 1] !== "") {
      lines.push("");
    }
    lines.push(assignment);
  }

  await writeFile(filePath, `${lines.join("\n").replace(/\n+$/, "")}\n`, "utf8");
}

export function parseLocalEnv(content: string): LocalEnvValues {
  const values: LocalEnvValues = {};
  for (const line of content.split(/\r?\n/)) {
    const parsed = parseLocalEnvLine(line);
    if (parsed) {
      values[parsed.key] = parsed.value;
    }
  }
  return values;
}

function parseLocalEnvLine(line: string): { key: string; value: string } | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
  if (!match) {
    return null;
  }

  return {
    key: match[1],
    value: unquoteLocalEnvValue(match[2].trim())
  };
}

function unquoteLocalEnvValue(value: string): string {
  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function formatLocalEnvValue(value: string): string {
  return /[\s#"'\\]/.test(value) ? JSON.stringify(value) : value;
}

import type { QueryResult } from "pg";

export type Queryable = {
  query: <T extends object = Record<string, unknown>>(text: string, values?: unknown[]) => Promise<QueryResult<T>>;
};

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export function toJsonValue(value: unknown): JsonValue {
  return value as JsonValue;
}

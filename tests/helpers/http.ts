import http from "node:http";
import type { Socket } from "node:net";
import { Readable, Writable } from "node:stream";
import type pg from "pg";
import type { QueryResult } from "pg";
import { loadConfig } from "../../service/src/config/env";
import { createServer } from "../../service/src/http/server";
import type { Queryable } from "../../service/src/repositories/types";

export type QueuedQuery = {
  text: string;
  values?: unknown[];
};

export type TestResponse = {
  status: number;
  headers: Record<string, string>;
  body: unknown;
};

export function createQueuedDatabase(queuedRows: object[][]): Queryable & { queries: QueuedQuery[] } {
  const queries: QueuedQuery[] = [];
  const appSettings = new Map<string, unknown>();
  const documents = new Map<string, Record<string, unknown>>();

  return {
    queries,
    async query<T extends object = Record<string, unknown>>(text: string, values?: unknown[]): Promise<QueryResult<T>> {
      queries.push({ text, values });
      const normalizedText = text.replace(/\s+/g, " ").trim().toLowerCase();

      if (normalizedText.includes("select value from app_settings where key = $1") && typeof values?.[0] === "string") {
        const stored = appSettings.get(values[0]);
        return buildQueryResult(stored === undefined ? [] : ([{ value: stored }] as T[]));
      }

      if (normalizedText.includes("insert into app_settings") && typeof values?.[0] === "string") {
        const rawValue = values[1];
        appSettings.set(values[0], typeof rawValue === "string" ? JSON.parse(rawValue) : rawValue);
        return buildQueryResult([]);
      }

      if (normalizedText.includes("insert into documents")) {
        const rows = (queuedRows.shift() ?? []) as T[];
        for (const row of rows) {
          if ("id" in row && typeof row.id === "string") {
            documents.set(row.id, row as Record<string, unknown>);
          }
        }
        return buildQueryResult(rows);
      }

      if (normalizedText.includes("update documents") && typeof values?.[0] === "string") {
        const existing = documents.get(values[0]);
        if (existing) {
          const updated = {
            ...existing,
            current_workflow_item_ref: values[1],
            updated_at: existing.updated_at ?? new Date()
          } as T;
          documents.set(values[0], updated as Record<string, unknown>);
          return buildQueryResult([updated]);
        }
      }

      if (
        normalizedText.includes("from documents") &&
        normalizedText.includes("where id = $1") &&
        typeof values?.[0] === "string"
      ) {
        const existing = documents.get(values[0]);
        if (existing) {
          return buildQueryResult([existing as T]);
        }
        const rows = (queuedRows.shift() ?? []) as T[];
        for (const row of rows) {
          if ("id" in row && typeof row.id === "string") {
            documents.set(row.id, row as Record<string, unknown>);
          }
        }
        return buildQueryResult(rows);
      }

      const rows = (queuedRows.shift() ?? []) as T[];
      return buildQueryResult(rows);
    }
  };
}

function buildQueryResult<T extends object>(rows: T[]): QueryResult<T> {
  return {
    command: "SELECT",
    rowCount: rows.length,
    oid: 0,
    fields: [],
    rows
  };
}

export function createTestServer(db: Queryable | null, env: NodeJS.ProcessEnv = {}) {
  return createServer(
    loadConfig({
      ARTIFACT_REVIEW_SERVICE_HOST: "127.0.0.1",
      ARTIFACT_REVIEW_SERVICE_PORT: "4793",
      ...env
    }),
    db as pg.Pool | null
  );
}

export async function requestApp(
  app: ReturnType<typeof createServer>,
  method: string,
  url: string,
  body?: unknown
): Promise<TestResponse> {
  return new Promise((resolve, reject) => {
    const request = new Readable({ read() {} }) as http.IncomingMessage;
    request.url = url;
    request.method = method;

    const serializedBody = body === undefined ? null : Buffer.from(JSON.stringify(body));
    request.headers = serializedBody
      ? {
          "content-type": "application/json",
          "content-length": String(serializedBody.length)
        }
      : {};

    const responseChunks: Buffer[] = [];
    const socket = new Writable({
      write(chunk, _encoding, callback) {
        responseChunks.push(Buffer.from(chunk));
        callback();
      }
    });
    const response = new http.ServerResponse(request);

    socket.on("error", reject);
    response.assignSocket(socket as Socket);
    response.on("finish", () => {
      const rawResponse = Buffer.concat(responseChunks).toString("utf8");
      resolve(parseResponse(rawResponse));
    });

    if (serializedBody) {
      request.push(serializedBody);
    }
    request.push(null);

    const handleApp = app as unknown as {
      handle(request: http.IncomingMessage, response: http.ServerResponse, next: (error: unknown) => void): void;
    };
    handleApp.handle(request, response, reject);
  });
}

function parseResponse(rawResponse: string): TestResponse {
  const [rawHeaderBlock, rawBody = ""] = rawResponse.split("\r\n\r\n");
  const headerLines = rawHeaderBlock.split("\r\n");
  const statusLine = headerLines.shift() ?? "";
  const status = Number(statusLine.match(/^HTTP\/\d\.\d\s+(\d+)/)?.[1] ?? 0);
  const headers = Object.fromEntries(
    headerLines.map((line) => {
      const separatorIndex = line.indexOf(":");
      return [line.slice(0, separatorIndex).toLowerCase(), line.slice(separatorIndex + 1).trim()];
    })
  );

  return {
    status,
    headers,
    body: rawBody ? JSON.parse(rawBody) : null
  };
}

import type { AppConfig } from "./env.js";

type LogLevel = AppConfig["LOG_LEVEL"];

const rank: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

export function createLogger(level: LogLevel) {
  function shouldLog(candidate: LogLevel) {
    return rank[candidate] >= rank[level];
  }

  function write(candidate: LogLevel, message: string, context?: Record<string, unknown>) {
    if (!shouldLog(candidate)) {
      return;
    }

    const safeContext = context ? ` ${JSON.stringify(context)}` : "";
    console[candidate === "debug" ? "log" : candidate](
      `${new Date().toISOString()} ${candidate.toUpperCase()} ${message}${safeContext}`
    );
  }

  return {
    debug: (message: string, context?: Record<string, unknown>) => write("debug", message, context),
    info: (message: string, context?: Record<string, unknown>) => write("info", message, context),
    warn: (message: string, context?: Record<string, unknown>) => write("warn", message, context),
    error: (message: string, context?: Record<string, unknown>) => write("error", message, context)
  };
}


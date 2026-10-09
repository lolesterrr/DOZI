// A small app-wide logger. In development it writes to the Metro console; in release builds only
// warnings and errors are kept. Crash reporting (Sentry, Phase 8) will plug in with `addLogSink`.
//
// Privacy: never log note text, answers, names or other personal data — log ids and counts.

import { nowIso } from './time';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogEntry = {
  level: LogLevel;
  /** Which part of the app wrote it, e.g. "db" or "sync". */
  scope: string;
  message: string;
  /** Extra details: ids, counts, durations. */
  data?: Record<string, unknown>;
  error?: unknown;
  /** ISO-8601 UTC. */
  at: string;
};

export type LogSink = (entry: LogEntry) => void;

const LEVEL_RANK: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

const isDev = typeof __DEV__ === 'undefined' ? true : __DEV__;

let minLevel: LogLevel = isDev ? 'debug' : 'warn';

/** Writes to the Metro console (what `npm run start` shows). */
export const consoleSink: LogSink = ({ level, scope, message, data, error }) => {
  const write = level === 'debug' ? console.log : console[level];
  const extras = [data, error].filter((value) => value !== undefined);
  write(`[${scope}] ${message}`, ...extras);
};

const sinks = new Set<LogSink>([consoleSink]);

/** Sends every log entry at or above the minimum level to `sink`. Returns a function to remove it. */
export function addLogSink(sink: LogSink): () => void {
  sinks.add(sink);
  return () => {
    sinks.delete(sink);
  };
}

/** Changes the quietest level that still gets logged. */
export function setLogLevel(level: LogLevel): void {
  minLevel = level;
}

export function getLogLevel(): LogLevel {
  return minLevel;
}

function write(entry: Omit<LogEntry, 'at'>): void {
  if (LEVEL_RANK[entry.level] < LEVEL_RANK[minLevel]) return;
  const full: LogEntry = { ...entry, at: nowIso() };
  for (const sink of sinks) {
    try {
      sink(full);
    } catch {
      // A broken sink must never crash the app.
    }
  }
}

export type Logger = {
  debug: (message: string, data?: Record<string, unknown>) => void;
  info: (message: string, data?: Record<string, unknown>) => void;
  warn: (message: string, data?: Record<string, unknown>) => void;
  error: (message: string, error?: unknown, data?: Record<string, unknown>) => void;
};

/** A logger for one part of the app: `const log = createLogger('db');` */
export function createLogger(scope: string): Logger {
  return {
    debug: (message, data) => write({ level: 'debug', scope, message, data }),
    info: (message, data) => write({ level: 'info', scope, message, data }),
    warn: (message, data) => write({ level: 'warn', scope, message, data }),
    error: (message, error, data) => write({ level: 'error', scope, message, error, data }),
  };
}

/** The general-purpose logger. Prefer `createLogger('<feature>')` inside a feature. */
export const logger = createLogger('app');

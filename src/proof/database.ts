import { isTauriRuntime } from "../core/tauri";
import type { ProofRecord, ProofSnapshot } from "../types";

const DATABASE_URL = "sqlite:token-saver.db";

type SqlDatabase = {
  execute(query: string, bindValues?: unknown[]): Promise<{ rowsAffected: number }>;
  select<T>(query: string, bindValues?: unknown[]): Promise<T>;
};

interface ProofRow {
  id: string;
  session_id: string;
  created_at: string;
  status: ProofRecord["status"];
  strategy_id: string | null;
  strategy_version: string | null;
  before_json: string;
  after_json: string | null;
  reversible: number;
  provenance_json: string;
}

export interface ProofLedgerInitialization {
  records: ProofRecord[];
  mode: "sqlite" | "web-preview" | "fallback";
  detail: string;
}

let databasePromise: Promise<SqlDatabase> | undefined;

async function database(): Promise<SqlDatabase> {
  databasePromise ??= import("@tauri-apps/plugin-sql").then(async ({ default: Database }) =>
    Database.load(DATABASE_URL) as Promise<SqlDatabase>,
  );
  return databasePromise;
}

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function rowToRecord(row: ProofRow): ProofRecord {
  return {
    id: row.id,
    sessionId: row.session_id,
    createdAt: row.created_at,
    status: row.status,
    strategyId: row.strategy_id ?? undefined,
    strategyVersion: row.strategy_version ?? undefined,
    before: parseJson<ProofSnapshot>(row.before_json, emptySnapshot()),
    after: row.after_json ? parseJson<ProofSnapshot>(row.after_json, emptySnapshot()) : undefined,
    reversible: row.reversible === 1,
    provenance: parseJson<string[]>(row.provenance_json, []),
  };
}

function emptySnapshot(): ProofSnapshot {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    reasoningTokens: 0,
    estimatedCostUsd: 0,
    toolCalls: 0,
    repeatedReads: 0,
    repeatedResults: 0,
    taskStatus: "unknown",
  };
}

function values(record: ProofRecord): unknown[] {
  return [
    record.id,
    record.sessionId,
    record.createdAt,
    record.status,
    record.strategyId ?? null,
    record.strategyVersion ?? null,
    JSON.stringify(record.before),
    record.after ? JSON.stringify(record.after) : null,
    record.reversible ? 1 : 0,
    JSON.stringify(record.provenance),
    new Date().toISOString(),
  ];
}

const INSERT_BASELINE = `
  INSERT OR IGNORE INTO proof_records (
    id, session_id, created_at, status, strategy_id, strategy_version,
    before_json, after_json, reversible, provenance_json, updated_at
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
`;

const UPSERT_RECORD = `
  INSERT INTO proof_records (
    id, session_id, created_at, status, strategy_id, strategy_version,
    before_json, after_json, reversible, provenance_json, updated_at
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
  ON CONFLICT(id) DO UPDATE SET
    status = excluded.status,
    strategy_id = excluded.strategy_id,
    strategy_version = excluded.strategy_version,
    after_json = excluded.after_json,
    reversible = excluded.reversible,
    provenance_json = excluded.provenance_json,
    updated_at = excluded.updated_at
`;

export function mergeProofRecords(
  local: ProofRecord[],
  persisted: ProofRecord[],
): ProofRecord[] {
  const records = new Map(local.map((record) => [record.id, record]));
  for (const record of persisted) records.set(record.id, record);
  return [...records.values()].sort(
    (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt),
  );
}

export async function loadProofRecords(): Promise<ProofRecord[]> {
  const db = await database();
  const rows = await db.select<ProofRow[]>(
    "SELECT * FROM proof_records ORDER BY created_at DESC, id ASC",
  );
  return rows.map(rowToRecord);
}

export async function persistProofRecords(records: ProofRecord[]): Promise<void> {
  if (!isTauriRuntime()) return;
  const db = await database();
  for (const record of records) {
    await db.execute(record.status === "baseline" ? INSERT_BASELINE : UPSERT_RECORD, values(record));
  }
}

export async function clearProofRecords(): Promise<void> {
  if (!isTauriRuntime()) return;
  const db = await database();
  await db.execute("DELETE FROM proof_records");
}

export async function initializeProofLedger(
  localRecords: ProofRecord[],
): Promise<ProofLedgerInitialization> {
  if (!isTauriRuntime()) {
    return {
      records: localRecords,
      mode: "web-preview",
      detail: "Proof records use browser storage in Web Preview.",
    };
  }
  try {
    const persisted = await loadProofRecords();
    const records = mergeProofRecords(localRecords, persisted);
    await persistProofRecords(records);
    return {
      records,
      mode: "sqlite",
      detail: "Proof records are stored in the local Token Saver SQLite database.",
    };
  } catch (error) {
    return {
      records: localRecords,
      mode: "fallback",
      detail: `SQLite was unavailable; local workspace fallback is active: ${String(error)}`,
    };
  }
}

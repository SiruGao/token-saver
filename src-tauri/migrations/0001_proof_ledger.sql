CREATE TABLE IF NOT EXISTS proof_records (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL,
  strategy_id TEXT,
  strategy_version TEXT,
  before_json TEXT NOT NULL,
  after_json TEXT,
  reversible INTEGER NOT NULL DEFAULT 1,
  provenance_json TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_proof_session
  ON proof_records (session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_proof_status
  ON proof_records (status, created_at DESC);

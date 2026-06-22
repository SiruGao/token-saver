use tauri_plugin_sql::{Migration, MigrationKind};

pub const DATABASE_URL: &str = "sqlite:token-saver.db";

pub fn migrations() -> Vec<Migration> {
    vec![Migration {
        version: 1,
        description: "create_proof_ledger",
        sql: include_str!("../migrations/0001_proof_ledger.sql"),
        kind: MigrationKind::Up,
    }]
}

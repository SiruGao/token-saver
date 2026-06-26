use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StrategyTargetStatus {
    pub id: String,
    pub name: String,
    pub detected: bool,
    pub routed: bool,
    pub detail: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StrategySavingsSummary {
    pub requests: u64,
    pub original_tokens: u64,
    pub delivered_tokens: u64,
    pub tokens_saved: u64,
    pub estimated_cost_saved_usd: f64,
    pub last_activity_at: Option<String>,
    pub source: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StrategyAdapterStatus {
    pub strategy_id: String,
    pub adapter_version: String,
    pub upstream_version: Option<String>,
    pub installed: bool,
    pub compatible: bool,
    pub configured: bool,
    pub healthy: bool,
    pub active: bool,
    pub executable_path: Option<String>,
    pub managed_runtime: bool,
    pub can_install: bool,
    pub can_apply: bool,
    pub can_remove: bool,
    pub reversible: bool,
    pub risk: String,
    pub detail: String,
    pub setup_detail: String,
    pub targets: Vec<StrategyTargetStatus>,
    pub savings: Option<StrategySavingsSummary>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StrategyAdapterPreview {
    pub strategy_id: String,
    pub title: String,
    pub description: String,
    pub changes: Vec<String>,
    pub targets: Vec<String>,
    pub reversible: bool,
    pub requires_restart: bool,
    pub source: String,
    pub pinned_version: String,
    pub risk: String,
}

pub trait StrategyAdapter {
    fn inspect() -> Result<StrategyAdapterStatus, String>;
    fn preview() -> Result<StrategyAdapterPreview, String>;
    fn install() -> Result<StrategyAdapterStatus, String>;
    fn apply() -> Result<StrategyAdapterStatus, String>;
    fn remove() -> Result<StrategyAdapterStatus, String>;
}

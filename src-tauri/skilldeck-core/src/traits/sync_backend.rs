//! Sync Backend trait — v2 stub.

use async_trait::async_trait;
use serde::{Deserialize, Serialize};

use crate::CoreError;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Changeset {
    pub records: Vec<SyncRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncRecord {
    pub table: String,
    pub id: String,
    pub operation: SyncOperation,
    pub data: serde_json::Value,
    pub version: u64,
    pub timestamp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SyncOperation {
    Create,
    Update,
    Delete,
}

#[async_trait]
pub trait SyncBackend: Send + Sync {
    async fn push(&self, changeset: &Changeset) -> Result<PushResult, CoreError>;
    async fn pull(&self, since: u64) -> Result<Changeset, CoreError>;
    async fn resolve_conflict(
        &self,
        conflict: &SyncConflict,
    ) -> Result<ConflictResolution, CoreError>;
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PushResult {
    pub pushed: Vec<String>,
    pub conflicts: Vec<SyncConflict>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncConflict {
    pub table: String,
    pub id: String,
    pub local_version: u64,
    pub remote_version: u64,
    pub local_data: serde_json::Value,
    pub remote_data: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ConflictResolution {
    LocalWins,
    RemoteWins,
    Merged(serde_json::Value),
}

/// No-op sync backend for v1 — does nothing.
pub struct NoOpSyncBackend;

#[async_trait]
impl SyncBackend for NoOpSyncBackend {
    async fn push(&self, _: &Changeset) -> Result<PushResult, CoreError> {
        Ok(PushResult {
            pushed: Vec::new(),
            conflicts: Vec::new(),
        })
    }
    async fn pull(&self, _: u64) -> Result<Changeset, CoreError> {
        Ok(Changeset::default())
    }
    async fn resolve_conflict(&self, _: &SyncConflict) -> Result<ConflictResolution, CoreError> {
        Ok(ConflictResolution::LocalWins)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn changeset_default() {
        assert!(Changeset::default().records.is_empty());
    }

    #[test]
    fn sync_operation_serialization() {
        let json = serde_json::to_string(&SyncOperation::Create).unwrap();
        assert_eq!(json, "\"Create\"");
    }

    #[tokio::test]
    async fn no_op_push_returns_empty() {
        let result = NoOpSyncBackend.push(&Changeset::default()).await.unwrap();
        assert!(result.pushed.is_empty());
        assert!(result.conflicts.is_empty());
    }
}

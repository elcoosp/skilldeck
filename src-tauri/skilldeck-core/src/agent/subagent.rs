//! Subagent support — lightweight session tracking for parallel sub-tasks.
//!
//! In v1 this is intentionally minimal: a `SubagentSession` records the task
//! description and its result, and `SubagentManager` fans out tasks and
//! collects results.  Full process-isolation and message-passing are Chunk 13+.

use std::collections::HashMap;
use uuid::Uuid;

use crate::CoreError;

// ── Session ───────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SubagentStatus {
    Pending,
    Running,
    Completed,
    Failed,
}

#[derive(Debug, Clone)]
pub struct SubagentSession {
    pub id: Uuid,
    pub parent_id: Uuid,
    pub task: String,
    pub skill: Option<String>,
    pub status: SubagentStatus,
    pub result: Option<String>,
    pub error: Option<String>,
}

impl SubagentSession {
    pub fn new(parent_id: Uuid, task: impl Into<String>, skill: Option<String>) -> Self {
        Self {
            id: Uuid::new_v4(),
            parent_id,
            task: task.into(),
            skill,
            status: SubagentStatus::Pending,
            result: None,
            error: None,
        }
    }
}

// ── Manager ───────────────────────────────────────────────────────────────────

/// Tracks all subagent sessions for a parent conversation.
pub struct SubagentManager {
    sessions: HashMap<Uuid, SubagentSession>,
}

impl SubagentManager {
    pub fn new() -> Self {
        Self {
            sessions: HashMap::new(),
        }
    }

    /// Spawn a new subagent for `task` and return its session ID.
    pub fn spawn(
        &mut self,
        parent_id: Uuid,
        task: impl Into<String>,
        skill: Option<String>,
    ) -> Uuid {
        let session = SubagentSession::new(parent_id, task, skill);
        let id = session.id;
        self.sessions.insert(id, session);
        id
    }

    /// Mark a session as running.
    pub fn start(&mut self, id: Uuid) -> Result<(), CoreError> {
        self.sessions
            .get_mut(&id)
            .ok_or_else(|| CoreError::Internal {
                message: format!("Subagent {} not found", id),
            })?
            .status = SubagentStatus::Running;
        Ok(())
    }

    /// Record a successful result.
    pub fn complete(&mut self, id: Uuid, result: String) -> Result<(), CoreError> {
        let s = self
            .sessions
            .get_mut(&id)
            .ok_or_else(|| CoreError::Internal {
                message: format!("Subagent {} not found", id),
            })?;
        s.status = SubagentStatus::Completed;
        s.result = Some(result);
        Ok(())
    }

    /// Record a failure.
    pub fn fail(&mut self, id: Uuid, error: String) -> Result<(), CoreError> {
        let s = self
            .sessions
            .get_mut(&id)
            .ok_or_else(|| CoreError::Internal {
                message: format!("Subagent {} not found", id),
            })?;
        s.status = SubagentStatus::Failed;
        s.error = Some(error);
        Ok(())
    }

    /// Collect all completed results for a given parent conversation.
    pub fn collect_results(&self, parent_id: Uuid) -> Vec<String> {
        self.sessions
            .values()
            .filter(|s| s.parent_id == parent_id && s.status == SubagentStatus::Completed)
            .filter_map(|s| s.result.clone())
            .collect()
    }

    /// Check if all spawned subagents for a parent have finished.
    pub fn all_done(&self, parent_id: Uuid) -> bool {
        self.sessions
            .values()
            .filter(|s| s.parent_id == parent_id)
            .all(|s| matches!(s.status, SubagentStatus::Completed | SubagentStatus::Failed))
    }

    pub fn get(&self, id: Uuid) -> Option<&SubagentSession> {
        self.sessions.get(&id)
    }
}

impl Default for SubagentManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn spawn_and_complete() {
        let parent = Uuid::new_v4();
        let mut mgr = SubagentManager::new();
        let id = mgr.spawn(parent, "Summarise the doc", None);

        assert_eq!(mgr.get(id).unwrap().status, SubagentStatus::Pending);

        mgr.start(id).unwrap();
        assert_eq!(mgr.get(id).unwrap().status, SubagentStatus::Running);

        mgr.complete(id, "Summary done".into()).unwrap();
        assert_eq!(mgr.get(id).unwrap().status, SubagentStatus::Completed);

        let results = mgr.collect_results(parent);
        assert_eq!(results, vec!["Summary done"]);
    }

    #[test]
    fn all_done_false_while_running() {
        let parent = Uuid::new_v4();
        let mut mgr = SubagentManager::new();
        let id1 = mgr.spawn(parent, "task 1", None);
        let id2 = mgr.spawn(parent, "task 2", None);
        mgr.complete(id1, "r1".into()).unwrap();
        assert!(!mgr.all_done(parent));
        mgr.complete(id2, "r2".into()).unwrap();
        assert!(mgr.all_done(parent));
    }

    #[test]
    fn fail_marks_session_failed() {
        let parent = Uuid::new_v4();
        let mut mgr = SubagentManager::new();
        let id = mgr.spawn(parent, "bad task", None);
        mgr.fail(id, "timeout".into()).unwrap();
        let s = mgr.get(id).unwrap();
        assert_eq!(s.status, SubagentStatus::Failed);
        assert_eq!(s.error.as_deref(), Some("timeout"));
    }

    #[test]
    fn unknown_id_returns_error() {
        let mut mgr = SubagentManager::new();
        assert!(mgr.start(Uuid::new_v4()).is_err());
    }
}

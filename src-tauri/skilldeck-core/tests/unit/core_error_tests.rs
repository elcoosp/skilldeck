//! Unit tests for CoreError taxonomy.
//!
//! Verifies retryability classification, code uniqueness, suggested actions,
//! and Display formatting. Tests are pure (no I/O, no async).

use skilldeck_core::CoreError;
use std::collections::HashSet;

// ── is_retryable ──────────────────────────────────────────────────────────────

#[test]
fn rate_limited_is_retryable() {
    let e = CoreError::ModelRateLimited {
        provider: "claude".into(),
        retry_after_ms: 1_000,
    };
    assert!(e.is_retryable(), "rate-limited errors should be retryable");
}

#[test]
fn model_internal_is_retryable() {
    let e = CoreError::ModelInternal {
        provider: "openai".into(),
        message: "502 Bad Gateway".into(),
    };
    assert!(e.is_retryable());
}

#[test]
fn model_timeout_is_retryable() {
    let e = CoreError::ModelTimeout {
        provider: "claude".into(),
        timeout_ms: 30_000,
    };
    assert!(e.is_retryable());
}

#[test]
fn model_connection_is_retryable() {
    let e = CoreError::ModelConnection {
        provider: "ollama".into(),
        message: "connection refused".into(),
    };
    assert!(e.is_retryable());
}

#[test]
fn auth_error_is_not_retryable() {
    let e = CoreError::ModelAuthentication {
        provider: "claude".into(),
        message: "invalid API key".into(),
    };
    assert!(!e.is_retryable(), "auth errors must not be retried automatically");
}

#[test]
fn request_rejected_is_not_retryable() {
    let e = CoreError::ModelRequestRejected {
        provider: "claude".into(),
        message: "content policy violation".into(),
    };
    assert!(!e.is_retryable());
}

#[test]
fn workflow_cycle_is_not_retryable() {
    let e = CoreError::WorkflowCycle {
        cycle_path: "A -> B -> A".into(),
    };
    assert!(!e.is_retryable());
}

#[test]
fn skill_not_found_is_not_retryable() {
    let e = CoreError::SkillNotFound {
        path: std::path::PathBuf::from("/missing/SKILL.md"),
    };
    assert!(!e.is_retryable());
}

#[test]
fn internal_error_is_retryable() {
    // Internal errors may resolve on retry (transient OS issues etc.)
    let e = CoreError::Internal {
        message: "unexpected state".into(),
    };
    assert!(e.is_retryable());
}

// ── error_code uniqueness ─────────────────────────────────────────────────────

#[test]
fn error_codes_are_non_empty() {
    let errors: Vec<CoreError> = sample_errors();
    for e in &errors {
        assert!(!e.error_code().is_empty(), "error_code must not be empty: {:?}", e);
    }
}

#[test]
fn error_codes_are_unique_across_sample() {
    let errors = sample_errors();
    let codes: HashSet<&str> = errors.iter().map(|e| e.error_code()).collect();
    assert_eq!(
        codes.len(),
        errors.len(),
        "every error variant must have a distinct code"
    );
}

#[test]
fn error_codes_are_screaming_snake_case() {
    for e in sample_errors() {
        let code = e.error_code();
        assert!(
            code.chars().all(|c| c.is_ascii_uppercase() || c == '_'),
            "expected SCREAMING_SNAKE_CASE, got: {code}"
        );
    }
}

// ── suggested_action ──────────────────────────────────────────────────────────

#[test]
fn rate_limited_has_suggested_action() {
    let e = CoreError::ModelRateLimited {
        provider: "claude".into(),
        retry_after_ms: 2_000,
    };
    assert!(e.suggested_action().is_some());
}

#[test]
fn auth_error_has_suggested_action() {
    let e = CoreError::ModelAuthentication {
        provider: "openai".into(),
        message: "401".into(),
    };
    assert!(e.suggested_action().is_some());
}

#[test]
fn timeout_has_suggested_action() {
    let e = CoreError::ModelTimeout {
        provider: "claude".into(),
        timeout_ms: 60_000,
    };
    assert!(e.suggested_action().is_some());
}

#[test]
fn mcp_connection_failed_has_suggested_action() {
    let e = CoreError::McpConnectionFailed {
        server_name: "filesystem".into(),
        message: "ECONNREFUSED".into(),
    };
    assert!(e.suggested_action().is_some());
}

#[test]
fn tool_not_found_has_no_suggested_action() {
    // Tool-not-found is a programming error, not user-actionable.
    let e = CoreError::McpToolNotFound {
        server_name: "filesystem".into(),
        tool_name: "nonexistent_tool".into(),
    };
    assert!(
        e.suggested_action().is_none(),
        "McpToolNotFound should not have a user-facing suggested action"
    );
}

#[test]
fn workflow_cycle_has_no_suggested_action() {
    let e = CoreError::WorkflowCycle {
        cycle_path: "step_a -> step_b -> step_a".into(),
    };
    assert!(e.suggested_action().is_none());
}

// ── Display / Debug formatting ────────────────────────────────────────────────

#[test]
fn error_display_includes_provider_name() {
    let e = CoreError::ModelRateLimited {
        provider: "anthropic".into(),
        retry_after_ms: 500,
    };
    let msg = e.to_string();
    assert!(msg.contains("anthropic"), "Display should contain provider name");
}

#[test]
fn error_display_includes_retry_ms() {
    let e = CoreError::ModelRateLimited {
        provider: "test".into(),
        retry_after_ms: 9_999,
    };
    assert!(e.to_string().contains("9999"));
}

#[test]
fn mcp_error_display_includes_server_name() {
    let e = CoreError::McpConnectionFailed {
        server_name: "my-server".into(),
        message: "timeout".into(),
    };
    assert!(e.to_string().contains("my-server"));
}

#[test]
fn skill_not_found_display_includes_path() {
    let e = CoreError::SkillNotFound {
        path: std::path::PathBuf::from("/workspace/.skilldeck/skills/fmt/SKILL.md"),
    };
    assert!(e.to_string().contains("fmt"));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn sample_errors() -> Vec<CoreError> {
    vec![
        CoreError::ModelRequestRejected {
            provider: "test".into(),
            message: "".into(),
        },
        CoreError::ModelRateLimited {
            provider: "test".into(),
            retry_after_ms: 0,
        },
        CoreError::ModelInternal {
            provider: "test".into(),
            message: "".into(),
        },
        CoreError::ModelAuthentication {
            provider: "test".into(),
            message: "".into(),
        },
        CoreError::McpServerNotFound {
            server_id: uuid::Uuid::nil(),
        },
        CoreError::McpConnectionFailed {
            server_name: "test".into(),
            message: "".into(),
        },
        CoreError::McpToolNotFound {
            server_name: "test".into(),
            tool_name: "test".into(),
        },
        CoreError::SkillNotFound {
            path: std::path::PathBuf::new(),
        },
        CoreError::SkillParse {
            name: "test".into(),
            message: "".into(),
        },
        CoreError::WorkflowCycle {
            cycle_path: "".into(),
        },
        CoreError::DatabaseConnection {
            message: "".into(),
        },
        CoreError::DatabaseEntityNotFound {
            entity: "test".into(),
            id: "test".into(),
        },
        CoreError::Internal {
            message: "".into(),
        },
    ]
}

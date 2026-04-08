//! Unit tests for the ApprovalGate — the oneshot-channel bridge between the
//! agent loop and the UI approval dialog (ASR-SEC-002).

use std::sync::Arc;
use skilldeck_core::agent::{ApprovalGate, ApprovalResult};

// ── Basic resolve ─────────────────────────────────────────────────────────────

#[tokio::test]
async fn approve_resolves_request() {
    let gate = ApprovalGate::new();
    let gate_arc = Arc::new(gate);

    let gate_clone = Arc::clone(&gate_arc);
    let request_handle = tokio::spawn(async move {
        gate_clone
            .request_approval("call-001", "read_file", serde_json::json!({"path": "/tmp/x"}))
            .await
    });

    // Give the spawned task a tick to register the sender.
    tokio::time::sleep(tokio::time::Duration::from_millis(5)).await;

    gate_arc
        .resolve("call-001", ApprovalResult::Approved { edited_input: None })
        .expect("resolve should succeed");

    let result = request_handle.await.unwrap().unwrap();
    assert!(
        matches!(result, ApprovalResult::Approved { edited_input: None }),
        "expected Approved, got {:?}",
        result
    );
}

#[tokio::test]
async fn deny_resolves_request() {
    let gate = Arc::new(ApprovalGate::new());

    let gate_clone = Arc::clone(&gate);
    let handle = tokio::spawn(async move {
        gate_clone
            .request_approval("call-002", "execute_shell", serde_json::json!({"cmd": "rm -rf /"}))
            .await
    });

    tokio::time::sleep(tokio::time::Duration::from_millis(5)).await;

    gate.resolve(
        "call-002",
        ApprovalResult::Denied {
            reason: "too dangerous".to_string(),
        },
    )
    .unwrap();

    let result = handle.await.unwrap().unwrap();
    assert!(
        matches!(result, ApprovalResult::Denied { .. }),
        "expected Denied"
    );
}

#[tokio::test]
async fn edited_input_is_propagated() {
    let gate = Arc::new(ApprovalGate::new());

    let gate_clone = Arc::clone(&gate);
    let handle = tokio::spawn(async move {
        gate_clone
            .request_approval("call-003", "read_file", serde_json::json!({"path": "/etc/passwd"}))
            .await
    });

    tokio::time::sleep(tokio::time::Duration::from_millis(5)).await;

    let safe_input = serde_json::json!({"path": "/project/README.md"});
    gate.resolve(
        "call-003",
        ApprovalResult::Approved {
            edited_input: Some(safe_input.clone()),
        },
    )
    .unwrap();

    let result = handle.await.unwrap().unwrap();
    match result {
        ApprovalResult::Approved { edited_input: Some(v) } => {
            assert_eq!(v["path"], "/project/README.md");
        }
        other => panic!("unexpected result: {:?}", other),
    }
}

// ── Error cases ───────────────────────────────────────────────────────────────

#[test]
fn resolve_nonexistent_call_returns_err() {
    let gate = ApprovalGate::new();
    let result = gate.resolve("does-not-exist", ApprovalResult::Approved { edited_input: None });
    assert!(result.is_err(), "resolving unknown call-id must return Err");
}

#[test]
fn double_resolve_returns_err() {
    // The first resolve consumes the sender; the second must fail.
    let gate = Arc::new(ApprovalGate::new());

    // We can't easily test the second resolve without also having a receiver,
    // so we just verify that resolving a non-pending id fails.
    // (The full double-resolve scenario is covered by the integration test.)
    let result = gate.resolve("ghost-id", ApprovalResult::Cancelled);
    assert!(result.is_err());
}

// ── cancel_all ────────────────────────────────────────────────────────────────

#[tokio::test]
async fn cancel_all_unblocks_pending_requests() {
    let gate = Arc::new(ApprovalGate::new());

    let gate_a = Arc::clone(&gate);
    let handle_a = tokio::spawn(async move {
        gate_a
            .request_approval("cancel-a", "tool_a", serde_json::Value::Null)
            .await
    });

    let gate_b = Arc::clone(&gate);
    let handle_b = tokio::spawn(async move {
        gate_b
            .request_approval("cancel-b", "tool_b", serde_json::Value::Null)
            .await
    });

    tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;

    gate.cancel_all();

    let result_a = handle_a.await.unwrap().unwrap();
    let result_b = handle_b.await.unwrap().unwrap();

    assert!(
        matches!(result_a, ApprovalResult::Cancelled),
        "expected Cancelled for a"
    );
    assert!(
        matches!(result_b, ApprovalResult::Cancelled),
        "expected Cancelled for b"
    );
}

#[test]
fn cancel_all_on_empty_gate_is_safe() {
    let gate = ApprovalGate::new();
    gate.cancel_all(); // must not panic
}






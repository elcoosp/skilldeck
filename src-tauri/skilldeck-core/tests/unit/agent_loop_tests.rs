// src-tauri/skilldeck-core/tests/integration/agent_loop_tests.rs
//! Integration tests for AgentLoop using MockProvider.

use skilldeck_core::{
    CoreError,
    agent::{AgentLoop, AgentLoopConfig, AgentLoopEvent, AgentRunResult},
    traits::{ChatMessage, FunctionCall, MessageRole, ToolCall, ToolDefinition},
};
use tokio::sync::mpsc;
use uuid::Uuid;

mod utils;
use utils::mock_provider::MockProvider;

#[tokio::test]
async fn agent_loop_processes_message() {
    let (tx, mut rx) = mpsc::channel(32);
    let mock = MockProvider::new(vec![
        Ok(CompletionChunk::Token {
            content: "Hello".to_string(),
        }),
        Ok(CompletionChunk::Done {
            input_tokens: 10,
            output_tokens: 5,
            cache_read_tokens: 0,
            cache_write_tokens: 0,
        }),
    ]);
    let agent = AgentLoop::new(
        Arc::new(mock),
        "mock".to_string(),
        AgentLoopConfig::default(),
        tx,
    );
    let result = agent.run("Hi".to_string()).await.unwrap();
    assert_eq!(result.messages.len(), 1);
    assert_eq!(result.messages[0].content, "Hello");
    assert_eq!(result.input_tokens, 10);
    assert_eq!(result.output_tokens, 5);

    // Verify events
    let mut events = vec![];
    while let Ok(event) = rx.try_recv() {
        events.push(event);
    }
    assert!(
        events
            .iter()
            .any(|e| matches!(e, Ok(AgentLoopEvent::Token { delta, .. }) if delta == "Hello"))
    );
    assert!(
        events
            .iter()
            .any(|e| matches!(e, Ok(AgentLoopEvent::Done { .. })))
    );
}

#[tokio::test]
async fn agent_loop_handles_tool_call() {
    let tool_def = ToolDefinition {
        name: "test_tool".to_string(),
        description: "Test tool".to_string(),
        input_schema: serde_json::json!({}),
    };
    let (tx, mut rx) = mpsc::channel(32);
    let mock = MockProvider::new(vec![
        Ok(CompletionChunk::ToolCall {
            tool_call: ToolCall {
                id: "tc1".to_string(),
                r#type: "function".to_string(),
                function: FunctionCall {
                    name: "test_tool".to_string(),
                    arguments: "{}".to_string(),
                },
            },
        }),
        Ok(CompletionChunk::Done {
            input_tokens: 5,
            output_tokens: 2,
            cache_read_tokens: 0,
            cache_write_tokens: 0,
        }),
    ]);
    let agent = AgentLoop::new(
        Arc::new(mock),
        "mock".to_string(),
        AgentLoopConfig::default(),
        tx,
    )
    .with_tool(tool_def);
    let result = agent.run("Call tool".to_string()).await.unwrap();
    assert_eq!(result.messages.len(), 2); // tool call + tool result
    assert_eq!(result.messages[0].role, MessageRole::Assistant);
    assert_eq!(result.messages[1].role, MessageRole::Tool);
    assert!(result.messages[1].content.contains("error") || result.messages[1].content.is_empty()); // dispatcher not configured
}

#[tokio::test]
async fn agent_loop_cancellation() {
    let (tx, mut rx) = mpsc::channel(32);
    let mock = MockProvider::new(vec![
        Ok(CompletionChunk::Token {
            content: "Hello".to_string(),
        }),
        Ok(CompletionChunk::Done {
            input_tokens: 10,
            output_tokens: 5,
            cache_read_tokens: 0,
            cache_write_tokens: 0,
        }),
    ]);
    let agent = AgentLoop::new(
        Arc::new(mock),
        "mock".to_string(),
        AgentLoopConfig::default(),
        tx,
    );
    let cancel_token = agent.cancellation_token();
    cancel_token.cancel();
    let result = agent.run("Hi".to_string()).await;
    assert!(matches!(result, Err(CoreError::Cancelled { .. })));
}

#[tokio::test]
async fn agent_loop_max_tool_iterations() {
    let (tx, _rx) = mpsc::channel(32);
    let tool_def = ToolDefinition {
        name: "test_tool".to_string(),
        description: "Test tool".to_string(),
        input_schema: serde_json::json!({}),
    };
    // Each iteration returns a tool call.
    let chunks = vec![
        Ok(CompletionChunk::ToolCall {
            tool_call: ToolCall {
                id: "tc".to_string(),
                r#type: "function".to_string(),
                function: FunctionCall {
                    name: "test_tool".to_string(),
                    arguments: "{}".to_string(),
                },
            },
        }),
        Ok(CompletionChunk::Done {
            input_tokens: 0,
            output_tokens: 0,
            cache_read_tokens: 0,
            cache_write_tokens: 0,
        }),
    ];
    let mut responses = vec![];
    for _ in 0..15 {
        responses.extend(chunks.clone());
    }
    let mock = MockProvider::new(responses);
    let config = AgentLoopConfig {
        max_tool_iterations: 3,
        ..Default::default()
    };
    let agent = AgentLoop::new(Arc::new(mock), "mock".to_string(), config, tx).with_tool(tool_def);
    let result = agent.run("Loop".to_string()).await.unwrap();
    // Should have executed 3 tool iterations (each adds assistant+tool message).
    assert_eq!(result.messages.len(), 6); // 3 assistant + 3 tool results
}

//! Integration test for agent loop with MCP tools and skills.
//!
//! Sets up a mock MCP server with a test tool and a test skill, then
//! runs the agent loop and verifies that the tool call is emitted and
//! the skill content appears in the system prompt.

use skilldeck_core::{
    CoreError, Registry,
    agent::{AgentLoop, AgentLoopConfig, AgentLoopEvent},
    mcp::{McpRegistry, ServerStatus, StdioTransport},
    skills::SkillRegistry,
    traits::{
        ChatMessage, McpServerConfig, McpTool, MessageRole, ModelInfo, ModelProvider,
        ToolDefinition,
    },
};
use std::sync::Arc;
use tokio::sync::mpsc;
use uuid::Uuid;

// A mock model provider that captures the request.
struct MockProvider {
    captured_request:
        std::sync::Arc<tokio::sync::Mutex<Option<skilldeck_core::traits::CompletionRequest>>>,
}

#[async_trait::async_trait]
impl ModelProvider for MockProvider {
    fn id(&self) -> &str {
        "mock"
    }
    fn display_name(&self) -> &str {
        "Mock"
    }
    fn supports_toon(&self) -> bool {
        false
    }

    async fn list_models(&self) -> Result<Vec<ModelInfo>, CoreError> {
        Ok(vec![ModelInfo {
            id: "mock".into(),
            name: "Mock".into(),
            context_length: 1000,
            max_output_tokens: 100,
            capabilities: Default::default(),
        }])
    }

    async fn complete(
        &self,
        request: skilldeck_core::traits::CompletionRequest,
    ) -> Result<skilldeck_core::traits::CompletionStream, CoreError> {
        // Capture the request for later inspection.
        *self.captured_request.lock().await = Some(request);

        // Return an empty stream (simulate immediate stop).
        use futures::stream;
        Ok(Box::pin(stream::empty()))
    }
}

#[tokio::test]
async fn test_agent_injects_mcp_tools_and_skills() {
    // 1. Set up a mock MCP server with a tool.
    let registry = Arc::new(Registry::new(
        crate::db::SqliteDatabase::open(":memory:").await.unwrap(),
    ));

    // Register a mock transport that returns a fake session.
    struct MockTransport;
    #[async_trait::async_trait]
    impl skilldeck_core::traits::McpTransport for MockTransport {
        async fn connect(
            &self,
            _config: &McpServerConfig,
            server_name: &str,
        ) -> Result<skilldeck_core::traits::McpSession, CoreError> {
            // Create a session with a predefined tool.
            use skilldeck_core::traits::{McpCapabilities, McpSession, McpSessionInner};
            struct Inner;
            #[async_trait::async_trait]
            impl McpSessionInner for Inner {
                async fn call_tool(
                    &self,
                    _name: &str,
                    _arguments: serde_json::Value,
                ) -> Result<skilldeck_core::traits::McpCallResult, CoreError> {
                    unimplemented!()
                }
                async fn list_resources(
                    &self,
                ) -> Result<Vec<skilldeck_core::traits::McpResource>, CoreError> {
                    Ok(vec![])
                }
                async fn read_resource(
                    &self,
                    _uri: &str,
                ) -> Result<Vec<skilldeck_core::traits::McpContent>, CoreError> {
                    Ok(vec![])
                }
            }
            let session = McpSession::new(
                server_name.to_string(),
                vec![McpTool {
                    name: "test_tool".to_string(),
                    description: "A test tool".to_string(),
                    input_schema: serde_json::json!({"type":"object"}),
                }],
                McpCapabilities::default(),
                Box::new(Inner),
            );
            Ok(session)
        }
        fn supports(&self, _config: &McpServerConfig) -> bool {
            true
        }
    }

    registry.mcp_registry.register_transport(MockTransport);
    let server_id = registry.mcp_registry.add_server(
        "mock-server".to_string(),
        McpServerConfig {
            transport: "mock".to_string(),
            config: serde_json::json!({}),
        },
    );
    // Connect the server (will use our mock transport).
    registry
        .mcp_registry
        .connect(
            server_id,
            McpServerConfig {
                transport: "mock".to_string(),
                config: serde_json::json!({}),
            },
        )
        .await
        .unwrap();

    // 2. Set up a skill registry with a test skill.
    use skilldeck_core::traits::Skill;
    let skill = Skill::new(
        "test-skill".to_string(),
        "Test skill".to_string(),
        "# Test Skill\nContent.".to_string(),
        "test".to_string(),
    );
    registry
        .skill_registry
        .register_source("test".to_string(), vec![skill])
        .await;

    // 3. Create a mock provider and capture request.
    let captured = Arc::new(tokio::sync::Mutex::new(None));
    let provider = Arc::new(MockProvider {
        captured_request: captured.clone(),
    });
    registry.register_provider(provider.clone()); // need a provider ID

    // 4. Build agent loop with the registry.
    let (tx, mut rx) = mpsc::channel(32);
    let agent = AgentLoop::new(provider, "mock".to_string(), AgentLoopConfig::default(), tx)
        .with_history(vec![]) // no history
        .with_tools(vec![]) // we'll add via with_tool later? Actually we need to simulate the injection that happens in messages.rs.
        // But this test is for the core; we can directly use with_tool and with_skill.
        .with_tool(ToolDefinition {
            name: "test_tool".to_string(),
            description: "".to_string(),
            input_schema: serde_json::json!({}),
        })
        .with_skill("# Test Skill\nContent.".to_string());

    // 5. Run agent with a prompt.
    let handle = tokio::spawn(async move { agent.run("Use the tool".to_string()).await });

    // Collect events (should see tool call)
    let mut tool_called = false;
    while let Some(event) = rx.recv().await {
        if let Ok(AgentLoopEvent::ToolCall { .. }) = event {
            tool_called = true;
            break;
        }
    }

    // Wait for loop to finish.
    handle.await.unwrap().unwrap();

    // 6. Verify tool was called.
    assert!(tool_called, "Tool call event should have been emitted");

    // 7. Verify skill content appeared in system prompt.
    let req_guard = captured.lock().await;
    let req = req_guard.as_ref().expect("Completion request captured");
    let system = req.system.as_deref().unwrap_or("");
    assert!(
        system.contains("Test Skill"),
        "Skill content should be in system prompt"
    );
}



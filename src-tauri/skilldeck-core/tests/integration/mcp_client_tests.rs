// src-tauri/skilldeck-core/tests/integration/mcp_client_tests.rs
use skilldeck_core::{
    CoreError,
    mcp::{McpRegistry, SseTransport, StdioTransport},
    traits::{McpServerConfig, McpTransport},
};
use std::sync::Arc;
use tempfile::TempDir;
use tokio::process::Command;
use uuid::Uuid;

#[tokio::test]
async fn stdio_transport_connect_and_list_tools() {
    // We'll use a simple echo server that responds with a fixed tool list.
    // Create a temporary script.
    let script_content = r#"#!/usr/bin/env bash
echo '{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2024-11-05","capabilities":{"tools":{}},"serverInfo":{"name":"echo","version":"1.0"}}}'
while read line; do
    if [[ "$line" == *'"method":"tools/list"'* ]]; then
        echo '{"jsonrpc":"2.0","id":2,"result":{"tools":[{"name":"echo","description":"Echo back input","input_schema":{"type":"object"}}]}}'
    elif [[ "$line" == *'"method":"initialize"'* ]]; then
        # already responded above
        :
    elif [[ "$line" == *'"method":"notifications/initialized"'* ]]; then
        :
    else
        echo '{"jsonrpc":"2.0","id":3,"result":{"content":[{"type":"text","text":"pong"}]}}'
    fi
done
"#;
    let dir = TempDir::new().unwrap();
    let script_path = dir.path().join("echo.sh");
    std::fs::write(&script_path, script_content).unwrap();
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = std::fs::metadata(&script_path).unwrap().permissions();
        perms.set_mode(0o755);
        std::fs::set_permissions(&script_path, perms).unwrap();
    }

    let transport = StdioTransport::new();
    let config = McpServerConfig {
        transport: "stdio".to_string(),
        config: serde_json::json!({ "command": script_path.to_str().unwrap(), "args": [] }),
    };
    let session = transport.connect(&config, "test-server").await.unwrap();
    assert_eq!(session.tools.len(), 1);
    assert_eq!(session.tools[0].name, "echo");
}

#[tokio::test]
async fn registry_connects_and_disconnects() {
    // Simple stdio server that just echos.
    let dir = TempDir::new().unwrap();
    let script_content = r#"#!/usr/bin/env bash
echo '{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2024-11-05","capabilities":{"tools":{}},"serverInfo":{"name":"echo","version":"1.0"}}}'
while read line; do
    echo '{"jsonrpc":"2.0","id":2,"result":{"tools":[{"name":"echo","description":"Echo","input_schema":{"type":"object"}}]}}'
done
"#;
    let script_path = dir.path().join("echo.sh");
    std::fs::write(&script_path, script_content).unwrap();
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = std::fs::metadata(&script_path).unwrap().permissions();
        perms.set_mode(0o755);
        std::fs::set_permissions(&script_path, perms).unwrap();
    }

    let registry = Arc::new(McpRegistry::new());
    registry.register_transport(StdioTransport::new());
    let id = registry.add_server(
        "test".to_string(),
        McpServerConfig {
            transport: "stdio".to_string(),
            config: serde_json::json!({ "command": script_path.to_str().unwrap(), "args": [] }),
        },
    );
    assert!(registry.get(id).is_some());
    registry
        .connect(
            id,
            McpServerConfig {
                transport: "stdio".to_string(),
                config: serde_json::json!({ "command": script_path.to_str().unwrap(), "args": [] }),
            },
        )
        .await
        .unwrap();
    let server = registry.get(id).unwrap();
    assert_eq!(server.status, skilldeck_core::mcp::ServerStatus::Connected);
    registry.disconnect(id);
    let server = registry.get(id).unwrap();
    assert_eq!(
        server.status,
        skilldeck_core::mcp::ServerStatus::Disconnected
    );
}

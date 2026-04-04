All notable changes to SkillDeck are documented in this file.

## [0.1.0] - 2025-01-15

### Added
- Initial public release of SkillDeck
- Multi-agent orchestration with streaming agent loop
- Parallel subagent spawning with merge strategies (concat, summarize, vote)
- Tool Approval Gate with category-based auto-approve configuration
- Visual Workflow Editor with drag-and-drop graph canvas
- Three workflow execution patterns: Sequential, Parallel, Evaluator-Optimizer
- Skill system with Markdown-based instruction packages and YAML frontmatter
- Skill Loader with directory scanning and hot-reload via Skill Watcher
- Skill Linter with 17 rules across frontmatter, structure, security, and quality categories
- Full MCP protocol implementation (JSON-RPC 2.0, protocol version 2024-11-05)
- MCP Supervisor with health monitoring, automatic reconnection, and connection registry
- stdio and SSE transport support for MCP servers
- MCP Catalog for browsing and connecting community MCP servers
- Multi-provider LLM support: OpenAI, Claude, and Ollama
- OS keychain storage for API keys (Keychain, Credential Manager, Secret Service)
- Local SQLite database for all conversations, artifacts, and workflow state
- Conversation branching from any message
- Artifacts system with versioned history and pinning
- Message Queue for batch sequential prompt processing
- Native desktop application built with Tauri 2 and Rust
- Rust backend with skilldeck-core engine and skilldeck-lint crate for skill validation
- React frontend with Zustand state management and shadcn/ui components
- MIT License
- macOS, Windows, and Linux support

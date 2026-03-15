//! Context builder — assembles the full completion request for a turn.
//!
//! Handles skill injection, context-window trimming, and system-prompt
//! construction so `AgentLoop` stays focused on control flow.

use crate::{
    CoreError,
    traits::{ChatMessage, CompletionRequest, MessageRole, ModelParams, ToolDefinition},
};

/// Builder for a [`CompletionRequest`].
#[derive(Debug, Default)]
pub struct ContextBuilder {
    model_id: String,
    system_prompt: Option<String>,
    skills: Vec<String>,
    messages: Vec<ChatMessage>,
    tools: Vec<ToolDefinition>,
    model_params: ModelParams,
    max_messages: usize,
}

impl ContextBuilder {
    pub fn new(model_id: impl Into<String>) -> Self {
        Self {
            model_id: model_id.into(),
            max_messages: 100,
            ..Default::default()
        }
    }

    pub fn system_prompt(mut self, prompt: impl Into<String>) -> Self {
        self.system_prompt = Some(prompt.into());
        self
    }

    pub fn add_skill(mut self, content: impl Into<String>) -> Self {
        self.skills.push(content.into());
        self
    }

    pub fn messages(mut self, messages: Vec<ChatMessage>) -> Self {
        self.messages = messages;
        self
    }

    pub fn tools(mut self, tools: Vec<ToolDefinition>) -> Self {
        self.tools = tools;
        self
    }

    pub fn model_params(mut self, params: ModelParams) -> Self {
        self.model_params = params;
        self
    }

    pub fn max_messages(mut self, n: usize) -> Self {
        self.max_messages = n;
        self
    }

    /// Build the [`CompletionRequest`].
    pub fn build(self) -> Result<CompletionRequest, CoreError> {
        // Assemble system prompt from base + injected skills.
        let system = build_system_prompt(self.system_prompt.as_deref(), &self.skills);

        // Trim message history to context window.
        let messages = trim_messages(self.messages, self.max_messages);

        Ok(CompletionRequest {
            model_id: self.model_id,
            messages,
            system,
            tools: self.tools,
            tools_toon: None, // <-- added field
            model_params: self.model_params,
        })
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/// Assemble the system string from a base prompt and skill contents.
///
/// Skills are separated from the base prompt and from each other by an
/// `\n\n---\n\n` fence so the model can clearly distinguish skill boundaries.
pub fn build_system_prompt(base: Option<&str>, skills: &[String]) -> Option<String> {
    let mut parts: Vec<&str> = Vec::new();
    if let Some(b) = base {
        parts.push(b);
    }
    let skill_refs: Vec<&str> = skills.iter().map(String::as_str).collect();
    parts.extend(skill_refs);

    if parts.is_empty() {
        None
    } else {
        Some(parts.join("\n\n---\n\n"))
    }
}

/// Keep only the last `max` messages so we stay within the context window.
///
/// If the first retained message is a `Tool` message we back-track one more
/// so the conversation always starts with a user/assistant exchange.
pub fn trim_messages(mut messages: Vec<ChatMessage>, max: usize) -> Vec<ChatMessage> {
    if messages.len() <= max {
        return messages;
    }
    let mut start = messages.len() - max;
    // Don't start mid-tool-exchange.
    if matches!(messages[start].role, MessageRole::Tool) {
        start = start.saturating_sub(1);
    }
    messages.split_off(start)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_system_prompt_base_only() {
        let s = build_system_prompt(Some("Be helpful"), &[]);
        assert_eq!(s.as_deref(), Some("Be helpful"));
    }

    #[test]
    fn build_system_prompt_with_skills() {
        let s = build_system_prompt(Some("Base"), &["Skill 1".into(), "Skill 2".into()]);
        let text = s.unwrap();
        assert!(text.starts_with("Base"));
        assert!(text.contains("Skill 1"));
        assert!(text.contains("Skill 2"));
        assert!(text.contains("---"));
    }

    #[test]
    fn build_system_prompt_skills_only() {
        let s = build_system_prompt(None, &["Only skill".into()]);
        assert_eq!(s.as_deref(), Some("Only skill"));
    }

    #[test]
    fn build_system_prompt_empty_is_none() {
        assert!(build_system_prompt(None, &[]).is_none());
    }

    #[test]
    fn trim_messages_under_limit() {
        let msgs = vec![
            ChatMessage {
                role: MessageRole::User,
                content: "hi".into(),
                name: None,
            },
            ChatMessage {
                role: MessageRole::Assistant,
                content: "hello".into(),
                name: None,
            },
        ];
        assert_eq!(trim_messages(msgs.clone(), 10).len(), 2);
    }

    #[test]
    fn trim_messages_over_limit() {
        let msgs: Vec<_> = (0..20)
            .map(|i| ChatMessage {
                role: MessageRole::User,
                content: i.to_string(),
                name: None,
            })
            .collect();
        let trimmed = trim_messages(msgs, 10);
        assert_eq!(trimmed.len(), 10);
        // Last message should be #19.
        assert_eq!(trimmed.last().unwrap().content, "19");
    }

    #[test]
    fn context_builder_builds_request() {
        let req = ContextBuilder::new("claude-sonnet-4-5")
            .system_prompt("Be helpful")
            .add_skill("# Skill A\nDo things")
            .tools(vec![])
            .messages(vec![ChatMessage {
                role: MessageRole::User,
                content: "hi".into(),
                name: None,
            }])
            .build()
            .unwrap();

        assert_eq!(req.model_id, "claude-sonnet-4-5");
        assert!(req.system.is_some());
        assert_eq!(req.messages.len(), 1);
    }
}

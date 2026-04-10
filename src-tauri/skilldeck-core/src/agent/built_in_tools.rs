//! Built-in tool definitions exposed to the model.
//!
//! These are always available and never route through MCP or the approval gate.

use crate::traits::ToolDefinition;

/// Return all built-in tool definitions.
pub fn all() -> Vec<ToolDefinition> {
    vec![load_skill(), spawn_subagent(), merge_subagent_results()]
}

/// `load_skill` — instruct the loop to inject a named skill into context.
pub fn load_skill() -> ToolDefinition {
    ToolDefinition {
        name: "load_skill".to_string(),
        description: "Load an additional skill into the current context. \
            Use when a task requires capabilities not already loaded."
            .to_string(),
        input_schema: serde_json::json!({
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "The skill name to load (e.g. 'code_review', 'summarizer')"
                }
            },
            "required": ["name"]
        }),
    }
}

/// `spawn_subagent` — launch a parallel subagent for a sub-task.
pub fn spawn_subagent() -> ToolDefinition {
    ToolDefinition {
        name: "spawn_subagent".to_string(),
        description: "Spawn a parallel subagent to handle an independent sub-task. \
            Optionally equip it with one or more skills from the skill registry."
            .to_string(),
        input_schema: serde_json::json!({
            "type": "object",
            "properties": {
                "task": {
                    "type": "string",
                    "description": "The task description for the subagent"
                },
                "skills": {
                    "type": "array",
                    "items": { "type": "string" },
                    "description": "List of skill names to equip the subagent with"
                }
            },
            "required": ["task"]
        }),
    }
}

/// `merge_subagent_results` — collect and merge results from spawned subagents.
pub fn merge_subagent_results() -> ToolDefinition {
    ToolDefinition {
        name: "merge_subagent_results".to_string(),
        description: "Collect and synthesise the outputs from all previously \
            spawned subagents into a single coherent result."
            .to_string(),
        input_schema: serde_json::json!({
            "type": "object",
            "properties": {
                "subagent_id": {
                    "type": "string",
                    "description": "ID of the subagent whose result to merge"
                },
                "strategy": {
                    "type": "string",
                    "enum": ["concat", "summarize", "vote"],
                    "description": "How to merge results: concatenate, summarize, or majority-vote"
                }
            },
            "required": ["subagent_id"]
        }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn all_returns_three_tools() {
        let tools = all();
        assert_eq!(tools.len(), 3);
        let names: Vec<_> = tools.iter().map(|t| t.name.as_str()).collect();
        assert!(names.contains(&"load_skill"));
        assert!(names.contains(&"spawn_subagent"));
        assert!(names.contains(&"merge_subagent_results"));
    }

    #[test]
    fn load_skill_schema_requires_name() {
        let t = load_skill();
        let required = t.input_schema["required"].as_array().unwrap();
        assert!(required.iter().any(|v| v.as_str() == Some("name")));
    }

    #[test]
    fn spawn_subagent_schema_requires_task() {
        let t = spawn_subagent();
        let required = t.input_schema["required"].as_array().unwrap();
        assert!(required.iter().any(|v| v.as_str() == Some("task")));
    }

    #[test]
    fn tool_definitions_serialize() {
        for t in all() {
            let json = serde_json::to_string(&t).unwrap();
            assert!(json.contains(&t.name));
        }
    }
}

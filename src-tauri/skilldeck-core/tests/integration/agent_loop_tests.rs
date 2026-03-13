//! Integration tests for AgentLoop builder and event emission.
//!
//! These tests do NOT require a live model provider — they exercise the loop
//! configuration API, context-builder helpers, and the event channel contract.

use skilldeck_core::{
    agent::{
        context_builder::{build_system_prompt, trim_messages},
        AgentLoopEvent,
    },
    traits::model_provider::{ChatMessage, MessageRole},
};

// ── build_system_prompt ───────────────────────────────────────────────────────

#[test]
fn system_prompt_base_only() {
    let s = build_system_prompt(Some("Be helpful"), &[]);
    assert_eq!(s.as_deref(), Some("Be helpful"));
}

#[test]
fn system_prompt_skills_only() {
    let skills = vec!["Skill A".to_string(), "Skill B".to_string()];
    let s = build_system_prompt(None, &skills);
    let s = s.unwrap();
    assert!(s.contains("Skill A"));
    assert!(s.contains("Skill B"));
}

#[test]
fn system_prompt_base_and_skills_joined_with_separator() {
    let skills = vec!["# My Skill\nDo things.".to_string()];
    let s = build_system_prompt(Some("Base prompt."), &skills).unwrap();
    assert!(s.starts_with("Base prompt."));
    assert!(s.contains("---"));
    assert!(s.contains("My Skill"));
}

#[test]
fn system_prompt_no_base_no_skills_is_none() {
    assert!(build_system_prompt(None, &[]).is_none());
}

#[test]
fn system_prompt_multiple_skills_all_present() {
    let skills: Vec<String> = (0..5).map(|i| format!("Skill {i}")).collect();
    let s = build_system_prompt(None, &skills).unwrap();
    for i in 0..5 {
        assert!(s.contains(&format!("Skill {i}")));
    }
}

// ── trim_messages ─────────────────────────────────────────────────────────────

fn msg(role: MessageRole, content: &str) -> ChatMessage {
    ChatMessage { role, content: content.to_string(), name: None }
}

#[test]
fn trim_keeps_all_when_under_limit() {
    let msgs = vec![
        msg(MessageRole::User, "hello"),
        msg(MessageRole::Assistant, "hi"),
    ];
    let trimmed = trim_messages(msgs.clone(), 10);
    assert_eq!(trimmed.len(), 2);
}

#[test]
fn trim_keeps_exactly_max() {
    let msgs: Vec<ChatMessage> = (0..10)
        .map(|i| msg(MessageRole::User, &format!("msg {i}")))
        .collect();
    let trimmed = trim_messages(msgs, 4);
    assert_eq!(trimmed.len(), 4);
    assert_eq!(trimmed[0].content, "msg 6");
    assert_eq!(trimmed[3].content, "msg 9");
}

#[test]
fn trim_avoids_starting_on_tool_message() {
    // If the first kept message after slicing is a Tool message, the trimmer
    // should back up by one to preserve context.
    let msgs = vec![
        msg(MessageRole::User, "u0"),
        msg(MessageRole::Assistant, "a0"),
        msg(MessageRole::User, "u1"),
        msg(MessageRole::Tool, "tool-result"),   // index 3 — would be start at max=2
        msg(MessageRole::Assistant, "a1"),
    ];
    // max=2 naively starts at index 3 (Tool). The trimmer backs up to 2.
    let trimmed = trim_messages(msgs, 2);
    assert!(
        !matches!(trimmed[0].role, MessageRole::Tool),
        "result must not start with a Tool message"
    );
}

#[test]
fn trim_empty_input_returns_empty() {
    let trimmed = trim_messages(vec![], 5);
    assert!(trimmed.is_empty());
}

#[test]
fn trim_max_zero_returns_empty() {
    let msgs = vec![msg(MessageRole::User, "hi")];
    let trimmed = trim_messages(msgs, 0);
    assert!(trimmed.is_empty());
}

// ── AgentLoopEvent display / serialisation ────────────────────────────────────

#[test]
fn agent_loop_event_token_has_delta() {
    let e = AgentLoopEvent::Token { delta: "hello".to_string() };
    match e {
        AgentLoopEvent::Token { delta } => assert_eq!(delta, "hello"),
        _ => panic!("expected Token"),
    }
}

#[test]
fn agent_loop_event_done_has_token_counts() {
    let e = AgentLoopEvent::Done {
        input_tokens: 100,
        output_tokens: 50,
        cache_read_tokens: 0,
        cache_write_tokens: 0,
    };
    match e {
        AgentLoopEvent::Done { input_tokens, output_tokens, .. } => {
            assert_eq!(input_tokens, 100);
            assert_eq!(output_tokens, 50);
        }
        _ => panic!("expected Done"),
    }
}

// ── Context-window token budget (via trim) ────────────────────────────────────

#[test]
fn long_history_fits_within_budget() {
    let msgs: Vec<ChatMessage> = (0..1000)
        .map(|i| msg(MessageRole::User, &format!("message {i}")))
        .collect();
    let max = 20;
    let trimmed = trim_messages(msgs, max);
    assert!(
        trimmed.len() <= max,
        "trimmed length {} exceeds max {}",
        trimmed.len(),
        max
    );
}

#[test]
fn trimmed_messages_preserve_order() {
    let msgs: Vec<ChatMessage> = (0..10)
        .map(|i| msg(MessageRole::User, &i.to_string()))
        .collect();
    let trimmed = trim_messages(msgs, 5);
    let contents: Vec<usize> = trimmed
        .iter()
        .map(|m| m.content.parse::<usize>().unwrap())
        .collect();
    for window in contents.windows(2) {
        assert!(window[0] < window[1], "messages must remain in order");
    }
}

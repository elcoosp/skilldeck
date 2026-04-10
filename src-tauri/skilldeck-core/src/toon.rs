//! TOON encoder / decoder using the `toon_rust` crate.

use crate::traits::ToolDefinition;
use toon_rust::{EncodeOptions, decode, encode};

/// Encode a list of tool definitions into a TOON string.
pub fn encode_tools(tools: &[ToolDefinition]) -> Option<String> {
    let tools_json = serde_json::to_value(tools).ok()?;
    encode(&tools_json, Some(&EncodeOptions::default())).ok()
}

/// Decode a TOON-encoded skill content back to a plain string.
pub fn decode_skill(content: &str) -> Option<String> {
    decode(content, None)
        .ok()
        .and_then(|v| v.as_str().map(String::from))
}

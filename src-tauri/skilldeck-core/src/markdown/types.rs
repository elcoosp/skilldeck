use serde::{Deserialize, Serialize};
use specta::Type;
use uuid::Uuid;

/// One extracted code fence, before syntax highlighting.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct ArtifactSpec {
    pub id: Uuid, // pre-assigned, stable
    pub language: String,
    pub raw_code: String, // plain text — ready for DB/copy
    pub slot_index: u32,  // position in the block sequence
}

/// One heading extracted from markdown.
/// Matches the shape of skilldeck_models::message_headings::TocItem.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct TocItem {
    pub id: String, // "h-{slug}-{toc_index}"
    pub toc_index: i32,
    pub text: String,
    pub level: i32,
    pub slug: String, // for HTML id= attribute and bookmark anchors
}

/// The complete output of one parse pass.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct ParseOutput {
    pub html_message: HtmlMessage,
    pub toc_items: Vec<TocItem>,
    pub artifact_specs: Vec<ArtifactSpec>,
}

/// Wire type for Tauri stream-update events and DB storage.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct HtmlMessage {
    pub stable_html: String,
    pub draft_html: Option<String>,
    pub slot_count: u32,
}

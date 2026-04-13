// src-tauri/skilldeck-core/src/markdown/types.rs
use serde::{Deserialize, Serialize};
use specta::Type;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, Type, PartialEq)]
pub struct ArtifactSpec {
    pub id: Uuid,
    pub language: String,
    pub raw_code: String,
    pub slot_index: u32,
    /// Optional file path extracted from a first-line comment or preceding inline code.
    pub file_path: Option<String>,
    pub line_count: u32,
    pub token_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type, PartialEq)]
pub struct TocItem {
    pub id: String,
    pub toc_index: i32,
    pub text: String,
    pub level: i32,
    pub slug: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type, PartialEq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum MdNode {
    Paragraph {
        id: String,
        html: String,
    },
    Heading {
        id: String,
        level: u8,
        text: String,
        slug: String,
        toc_index: i32,
    },
    CodeBlock {
        id: String,
        language: String,
        raw_code: String,
        highlighted_lines: Vec<String>,   // ← changed from highlighted_html
        artifact_id: Uuid,
        line_count: u32,
        file_path: Option<String>,
        token_count: u32,
        minimap_rgba: Vec<u8>,
        minimap_width: u32,
        minimap_height: u32,
    },
    List {
        id: String,
        ordered: bool,
        html: String,
    },
    Blockquote {
        id: String,
        html: String,
    },
    HorizontalRule {
        id: String,
    },
    HtmlBlock {
        id: String,
        html: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, Type, PartialEq)]
pub struct NodeDocument {
    pub stable_nodes: Vec<MdNode>,
    pub draft_nodes: Vec<MdNode>,
    pub toc_items: Vec<TocItem>,
    pub artifact_specs: Vec<ArtifactSpec>,
}

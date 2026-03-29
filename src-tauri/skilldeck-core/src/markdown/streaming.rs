// src-tauri/skilldeck-core/src/markdown/streaming.rs
use super::{
    renderer::MarkdownPipeline,
    types::{ArtifactSpec, MdNode, NodeDocument, TocItem},
};
use std::sync::Arc;

pub struct IncrementalStream {
    pipeline: Arc<MarkdownPipeline>,
    buffer: String,
    stable_end: usize,

    stable_nodes: Vec<MdNode>,
    stable_toc_items: Vec<TocItem>,
    stable_artifact_specs: Vec<ArtifactSpec>,
    next_node_id: u32,

    last_draft_nodes: Vec<MdNode>,
    last_drained_toc_index: usize,
    last_drained_artifact_index: usize,
}

impl IncrementalStream {
    pub fn new(pipeline: Arc<MarkdownPipeline>) -> Self {
        Self {
            pipeline,
            buffer: String::new(),
            stable_end: 0,
            stable_nodes: Vec::new(),
            stable_toc_items: Vec::new(),
            stable_artifact_specs: Vec::new(),
            next_node_id: 0,
            last_draft_nodes: Vec::new(),
            last_drained_toc_index: 0,
            last_drained_artifact_index: 0,
        }
    }

    pub fn push(&mut self, delta: &str) -> Option<NodeDocument> {
        self.buffer.push_str(delta);

        let prev_stable_len = self.stable_nodes.len();
        let prev_draft = self.last_draft_nodes.clone();

        self.advance_stable_boundary();

        let draft_nodes = self.compute_draft_nodes();

        // Stable nodes only grow – compare length to detect change
        let stable_changed = self.stable_nodes.len() != prev_stable_len;
        let draft_changed = draft_nodes != prev_draft;

        if !stable_changed && !draft_changed {
            return None;
        }

        self.last_draft_nodes = draft_nodes.clone();

        Some(NodeDocument {
            stable_nodes: self.stable_nodes.clone(), // still needed for the event payload
            draft_nodes,
            toc_items: self.stable_toc_items.clone(),
            artifact_specs: self.stable_artifact_specs.clone(),
        })
    }

    pub fn drain_new_toc_items(&mut self) -> Vec<TocItem> {
        let new = self.stable_toc_items[self.last_drained_toc_index..].to_vec();
        self.last_drained_toc_index = self.stable_toc_items.len();
        new
    }

    pub fn drain_new_artifact_specs(&mut self) -> Vec<ArtifactSpec> {
        let new = self.stable_artifact_specs[self.last_drained_artifact_index..].to_vec();
        self.last_drained_artifact_index = self.stable_artifact_specs.len();
        new
    }

    pub fn finalize(mut self) -> NodeDocument {
        let remaining_start = self.stable_end;
        let remaining = self.buffer[remaining_start..].to_string();
        self.stable_end = self.buffer.len();

        if !remaining.is_empty() {
            let chunk = self
                .pipeline
                .render_partial(&remaining, self.next_node_id, false);
            let len = chunk.stable_nodes.len();
            self.stable_nodes.extend(chunk.stable_nodes);
            self.stable_toc_items.extend(chunk.toc_items);
            self.stable_artifact_specs.extend(chunk.artifact_specs);
            self.next_node_id += len as u32;
        }
        NodeDocument {
            stable_nodes: self.stable_nodes,
            draft_nodes: Vec::new(),
            toc_items: self.stable_toc_items,
            artifact_specs: self.stable_artifact_specs,
        }
    }

    fn advance_stable_boundary(&mut self) {
        let search_start = self.stable_end.saturating_sub(1);
        if let Some(pos) = self.buffer[search_start..].find("\n\n") {
            let new_end = search_start + pos + 2;
            if new_end > self.stable_end {
                let chunk_md = &self.buffer[self.stable_end..new_end];
                let chunk = self
                    .pipeline
                    .render_partial(chunk_md, self.next_node_id, false);
                let len = chunk.stable_nodes.len();
                self.stable_nodes.extend(chunk.stable_nodes);
                self.stable_toc_items.extend(chunk.toc_items);
                self.stable_artifact_specs.extend(chunk.artifact_specs);
                self.next_node_id += len as u32;
                self.stable_end = new_end;
            }
        }
    }

    fn compute_draft_nodes(&self) -> Vec<MdNode> {
        let draft_md = &self.buffer[self.stable_end..];
        if draft_md.trim().is_empty() {
            Vec::new()
        } else {
            self.pipeline
                .render_partial(draft_md, self.next_node_id, true)
                .draft_nodes
        }
    }
}

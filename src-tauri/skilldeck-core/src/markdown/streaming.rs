use super::{
    renderer::MarkdownPipeline,
    types::{ArtifactSpec, HtmlMessage, ParseOutput, TocItem},
};
use std::sync::Arc;

pub struct IncrementalStream {
    pipeline: Arc<MarkdownPipeline>,
    buffer: String,
    stable_end: usize,

    stable_html: String,
    stable_slot_count: u32,
    stable_toc_items: Vec<TocItem>,
    stable_artifact_specs: Vec<ArtifactSpec>,

    last_draft_html: Option<String>,
    last_drained_toc_index: usize,
    last_drained_artifact_index: usize,
}

impl IncrementalStream {
    pub fn new(pipeline: Arc<MarkdownPipeline>) -> Self {
        Self {
            pipeline,
            buffer: String::new(),
            stable_end: 0,
            stable_html: String::new(),
            stable_slot_count: 0,
            stable_toc_items: Vec::new(),
            stable_artifact_specs: Vec::new(),
            last_draft_html: None,
            last_drained_toc_index: 0,
            last_drained_artifact_index: 0,
        }
    }

    pub fn push(&mut self, delta: &str) -> Option<HtmlMessage> {
        self.buffer.push_str(delta);
        self.advance_stable_boundary();
        let msg = self.build_message();
        if self.last_draft_html.as_deref() == msg.draft_html.as_deref()
            && msg.stable_html == self.stable_html
        {
            return None;
        }
        self.last_draft_html = msg.draft_html.clone();
        Some(msg)
    }

    /// Returns newly committed TOC items since the last call, for streaming events.
    pub fn drain_new_toc_items(&mut self) -> Vec<TocItem> {
        let new = self.stable_toc_items[self.last_drained_toc_index..].to_vec();
        self.last_drained_toc_index = self.stable_toc_items.len();
        new
    }

    /// Returns newly committed artifact specs since the last call, for streaming events.
    pub fn drain_new_artifact_specs(&mut self) -> Vec<ArtifactSpec> {
        let new = self.stable_artifact_specs[self.last_drained_artifact_index..].to_vec();
        self.last_drained_artifact_index = self.stable_artifact_specs.len();
        new
    }

    pub fn finalize(mut self) -> ParseOutput {
        // Capture remaining BEFORE updating stable_end
        let remaining_start = self.stable_end;
        let remaining = self.buffer[remaining_start..].to_string();
        self.stable_end = self.buffer.len();

        if !remaining.is_empty() {
            let chunk = self.pipeline.render_final(&remaining);
            self.stable_html.push_str(&chunk.html_message.stable_html);
            self.stable_slot_count += chunk.html_message.slot_count;
            self.stable_toc_items.extend(chunk.toc_items);
            self.stable_artifact_specs.extend(chunk.artifact_specs);
        }
        ParseOutput {
            html_message: HtmlMessage {
                stable_html: self.stable_html,
                draft_html: None,
                slot_count: self.stable_slot_count,
            },
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
                let chunk = self.pipeline.render_split(
                    chunk_md,
                    "",
                    self.stable_slot_count,
                    self.stable_toc_items.len() as i32,
                );
                self.stable_html.push_str(&chunk.html_message.stable_html);
                self.stable_slot_count += chunk.html_message.slot_count;
                self.stable_toc_items.extend(chunk.toc_items);
                self.stable_artifact_specs.extend(chunk.artifact_specs);
                self.stable_end = new_end;
            }
        }
    }

    fn build_message(&self) -> HtmlMessage {
        let draft_md = &self.buffer[self.stable_end..];
        let draft_html = if draft_md.trim().is_empty() {
            None
        } else {
            let d = self.pipeline.render_split(
                "",
                draft_md,
                self.stable_slot_count,
                self.stable_toc_items.len() as i32,
            );
            d.html_message.draft_html
        };
        HtmlMessage {
            stable_html: self.stable_html.clone(),
            draft_html,
            slot_count: self.stable_slot_count,
        }
    }
}

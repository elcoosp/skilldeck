use super::{
    theme::SharedTheme,
    types::{ArtifactSpec, HtmlMessage, ParseOutput, TocItem},
};
use once_cell::sync::Lazy;
use pulldown_cmark::{CodeBlockKind, Event, HeadingLevel, Options, Parser, Tag, TagEnd};
use syntect::{
    html::{ClassStyle, ClassedHTMLGenerator},
    parsing::SyntaxSet,
};
use uuid::Uuid;

static SYNTAX_SET: Lazy<SyntaxSet> = Lazy::new(SyntaxSet::load_defaults_newlines);

pub struct MarkdownPipeline {
    theme: SharedTheme,
}

impl MarkdownPipeline {
    pub fn new(theme: SharedTheme) -> Self {
        Self { theme }
    }

    pub fn render_final(&self, markdown: &str) -> ParseOutput {
        self.parse_blocks(markdown, 0, 0)
    }

    pub fn render_split(
        &self,
        stable_markdown: &str,
        draft_markdown: &str,
        slot_offset: u32,
        toc_offset: i32,
    ) -> ParseOutput {
        let mut out = self.parse_blocks(stable_markdown, slot_offset, toc_offset);
        if !draft_markdown.trim().is_empty() {
            let next_slot = slot_offset + out.html_message.slot_count;
            let draft_out = self.parse_blocks(draft_markdown, next_slot, -1);
            out.html_message.draft_html = draft_out.html_message.stable_html.into();
        }
        out
    }

    fn parse_blocks(&self, markdown: &str, slot_offset: u32, toc_offset: i32) -> ParseOutput {
        let mut html_buf = String::new();
        let mut code_buf = String::new();
        let mut heading_buf = String::new();
        let mut in_code = false;
        let mut in_heading = false;
        let mut code_lang = String::new();
        let mut heading_level: u8 = 1;

        let mut toc_items: Vec<TocItem> = Vec::new();
        let mut artifact_specs: Vec<ArtifactSpec> = Vec::new();
        let mut slot_count: u32 = 0;

        for event in Parser::new_ext(markdown, Options::all()) {
            match event {
                // ── Code block start ────────────────────────────────────────
                Event::Start(Tag::CodeBlock(CodeBlockKind::Fenced(lang))) => {
                    code_lang = lang.trim().to_string();
                    in_code = true;
                }
                Event::End(TagEnd::CodeBlock) => {
                    let slot_id = slot_offset + slot_count;
                    let artifact_id = Uuid::new_v4();

                    let highlighted = self.highlight(&code_buf, &code_lang);
                    html_buf.push_str(&format!(
                        r#"<div data-slot="code-block" data-slot-id="{slot_id}" data-language="{lang}" data-artifact-id="{aid}">{inner}</div>"#,
                        slot_id = slot_id,
                        lang = html_escape::encode_double_quoted_attribute(&code_lang),
                        aid = artifact_id,
                        inner = highlighted,
                    ));

                    artifact_specs.push(ArtifactSpec {
                        id: artifact_id,
                        language: code_lang.clone(),
                        raw_code: std::mem::take(&mut code_buf),
                        slot_index: slot_id,
                    });

                    slot_count += 1;
                    code_lang.clear();
                    in_code = false;
                }
                Event::Text(t) if in_code => code_buf.push_str(&t),

                // ── Heading ─────────────────────────────────────────────────
                Event::Start(Tag::Heading { level, .. }) => {
                    heading_level = heading_level_to_u8(level);
                    in_heading = true;
                }
                Event::End(TagEnd::Heading(_)) => {
                    let toc_index = toc_offset.max(0) as i32 + toc_items.len() as i32;
                    let text = std::mem::take(&mut heading_buf);
                    let slug = format!("{}-{}", slug::slugify(&text), toc_index);

                    toc_items.push(TocItem {
                        id: format!("h-{}-{}", slug, toc_index),
                        toc_index,
                        text: text.clone(),
                        level: heading_level as i32,
                        slug: slug.clone(),
                    });

                    html_buf.push_str(&format!(
                        r#"<h{l} data-slot="heading" data-slug="{slug}" data-level="{l}" id="{slug}">{text}</h{l}>"#,
                        l = heading_level,
                        slug = html_escape::encode_double_quoted_attribute(&slug),
                        text = html_escape::encode_text(&text),
                    ));
                    in_heading = false;
                }
                Event::Text(t) if in_heading => heading_buf.push_str(&t),

                // ── Everything else ──
                event => {
                    pulldown_cmark::html::push_html(&mut html_buf, std::iter::once(event));
                }
            }
        }

        ParseOutput {
            html_message: HtmlMessage {
                stable_html: html_buf,
                draft_html: None,
                slot_count,
            },
            toc_items,
            artifact_specs,
        }
    }

    fn highlight(&self, code: &str, lang: &str) -> String {
        let syntax = SYNTAX_SET
            .find_syntax_by_token(lang)
            .unwrap_or_else(|| SYNTAX_SET.find_syntax_plain_text());
        let mut gen =
            ClassedHTMLGenerator::new_with_class_style(syntax, &SYNTAX_SET, ClassStyle::Spaced);
        for line in syntect::util::LinesWithEndings::from(code) {
            let _ = gen.parse_html_for_line_which_includes_newline(line);
        }
        gen.finalize()
    }
}

fn heading_level_to_u8(level: HeadingLevel) -> u8 {
    match level {
        HeadingLevel::H1 => 1,
        HeadingLevel::H2 => 2,
        HeadingLevel::H3 => 3,
        HeadingLevel::H4 => 4,
        HeadingLevel::H5 => 5,
        HeadingLevel::H6 => 6,
    }
}

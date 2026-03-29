// src-tauri/skilldeck-core/src/markdown/renderer.rs
use super::{
    theme::SharedTheme,
    types::{ArtifactSpec, MdNode, NodeDocument, TocItem},
};
use once_cell::sync::Lazy;
use pulldown_cmark::{CodeBlockKind, Event, HeadingLevel, Options, Parser, Tag, TagEnd, html};
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

    pub fn render_final(&self, markdown: &str) -> NodeDocument {
        self.render_blocks(markdown, 0, false)
    }

    pub fn render_partial(&self, markdown: &str, next_id: u32, is_draft: bool) -> NodeDocument {
        self.render_blocks(markdown, next_id, is_draft)
    }

    fn render_blocks(&self, markdown: &str, start_id: u32, is_draft: bool) -> NodeDocument {
        let mut id_counter = start_id;
        let mut nodes = Vec::new();
        let mut toc_items = Vec::new();
        let mut artifact_specs = Vec::new();
        let mut html_buf = String::new();

        let mut in_special = false;
        let mut in_heading = false;
        let mut heading_level = 1;
        let mut heading_text = String::new();

        let mut in_code = false;
        let mut code_lang = String::new();
        let mut code_buf = String::new();

        let flush_html = |buf: &mut String, id_counter: &mut u32, nodes: &mut Vec<MdNode>| {
            if !buf.is_empty() {
                let id = format!("html-{}", *id_counter);
                *id_counter += 1;
                nodes.push(MdNode::HtmlBlock {
                    id,
                    html: std::mem::take(buf),
                });
            }
        };

        if is_draft && markdown.trim().is_empty() {
            return NodeDocument {
                stable_nodes: vec![],
                draft_nodes: vec![],
                toc_items: vec![],
                artifact_specs: vec![],
            };
        }

        if is_draft {
            let id = format!("draft-{}", id_counter);
            nodes.push(MdNode::Draft {
                id,
                raw_markdown: markdown.to_string(),
            });
            return NodeDocument {
                stable_nodes: vec![],
                draft_nodes: nodes,
                toc_items: vec![],
                artifact_specs: vec![],
            };
        }

        let parser = Parser::new_ext(markdown, Options::all());

        for event in parser {
            match event {
                Event::Start(Tag::CodeBlock(CodeBlockKind::Fenced(lang))) => {
                    flush_html(&mut html_buf, &mut id_counter, &mut nodes);
                    in_special = true;
                    in_code = true;
                    code_lang = lang.trim().to_string();
                    code_buf.clear();
                }
                Event::Text(t) if in_code => code_buf.push_str(&t),
                Event::End(TagEnd::CodeBlock) => {
                    let id = format!("cb-{}", id_counter);
                    id_counter += 1;
                    let highlighted = self.highlight(&code_buf, &code_lang);
                    let artifact_id = Uuid::new_v4();

                    // FIX: take the raw code once, then clone for the node
                    let raw = std::mem::take(&mut code_buf);

                    nodes.push(MdNode::CodeBlock {
                        id,
                        language: code_lang.clone(),
                        raw_code: raw.clone(),
                        highlighted_html: highlighted,
                        artifact_id,
                    });
                    artifact_specs.push(ArtifactSpec {
                        id: artifact_id,
                        language: code_lang.clone(),
                        raw_code: raw,
                        slot_index: id_counter - 1,
                    });

                    in_code = false;
                    in_special = false;
                }

                Event::Start(Tag::Heading { level, .. }) => {
                    flush_html(&mut html_buf, &mut id_counter, &mut nodes);
                    in_special = true;
                    in_heading = true;
                    heading_level = heading_level_to_u8(level);
                    heading_text.clear();
                }
                Event::Text(t) if in_heading => heading_text.push_str(&t),
                Event::End(TagEnd::Heading(_)) => {
                    let text = heading_text.clone();
                    let slug = slug::slugify(&text);
                    let id = format!("h-{}-{}", slug, toc_items.len());
                    let toc_index = toc_items.len() as i32;
                    toc_items.push(TocItem {
                        id: id.clone(),
                        toc_index,
                        text: text.clone(),
                        level: heading_level as i32,
                        slug: slug.clone(),
                    });
                    nodes.push(MdNode::Heading {
                        id,
                        level: heading_level,
                        text,
                        slug,
                        toc_index,
                    });
                    in_heading = false;
                    in_special = false;
                }

                Event::Start(Tag::List(_)) => {}
                Event::End(TagEnd::List(_)) => {}

                Event::Start(Tag::BlockQuote(_)) => {}
                Event::End(TagEnd::BlockQuote(_)) => {}

                Event::Rule => {
                    flush_html(&mut html_buf, &mut id_counter, &mut nodes);
                    let id = format!("hr-{}", id_counter);
                    id_counter += 1;
                    nodes.push(MdNode::HorizontalRule { id });
                }

                _ => {
                    if !in_special {
                        html_buf.push_str(&event_to_html(&event));
                    }
                }
            }
        }

        flush_html(&mut html_buf, &mut id_counter, &mut nodes);

        NodeDocument {
            stable_nodes: nodes,
            draft_nodes: vec![],
            toc_items,
            artifact_specs,
        }
    }

    fn highlight(&self, code: &str, lang: &str) -> String {
        let syntax = SYNTAX_SET
            .find_syntax_by_token(lang)
            .unwrap_or_else(|| SYNTAX_SET.find_syntax_plain_text());
        let mut css_gen =
            ClassedHTMLGenerator::new_with_class_style(syntax, &SYNTAX_SET, ClassStyle::Spaced);
        for line in syntect::util::LinesWithEndings::from(code) {
            let _ = css_gen.parse_html_for_line_which_includes_newline(line);
        }
        css_gen.finalize()
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

fn event_to_html(event: &Event) -> String {
    let mut buf = String::new();
    html::push_html(&mut buf, std::iter::once(event.clone()));
    buf
}

// src-tauri/skilldeck-core/src/markdown/renderer.rs

use super::{
    theme::SharedTheme,
    types::{ArtifactSpec, MdNode, NodeDocument, TocItem},
};
use once_cell::sync::Lazy;
use pulldown_cmark::{CodeBlockKind, Event, HeadingLevel, Options, Parser, Tag, TagEnd, html};
use regex::Regex;
use syntect::{
    easy::HighlightLines,
    highlighting::Theme,
    html::{styled_line_to_highlighted_html, IncludeBackground},
    parsing::{SyntaxDefinition, SyntaxReference, SyntaxSet},
};
use uuid::Uuid;

static SYNTAX_SET: Lazy<SyntaxSet> = Lazy::new(|| {
    let mut builder = SyntaxSet::load_defaults_newlines().into_builder();

    // Load TypeScriptReact (TSX) syntax
    let tsx_def = SyntaxDefinition::load_from_str(
        include_str!("./TypeScriptReact.sublime-syntax"),
        false,
        Some("typescriptreact"),
    )
    .expect("Failed to load TypeScriptReact.sublime-syntax");
    builder.add(tsx_def);

    // Load TOML syntax
    let toml_def = SyntaxDefinition::load_from_str(
        include_str!("./TOML.sublime-syntax"),
        false,
        Some("toml"),
    )
    .expect("Failed to load TOML.sublime-syntax");
    builder.add(toml_def);

    builder.build()
});

// compiled regex for link rewriting
static LINK_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r#"<a((?:\s[^>]*)?)\s*href=(")([^"]+)""#).unwrap());

pub struct MarkdownPipeline {
    theme: SharedTheme,
}

impl MarkdownPipeline {
    pub fn new(theme: SharedTheme) -> Self {
        Self { theme }
    }

    pub fn render_final(&self, markdown: &str) -> NodeDocument {
        self.render_blocks(markdown, 0, true)
    }

    pub fn render_partial(
        &self,
        markdown: &str,
        next_id: u32,
        emit_artifacts: bool,
    ) -> NodeDocument {
        self.render_blocks(markdown, next_id, emit_artifacts)
    }

    fn render_blocks(&self, markdown: &str, start_id: u32, emit_artifacts: bool) -> NodeDocument {
        let mut id_counter = start_id;
        let mut nodes = Vec::new();
        let mut toc_items = Vec::new();
        let mut artifact_specs = Vec::new();
        let mut html_buf = String::new();

        // List handling
        let mut list_stack: Vec<(bool, String)> = Vec::new();
        let mut in_list = false;

        let mut in_code = false;
        let mut code_lang = String::new();
        let mut code_buf = String::new();

        let mut in_heading = false;
        let mut heading_level = 1;
        let mut heading_text = String::new();

        // State for capturing preceding inline code
        let mut last_inline_code: Option<String> = None;

        let flush_html = |buf: &mut String, id_counter: &mut u32, nodes: &mut Vec<MdNode>| {
            if !buf.is_empty() {
                let raw = std::mem::take(buf);
                let html = rewrite_links(&raw);
                let html = rewrite_images(&html);
                let html = rewrite_inline_code(&html);
                let id = format!("html-{}", *id_counter);
                *id_counter += 1;
                nodes.push(MdNode::HtmlBlock { id, html });
            }
        };

        let parser = Parser::new_ext(markdown, Options::all());

        for event in parser {
            match event {
                // ─── Code blocks ─────────────────────────────────────────────
                Event::Start(Tag::CodeBlock(CodeBlockKind::Fenced(lang))) => {
                    flush_html(&mut html_buf, &mut id_counter, &mut nodes);
                    in_code = true;
                    code_lang = lang.trim().to_string();
                    code_buf.clear();
                }
                Event::Text(t) if in_code => code_buf.push_str(&t),
                Event::End(TagEnd::CodeBlock) => {
                    if code_buf.trim().is_empty() {
                        in_code = false;
                        code_lang.clear();
                        last_inline_code = None;
                        continue;
                    }

                    // Attempt to extract file path from first-line comment or preceding inline code
                    let file_path = extract_file_path(&code_lang, &code_buf).or_else(|| {
                        last_inline_code
                            .take()
                            .filter(|s| is_plausible_filename(s, &code_lang))
                    });

                    let id = format!("cb-{}", id_counter);
                    id_counter += 1;
                    let (highlighted_lines, line_count, token_count, minimap_rgba, minimap_width, minimap_height) =
                        self.highlight(&code_buf, &code_lang);
                    let artifact_id = Uuid::new_v4();
                    let raw = std::mem::take(&mut code_buf);
                    nodes.push(MdNode::CodeBlock {
                        id,
                        language: code_lang.clone(),
                        raw_code: raw.clone(),
                        highlighted_lines,
                        artifact_id,
                        line_count,
                        file_path: file_path.clone(),
                        token_count,
                        minimap_rgba,
                        minimap_width,
                        minimap_height,
                    });
                    if emit_artifacts {
                        artifact_specs.push(ArtifactSpec {
                            id: artifact_id,
                            language: code_lang.clone(),
                            raw_code: raw,
                            slot_index: id_counter - 1,
                            file_path,
                            line_count,
                            token_count,
                        });
                    }

                    last_inline_code = None;
                    in_code = false;
                }

                // ─── Inline code ────────────────────────────────────────────
                Event::Code(ref text) => {
                    last_inline_code = Some(text.to_string());
                    if !in_code && !in_heading {
                        html_buf.push_str(&event_to_html(&event));
                    }
                }

                // ─── Headings ────────────────────────────────────────────────
                Event::Start(Tag::Heading { level, .. }) => {
                    flush_html(&mut html_buf, &mut id_counter, &mut nodes);
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
                }

                // ─── Lists ───────────────────────────────────────────────────
                Event::Start(Tag::List(ord)) => {
                    flush_html(&mut html_buf, &mut id_counter, &mut nodes);
                    let ordered = ord.is_some();
                    list_stack.push((ordered, String::new()));
                    in_list = true;
                }
                Event::End(TagEnd::List(_)) => {
                    if let Some((ordered, list_html)) = list_stack.pop() {
                        let list_html = rewrite_links(&list_html);
                        let list_html = rewrite_images(&list_html);
                        let list_html = rewrite_inline_code(&list_html);
                        let tag = if ordered { "ol" } else { "ul" };
                        let full_html = format!("<{}>{}</{}>", tag, list_html, tag);
                        let id = format!("list-{}", id_counter);
                        id_counter += 1;
                        nodes.push(MdNode::List {
                            id,
                            ordered,
                            html: full_html,
                        });
                    }
                    in_list = !list_stack.is_empty();
                }
                Event::Start(Tag::Item) => {
                    if in_list && !list_stack.is_empty() {
                        if let Some((_, buf)) = list_stack.last_mut() {
                            buf.push_str("<li>");
                        }
                    }
                }
                Event::End(TagEnd::Item) => {
                    if in_list && !list_stack.is_empty() {
                        if let Some((_, buf)) = list_stack.last_mut() {
                            buf.push_str("</li>");
                        }
                    }
                }

                // ─── Blockquotes ────────────────────────────────────────────
                Event::Start(Tag::BlockQuote(_)) => {
                    flush_html(&mut html_buf, &mut id_counter, &mut nodes);
                    html_buf.push_str("<blockquote>");
                }
                Event::End(TagEnd::BlockQuote(_)) => {
                    html_buf.push_str("</blockquote>");
                }

                // ─── Horizontal rule ────────────────────────────────────────
                Event::Rule => {
                    flush_html(&mut html_buf, &mut id_counter, &mut nodes);
                    let id = format!("hr-{}", id_counter);
                    id_counter += 1;
                    nodes.push(MdNode::HorizontalRule { id });
                }

                // ─── Everything else (paragraphs, inline HTML, etc.) ────────
                _ => {
                    if in_list && !list_stack.is_empty() {
                        let html = event_to_html(&event);
                        if let Some((_, buf)) = list_stack.last_mut() {
                            buf.push_str(&html);
                        }
                    } else if !in_code && !in_heading {
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

    /// Highlight code and return per-line HTML (inline spans only, no block wrapper).
    /// Returns (lines_html, line_count, token_count, minimap_rgba, minimap_width, minimap_height).
    fn highlight(&self, code: &str, lang: &str) -> (Vec<String>, u32, u32, Vec<u8>, u32, u32) {
        let normalized_lang = match lang {
            "typescript" | "ts" | "typescriptreact" => "tsx",
            _ => lang,
        };
        let syntax_ref = SYNTAX_SET
            .find_syntax_by_token(normalized_lang)
            .unwrap_or_else(|| {
                SYNTAX_SET
                    .find_syntax_by_first_line(code)
                    .unwrap_or_else(|| SYNTAX_SET.find_syntax_plain_text())
            });

        let lines: Vec<&str> = code.lines().collect();
        let line_count = lines.len() as u32;

        let mut highlighted_lines = Vec::with_capacity(lines.len());
        let mut minimap_rgba = Vec::new();
        let mut minimap_width = 0;
        let mut minimap_height = 0;
        let mut token_count = 0u32;

        self.theme.with_theme(|theme| {
            // Count tokens using HighlightLines (still needed)
            let mut highlighter = HighlightLines::new(syntax_ref, theme);
            for line in &lines {
                let line_with_nl = format!("{}\n", line);
                if let Ok(regions) = highlighter.highlight_line(&line_with_nl, &SYNTAX_SET) {
                    token_count += regions.len() as u32;
                }
            }

            // Generate class-based HTML per line (no block wrapper)
            for line in lines.iter() {
                let highlighted = syntect::html::highlighted_html_for_string(
                    line,
                    &SYNTAX_SET,
                    syntax_ref,
                    theme,
                )
                .unwrap_or_else(|_| line.replace('<', "&lt;").replace('>', "&gt;"));

                // `highlighted_html_for_string` returns a full <pre>…</pre> block.
                // We need to strip the outer <pre> and keep only the inner spans.
                let inner = strip_pre_tag(&highlighted);
                highlighted_lines.push(inner);
            }

            // Generate minimap (unchanged)
            let (rgba, w, h) = self.minimap_from_lines_with_highlighter(&lines, syntax_ref, theme);
            minimap_rgba = rgba;
            minimap_width = w;
            minimap_height = h;
        });

        (highlighted_lines, line_count, token_count, minimap_rgba, minimap_width, minimap_height)
    }

    // ─── Minimap generation using HighlightLines ──────────────────────────────
    fn minimap_from_lines_with_highlighter(
        &self,
        lines: &[&str],
        syntax_ref: &SyntaxReference,
        theme: &Theme,
    ) -> (Vec<u8>, u32, u32) {
        if lines.is_empty() {
            return (vec![], 0, 0);
        }

        const CHAR_W: u32 = 2;
        const CHAR_H: u32 = 2;
        const MAX_WIDTH_CHARS: u32 = 50;

        let image_width = MAX_WIDTH_CHARS * CHAR_W;
        let image_height = lines.len() as u32 * CHAR_H;
        let mut rgba = vec![0u8; (image_width * image_height * 4) as usize];

        let mut highlighter = HighlightLines::new(syntax_ref, theme);

        for (line_idx, &line) in lines.iter().enumerate() {
            let line_with_nl = format!("{}\n", line);
            let regions = highlighter
                .highlight_line(&line_with_nl, &SYNTAX_SET)
                .unwrap_or_default();
            let mut col = 0;

            for (style, text) in regions {
                let fg = style.foreground;
                let char_count = text.chars().count();
                for _ in 0..char_count {
                    if col < MAX_WIDTH_CHARS {
                        fill_block(
                            &mut rgba,
                            line_idx as u32,
                            col,
                            CHAR_W,
                            CHAR_H,
                            image_width,
                            fg,
                        );
                        col += 1;
                    }
                }
            }
        }

        (rgba, image_width, image_height)
    }
}

// Helper to fill a block of pixels
fn fill_block(
    rgba: &mut [u8],
    line_idx: u32,
    char_col: u32,
    char_w: u32,
    char_h: u32,
    full_width: u32,
    color: syntect::highlighting::Color,
) {
    let start_x = char_col * char_w;
    let start_y = line_idx * char_h;
    for dy in 0..char_h {
        for dx in 0..char_w {
            let px_x = start_x + dx;
            let px_y = start_y + dy;
            if px_x < full_width {
                let idx = ((px_y * full_width + px_x) * 4) as usize;
                if idx + 3 < rgba.len() {
                    rgba[idx] = color.r;
                    rgba[idx + 1] = color.g;
                    rgba[idx + 2] = color.b;
                    rgba[idx + 3] = color.a;
                }
            }
        }
    }
}

/// Tag `<a href="http://...">` or `<a href="https://...">` links with a data
/// attribute so the frontend can intercept clicks and open them in the system
/// browser instead of the Tauri webview.
///
/// Anchor links (`#...`), relative paths, and other schemes (mailto:, tel:, etc.)
/// are left untouched.
fn rewrite_links(html: &str) -> String {
    LINK_RE
        .replace_all(html, |caps: &regex::Captures| {
            let pre_href_attrs = &caps[1];
            let quote = &caps[2];
            let href = &caps[3];

            if href.starts_with("http://") || href.starts_with("https://") {
                format!(
                    "<a{} data-external-link=\"true\" href={}{}{}",
                    pre_href_attrs, quote, href, quote
                )
            } else {
                format!("<a{} href={}{}{}", pre_href_attrs, quote, href, quote)
            }
        })
        .into_owned()
}

/// Add lazy loading and onerror fallback to images.
/// This prevents layout shift when an image fails to load.
fn rewrite_images(html: &str) -> String {
    html.replace(
        "<img ",
        "<img loading=\"lazy\" onerror=\"this.style.visibility='hidden';this.style.minHeight='1.5em'\" ",
    )
}

/// Tag inline `<code>` spans (not inside fenced blocks) so the frontend can
/// add click-to-copy behaviour via a delegated handler.
fn rewrite_inline_code(html: &str) -> String {
    html.replace("<code>", "<code data-inline-code=\"true\">")
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

// -----------------------------------------------------------------------------
// File path extraction helpers (unchanged)
// -----------------------------------------------------------------------------

fn extract_file_path(lang: &str, code: &str) -> Option<String> {
    let first_line = code.lines().find(|l| !l.trim().is_empty())?;
    let trimmed = first_line.trim();

    let comment_prefix = comment_prefix_for_lang(lang)?;
    if trimmed.starts_with(comment_prefix) {
        let after_comment = trimmed[comment_prefix.len()..].trim();
        if is_plausible_filename(after_comment, lang) {
            return Some(after_comment.to_string());
        }
    }
    None
}

fn comment_prefix_for_lang(lang: &str) -> Option<&'static str> {
    match lang.to_lowercase().as_str() {
        "rust" | "rs" | "c" | "cpp" | "c++" | "java" | "javascript" | "js" | "typescript"
        | "ts" | "go" | "swift" | "kotlin" | "scala" => Some("//"),
        "python" | "py" | "ruby" | "rb" | "perl" | "sh" | "bash" | "yaml" | "yml" | "toml" => {
            Some("#")
        }
        "html" | "xml" | "md" | "markdown" => Some("<!--"),
        "css" | "scss" | "sass" | "less" => Some("/*"),
        "sql" => Some("--"),
        "lua" => Some("--"),
        "haskell" | "hs" => Some("--"),
        _ => None,
    }
}

fn is_plausible_filename(s: &str, lang: &str) -> bool {
    if !(s.contains('/') || s.contains('\\') || s.contains('.')) {
        return false;
    }

    let ext = std::path::Path::new(s)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("");

    match (lang.to_lowercase().as_str(), ext) {
        ("rust", "rs")
        | ("rs", "rs")
        | ("python", "py")
        | ("py", "py")
        | ("javascript", "js")
        | ("js", "js")
        | ("typescript", "ts")
        | ("ts", "ts")
        | ("typescript", "tsx")
        | ("tsx", "tsx")
        | ("html", "html")
        | ("htm", "html")
        | ("css", "css")
        | ("json", "json")
        | ("toml", "toml")
        | ("yaml", "yaml")
        | ("yml", "yaml")
        | ("c", "c")
        | ("cpp", "cpp")
        | ("c++", "cpp")
        | ("java", "java")
        | ("go", "go")
        | ("swift", "swift")
        | ("kotlin", "kt")
        | ("scala", "scala")
        | ("ruby", "rb")
        | ("rb", "rb")
        | ("sh", "sh")
        | ("bash", "sh")
        | ("sql", "sql")
        | ("lua", "lua")
        | ("haskell", "hs")
        | ("hs", "hs") => true,
        _ => ext.len() >= 2 && ext.len() <= 5,
    }
}
fn strip_pre_tag(html: &str) -> String {
    let open = html.find("<pre").unwrap_or(0);
    let close = html.rfind("</pre>").unwrap_or(html.len());
    html[open..close].to_string()
        .trim_start_matches(|c| c != '>')
        .trim_start_matches('>')
        .to_string()
}

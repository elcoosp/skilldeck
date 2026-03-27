use pulldown_cmark::{Event, Parser, Tag, TagEnd};
use skilldeck_models::message_headings::TocItem;
use uuid::Uuid;

pub fn extract_headings(content: &str) -> Vec<TocItem> {
    let mut headings = Vec::new();
    let mut toc_index = 0;
    let parser = Parser::new(content);

    let mut in_heading = false;
    let mut current_level = 0;
    let mut current_text = String::new();

    for event in parser {
        match event {
            Event::Start(Tag::Heading { level, .. }) => {
                in_heading = true;
                current_level = level as i32;
                current_text.clear();
            }
            Event::End(TagEnd::Heading) if in_heading => {
                headings.push(TocItem {
                    id: format!("heading-{}-{}", Uuid::new_v4(), toc_index),
                    toc_index,
                    text: current_text.trim().to_string(),
                    level: current_level,
                });
                toc_index += 1;
                in_heading = false;
            }
            Event::Text(text) if in_heading => {
                current_text.push_str(&text);
            }
            _ => {}
        }
    }
    headings
}

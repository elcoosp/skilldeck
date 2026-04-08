use skilldeck_core::providers::ollama::{OllamaProvider, OllamaStatus};

#[test]
fn parse_ollama_list_typical() {
    let output = "NAME                     ID              SIZE    MODIFIED\n\
                  llama3.2:latest          a80c4f17acd5    2.0 GB  3 hours ago\n";
    let models = OllamaProvider::parse_ollama_list(output);
    assert_eq!(models, vec!["llama3.2:latest"]);
}

#[test]
fn parse_ollama_list_empty() {
    let output = "NAME                     ID              SIZE    MODIFIED\n";
    let models = OllamaProvider::parse_ollama_list(output);
    assert!(models.is_empty());
}

#[test]
fn parse_ollama_list_multiple() {
    let output = "NAME                     ID              SIZE    MODIFIED\n\
                  llama3.2:latest          a80c4f17acd5    2.0 GB  3 hours ago\n\
                  mistral:latest           61e88e884507    4.1 GB  1 week ago\n";
    let models = OllamaProvider::parse_ollama_list(output);
    assert_eq!(models, vec!["llama3.2:latest", "mistral:latest"]);
}




//! Ollama (local) model provider implementation.
//!
//! Wraps the OpenAI-compatible API that Ollama exposes at localhost.

use crate::{
    CoreError,
    traits::{CompletionRequest, CompletionStream, ModelCapabilities, ModelInfo, ModelProvider},
    providers::openai::OpenAiProvider,
};

pub struct OllamaProvider {
    inner: OpenAiProvider,
    pub(crate) port: u16,
}

impl OllamaProvider {
    pub fn new(port: u16) -> Self {
        let inner = OpenAiProvider::new("ollama".to_string())
            .with_base_url(format!("http://localhost:{}/v1", port));
        Self { inner, port }
    }
}

#[async_trait::async_trait]
impl ModelProvider for OllamaProvider {
    fn id(&self) -> &str { "ollama" }
    fn display_name(&self) -> &str { "Ollama (local)" }
    fn supports_toon(&self) -> bool { false }

    async fn list_models(&self) -> Result<Vec<ModelInfo>, CoreError> {
        Ok(vec![
            ModelInfo {
                id: "llama3.2".to_string(),
                name: "Llama 3.2".to_string(),
                context_length: 128_000,
                max_output_tokens: 4096,
                capabilities: ModelCapabilities {
                    function_calling: true,
                    vision: false,
                    code_execution: false,
                    prompt_caching: false,
                },
            },
            ModelInfo {
                id: "llama3.1".to_string(),
                name: "Llama 3.1".to_string(),
                context_length: 128_000,
                max_output_tokens: 4096,
                capabilities: ModelCapabilities {
                    function_calling: true,
                    vision: false,
                    code_execution: false,
                    prompt_caching: false,
                },
            },
            ModelInfo {
                id: "codellama".to_string(),
                name: "Code Llama".to_string(),
                context_length: 16_000,
                max_output_tokens: 4096,
                capabilities: ModelCapabilities {
                    function_calling: false,
                    vision: false,
                    code_execution: false,
                    prompt_caching: false,
                },
            },
        ])
    }

    async fn complete(&self, request: CompletionRequest) -> Result<CompletionStream, CoreError> {
        // Ollama has no rate limits — delegate directly, no retry wrapper needed.
        self.inner.complete(request).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn provider_id() {
        let p = OllamaProvider::new(11434);
        assert_eq!(p.id(), "ollama");
        assert_eq!(p.display_name(), "Ollama (local)");
        assert!(!p.supports_toon());
    }

    #[test]
    fn default_port() {
        let p = OllamaProvider::new(11434);
        assert_eq!(p.port, 11434);
    }

    #[tokio::test]
    async fn list_models_returns_llama() {
        let p = OllamaProvider::new(11434);
        let models = p.list_models().await.unwrap();
        assert!(models.iter().any(|m| m.id == "llama3.2"));
    }
}

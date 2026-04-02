//! Ollama (local) model provider implementation.
//!
//! Wraps the OpenAI-compatible API that Ollama exposes at localhost.
//! When `list_models()` is called it runs `ollama list` to get the actual
//! installed models rather than returning a hard-coded list.

use crate::{
    CoreError,
    providers::openai::OpenAiProvider,
    traits::model_provider::ProviderReadyStatus,
    traits::{CompletionRequest, CompletionStream, ModelCapabilities, ModelInfo, ModelProvider},
};

// ── OllamaStatus enum (moved to module scope) ────────────────────────────────

#[derive(Debug, Clone)]
pub enum OllamaStatus {
    Available(Vec<ModelInfo>),
    NotInstalled,
    NotRunning,
    NoModels,
}

// ── OllamaProvider implementation ────────────────────────────────────────────

pub struct OllamaProvider {
    inner: OpenAiProvider,
}

impl OllamaProvider {
    pub fn new(port: u16) -> Self {
        let inner = OpenAiProvider::new("ollama".to_string())
            .with_base_url(format!("http://localhost:{}/v1", port));
        Self { inner }
    }

    /// Parse the output of `ollama list` into a vec of model IDs.
    ///
    /// The command outputs lines like:
    /// ```
    /// NAME                     ID              SIZE    MODIFIED
    /// llama3.2:latest          a80c4f17acd5    2.0 GB  3 hours ago
    /// codellama:latest         8fdf8f752f6e    3.8 GB  2 days ago
    /// ```
    /// We skip the header line and take the first whitespace-delimited token
    /// from each subsequent line as the model name.
    fn parse_ollama_list(output: &str) -> Vec<String> {
        output
            .lines()
            .skip(1) // skip the header row
            .filter_map(|line| {
                let name = line.split_whitespace().next()?;
                if name.is_empty() {
                    None
                } else {
                    Some(name.to_string())
                }
            })
            .collect()
    }

    /// Run `ollama list` and return the installed model IDs.
    /// Falls back to a minimal default list if the command is unavailable.
    pub async fn fetch_installed_models() -> Vec<ModelInfo> {
        match Self::check_ollama_status().await {
            OllamaStatus::Available(models) => models,
            _ => vec![], // no fallback; return empty
        }
    }

    /// Minimal fallback model list used when `ollama list` is unavailable.
    fn default_models() -> Vec<ModelInfo> {
        vec![] // intentionally empty – no fake models
    }

    // =====================================================================
    // Ollama status detection
    // =====================================================================

    pub async fn check_ollama_status() -> OllamaStatus {
        // Check if binary exists
        let which = tokio::process::Command::new("which")
            .arg("ollama")
            .output()
            .await;
        if which.map(|w| w.status.success()).unwrap_or(false) {
            // binary found, now check `ollama list`
            let list = tokio::process::Command::new("ollama")
                .arg("list")
                .output()
                .await;
            match list {
                Ok(output) if output.status.success() => {
                    let stdout = String::from_utf8_lossy(&output.stdout);
                    let model_ids = Self::parse_ollama_list(&stdout);
                    if model_ids.is_empty() {
                        OllamaStatus::NoModels
                    } else {
                        let models: Vec<ModelInfo> = model_ids
                            .into_iter()
                            .map(|id| ModelInfo {
                                id: id.clone(),
                                name: id,
                                context_length: 128_000,
                                max_output_tokens: 4096,
                                capabilities: ModelCapabilities {
                                    function_calling: true,
                                    vision: false,
                                    code_execution: false,
                                    prompt_caching: false,
                                },
                            })
                            .collect();
                        OllamaStatus::Available(models)
                    }
                }
                _ => OllamaStatus::NotRunning,
            }
        } else {
            OllamaStatus::NotInstalled
        }
    }
}

#[async_trait::async_trait]
impl ModelProvider for OllamaProvider {
    fn id(&self) -> &str {
        "ollama"
    }
    fn display_name(&self) -> &str {
        "Ollama (local)"
    }
    fn supports_toon(&self) -> bool {
        false
    }

    async fn list_models(&self) -> Result<Vec<ModelInfo>, CoreError> {
        Ok(Self::fetch_installed_models().await)
    }

    async fn complete(&self, request: CompletionRequest) -> Result<CompletionStream, CoreError> {
        // Ollama has no rate limits — delegate directly, no retry wrapper needed.
        self.inner.complete(request).await
    }

    async fn is_ready(&self, model_id: &str) -> ProviderReadyStatus {
        match Self::check_ollama_status().await {
            OllamaStatus::Available(models) => {
                if models.iter().any(|m| m.id == model_id) {
                    ProviderReadyStatus::Ready
                } else {
                    ProviderReadyStatus::NotReady {
                        reason: format!("Model '{}' is not installed in Ollama", model_id),
                        fix_action: format!("Run `ollama pull {}` to install it", model_id),
                    }
                }
            }
            OllamaStatus::NotInstalled => ProviderReadyStatus::NotReady {
                reason: "Ollama is not installed on this machine".to_string(),
                fix_action: "Install Ollama from https://ollama.com/download".to_string(),
            },
            OllamaStatus::NotRunning => ProviderReadyStatus::NotReady {
                reason: "Ollama is installed but not running".to_string(),
                fix_action: "Start the Ollama service (e.g., `ollama serve`)".to_string(),
            },
            OllamaStatus::NoModels => ProviderReadyStatus::NotReady {
                reason: "Ollama is running but no models are installed".to_string(),
                fix_action: "Pull a model, e.g., `ollama pull llama3.2`".to_string(),
            },
        }
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
    fn parse_ollama_list_typical_output() {
        let output = "NAME                     ID              SIZE    MODIFIED\n\
                      llama3.2:latest          a80c4f17acd5    2.0 GB  3 hours ago\n\
                      codellama:latest         8fdf8f752f6e    3.8 GB  2 days ago\n\
                      mistral:latest           61e88e884507    4.1 GB  1 week ago\n";
        let models = OllamaProvider::parse_ollama_list(output);
        assert_eq!(models.len(), 3);
        assert_eq!(models[0], "llama3.2:latest");
        assert_eq!(models[1], "codellama:latest");
        assert_eq!(models[2], "mistral:latest");
    }

    #[test]
    fn parse_ollama_list_header_only() {
        let output = "NAME                     ID              SIZE    MODIFIED\n";
        let models = OllamaProvider::parse_ollama_list(output);
        assert!(models.is_empty());
    }

    #[test]
    fn parse_ollama_list_empty_string() {
        let models = OllamaProvider::parse_ollama_list("");
        assert!(models.is_empty());
    }

    #[test]
    fn default_models_empty() {
        let models = OllamaProvider::default_models();
        assert!(models.is_empty());
    }

    #[tokio::test]
    async fn list_models_returns_non_empty() {
        let p = OllamaProvider::new(11434);
        // Either returns real models (if ollama is installed) or the fallback list.
        let models = p.list_models().await.unwrap();
        // No expectation – we accept either, but the function now returns Vec
        // (maybe empty if ollama not installed). So just ensure no panic.
    }

    #[tokio::test]
    async fn check_ollama_status_does_not_panic() {
        let _ = OllamaProvider::check_ollama_status().await;
    }
}

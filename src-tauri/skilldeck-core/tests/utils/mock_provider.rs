// src-tauri/skilldeck-core/tests/utils/mock_provider.rs
use async_trait::async_trait;
use futures::stream::{self, BoxStream};
use skilldeck_core::{
    CoreError,
    traits::{
        CompletionChunk, CompletionRequest, CompletionStream, ModelCapabilities, ModelInfo,
        ModelProvider,
    },
};
use std::pin::Pin;

pub struct MockProvider {
    responses: Vec<Result<CompletionChunk, CoreError>>,
}

impl MockProvider {
    pub fn new(responses: Vec<Result<CompletionChunk, CoreError>>) -> Self {
        Self { responses }
    }
}

#[async_trait]
impl ModelProvider for MockProvider {
    fn id(&self) -> &str {
        "mock"
    }
    fn display_name(&self) -> &str {
        "Mock"
    }
    fn supports_toon(&self) -> bool {
        false
    }

    async fn list_models(&self) -> Result<Vec<ModelInfo>, CoreError> {
        Ok(vec![ModelInfo {
            id: "mock".to_string(),
            name: "Mock".to_string(),
            context_length: 1000,
            max_output_tokens: 100,
            capabilities: ModelCapabilities::default(),
        }])
    }

    async fn complete(&self, _request: CompletionRequest) -> Result<CompletionStream, CoreError> {
        let stream = stream::iter(self.responses.clone());
        Ok(Box::pin(stream)
            as Pin<
                Box<dyn futures::Stream<Item = Result<CompletionChunk, CoreError>> + Send>,
            >)
    }
}




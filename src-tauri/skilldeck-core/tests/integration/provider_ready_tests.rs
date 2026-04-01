use crate::helpers::setup_app_state;
use skilldeck_core::providers::ollama::OllamaProvider;
use tauri::test::mock_builder;

#[tokio::test]
async fn test_check_provider_ready_with_valid_ollama_profile() {
    let app = setup_app_state().await;
    let profile_id = get_default_ollama_profile_id(&app).await;
    let result = commands::check_provider_ready(profile_id.to_string(), app.state()).await;
    assert!(result.is_ok());
    let info = result.unwrap();
    assert_eq!(info.status.status, "ready");
}

use anyhow::Result;
use uuid::Uuid;
use wiremock::{
    Mock, MockServer, ResponseTemplate,
    matchers::{method, path},
};

use skilldeck::platform_client::{PlatformClient, RegisterRequest, UpdatePreferencesRequest};

#[tokio::test]
async fn test_register_success() -> Result<()> {
    let mock_server = MockServer::start().await;

    let client_id = Uuid::new_v4();
    let api_key = "test-api-key".to_string();

    Mock::given(method("POST"))
        .and(path("/api/core/register"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "user_id": client_id,
            "api_key": api_key
        })))
        .mount(&mock_server)
        .await;

    let client = PlatformClient::new(mock_server.uri(), true);
    let resp = client.register(client_id).await?;

    assert_eq!(resp.user_id, client_id);
    assert_eq!(resp.api_key, api_key);
    Ok(())
}

#[tokio::test]
async fn test_register_http_error() -> Result<()> {
    let mock_server = MockServer::start().await;

    Mock::given(method("POST"))
        .and(path("/api/core/register"))
        .respond_with(ResponseTemplate::new(500).set_body_string("Internal Server Error"))
        .mount(&mock_server)
        .await;

    let client = PlatformClient::new(mock_server.uri(), true);
    let result = client.register(Uuid::new_v4()).await;

    assert!(result.is_err());
    let err = result.unwrap_err();
    assert!(err.to_string().contains("500"));
    Ok(())
}

#[tokio::test]
async fn test_get_preferences_with_auth() -> Result<()> {
    let mock_server = MockServer::start().await;

    Mock::given(method("GET"))
        .and(path("/api/preferences"))
        .and(|req: &wiremock::Request| {
            req.headers
                .get("authorization")
                .and_then(|h| h.to_str().ok())
                .map(|s| s == "Bearer test-key")
                .unwrap_or(false)
        })
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "email": "test@example.com",
            "email_verified": true,
            "nudge_frequency": "weekly",
            "nudge_opt_out": false,
            "notification_channels": ["in-app", "email"],
            "theme_preference": "dark",
            "timezone": "America/New_York",
            "analytics_opt_in": true
        })))
        .mount(&mock_server)
        .await;

    let mut client = PlatformClient::new(mock_server.uri(), true);
    client.set_api_key("test-key".to_string());

    let prefs = client.get_preferences(None).await?;
    assert_eq!(prefs.email, Some("test@example.com".to_string()));
    assert_eq!(prefs.theme_preference, "dark");
    Ok(())
}

#[tokio::test]
async fn test_update_preferences() -> Result<()> {
    let mock_server = MockServer::start().await;

    Mock::given(method("PUT"))
        .and(path("/api/preferences"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "email": "updated@example.com",
            "email_verified": false,
            "nudge_frequency": "daily",
            "nudge_opt_out": false,
            "notification_channels": ["in-app"],
            "theme_preference": "light",
            "timezone": "Europe/London",
            "analytics_opt_in": false
        })))
        .mount(&mock_server)
        .await;

    let mut client = PlatformClient::new(mock_server.uri(), true);
    client.set_api_key("dummy".to_string());

    let req = UpdatePreferencesRequest {
        email: Some("updated@example.com".to_string()),
        nudge_frequency: Some("daily".to_string()),
        nudge_opt_out: None,
        notification_channels: Some(vec!["in-app".to_string()]),
        theme_preference: Some("light".to_string()),
        timezone: Some("Europe/London".to_string()),
        analytics_opt_in: Some(false),
    };

    let prefs = client.update_preferences(req, None).await?;
    assert_eq!(prefs.email, Some("updated@example.com".to_string()));
    Ok(())
}

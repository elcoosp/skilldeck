//! Gist-based skill and workflow sharing commands.
//!
//! Uses the GitHub Gist API (unauthenticated for reading, OAuth token for writing).
//! The OAuth token is stored in the OS keychain under account `"github_token"`.

use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, sync::Arc};
use tauri::State;
use tauri_plugin_keyring::KeyringExt;
use tracing::info;

use crate::state::AppState;

const KEYRING_SERVICE: &str = "skilldeck";
const GITHUB_TOKEN_ACCOUNT: &str = "github_token";
const GITHUB_API: &str = "https://api.github.com";
// Community skills registry gist (public, read-only for discovery).
const COMMUNITY_GIST_ID: &str = "skilldeck-community";

// ── DTOs ──────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone, specta::Type)]
pub struct GistFile {
    pub filename: String,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, specta::Type)]
pub struct GistInfo {
    pub id: String,
    pub url: String,
    pub html_url: String,
    pub description: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct CreateGistRequest {
    description: String,
    public: bool,
    files: HashMap<String, GistFileBody>,
}

#[derive(Debug, Serialize, Deserialize)]
struct GistFileBody {
    content: String,
}

#[derive(Debug, Deserialize)]
struct GitHubGistResponse {
    id: String,
    url: String,
    html_url: String,
    description: String,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn http_client() -> Client {
    Client::builder()
        .user_agent("SkillDeck/0.1")
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .expect("HTTP client build failed")
}

fn get_github_token(app: &tauri::AppHandle) -> Option<String> {
    app.keyring()
        .get_password(KEYRING_SERVICE, GITHUB_TOKEN_ACCOUNT)
        .ok()
        .flatten()
}

// ── Commands ──────────────────────────────────────────────────────────────────

/// Store a GitHub OAuth token in the keychain.
#[tauri::command]
pub async fn set_github_token(token: String, app: tauri::AppHandle) -> Result<(), String> {
    app.keyring()
        .set_password(KEYRING_SERVICE, GITHUB_TOKEN_ACCOUNT, &token)
        .map_err(|e| format!("Keychain write failed: {e}"))
}

/// Check whether a GitHub token is already stored.
#[tauri::command]
pub async fn has_github_token(app: tauri::AppHandle) -> bool {
    get_github_token(&app).is_some()
}

/// Share a skill as a GitHub Gist.
///
/// `skill_name` — the skill's filesystem folder name.
/// `content_md` — the full SKILL.md content.
#[tauri::command]
pub async fn share_skill_as_gist(
    skill_name: String,
    content_md: String,
    description: String,
    app: tauri::AppHandle,
    _state: State<'_, Arc<AppState>>,
) -> Result<GistInfo, String> {
    let token = get_github_token(&app)
        .ok_or_else(|| "No GitHub token — connect GitHub first".to_string())?;

    let mut files = HashMap::new();
    files.insert(
        "SKILL.md".to_string(),
        GistFileBody {
            content: content_md,
        },
    );

    let body = CreateGistRequest {
        description: format!(
            "[SkillDeck] {skill_name} — {description} | Generated with SkillDeck (skilldeck.dev)"
        ),
        public: true,
        files,
    };

    let resp = http_client()
        .post(format!("{GITHUB_API}/gists"))
        .bearer_auth(&token)
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("GitHub API error {status}: {body}"));
    }

    let gist: GitHubGistResponse = resp.json().await.map_err(|e| e.to_string())?;
    info!("Shared skill '{skill_name}' as gist {}", gist.id);

    Ok(GistInfo {
        id: gist.id,
        url: gist.url,
        html_url: gist.html_url,
        description: gist.description,
    })
}

/// Import a skill from a GitHub Gist URL or ID.
/// Returns the SKILL.md content so the frontend can write it to disk.
#[tauri::command]
pub async fn import_skill_from_gist(gist_id: String) -> Result<GistFile, String> {
    let url = format!("{GITHUB_API}/gists/{gist_id}");

    #[derive(Deserialize)]
    struct GistFileMeta {
        filename: String,
        content: Option<String>,
    }
    #[derive(Deserialize)]
    struct RawGist {
        files: HashMap<String, GistFileMeta>,
    }

    let resp = http_client()
        .get(&url)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Err(format!("GitHub API error {}", resp.status().as_u16()));
    }

    let raw: RawGist = resp.json().await.map_err(|e| e.to_string())?;

    // Prefer SKILL.md; fall back to the first file.
    let file = raw
        .files
        .get("SKILL.md")
        .or_else(|| raw.files.values().next())
        .ok_or_else(|| "Gist is empty".to_string())?;

    Ok(GistFile {
        filename: file.filename.clone(),
        content: file.content.clone().unwrap_or_default(),
    })
}

/// Share a workflow definition as a GitHub Gist.
#[tauri::command]
pub async fn share_workflow_as_gist(
    workflow_name: String,
    workflow_json: serde_json::Value,
    description: String,
    app: tauri::AppHandle,
) -> Result<GistInfo, String> {
    let token = get_github_token(&app)
        .ok_or_else(|| "No GitHub token — connect GitHub first".to_string())?;

    let content = serde_json::to_string_pretty(&workflow_json).map_err(|e| e.to_string())?;

    let mut files = HashMap::new();
    files.insert(
        format!("{workflow_name}.workflow.json"),
        GistFileBody { content },
    );

    let body = CreateGistRequest {
        description: format!(
            "[SkillDeck Workflow] {workflow_name} — {description} | skilldeck.dev"
        ),
        public: true,
        files,
    };

    let resp = http_client()
        .post(format!("{GITHUB_API}/gists"))
        .bearer_auth(&token)
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        let body_text = resp.text().await.unwrap_or_default();
        return Err(format!("GitHub API error {status}: {body_text}"));
    }

    let gist: GitHubGistResponse = resp.json().await.map_err(|e| e.to_string())?;

    Ok(GistInfo {
        id: gist.id,
        url: gist.url,
        html_url: gist.html_url,
        description: gist.description,
    })
}

/// Import a workflow from a Gist ID. Returns the parsed JSON value.
#[tauri::command]
pub async fn import_workflow_from_gist(gist_id: String) -> Result<serde_json::Value, String> {
    #[derive(Deserialize)]
    struct GistFileMeta {
        content: Option<String>,
    }
    #[derive(Deserialize)]
    struct RawGist {
        files: HashMap<String, GistFileMeta>,
    }

    let url = format!("{GITHUB_API}/gists/{gist_id}");
    let resp = http_client()
        .get(&url)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Err(format!("GitHub API error {}", resp.status().as_u16()));
    }

    let raw: RawGist = resp.json().await.map_err(|e| e.to_string())?;

    // Find the .workflow.json file.
    let content = raw
        .files
        .values()
        .find(|f| f.content.is_some())
        .and_then(|f| f.content.clone())
        .ok_or_else(|| "No content found in gist".to_string())?;

    serde_json::from_str(&content).map_err(|e| format!("Invalid workflow JSON: {e}"))
}

/// Export a conversation as Markdown with SkillDeck attribution footer.
#[tauri::command]
pub async fn export_conversation_as_markdown(
    title: String,
    messages: Vec<crate::commands::export::MessageExport>,
    tags: Vec<String>,
) -> Result<String, String> {
    let now = chrono::Utc::now().format("%Y-%m-%d").to_string();
    let tags_str = if tags.is_empty() {
        String::new()
    } else {
        format!("tags: [{}]\n", tags.join(", "))
    };

    let mut md = format!("---\ntitle: \"{title}\"\ndate: {now}\n{tags_str}---\n\n# {title}\n\n");

    for msg in &messages {
        let role_label = match msg.role.as_str() {
            "user" => "**You**",
            "assistant" => "**SkillDeck**",
            other => other,
        };
        md.push_str(&format!("### {role_label}\n\n{}\n\n---\n\n", msg.content));
    }

    md.push_str(
        "\n\n*Generated with [SkillDeck](https://skilldeck.dev) — \
        local-first AI orchestration for developers.*\n",
    );

    Ok(md)
}

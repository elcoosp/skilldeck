use sea_orm::{
    ActiveModelTrait, ColumnTrait, EntityTrait, ModelTrait, QueryFilter, QueryOrder, Set,
};
use serde::Serialize;
use skilldeck_models::pinned_artifacts::{self, Entity as PinnedArtifacts};
use specta::{Type, specta};
use std::path::PathBuf;
use std::sync::Arc;
use tauri::State;
use uuid::Uuid;

use crate::state::AppState;
use skilldeck_models::artifacts::{self, Entity as Artifacts};
use skilldeck_models::conversation_branches::Entity as Branches;
use skilldeck_models::messages::{self, Entity as Messages};

#[derive(Debug, Clone, Serialize, Type)]
pub struct ArtifactData {
    pub id: String,
    pub message_id: String,
    pub branch_id: Option<String>,
    pub r#type: String,
    pub name: String,
    pub content: String,
    pub language: Option<String>,
    pub logical_key: Option<String>,
    pub file_path: Option<String>, // <-- new field
    pub created_at: String,
}

impl ArtifactData {
    async fn from_model(a: artifacts::Model) -> Result<Self, String> {
        let content = if let Some(path) = a.storage_path {
            tokio::fs::read_to_string(&path)
                .await
                .map_err(|e| e.to_string())?
        } else {
            a.content
        };
        Ok(Self {
            id: a.id.to_string(),
            message_id: a.message_id.to_string(),
            branch_id: a.branch_id.map(|id| id.to_string()),
            r#type: a.r#type,
            name: a.name,
            content,
            language: a.language,
            logical_key: a.logical_key,
            file_path: a.file_path, // <-- pass through
            created_at: a.created_at.to_rfc3339(),
        })
    }
}

#[specta]
#[tauri::command]
pub async fn list_artifact_versions(
    state: State<'_, Arc<AppState>>,
    artifact_id: String,
) -> Result<Vec<ArtifactData>, String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;
    let art_uuid = Uuid::parse_str(&artifact_id).map_err(|e| e.to_string())?;

    let artifact = Artifacts::find_by_id(art_uuid)
        .one(db)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Artifact not found".to_string())?;

    let logical_key = artifact
        .logical_key
        .ok_or_else(|| "Artifact has no logical key".to_string())?;

    let versions = Artifacts::find()
        .filter(artifacts::Column::LogicalKey.eq(logical_key))
        .order_by_desc(artifacts::Column::CreatedAt)
        .all(db)
        .await
        .map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for v in versions {
        result.push(ArtifactData::from_model(v).await?);
    }
    Ok(result)
}

#[specta]
#[tauri::command]
pub async fn pin_artifact(
    state: State<'_, Arc<AppState>>,
    artifact_id: String,
    branch_id: Option<String>,
    is_global: bool,
) -> Result<(), String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;
    let art_uuid = Uuid::parse_str(&artifact_id).map_err(|e| e.to_string())?;
    let branch_uuid = branch_id
        .map(|id| Uuid::parse_str(&id))
        .transpose()
        .map_err(|e| e.to_string())?;

    // Get conversation_id from artifact
    let artifact = Artifacts::find_by_id(art_uuid)
        .one(db)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Artifact not found".to_string())?;
    let msg = Messages::find_by_id(artifact.message_id)
        .one(db)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Message not found".to_string())?;
    let conv_uuid = msg.conversation_id;

    // Check if already pinned
    let existing = PinnedArtifacts::find()
        .filter(pinned_artifacts::Column::ConversationId.eq(conv_uuid))
        .filter(pinned_artifacts::Column::ArtifactId.eq(art_uuid))
        .filter(pinned_artifacts::Column::BranchId.eq(branch_uuid))
        .one(db)
        .await
        .map_err(|e| e.to_string())?;

    if existing.is_some() {
        return Err("Already pinned".to_string());
    }

    let now = chrono::Utc::now().fixed_offset();
    let pin = pinned_artifacts::ActiveModel {
        id: Set(Uuid::new_v4()),
        conversation_id: Set(conv_uuid),
        artifact_id: Set(art_uuid),
        branch_id: Set(branch_uuid),
        is_global: Set(is_global),
        created_at: Set(now),
    };
    pin.insert(db).await.map_err(|e| e.to_string())?;
    Ok(())
}

#[specta]
#[tauri::command]
pub async fn unpin_artifact(
    state: State<'_, Arc<AppState>>,
    artifact_id: String,
    branch_id: Option<String>,
) -> Result<(), String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;
    let art_uuid = Uuid::parse_str(&artifact_id).map_err(|e| e.to_string())?;
    let branch_uuid = branch_id
        .map(|id| Uuid::parse_str(&id))
        .transpose()
        .map_err(|e| e.to_string())?;

    // Get conversation_id from artifact
    let artifact = Artifacts::find_by_id(art_uuid)
        .one(db)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Artifact not found".to_string())?;
    let msg = Messages::find_by_id(artifact.message_id)
        .one(db)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Message not found".to_string())?;
    let conv_uuid = msg.conversation_id;

    let pin = PinnedArtifacts::find()
        .filter(pinned_artifacts::Column::ConversationId.eq(conv_uuid))
        .filter(pinned_artifacts::Column::ArtifactId.eq(art_uuid))
        .filter(pinned_artifacts::Column::BranchId.eq(branch_uuid))
        .one(db)
        .await
        .map_err(|e| e.to_string())?;
    if let Some(p) = pin {
        p.delete(db).await.map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[specta]
#[tauri::command]
pub async fn list_pinned_artifacts(
    state: State<'_, Arc<AppState>>,
    conversation_id: String,
    branch_id: Option<String>,
) -> Result<Vec<ArtifactData>, String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;
    let conv_uuid = Uuid::parse_str(&conversation_id).map_err(|e| e.to_string())?;
    let branch_uuid = branch_id
        .map(|id| Uuid::parse_str(&id))
        .transpose()
        .map_err(|e| e.to_string())?;

    let mut query =
        PinnedArtifacts::find().filter(pinned_artifacts::Column::ConversationId.eq(conv_uuid));

    if let Some(branch_uuid) = branch_uuid {
        query = query.filter(pinned_artifacts::Column::BranchId.eq(branch_uuid));
    } else {
        query = query.filter(pinned_artifacts::Column::BranchId.is_null());
    }

    let pins = query.all(db).await.map_err(|e| e.to_string())?;
    let mut result = Vec::new();
    for pin in pins {
        let artifact = Artifacts::find_by_id(pin.artifact_id)
            .one(db)
            .await
            .map_err(|e| e.to_string())?;
        if let Some(a) = artifact {
            result.push(ArtifactData::from_model(a).await?);
        }
    }
    Ok(result)
}

#[specta]
#[tauri::command]
pub async fn list_artifacts(
    state: State<'_, Arc<AppState>>,
    conversation_id: String,
    branch_id: Option<String>,
) -> Result<Vec<ArtifactData>, String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;
    let conv_uuid = Uuid::parse_str(&conversation_id).map_err(|e| e.to_string())?;
    let branch_uuid = branch_id
        .map(|id| Uuid::parse_str(&id))
        .transpose()
        .map_err(|e| e.to_string())?;

    let mut query = Artifacts::find()
        .inner_join(Messages)
        .filter(messages::Column::ConversationId.eq(conv_uuid));

    if let Some(branch_uuid) = branch_uuid {
        query = query.filter(artifacts::Column::BranchId.eq(branch_uuid));
    } else {
        query = query.filter(artifacts::Column::BranchId.is_null());
    }

    let rows = query
        .order_by_desc(artifacts::Column::CreatedAt)
        .all(db)
        .await
        .map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for row in rows {
        result.push(ArtifactData::from_model(row).await?);
    }
    Ok(result)
}

#[specta]
#[tauri::command]
pub async fn copy_artifact_to_branch(
    state: State<'_, Arc<AppState>>,
    artifact_id: String,
    target_branch_id: String,
) -> Result<String, String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;
    let art_uuid = Uuid::parse_str(&artifact_id).map_err(|e| e.to_string())?;
    let branch_uuid = Uuid::parse_str(&target_branch_id).map_err(|e| e.to_string())?;

    // Fetch the artifact
    let artifact = Artifacts::find_by_id(art_uuid)
        .one(db)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Artifact not found".to_string())?;

    // Verify that target branch belongs to same conversation
    let conv_uuid = match Messages::find_by_id(artifact.message_id).one(db).await {
        Ok(Some(msg)) => msg.conversation_id,
        _ => return Err("Artifact's message not found".to_string()),
    };

    // Check that branch exists and belongs to that conversation
    let branch = Branches::find_by_id(branch_uuid)
        .one(db)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Target branch not found".to_string())?;
    if branch.conversation_id != conv_uuid {
        return Err("Branch does not belong to the same conversation".to_string());
    }

    // Create a draft message in the target branch
    let draft_id = Uuid::new_v4();
    let now = chrono::Utc::now().fixed_offset();

    let draft = messages::ActiveModel {
        id: Set(draft_id),
        conversation_id: Set(conv_uuid),
        branch_id: Set(Some(branch_uuid)),
        role: Set("user".to_string()),
        content: Set(format!(
            "```{}\n{}\n```",
            artifact.language.unwrap_or_default(),
            artifact.content
        )),
        metadata: Set(None),
        context_items: Set(None),
        created_at: Set(now),
        seen: Set(false),
        status: Set("draft".to_string()),
        ..Default::default()
    };
    draft.insert(db).await.map_err(|e| e.to_string())?;

    Ok(draft_id.to_string())
}

#[specta]
#[tauri::command]
pub async fn get_artifact_content(
    state: State<'_, Arc<AppState>>,
    artifact_id: String,
) -> Result<String, String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;

    let uuid = Uuid::parse_str(&artifact_id).map_err(|e| e.to_string())?;
    let artifact = Artifacts::find_by_id(uuid)
        .one(db)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Artifact {} not found", artifact_id))?;

    // If the content is stored on disk, read it; otherwise use the inline content.
    if let Some(storage_path) = artifact.storage_path {
        tokio::fs::read_to_string(storage_path)
            .await
            .map_err(|e| e.to_string())
    } else {
        Ok(artifact.content)
    }
}

// NEW COMMAND
#[specta]
#[tauri::command]
pub async fn write_artifact_to_file(
    state: State<'_, Arc<AppState>>,
    artifact_id: String,
    target_path: String,
) -> Result<(), String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;
    let art_uuid = Uuid::parse_str(&artifact_id).map_err(|e| e.to_string())?;

    let artifact = Artifacts::find_by_id(art_uuid)
        .one(db)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Artifact not found".to_string())?;

    let content = if let Some(storage_path) = artifact.storage_path {
        tokio::fs::read_to_string(&storage_path)
            .await
            .map_err(|e| e.to_string())?
    } else {
        artifact.content
    };

    let path = PathBuf::from(&target_path);
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| e.to_string())?;
    }
    tokio::fs::write(&path, content)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

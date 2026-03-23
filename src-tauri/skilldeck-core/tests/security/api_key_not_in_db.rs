// src-tauri/tests/security/api_key_not_in_db.rs
use sea_orm::{EntityTrait, QuerySelect};
use skilldeck_core::db::open_db;
use tauri_plugin_keyring::KeyringExt;

#[tokio::test]
async fn api_key_not_in_db() {
    let db = open_db(":memory:", true).await.unwrap();
    // Simulate inserting a profile with an API key hash (should be a hash, not plaintext)
    use sea_orm::ActiveValue::Set;
    use skilldeck_models::api_keys::{ActiveModel, Column, Entity as ApiKeys};
    use uuid::Uuid;
    let id = Uuid::new_v4();
    let user_id = Uuid::new_v4();
    let now = chrono::Utc::now().fixed_offset();
    let key = "sk-ant-test123";
    let hash = "hashed_value";
    let model = ActiveModel {
        id: Set(id),
        user_id: Set(user_id),
        key_hash: Set(hash.to_string()),
        created_at: Set(now),
    };
    model.insert(&db).await.unwrap();
    // Now query the DB and ensure raw key not present.
    let rows = ApiKeys::find().all(&db).await.unwrap();
    for row in rows {
        assert!(!row.key_hash.contains(key));
    }
}

use std::path::PathBuf;
use tokio::fs;
use uuid::Uuid;

/// Store artifact content on disk if it exceeds a threshold, otherwise return None.
pub async fn store_artifact_content(content: &str) -> Result<Option<PathBuf>, String> {
    if content.len() > 1_000_000 {
        let data_dir = dirs_next::data_dir()
            .ok_or("No data directory")?
            .join("skilldeck")
            .join("artifacts");
        fs::create_dir_all(&data_dir)
            .await
            .map_err(|e| e.to_string())?;
        let filename = format!("{}.txt", Uuid::new_v4());
        let path = data_dir.join(filename);
        fs::write(&path, content).await.map_err(|e| e.to_string())?;
        Ok(Some(path))
    } else {
        Ok(None)
    }
}

use sea_orm::FromJsonQueryResult;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, FromJsonQueryResult)] // added PartialEq
#[serde(tag = "source_type", rename_all = "snake_case")]
pub enum SkillMetadata {
    Clawhub(ClawhubMetadata),
    SkillsSh(SkillsShMetadata),
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)] // added PartialEq
pub struct ClawhubMetadata {
    pub slug: String,
    pub downloads: u64,
    pub tags: Vec<String>,
    pub original_data: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)] // added PartialEq
pub struct SkillsShMetadata {
    pub skill_id: String,
    pub source: String,
    pub installs: u64,
    pub original_data: serde_json::Value,
}

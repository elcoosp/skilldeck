//! Model pricing entity — SeaORM 2.0 format.

use sea_orm::entity::prelude::*;

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "model_pricing")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub model_provider: String,
    pub model_id: String,
    pub input_cost_per_1k_tokens: i64,
    pub output_cost_per_1k_tokens: i64,
    pub cache_read_cost_per_1k_tokens: Option<i64>,
    pub cache_write_cost_per_1k_tokens: Option<i64>,
    pub valid_from: DateTimeWithTimeZone,
}

impl ActiveModelBehavior for ActiveModel {}

use pg_embed::postgres::PgEmbed;
use pg_embed::settings::PgSettings;
use pg_embed::settings::PostgresVersion;
use std::path::PathBuf;

pub async fn setup_db() -> Result<PgEmbed, Box<dyn std::error::Error>> {
    let mut pg = PgEmbed::new(
        PgSettings {
            executables_dir: PathBuf::from("pg_embed_data"),
            ..Default::default()
        },
        PostgresVersion::V14,
    )?;
    pg.setup().await?;
    pg.start().await?;
    Ok(pg)
}

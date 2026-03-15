//! SkillDeck Platform — main entry point.
//!
//! Extended to include:
//! - Hourly lint cron job for all registered skills
//! - Skill enrichment queue (runs once on startup for unenriched skills)

use anyhow::Context;
use std::sync::Arc;
use tracing::{error, info}; // maybe not needed but could be helpful

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive("skilldeck_platform=debug".parse()?)
                .add_directive("tower_http=info".parse()?),
        )
        .init();

    let config = Arc::new(crate::config::Config::load()?);
    let db = crate::db::connect(&config.database_url).await?;

    // Run pending migrations.
    crate::db::run_migrations(&db).await?;

    let state = Arc::new(crate::AppState {
        db: db.clone(),
        config: Arc::clone(&config),
    });

    // ── Background: hourly lint cron ───────────────────────────────────────
    {
        let db_clone = db.clone();
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(std::time::Duration::from_secs(3600));
            loop {
                interval.tick().await;
                info!("Running lint cron…");
                if let Err(e) = crate::skills::lint_cron::run_lint_cron(&db_clone).await {
                    error!("Lint cron failed: {}", e);
                }
            }
        });
    }

    // ── Background: LLM enrichment queue ──────────────────────────────────
    {
        let db_clone = db.clone();
        let ollama_host = config.ollama_host.clone();
        tokio::spawn(async move {
            // Small delay so the server is fully up before enrichment starts.
            tokio::time::sleep(std::time::Duration::from_secs(10)).await;
            info!("Starting initial LLM enrichment pass…");
            match crate::skills::enrichment::enrich_pending_skills(&db_clone, &ollama_host).await {
                Ok(n) => info!("Enriched {} skill(s)", n),
                Err(e) => error!("Enrichment failed: {}", e),
            }
        });
    }

    // ── HTTP server ────────────────────────────────────────────────────────
    let addr: std::net::SocketAddr = config
        .listen_addr
        .parse()
        .context("Failed to parse listen address")?;
    let router = crate::app::build_router(Arc::clone(&state));
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    info!("SkillDeck Platform listening on {}", addr);
    axum::serve(listener, router).await?;

    Ok(())
}

//! SkillDeck Platform — main entry point.
//!
//! Extended to include:
//! - Hourly lint cron job for all registered skills
//! - Skill enrichment queue (runs once on startup for unenriched skills)
//! - Daily web registry crawl (every 24 hours)

use anyhow::Context;
use std::sync::Arc;
use tracing::{error, info};

use skilldeck_platform::app;
use skilldeck_platform::config::Config;
use skilldeck_platform::db;
use skilldeck_platform::email;
use skilldeck_platform::skills;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::from_default_env()
                .add_directive("skilldeck=info".parse().unwrap())
                .add_directive("skilldeck_core=info".parse().unwrap())
                .add_directive("skilldeck_lint=info".parse().unwrap()),
        )
        .init();
    let config = Arc::new(Config::from_env()?);
    let db = db::connect(&config.database_url).await?;

    // Run pending migrations.
    db::run_migrations(&db).await?;

    // Build email service
    let email = email::build_service(&config);

    let state = Arc::new(app::AppState {
        db: db.clone(),
        email,
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
                if let Err(e) = skills::lint_cron::run_lint_cron(&db_clone).await {
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
            match skills::enrichment::enrich_pending_skills(&db_clone, &ollama_host).await {
                Ok(n) => info!("Enriched {} skill(s)", n),
                Err(e) => error!("Enrichment failed: {}", e),
            }
        });
    }

    // ── Background: daily web registry crawl (every 24 hours) ──────────────
    {
        let db_clone = db.clone();
        tokio::spawn(async move {
            // First tick after initial delay (5 minutes to let server start)
            tokio::time::sleep(std::time::Duration::from_secs(300)).await;
            let mut interval = tokio::time::interval(std::time::Duration::from_secs(24 * 3600));
            loop {
                interval.tick().await;
                info!("Running daily web registry crawl…");
                if let Err(e) = skills::ingestion::crawl_all_enabled_sources(&db_clone).await {
                    error!("Web registry crawl failed: {}", e);
                }
            }
        });
    }

    // ── HTTP server ────────────────────────────────────────────────────────
    let addr: std::net::SocketAddr = config
        .listen_addr
        .parse()
        .context("Failed to parse listen address")?;
    let router = app::build_router(Arc::clone(&state));
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    info!("SkillDeck Platform listening on {}", addr);
    axum::serve(listener, router).await?;

    Ok(())
}

//! Axum router wiring and shared application state.

use axum::{
    Router, middleware,
    routing::{delete, get, post, put},
};
use sea_orm::DatabaseConnection;
use std::sync::Arc;
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing::info;

use crate::{
    config::Config,
    core::handlers as core_handlers,
    email::EmailServiceBox,
    feedback,
    growth::{handlers as growth_handlers, nudge_engine},
    preferences::handlers as pref_handlers,
};

/// Shared state available to every handler via `State<Arc<AppState>>`.
#[derive(Clone)]
pub struct AppState {
    pub db: DatabaseConnection,
    pub email: EmailServiceBox,
    pub config: Arc<Config>,
}

pub async fn run() -> anyhow::Result<()> {
    let config = Arc::new(Config::from_env()?);

    let db = crate::db::connect(&config.database_url).await?;
    crate::db::run_migrations(&db).await?;

    let email = crate::email::build_service(&config);

    let state = Arc::new(AppState {
        db: db.clone(),
        email,
        config: Arc::clone(&config),
    });

    // Start nudge engine scheduler.
    nudge_engine::start(Arc::clone(&state));

    let app = build_router(state);

    let addr: std::net::SocketAddr = config.listen_addr.parse()?;
    info!("Listening on {addr}");
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}

pub fn build_router(state: Arc<AppState>) -> Router {
    // Auth-free routes.
    let public = Router::new()
        .route("/health", get(health))
        .route("/api/core/register", post(core_handlers::register));

    // Authenticated routes — wrapped with auth middleware.
    let authenticated = Router::new()
        // Feedback
        .route("/api/feedback", get(feedback::handlers::list_feedback))
        .route("/api/feedback/{id}", get(feedback::handlers::get_feedback))
        .route(
            "/api/feedback/{id}",
            put(feedback::handlers::update_feedback),
        )
        .route(
            "/api/feedback/{id}/comments",
            post(feedback::handlers::add_comment),
        )
        // Preferences
        .route("/api/preferences", get(pref_handlers::get_preferences))
        .route("/api/preferences", put(pref_handlers::update_preferences))
        .route(
            "/api/preferences/resend-verification",
            post(pref_handlers::resend_verification),
        )
        .route(
            "/api/preferences/export",
            get(pref_handlers::export_gdpr_data),
        )
        .route(
            "/api/preferences/account",
            delete(pref_handlers::delete_account),
        )
        // Growth — referrals
        .route(
            "/api/growth/referral",
            post(growth_handlers::create_referral_code),
        )
        .route(
            "/api/growth/referral/stats",
            get(growth_handlers::get_referral_stats),
        )
        .route(
            "/api/growth/referral/validate/{code}",
            get(growth_handlers::validate_referral_code),
        )
        // Growth — nudges
        .route(
            "/api/growth/nudges/pending",
            get(growth_handlers::get_pending_nudges),
        )
        .route(
            "/api/growth/nudges/{id}/delivered",
            post(growth_handlers::mark_nudge_delivered),
        )
        // Growth — activity events
        .route("/api/growth/event", post(growth_handlers::track_event))
        .layer(middleware::from_fn_with_state(
            Arc::clone(&state),
            crate::middleware::auth_middleware,
        ));

    // Email verification — token in query string, no bearer required.
    let verify = Router::new().route("/api/preferences/verify", get(pref_handlers::verify_email));

    Router::new()
        .merge(public)
        .merge(authenticated)
        .merge(verify)
        .layer(TraceLayer::new_for_http())
        .layer(CorsLayer::permissive())
        .with_state(state)
}

async fn health() -> &'static str {
    "ok"
}

use skilldeck_platform::app;
use tracing_subscriber::{fmt, EnvFilter};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();

    fmt()
        .with_env_filter(
            EnvFilter::from_default_env()
                .add_directive("skilldeck_platform=info".parse()?)
                .add_directive("tower_http=info".parse()?),
        )
        .init();

    app::run().await
}

//! Email service abstraction.
//!
//! The `EmailService` trait decouples business logic from the sending
//! implementation.  In production we use Resend; in tests a no-op stub.

use async_trait::async_trait;
use std::sync::Arc;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum EmailError {
    #[error("Send failed: {0}")]
    Send(String),
    #[error("Email service not configured")]
    NotConfigured,
}

#[async_trait]
pub trait EmailService: Send + Sync {
    async fn send(&self, to: &str, subject: &str, html: &str) -> Result<(), EmailError>;

    async fn send_verification(&self, to: &str, token: &str) -> Result<(), EmailError>;

    async fn send_nudge(
        &self,
        to: &str,
        message: &str,
        cta_link: Option<&str>,
    ) -> Result<(), EmailError>;

    async fn send_referral_reward(&self, to: &str, reward: &str) -> Result<(), EmailError>;

    async fn send_welcome(&self, to: &str) -> Result<(), EmailError>;
}

/// Type-erased email service pointer.
pub type EmailServiceBox = Arc<dyn EmailService>;

// ── Factory ────────────────────────────────────────────────────────────────────

pub fn build_service(config: &crate::config::Config) -> EmailServiceBox {
    match &config.resend_api_key {
        Some(key) => Arc::new(ResendEmailService::new(
            key.clone(),
            config.from_email.clone(),
            config.platform_url.clone(),
        )),
        None => {
            tracing::warn!("No RESEND_API_KEY configured – using no-op email service");
            Arc::new(NoopEmailService)
        }
    }
}

// ── Resend implementation ──────────────────────────────────────────────────────

pub struct ResendEmailService {
    client: resend_rs::Resend,
    from: String,
    platform_url: String,
}

impl ResendEmailService {
    pub fn new(api_key: String, from: String, platform_url: String) -> Self {
        Self {
            client: resend_rs::Resend::new(&api_key),
            from,
            platform_url,
        }
    }

    async fn send_raw(&self, to: &str, subject: &str, html: &str) -> Result<(), EmailError> {
        use resend_rs::types::CreateEmailBaseOptions;

        // Retry up to 3 times with exponential back-off.
        let mut delay = std::time::Duration::from_millis(500);
        for attempt in 0..3 {
            let email = CreateEmailBaseOptions::new(
                self.from.clone(),
                vec![to.to_string()],
                subject.to_string(),
            )
            .with_html(html);

            match self.client.emails.send(email).await {
                Ok(_) => return Ok(()),
                Err(e) => {
                    if attempt == 2 {
                        return Err(EmailError::Send(e.to_string()));
                    }
                    tracing::warn!("Email send attempt {attempt} failed: {e}, retrying…");
                    tokio::time::sleep(delay).await;
                    delay *= 2;
                }
            }
        }
        unreachable!()
    }
}

#[async_trait]
impl EmailService for ResendEmailService {
    async fn send(&self, to: &str, subject: &str, html: &str) -> Result<(), EmailError> {
        self.send_raw(to, subject, html).await
    }

    async fn send_verification(&self, to: &str, token: &str) -> Result<(), EmailError> {
        let link = format!("{}/api/preferences/verify?token={token}", self.platform_url);
        let html = templates::verification(&link);
        self.send_raw(to, "Verify your SkillDeck email", &html)
            .await
    }

    async fn send_nudge(
        &self,
        to: &str,
        message: &str,
        cta_link: Option<&str>,
    ) -> Result<(), EmailError> {
        let html = templates::nudge(message, cta_link);
        self.send_raw(to, "A tip from SkillDeck 🚀", &html).await
    }

    async fn send_referral_reward(&self, to: &str, reward: &str) -> Result<(), EmailError> {
        let html = templates::referral_reward(reward);
        self.send_raw(to, "You've earned a SkillDeck reward! 🎉", &html)
            .await
    }

    async fn send_welcome(&self, to: &str) -> Result<(), EmailError> {
        let html = templates::welcome();
        self.send_raw(to, "Welcome to SkillDeck", &html).await
    }
}

// ── No-op implementation ───────────────────────────────────────────────────────

struct NoopEmailService;

#[async_trait]
impl EmailService for NoopEmailService {
    async fn send(&self, to: &str, subject: &str, _html: &str) -> Result<(), EmailError> {
        tracing::info!("[no-op email] To: {to} | Subject: {subject}");
        Ok(())
    }
    async fn send_verification(&self, to: &str, _token: &str) -> Result<(), EmailError> {
        tracing::info!("[no-op email] Verification to {to}");
        Ok(())
    }
    async fn send_nudge(&self, to: &str, _msg: &str, _cta: Option<&str>) -> Result<(), EmailError> {
        tracing::info!("[no-op email] Nudge to {to}");
        Ok(())
    }
    async fn send_referral_reward(&self, to: &str, _reward: &str) -> Result<(), EmailError> {
        tracing::info!("[no-op email] Referral reward to {to}");
        Ok(())
    }
    async fn send_welcome(&self, to: &str) -> Result<(), EmailError> {
        tracing::info!("[no-op email] Welcome to {to}");
        Ok(())
    }
}

// ── HTML templates ─────────────────────────────────────────────────────────────

pub mod templates {
    const BRAND_COLOR: &str = "#6366f1"; // indigo-500
    const FONT: &str = "font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;";

    fn base(content: &str) -> String {
        format!(
            r#"<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {{ margin:0; padding:0; background:#f8fafc; {FONT} }}
    .wrapper {{ max-width:600px; margin:32px auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,.1); }}
    .header {{ background:{BRAND_COLOR}; padding:24px 32px; }}
    .header h1 {{ margin:0; color:#fff; font-size:20px; font-weight:700; letter-spacing:-.3px; }}
    .body {{ padding:32px; color:#1e293b; line-height:1.6; font-size:15px; }}
    .body p {{ margin:0 0 16px; }}
    .cta {{ display:inline-block; margin-top:8px; padding:12px 24px; background:{BRAND_COLOR}; color:#fff !important; text-decoration:none; border-radius:8px; font-weight:600; font-size:14px; }}
    .footer {{ padding:20px 32px; border-top:1px solid #e2e8f0; color:#94a3b8; font-size:12px; }}
    .footer a {{ color:#94a3b8; }}
  </style>
</head>
<body>
<div class="wrapper">
  <div class="header"><h1>SkillDeck</h1></div>
  <div class="body">{content}</div>
  <div class="footer">
    <p>SkillDeck — Local-first AI orchestration for developers.<br>
    <a href="https://skilldeck.dev">skilldeck.dev</a> &bull;
    <a href="https://skilldeck.dev/privacy">Privacy</a> &bull;
    <a href="{{unsubscribe_link}}">Unsubscribe</a></p>
  </div>
</div>
</body>
</html>"#
        )
    }

    pub fn verification(link: &str) -> String {
        let content = format!(
            r#"<p>Welcome to SkillDeck! Please verify your email address to unlock team features and receive skill-sharing tips.</p>
<a class="cta" href="{link}">Verify my email</a>
<p style="margin-top:24px;font-size:13px;color:#64748b;">This link expires in 24 hours. If you didn't request this, you can safely ignore this email.</p>"#
        );
        base(&content)
    }

    pub fn nudge(message: &str, cta_link: Option<&str>) -> String {
        let cta = cta_link
            .map(|l| format!(r#"<a class="cta" href="{l}">Open SkillDeck</a>"#))
            .unwrap_or_default();
        let content = format!("{message}{cta}");
        base(&content)
    }

    pub fn referral_reward(reward: &str) -> String {
        let content = format!(
            r#"<p>🎉 <strong>You've earned a reward!</strong></p>
<p>Your referrals have unlocked: <strong>{reward}</strong></p>
<p>Keep sharing SkillDeck with your team — every developer you bring on board compounds your team's AI knowledge base.</p>
<a class="cta" href="https://skilldeck.dev">Open SkillDeck</a>"#
        );
        base(&content)
    }

    pub fn welcome() -> String {
        let content = r#"<p>Welcome to <strong>SkillDeck</strong> — the local-first AI orchestration platform built for developers like you.</p>
<p>Here's what makes SkillDeck different:</p>
<ul>
  <li><strong>Privacy Without Compromise</strong> — Your code never leaves your machine. API keys live in your OS keychain.</li>
  <li><strong>Team Knowledge That Compounds</strong> — Skills are version-controlled files. Share them like code.</li>
  <li><strong>From Chat to Intelligence</strong> — Multi-agent workflows orchestrate complex tasks in parallel.</li>
</ul>
<a class="cta" href="https://skilldeck.dev/docs">Get started</a>"#;
        base(content)
    }
}

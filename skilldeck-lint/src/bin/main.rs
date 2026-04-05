//! `skilldeck-lint` CLI — validate skill directories from the command line.
//!
//! Commands:
//!   validate <path>   — run all lint rules and report issues
//!   list-rules        — print all available rule IDs
//!   init-config       — print a default config file to stdout

use clap::{Parser, Subcommand};
use skilldeck_lint::{default_config_toml, lint_skill, rules::all_rules, LintConfig, Severity};
use std::path::PathBuf;

#[derive(Parser)]
#[command(
    author,
    version,
    about = "Lint Agent Skill directories for quality and security issues"
)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Validate a skill directory and report lint warnings
    Validate {
        /// Path to the skill directory (must contain SKILL.md)
        path: PathBuf,
        /// Override config file (defaults: ~/.config/skilldeck/skilldeck-lint.toml)
        #[arg(short, long)]
        config: Option<PathBuf>,
        /// Output format: "text" or "json"
        #[arg(short, long, default_value = "text")]
        format: String,
        /// Exit with code 0 even if warnings are found (only fail on errors)
        #[arg(long)]
        warnings_as_ok: bool,
    },
    /// List all available lint rule IDs
    ListRules,
    /// Print a default config file to stdout (pipe to a file to use)
    InitConfig,
}

fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();

    match cli.command {
        Commands::Validate {
            path,
            config,
            format,
            warnings_as_ok,
        } => {
            // Build merged config: global → workspace → explicit override.
            let global_config_path =
                dirs_next::config_dir().map(|d| d.join("skilldeck").join("skilldeck-lint.toml"));
            let workspace_config_path = path.join(".skilldeck").join("skilldeck-lint.toml");

            let merged_config = if let Some(explicit) = config {
                LintConfig::from_files(None, Some(&explicit))?
            } else {
                LintConfig::from_files(
                    global_config_path.as_deref(),
                    if workspace_config_path.exists() {
                        Some(&workspace_config_path)
                    } else {
                        None
                    },
                )?
            };

            let warnings = lint_skill(&path, &merged_config);

            if warnings.is_empty() {
                println!("✅ No issues found in '{}'", path.display());
                return Ok(());
            }

            match format.as_str() {
                "json" => {
                    let json = serde_json::to_string_pretty(&warnings)?;
                    println!("{}", json);
                }
                _ => {
                    let errors = warnings
                        .iter()
                        .filter(|w| w.severity == Severity::Error)
                        .count();
                    let warning_count = warnings
                        .iter()
                        .filter(|w| w.severity == Severity::Warning)
                        .count();
                    let info_count = warnings
                        .iter()
                        .filter(|w| w.severity == Severity::Info)
                        .count();

                    println!(
                        "Found {} issue(s) in '{}': {} error(s), {} warning(s), {} info",
                        warnings.len(),
                        path.display(),
                        errors,
                        warning_count,
                        info_count
                    );
                    println!();

                    for w in &warnings {
                        let icon = match w.severity {
                            Severity::Error => "❌",
                            Severity::Warning => "⚠️ ",
                            Severity::Info => "ℹ️ ",
                            Severity::Off => continue,
                        };

                        if let Some(loc) = &w.location {
                            if let Some(line) = loc.line {
                                println!(
                                    "  {} [{}] {}:{} — {}",
                                    icon, w.rule_id, loc.file, line, w.message
                                );
                            } else {
                                println!("  {} [{}] {} — {}", icon, w.rule_id, loc.file, w.message);
                            }
                        } else {
                            println!("  {} [{}] {}", icon, w.rule_id, w.message);
                        }

                        if let Some(fix) = &w.suggested_fix {
                            println!("     💡 Fix: {}", fix);
                        }
                        println!();
                    }
                }
            }

            let has_errors = warnings.iter().any(|w| w.severity == Severity::Error);
            let should_fail = if warnings_as_ok {
                has_errors
            } else {
                !warnings.is_empty()
            };

            if should_fail {
                std::process::exit(1);
            }
        }

        Commands::ListRules => {
            println!("Available lint rules:\n");
            for rule in all_rules() {
                println!("  {}", rule.id());
            }
        }

        Commands::InitConfig => {
            print!("{}", default_config_toml());
        }
    }

    Ok(())
}

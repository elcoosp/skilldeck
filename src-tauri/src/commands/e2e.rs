//! E2E-testing-only marker command.

/// Report whether the running binary was compiled with `--features e2e-testing`.
/// The frontend uses this to bypass manual onboarding in scripted demo runs.
#[specta]
#[tauri::command]
pub fn is_e2e_testing() -> bool {
    cfg!(feature = "e2e-testing")
}
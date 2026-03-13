//! Workspace detection and context loading.

pub mod context;
pub mod detector;

pub use context::{ContextFile, ContextLoader, WorkspaceContext};
pub use detector::{ProjectType, WorkspaceDetector};

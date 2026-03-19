
/// Trait for emitting skill events from the core to the shell.
pub trait SkillEventEmitter: Send + Sync {
    fn emit_updated(&self, source_label: String, skill_name: String);
}

/// A no-op emitter for testing.
pub struct NoopSkillEventEmitter;

impl SkillEventEmitter for NoopSkillEventEmitter {
    fn emit_updated(&self, _source_label: String, _skill_name: String) {}
}

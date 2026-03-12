//! Database layer — SQLite connection, migrations, and entity models.

pub mod connection;

pub use connection::{SqliteDatabase, check_integrity, get_stats, open_db};

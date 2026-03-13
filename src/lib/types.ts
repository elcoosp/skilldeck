/**
 * Shared primitive types used throughout the application.
 */

/** UUID string (not branded — kept simple for Tauri IPC compatibility). */
export type UUID = string

/** ISO-8601 datetime string as returned by Rust chrono. */
export type DateTimeString = string

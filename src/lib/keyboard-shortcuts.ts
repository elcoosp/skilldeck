// src/lib/keyboard-shortcuts.ts
export interface KeyboardShortcut {
  keys: string
  description: string
  category: 'navigation' | 'conversation' | 'editing' | 'app'
}

export const keyboardShortcuts: KeyboardShortcut[] = [
  // Navigation
  { keys: 'Cmd+K', description: 'Open command palette', category: 'navigation' },
  { keys: 'Cmd+Shift+F', description: 'Global search', category: 'navigation' },
  { keys: 'Cmd+N', description: 'New conversation', category: 'navigation' },
  // App
  { keys: 'Cmd+,', description: 'Open settings', category: 'app' },
  { keys: 'Cmd+Shift+S', description: 'Toggle right panel', category: 'app' },
  // Conversation
  { keys: 'Cmd+Enter', description: 'Send message', category: 'conversation' },
  { keys: 'Shift+Enter', description: 'New line', category: 'conversation' },
  { keys: 'Esc', description: 'Close modal / Cancel', category: 'conversation' },
  // Editing
  { keys: 'Cmd+Z', description: 'Undo', category: 'editing' },
  { keys: 'Cmd+Shift+Z', description: 'Redo', category: 'editing' },
]

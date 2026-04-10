import { createTauriTest } from '@srsholmes/tauri-playwright';
import path from 'path';

export const { test, expect } = createTauriTest({
  // Browser‑only mode config (not used for actual asset capture)
  devUrl: 'http://localhost:1420',
  // Tauri mode config – the plugin socket
  mcpSocket: '/tmp/tauri-playwright.sock',
  // Command to start the app if not already running (optional)
  tauriCommand: 'cargo tauri dev',
  tauriFeatures: ['e2e-testing'],
  tauriCwd: path.resolve(__dirname, '../../'), // repo root
  startTimeout: 120,
});

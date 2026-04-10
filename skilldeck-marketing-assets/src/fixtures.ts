import { test as base, chromium, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

type AppFixtures = {
  appPage: Page;
};

/**
 * Get the path to the app's user data directory where DevToolsActivePort is stored.
 */
function getUserDataDir(): string {
  const platform = os.platform();
  const home = os.homedir();
  const bundleId = 'com.skilldeck.core';

  if (platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', bundleId);
  } else if (platform === 'linux') {
    return path.join(home, '.config', bundleId);
  } else if (platform === 'win32') {
    return path.join(process.env.APPDATA || '', bundleId);
  }
  throw new Error(`Unsupported platform: ${platform}`);
}

/**
 * Try to read the actual port from DevToolsActivePort file (macOS/Linux fallback).
 */
function readDevToolsPort(): number | null {
  try {
    const userDataDir = getUserDataDir();
    const portFile = path.join(userDataDir, 'DevToolsActivePort');
    if (fs.existsSync(portFile)) {
      const content = fs.readFileSync(portFile, 'utf-8');
      const lines = content.split('\n');
      if (lines.length > 0) {
        const port = parseInt(lines[0].trim(), 10);
        return isNaN(port) ? null : port;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

async function connectToTauri(): Promise<Page> {
  const maxRetries = 30;
  const retryDelay = 1000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    // 1. Try the environment variable (explicit port)
    let endpoint = process.env.CDP_ENDPOINT_URL;
    if (endpoint) {
      try {
        const browser = await chromium.connectOverCDP(endpoint);
        const context = browser.contexts()[0];
        const page = context.pages()[0] || await context.newPage();
        await page.bringToFront();
        console.log(`Connected to Tauri app via ${endpoint}`);
        return page;
      } catch (e) {
        console.log(`Attempt ${attempt}: CDP connection to ${endpoint} failed, trying fallback...`);
      }
    }

    // 2. Fallback: read DevToolsActivePort (dynamic port)
    const port = readDevToolsPort();
    if (port) {
      const fallbackEndpoint = `http://127.0.0.1:${port}`;
      try {
        const browser = await chromium.connectOverCDP(fallbackEndpoint);
        const context = browser.contexts()[0];
        const page = context.pages()[0] || await context.newPage();
        await page.bringToFront();
        console.log(`Connected to Tauri app via dynamic port ${port}`);
        return page;
      } catch (e) {
        console.log(`Attempt ${attempt}: CDP connection to ${fallbackEndpoint} failed, retrying...`);
      }
    }

    await new Promise((resolve) => setTimeout(resolve, retryDelay));
  }

  throw new Error(
    `Failed to connect to Tauri app after ${maxRetries} attempts. ` +
    `Ensure the app is running in debug mode (pnpm tauri:dev).`
  );
}

export const test = base.extend<AppFixtures>({
  appPage: async ({ }, use) => {
    const page = await connectToTauri();
    await use(page);
  },
});

export { expect } from '@playwright/test';

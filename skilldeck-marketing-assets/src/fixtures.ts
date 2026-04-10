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
 * Read the DevToolsActivePort file to get the actual debugging port.
 */
function readDevToolsPort(userDataDir: string): number | null {
  const portFile = path.join(userDataDir, 'DevToolsActivePort');
  try {
    const content = fs.readFileSync(portFile, 'utf-8');
    const lines = content.split('\n');
    if (lines.length > 0) {
      const port = parseInt(lines[0].trim(), 10);
      return isNaN(port) ? null : port;
    }
  } catch {
    // File doesn't exist yet
  }
  return null;
}

async function connectToTauri(): Promise<Page> {
  const maxRetries = 30;
  const retryDelay = 1000; // ms
  const userDataDir = getUserDataDir();

  console.log(`Looking for DevToolsActivePort in: ${userDataDir}`);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    let port = process.env.CDP_ENDPOINT
      ? parseInt(new URL(process.env.CDP_ENDPOINT).port, 10)
      : null;

    if (!port) {
      port = readDevToolsPort(userDataDir);
    }

    if (port) {
      try {
        const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
        const context = browser.contexts()[0];
        const page = context.pages()[0] || await context.newPage();
        await page.bringToFront();
        console.log(`Connected to Tauri app on port ${port}`);
        return page;
      } catch (e) {
        console.log(`Attempt ${attempt}: CDP connection to port ${port} failed, retrying...`);
      }
    } else {
      console.log(`Attempt ${attempt}: DevToolsActivePort not found yet...`);
    }

    await new Promise((resolve) => setTimeout(resolve, retryDelay));
  }

  throw new Error(
    `Failed to connect to Tauri app after ${maxRetries} attempts. ` +
    `Ensure the app is running with --remote-debugging-port=0.`
  );
}

export const test = base.extend<AppFixtures>({
  appPage: async ({ }, use) => {
    const page = await connectToTauri();
    await use(page);
  },
});

export { expect } from '@playwright/test';

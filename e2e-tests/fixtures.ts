import { execSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createTauriTest } from '@srsholmes/tauri-playwright'

const cdp = process.env.E2E_MODE === 'cdp'
const here = path.dirname(fileURLToPath(import.meta.url))
const home = os.homedir()

/**
 * Storage directories that hold the webview's localStorage / website data.
 * Each platform's web runtime persists these in different places; removing
 * them before every socket-mode launch guarantees a fresh store and shows the
 * onboarding wizard without any in-page removeItem/reload dance.
 */
function websiteDataDirs(): string[] {
  if (process.platform === 'darwin') {
    return [
      path.join(home, 'Library/WebKit/skilldeck/WebsiteData/Default'),
      path.join(home, 'Library/WebKit/com.skilldeck.core/WebsiteData/Default')
    ]
  }
  if (process.platform === 'linux') {
    return [
      path.join(home, '.local/share/WebKitWebsiteData'),
      path.join(home, '.local/share/com.skilldeck.core/WebKitWebsiteData'),
      path.join(home, '.cache/skilldeck')
    ]
  }
  if (process.platform === 'win32') {
    const local =
      process.env.LOCALAPPDATA ?? path.join(home, 'AppData', 'Local')
    return [
      path.join(local, 'skilldeck', 'EBWebView'),
      path.join(local, 'com.skilldeck.core', 'EBWebView')
    ]
  }
  return []
}

/**
 * Restore a deterministic, fresh state before (re)launching the app:
 * - kill any leftover app instance and its webview helper processes, and
 *   remove stale single-instance / playwright sockets (socket mode only)
 * - wipe the platform's webview website-data stores so localStorage cannot
 *   leak across tests or runs
 */
function preSpawnHygiene() {
  if (process.env.E2E_SKIP_HYGIENE === '1') return

  if (!cdp) {
    if (process.platform === 'darwin') {
      execSync('pkill -x skilldeck 2>/dev/null; true', { stdio: 'ignore' })
      try {
        execSync(
          'pkill -f com.apple.WebKit.Networking 2>/dev/null; ' +
            'pkill -f com.apple.WebKit.WebContent 2>/dev/null; true',
          { stdio: 'ignore' }
        )
      } catch {}
    } else if (process.platform === 'linux') {
      execSync('pkill -x skilldeck 2>/dev/null; true', { stdio: 'ignore' })
      try {
        execSync(
          'pkill -f WebKitWebProcess 2>/dev/null; pkill -f WebKitNetworkProcess 2>/dev/null; true',
          { stdio: 'ignore' }
        )
      } catch {}
    } else if (process.platform === 'win32') {
      try {
        execSync('taskkill /IM skilldeck.exe /F /T 2>NUL', {
          stdio: 'ignore'
        })
      } catch {}
    }

    const tempDir = process.env.TEMP ?? '/tmp'
    for (const sock of [
      cdp
        ? '__none__'
        : process.platform === 'win32'
          ? path.join(tempDir, 'com_skilldeck_core_si.sock')
          : '/tmp/com_skilldeck_core_si.sock',
      '/tmp/tauri-playwright.sock'
    ]) {
      if (sock === '__none__') continue
      try {
        fs.rmSync(sock, { force: true })
      } catch {}
    }
  }

  for (const dir of websiteDataDirs()) {
    try {
      fs.rmSync(dir, { recursive: true, force: true })
    } catch {}
  }
}

const { expect, test: baseTest } = createTauriTest({
  // When set, the app webview is pointed at this URL after connecting.
  // CI builds the release binary that already serves the built frontend,
  // so this stays unset there. Browser-only runs can set E2E_DEV_URL.
  devUrl: process.env.E2E_DEV_URL,
  // WebView2 CDP endpoint (Windows).
  cdpEndpoint: process.env.CDP_ENDPOINT ?? 'http://localhost:9222',
  ...(cdp
    ? {}
    : process.env.APP_BINARY_PATH
      ? {
          tauriCommand: process.env.APP_BINARY_PATH,
          startTimeout: Number(process.env.E2E_START_TIMEOUT ?? 180)
        }
      : {
          tauriCommand: 'cargo tauri dev',
          tauriFeatures: ['e2e-testing'],
          tauriCwd: path.resolve(here, '..'),
          startTimeout: Number(process.env.E2E_START_TIMEOUT ?? 240)
        })
})

// Run the hygiene pass before every test. In socket mode Playwright
// instantiates the `tauriPage` fixture at the start of the test body, so the
// previous test's app process is torn down and its storage wiped here first.
const test = baseTest.extend({})

// biome-ignore lint/correctness/noEmptyPattern: must stay empty so no fixture (which would spawn the app) is touched before hygiene runs
test.beforeEach(async ({}, _testInfo) => {
  preSpawnHygiene()
})

export { expect, test }

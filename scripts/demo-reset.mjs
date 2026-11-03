#!/usr/bin/env node
/**
 * demo-reset.mjs — start a fresh, reproducible SkillDeck demo session.
 *
 * Kills any running demo app, spawns `tauri dev --features e2e-testing`
 * against a brand-new disposable data directory (fresh database + webview
 * storage), and boots the app into the state the recording pipeline needs:
 * a conversation open in the provisioned workspace, composer visible.
 *
 * Usage:
 *   SKILLDECK_DEMO_WORKSPACE=/path/to/demo-springboard node scripts/demo-reset.mjs
 *
 * Env:
 *   SKILLDECK_DEMO_WORKSPACE — workspace to provision (defaults to this repo)
 *   SKILLDECK_DEMO_DATA_DIR  — reuse a specific data dir instead of mktemp
 *   SKILLDECK_DEMO_SOCKET    — plugin socket path (default /tmp/tauri-playwright.sock)
 *
 * Exits 0 when the app is ready. The disposable data dir is recorded in
 * output/.demo-data-dir so a later run wipes the previous one first.
 */
import { spawn, execSync } from 'node:child_process'
import {
  existsSync, mkdtempSync, rmSync, mkdirSync, readFileSync, writeFileSync, openSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO = join(__dirname, '..')
const SOCKET =
  process.env.SKILLDECK_DEMO_SOCKET ?? '/tmp/tauri-playwright.sock'
const LOG = join(REPO, 'output', 'demo-reset.log')
const DEMO_DIR_FILE = join(REPO, 'output', '.demo-data-dir')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function resolvePlugin() {
  const roots = [REPO, join(REPO, '..', 'recovoice')]
  for (const root of roots) {
    const candidates = [
      join(root, 'node_modules', '@srsholmes', 'tauri-playwright', 'dist', 'index.js'),
      join(root, 'node_modules', 'tauri-playwright', 'dist', 'index.js')
    ]
    for (const p of candidates) {
      if (existsSync(p)) return `file://${p}`
    }
  }
  throw new Error(
    '@srsholmes/tauri-playwright is not installed. Add it to this repo or ../recovoice with `pnpm add -D @srsholmes/tauri-playwright`.'
  )
}

async function main() {
  const pluginUrl = resolvePlugin()
  const { PluginClient, TauriPage } = await import(pluginUrl)

  // 1. Fresh data dir (wipe the previous demo's scratch dir first)
  const previous = existsSync(DEMO_DIR_FILE)
    ? readFileSync(DEMO_DIR_FILE, 'utf8').trim()
    : ''
  if (previous) {
    try {
      rmSync(previous, { recursive: true, force: true })
    } catch {
      /* ignore */
    }
  }
  const dataDir =
    process.env.SKILLDECK_DEMO_DATA_DIR ??
    mkdtempSync(join(tmpdir(), 'skilldeck-demo-'))
  const workspace = process.env.SKILLDECK_DEMO_WORKSPACE ?? REPO

  // 2. Stop any existing demo instance
  for (const pat of ['target/debug/skilldeck', 'tauri dev', 'vite']) {
    try {
      execSync(`pkill -f '${pat}'`, { stdio: 'ignore' })
    } catch {
      /* no match */
    }
  }
  await sleep(1500)

  // 3. Launch against the fresh dir, logging to a file via a raw fd so the
  //    app keeps running (and logging) after this script exits.
  mkdirSync(join(REPO, 'output'), { recursive: true })
  writeFileSync(DEMO_DIR_FILE, dataDir)
  const logFd = openSync(LOG, 'a')
  const child = spawn(
    join(REPO, 'node_modules', '.bin', 'tauri'),
    ['dev', '--features', 'e2e-testing'],
    {
      cwd: REPO,
      env: {
        ...process.env,
        SKILLDECK_DATA_DIR: dataDir,
        SKILLDECK_DEMO_WORKSPACE: workspace
      },
      stdio: ['ignore', logFd, logFd],
      detached: true
    }
  )
  child.unref()
  console.log(`data dir : ${dataDir}`)
  console.log(`workspace: ${workspace}`)

  // 4. Wait for the plugin socket (first build compiles Rust; be patient)
  const client = new PluginClient(SOCKET, undefined)
  const deadline = Date.now() + 300_000
  for (;;) {
    try {
      await Promise.race([
        client.connect(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('conn timeout')), 2000))
      ])
      break
    } catch {
      if (Date.now() > deadline) {
        console.error(`Timed out waiting for the app to start. See ${LOG}`)
        process.exit(1)
      }
      await sleep(1500)
    }
  }
  const page = new TauriPage(client)

  // 5. Wait for the app shell + a clickable New Chat (workspace auto-selected)
  let ready = false
  for (let i = 0; i < 60 && !ready; i++) {
    await sleep(1000)
    try {
      const state = await page.evaluate(`(function(){
        var b=Array.from(document.querySelectorAll('button')).filter(
          x=>(x.textContent||'').trim()==='New Chat'
        ).find(x=>x.offsetParent!==null);
        return b ? {enabled:!b.disabled} : null;
      })()`)
      if (state?.enabled) ready = true
    } catch {
      /* app still booting */
    }
  }
  if (!ready) {
    console.error(`App did not reach a usable state. See ${LOG}`)
    process.exit(1)
  }

  // 6. Create and open a fresh conversation via the real UI. Conversation
  //    rows are div[role=button][data-conversation-id], not <a> links.
  await page.evaluate(`(function(){
    var b=Array.from(document.querySelectorAll('button')).filter(
      x=>(x.textContent||'').trim()==='New Chat'
    ).find(x=>x.offsetParent!==null && !x.disabled);
    if (b) b.click();
  })()`)

  let conversationId = null
  for (let i = 0; i < 20 && !conversationId; i++) {
    await sleep(500)
    try {
      conversationId = await page.evaluate(
        `document.querySelector('div[data-conversation-id]')?.getAttribute('data-conversation-id') || null`
      )
    } catch {
      /* list still refreshing */
    }
  }
  if (!conversationId) {
    console.error(
      'New conversation was not created in the UI. See ' + LOG
    )
    process.exit(1)
  }

  const clicked = await page.evaluate(`(function(){
    var el=document.querySelector('div[data-conversation-id]');
    if(el){el.click(); return true;}
    return false;
  })()`)
  if (!clicked) {
    console.error('Conversation row found but could not be clicked.')
    process.exit(1)
  }
  await sleep(2500)

  const url = await page.evaluate('location.href')
  const composer = await page.evaluate(
    `document.querySelector('textarea')?.placeholder || 'none'`
  )
  if (!url.includes(conversationId) || composer === 'none') {
    console.error(`Unexpected app state after opening: url=${url} composer=${composer}`)
    process.exit(1)
  }
  console.log(`conversation: ${url}`)
  console.log(`composer    : ${composer}`)
  client.disconnect()
  process.exit(0)
}

main().catch((e) => {
  console.error(e && e.stack ? e.stack : String(e))
  process.exit(1)
})
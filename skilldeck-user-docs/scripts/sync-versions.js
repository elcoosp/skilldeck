import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const docsDir = path.resolve(__dirname, '../src/content/docs');

const languages = ['en', 'fr'];
const versions = ['v0-1', 'v0-2', 'latest'];
const baseVersion = 'v0-2'; // the version with canonical content

async function syncVersion(version) {
  if (version === baseVersion) return;
  for (const lang of languages) {
    const src = path.join(docsDir, lang, baseVersion);
    const dest = path.join(docsDir, lang, version);
    if (await fs.pathExists(src)) {
      await fs.copy(src, dest, { overwrite: true });
      console.log(`Copied ${lang}/${baseVersion} to ${lang}/${version}`);
    } else {
      console.warn(`Source ${src} does not exist – skipping`);
    }
  }
}

async function main() {
  for (const v of versions) {
    await syncVersion(v);
  }
}

main().catch(console.error);

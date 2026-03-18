import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const docsDir = path.resolve(__dirname, '../src/content/docs');

const languages = ['en', 'fr']; // add as needed
const versions = ['v0.1', 'v0.2', 'latest'];
const baseVersion = 'v0.2';

async function syncVersion(version) {
  if (version === baseVersion) {
    console.log(`Skipping base version ${version}`);
    return;
  }

  for (const lang of languages) {
    const srcBase = path.join(docsDir, lang, baseVersion);
    const destBase = path.join(docsDir, lang, version);
    const overrideSrc = path.join(docsDir, lang, `${version}-overrides`);

    console.log(`Syncing ${lang}/${version} from ${srcBase}`);

    if (!await fs.pathExists(srcBase)) {
      console.warn(`Source ${srcBase} does not exist, skipping`);
      continue;
    }

    await fs.ensureDir(destBase);
    await fs.copy(srcBase, destBase, {
      filter: (src) => {
        const relative = path.relative(srcBase, src);
        const overridePath = path.join(overrideSrc, relative);
        return !fs.existsSync(overridePath);
      }
    });

    if (await fs.pathExists(overrideSrc)) {
      await fs.copy(overrideSrc, destBase, { overwrite: true });
    }

    console.log(`Copied to ${destBase}`);
  }
}

async function main() {
  for (const v of versions) {
    await syncVersion(v);
  }
  console.log('Sync complete!');
}

main().catch(console.error);

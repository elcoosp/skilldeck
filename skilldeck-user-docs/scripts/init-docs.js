import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const docsDir = path.resolve(__dirname, '../src/content/docs');

const languages = ['en', 'fr']; // add more as needed
const versions = ['v0.1', 'v0.2', 'latest'];
const baseVersion = 'v0.2'; // the version that will contain the canonical content

// Define a simple folder structure with placeholder files
const structure = [
  'getting-started/installation.md',
  'getting-started/first-conversation.md',
  'how-to/install-skill.md',
  'reference/errors.md',
  'index.md', // optional homepage for version
];

// Frontmatter template
const frontmatter = (title, description) => `---
title: ${title}
description: ${description}
---

`;

async function createDirectories() {
  // Create language/version folders
  for (const lang of languages) {
    for (const version of versions) {
      const versionPath = path.join(docsDir, lang, version);
      await fs.ensureDir(versionPath);

      // Create placeholder files if they don't exist (only for base version to avoid duplicates)
      if (version === baseVersion) {
        for (const file of structure) {
          const filePath = path.join(versionPath, file);
          if (!await fs.pathExists(filePath)) {
            await fs.ensureDir(path.dirname(filePath));
            const name = path.basename(file, '.md');
            const title = name.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
            const content = frontmatter(title, `Description for ${title}`);
            await fs.writeFile(filePath, content);
          }
        }
      }
    }
  }

  console.log('✅ Documentation structure created successfully!');
}

createDirectories().catch(console.error);

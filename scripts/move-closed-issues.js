#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ISSUES_DIR = path.join(__dirname, "../docs/issues");          // directory containing the issue files
const CLOSED_DIR = path.join(ISSUES_DIR, 'closed');

// Get all .md files in ISSUES_DIR (ignore directories)
async function getIssueFiles() {
  const entries = await fs.readdir(ISSUES_DIR, { withFileTypes: true });
  return entries
    .filter(entry => entry.isFile() && entry.name.endsWith('.md'))
    .map(entry => entry.name);
}

// Parse frontmatter from a markdown file
async function parseFrontmatter(filePath) {
  const content = await fs.readFile(filePath, 'utf-8');
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
  const match = content.match(frontmatterRegex);
  if (!match) return null;

  try {
    return yaml.load(match[1]);
  } catch (err) {
    console.warn(`Failed to parse frontmatter in ${filePath}:`, err.message);
    return null;
  }
}

async function main() {
  try {
    await fs.mkdir(CLOSED_DIR, { recursive: true });
    const files = await getIssueFiles();

    for (const file of files) {
      const filePath = path.join(ISSUES_DIR, file);
      const frontmatter = await parseFrontmatter(filePath);

      if (frontmatter && frontmatter.state === 'closed') {
        const targetPath = path.join(CLOSED_DIR, file);
        await fs.rename(filePath, targetPath);
        console.log(`Moved: ${file} → closed/`);
      }
    }
    console.log('Done.');
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();

#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';

async function main() {
  const [, , targetDir] = process.argv;

  if (!targetDir) {
    console.error('Usage: node scripts/docs/print-md-list.mjs <directory>');
    process.exit(1);
  }

  const absoluteDir = resolve(process.cwd(), targetDir);
  const entries = await readdir(absoluteDir, { withFileTypes: true }).catch((error) => {
    console.error(`Failed to read directory: ${absoluteDir}`);
    console.error(error);
    process.exit(1);
  });

  const markdownFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  if (markdownFiles.length === 0) {
    console.warn(`No markdown files found in ${absoluteDir}`);
    return;
  }

  const separator = '-'.repeat(80);

  for (const file of markdownFiles) {
    const filePath = join(absoluteDir, file);
    const content = await readFile(filePath, 'utf8');
    console.log(separator);
    console.log(`# ${file}`);
    console.log(separator);
    console.log(content.trim());
    console.log('');
  }
}

main().catch((error) => {
  console.error('Unexpected error while printing markdown files');
  console.error(error);
  process.exit(1);
});

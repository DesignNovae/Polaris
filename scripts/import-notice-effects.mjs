import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';

// Import user-supplied ThreeUI source exports without executing them.
const root = 'vendor/threeui/notice-effects';
const records = [];
for (const input of process.argv.slice(2)) {
  const text = readFileSync(input, 'utf8').replace(/\r\n/g, '\n');
  const sections = [...text.matchAll(/^### `([^`]+)`\n\nRole: [^\n]+SHA-256 `([a-f0-9]+)`\n\n```[^\n]*\n([\s\S]*?)\n```/gm)];
  if (!sections.length) throw new Error('No source sections found');
  for (const [, path, expected, body] of sections) {
    if (path.includes('..') || !path.startsWith('src/')) throw new Error('Invalid source path');
    const candidates = [body, body + '\n'];
    const source = candidates.find(s => createHash('sha256').update(s).digest('hex') === expected);
    if (source === undefined) throw new Error(`Source hash mismatch: ${path}`);
    const target = join(root, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, source);
    records.push({ path, sha256: expected });
  }
}
writeFileSync(join(root, 'manifest.json'), JSON.stringify([...new Map(records.map(r => [r.path, r])).values()], null, 2) + '\n');
console.log(`Verified and imported ${records.length} source sections.`);

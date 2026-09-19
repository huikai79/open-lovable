import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('app/api');
const legacyAllowlist = new Set([
  path.normalize('app/api/create-ai-sandbox/route.ts')
]);
const forbidden = [
  'global.activeSandbox',
  'global.activeSandboxProvider',
  'global.sandboxState',
  'global.existingFiles',
  'global.sandboxData',
  'global.conversationState',
  'global.lastViteRestartTime',
  'global.viteRestartInProgress'
];

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.isFile() && entry.name === 'route.ts' ? [full] : [];
  });
}

const violations = [];
for (const file of walk(root)) {
  const normalized = path.normalize(path.relative(process.cwd(), file));
  if (legacyAllowlist.has(normalized)) continue;

  const source = fs.readFileSync(file, 'utf8');
  for (const token of forbidden) {
    if (source.includes(token)) {
      violations.push(file + ': forbidden process-global sandbox state: ' + token);
    }
  }
}

if (violations.length) {
  console.error(violations.join('\n'));
  process.exit(1);
}

console.log('Workspace boundary check passed.');

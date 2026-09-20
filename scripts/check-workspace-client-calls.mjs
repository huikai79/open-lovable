import fs from 'node:fs';
import path from 'node:path';

const roots = ['app', 'components', 'hooks'];
const ignoredPrefixes = [path.normalize('app/api')];
const extensions = new Set(['.ts', '.tsx', '.js', '.jsx']);
const statefulEndpoints = [
  '/api/conversation-state',
  '/api/create-ai-sandbox-v2',
  '/api/sandbox-status',
  '/api/kill-sandbox',
  '/api/get-sandbox-files',
  '/api/generate-ai-code-stream',
  '/api/apply-ai-code-stream',
  '/api/apply-ai-code',
  '/api/install-packages',
  '/api/install-packages-v2',
  '/api/detect-and-install-packages',
  '/api/restart-vite',
  '/api/monitor-vite-logs',
  '/api/sandbox-logs',
  '/api/run-command',
  '/api/run-command-v2',
  '/api/create-zip'
];

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    const relative = path.normalize(path.relative(process.cwd(), full));
    if (ignoredPrefixes.some((prefix) => relative === prefix || relative.startsWith(prefix + path.sep))) return [];
    if (entry.isDirectory()) return walk(full);
    return entry.isFile() && extensions.has(path.extname(entry.name)) ? [full] : [];
  });
}

function hasDirectFetch(source, endpoint) {
  const patterns = [
    "fetch('" + endpoint,
    'fetch("' + endpoint,
    'fetch(`' + endpoint
  ];
  return patterns.some((pattern) => source.includes(pattern));
}

const violations = [];
for (const root of roots) {
  for (const file of walk(path.resolve(root))) {
    const source = fs.readFileSync(file, 'utf8');
    for (const endpoint of statefulEndpoints) {
      if (hasDirectFetch(source, endpoint)) {
        violations.push(path.relative(process.cwd(), file) + ': direct fetch to workspace-stateful endpoint ' + endpoint);
      }
    }
  }
}

if (violations.length) {
  console.error(violations.join('\n'));
  console.error('\nUse workspaceFetch(...) so X-Open-Lovable-Workspace is propagated.');
  process.exit(1);
}

console.log('Workspace client-call boundary check passed.');

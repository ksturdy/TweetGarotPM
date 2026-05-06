/* eslint-disable */
// Rewrites the __BUILD_ID__ token in build/service-worker.js with a unique
// per-build identifier so every production deploy invalidates the SW cache
// automatically. Runs as a `postbuild` step after `react-scripts build`.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const swPath = path.join(__dirname, '..', 'build', 'service-worker.js');

if (!fs.existsSync(swPath)) {
  console.warn('[version-sw] build/service-worker.js not found, skipping.');
  process.exit(0);
}

let buildId;
try {
  buildId = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
    .toString()
    .trim();
} catch {
  buildId = '';
}
if (!buildId) {
  buildId = String(Date.now());
}

const src = fs.readFileSync(swPath, 'utf8');
if (!src.includes('__BUILD_ID__')) {
  console.warn('[version-sw] __BUILD_ID__ token not found in service-worker.js — was it already replaced?');
  process.exit(0);
}

const out = src.replace(/__BUILD_ID__/g, buildId);
fs.writeFileSync(swPath, out);
console.log(`[version-sw] CACHE_NAME set to titan-pm-${buildId}`);

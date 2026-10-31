/**
 * Standalone verification script for sample extension manifest against Anvesha SDK rules.
 */
const fs = require('fs');
const path = require('path');

const manifestPath = path.join(__dirname, 'manifest.json');
const raw = fs.readFileSync(manifestPath, 'utf8');
const manifest = JSON.parse(raw);

const VALID_PERMISSIONS = new Set([
  'storage:read',
  'storage:write',
  'workspace:read',
  'network:fetch',
  'ui:sidepanel',
  'events:listen',
  'events:emit',
  'audit:log',
]);

function verifyManifest(m) {
  const errors = [];
  if (!m.id || !/^[a-z0-9-_.]+$/.test(m.id)) {
    errors.push(`Invalid ID: ${m.id}`);
  }
  if (!m.version || !/^\d+\.\d+\.\d+/.test(m.version)) {
    errors.push(`Invalid version: ${m.version}`);
  }
  if (!m.sdkVersion || !m.sdkVersion.startsWith('1.')) {
    errors.push(`Incompatible sdkVersion: ${m.sdkVersion}`);
  }
  if (!m.permissions || !Array.isArray(m.permissions)) {
    errors.push('Permissions must be an array');
  } else {
    for (const p of m.permissions) {
      if (!VALID_PERMISSIONS.has(p)) {
        errors.push(`Invalid permission: ${p}`);
      }
    }
  }

  if (errors.length > 0) {
    console.error('FAIL: Sample extension manifest failed validation:', errors);
    process.exit(1);
  } else {
    console.log('PASS: Sample extension manifest is fully compliant with Anvesha SDK v1.0.0');
    console.log(`Extension ID: ${m.id}`);
    console.log(`Permissions: ${m.permissions.join(', ')}`);
  }
}

verifyManifest(manifest);

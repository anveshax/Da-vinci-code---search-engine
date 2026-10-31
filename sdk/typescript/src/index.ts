/**
 * Anvesha Extension SDK Entry Point.
 */

export * from './types';

import { ExtensionManifest, ExtensionPermission } from './types';

export const SDK_VERSION = '1.0.0';

export const VALID_PERMISSIONS: ExtensionPermission[] = [
  'storage:read',
  'storage:write',
  'workspace:read',
  'network:fetch',
  'ui:sidepanel',
  'events:listen',
  'events:emit',
  'audit:log',
];

/**
 * Validates whether an object conforms to the Anvesha Extension Manifest specification.
 */
export function validateManifest(manifest: any): { valid: boolean; error?: string } {
  if (!manifest || typeof manifest !== 'object') {
    return { valid: false, error: 'Manifest must be an object' };
  }

  const requiredFields = ['id', 'name', 'version', 'sdkVersion', 'description'];
  for (const field of requiredFields) {
    if (!manifest[field]) {
      return { valid: false, error: `Manifest missing required field: '${field}'` };
    }
  }

  if (!/^[a-z0-9-_.]+$/.test(manifest.id)) {
    return {
      valid: false,
      error: `Extension ID '${manifest.id}' is invalid. Use lowercase alphanumeric characters, dots, hyphens, and underscores.`,
    };
  }

  if (!/^\d+\.\d+\.\d+/.test(manifest.version)) {
    return { valid: false, error: `Version '${manifest.version}' must follow semantic versioning (e.g. 1.0.0)` };
  }

  const manifestMajor = manifest.sdkVersion.split('.')[0];
  const currentMajor = SDK_VERSION.split('.')[0];
  if (manifestMajor !== currentMajor) {
    return {
      valid: false,
      error: `Incompatible SDK version '${manifest.sdkVersion}'. Expected major version ${currentMajor}.x`,
    };
  }

  if (manifest.permissions) {
    if (!Array.isArray(manifest.permissions)) {
      return { valid: false, error: 'Permissions must be an array of strings' };
    }
    for (const perm of manifest.permissions) {
      if (!VALID_PERMISSIONS.includes(perm)) {
        return { valid: false, error: `Unknown permission: '${perm}'` };
      }
    }
  }

  return { valid: true };
}

/**
 * Helper definition utility to define typed manifests with autocomplete and validation.
 */
export function defineManifest(manifest: ExtensionManifest): ExtensionManifest {
  const result = validateManifest(manifest);
  if (!result.valid) {
    throw new Error(`Invalid Anvesha Manifest: ${result.error}`);
  }
  return manifest;
}

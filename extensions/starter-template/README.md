# Anvesha Extension Starter Kit

This starter template enables engineering teams to build modular extensions for the Anvesha AI Developer Platform.

## Directory Structure
- `manifest.json`: Defines ID, name, version, SDK target, permissions, and side panel metadata.
- `src/index.ts`: Extension lifecycle entry point (`onActivate`, `onDeactivate`, `renderSidePanel`).
- `package.json`: NPM package metadata and build scripts.

## Permissions Guide
Extensions must declare any capabilities they require in `manifest.json`:
- `storage:read`: Read isolated key-value store.
- `storage:write`: Write isolated key-value store.
- `workspace:read`: Access active workspace metadata.
- `network:fetch`: Perform SSRF-safe outbound HTTP requests via proxy.
- `ui:sidepanel`: Render interactive widgets in the right-side extension drawer.
- `events:listen`: Listen for platform events.
- `events:emit`: Emit custom events to other extensions.

## Building and Registering
1. Compile TypeScript: `npm run build`
2. Register the manifest using the Anvesha Platform API:
   ```bash
   curl -X POST http://localhost:8000/api/v2/extensions/register \
     -H "Content-Type: application/json" \
     -d '{"manifest": <contents of manifest.json>}'
   ```
3. Open Anvesha, navigate to the Extensions Drawer, click **Install**, and then **Active** to enable it.

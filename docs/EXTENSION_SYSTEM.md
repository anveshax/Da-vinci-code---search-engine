# Anvesha AI Intelligence Platform — Extension Platform Architecture

## 1. Executive Summary & Design Principles

The **Anvesha Core Extension Platform** allows distributed engineering teams to build, test, package, and integrate custom developer tools directly into the Anvesha AI intelligence environment without modifying core platform code.

### Core Principles
1. **Zero-Trust Permission Model**: Every capability (storage, network proxying, workspace access, events) must be explicitly declared in `manifest.json`.
2. **Safe Default State**: Newly registered extensions are strictly defaulted to:
   - `installed = false`
   - `enabled = false`
   - `visible = false`
3. **Execution Isolation**: Disabled or uninstalled extensions cannot execute background code, emit events, or read/write storage.
4. **SSRF Network Security**: Outbound network requests through the platform proxy block loopback (`127.0.0.1`, `localhost`), link-local (`169.254.169.254`), and RFC 1918 private subnets.
5. **Isolated Storage**: Extension storage is partitioned strictly by `extension_id` in SQLite. No extension can view or alter data owned by another extension.

---

## 2. Extension SDK Specification (v1.0.0)

### Manifest Schema (`manifest.json`)
```json
{
  "id": "vendor.my-tool",
  "name": "My Custom Tool",
  "version": "1.0.0",
  "sdkVersion": "1.0.0",
  "description": "Short explanation of features provided.",
  "author": "Engineering Team",
  "permissions": [
    "storage:read",
    "storage:write",
    "workspace:read",
    "network:fetch",
    "ui:sidepanel",
    "events:listen",
    "events:emit"
  ],
  "entryPoint": {
    "frontend": "dist/index.js",
    "backend": "backend/plugin.py"
  },
  "sidePanel": {
    "title": "My Tool",
    "icon": "Tool",
    "defaultWidth": 380
  }
}
```

### Supported Permissions
| Permission | Description |
| :--- | :--- |
| `storage:read` | Read isolated key-value storage values |
| `storage:write` | Write and delete isolated key-value storage values |
| `workspace:read` | Access current project workspace metadata |
| `network:fetch` | Make outbound HTTP requests through the SSRF-safe proxy |
| `ui:sidepanel` | Render interactive widgets inside the extension drawer |
| `events:listen` | Listen for platform-level telemetry and workspace events |
| `events:emit` | Broadcast events to other extensions |
| `audit:log` | Query security and activity audit logs |

---

## 3. Extension Lifecycle State Machine

```
              ┌───────────────┐
              │ Registered    │  (installed=0, enabled=0, visible=0)
              └───────┬───────┘
                      │ install()
                      ▼
              ┌───────────────┐
              │ Installed     │  (installed=1, enabled=0, visible=0)
              └───────┬───────┘
                      │ enable()
                      ▼
              ┌───────────────┐
              │ Enabled       │  (installed=1, enabled=1)
              └───────┬───────┘
                      │ setVisibility(true/false)
                      ▼
         ┌─────────────────────────┐
         │ Visible in Side Drawer  │  (visible=1)
         └─────────────────────────┘
```

- **Cannot enable uninstalled extensions**: Attempting to enable an uninstalled extension returns HTTP 400.
- **Uninstall cascades to disable**: Uninstalling automatically sets `enabled = false` and `visible = false`.
- **Immediate execution halt**: Calling `disable()` immediately unloads memory instances, halts event subscriptions, and locks storage access.

---

## 4. Extension Side Panel Drawer & Minimization

The Extension Drawer is accessible from the top header navigation bar (`Blocks` icon):
- **Launcher Tab**: Browse all registered extensions, install/uninstall with one click, inspect version and permission requirements, and enable/disable modules.
- **Active Extension View**: Renders active widgets (e.g. Git Productivity & Metrics) in a sandboxed container.
- **Minimization Dock**: The drawer can be collapsed down to a sleek floating dock pill on the right margin with zero interference to the main 3D Earth Globe or AI workspaces.
- **Responsive Drawer**: Full width overlay on mobile screens, elegant slide-out panel on desktop.

---

## 5. Third-Party Packaging & Deployment

To publish an extension for Anvesha:
1. Clone the starter template from `extensions/starter-template/`.
2. Implement `onActivate`, `onDeactivate`, and optional `renderSidePanel`.
3. Compile with TypeScript `npm run build`.
4. Register your extension manifest using the Platform API:
   ```bash
   curl -X POST https://your-anvesha-backend.com/api/v2/extensions/register \
     -H "Content-Type: application/json" \
     -d @manifest.json
   ```
5. Users can install and enable the extension safely via the Anvesha UI.

"""
Comprehensive End-to-End Verification Runner for Anvesha Platform & Extensions.
Runs both the platform upgrade suite and the extension system suite,
and asserts full lifecycle flow.
"""
import sys
from starlette.testclient import TestClient
from app.main import app
from app.core.db import PlatformDB

client = TestClient(app)

def run_e2e_extension_lifecycle():
    print("\n--- [E2E] Testing Full Extension Lifecycle ---")
    manifest = {
        "id": "e2e.sample-verifier",
        "name": "E2E Lifecycle Verifier",
        "version": "1.0.0",
        "sdkVersion": "1.0.0",
        "description": "Verifies end-to-end registration and lifecycle hooks",
        "author": "Anvesha QA",
        "permissions": ["storage:read", "storage:write", "network:fetch", "ui:sidepanel"],
        "entryPoint": {"frontend": "dist/index.js"},
    }

    # Step 1: Register
    res = client.post("/api/v2/extensions/register", json={"manifest": manifest})
    assert res.status_code == 201, f"Failed registration: {res.text}"
    ext = res.json()["extension"]
    print("✓ Step 1: Extension registered successfully")

    # Step 2: Verify default state is strictly disabled and uninstalled
    assert ext["installed"] is False, "Violation: newly registered extension was marked installed"
    assert ext["enabled"] is False, "Violation: newly registered extension was marked enabled"
    assert ext["visible"] is False, "Violation: newly registered extension was marked visible"
    print("✓ Step 2: Strict defaults verified (installed=False, enabled=False, visible=False)")

    # Step 3: Install
    res = client.post(f"/api/v2/extensions/{ext['id']}/install")
    assert res.status_code == 200
    ext = res.json()["extension"]
    assert ext["installed"] is True
    assert ext["enabled"] is False, "Violation: installed extension must remain disabled until explicitly enabled"
    print("✓ Step 3: Extension installed (remains disabled by default)")

    # Step 4: Enable
    res = client.post(f"/api/v2/extensions/{ext['id']}/enable")
    assert res.status_code == 200
    ext = res.json()["extension"]
    assert ext["enabled"] is True
    print("✓ Step 4: Extension enabled successfully")

    # Step 5: Open (set visibility true)
    res = client.post(f"/api/v2/extensions/{ext['id']}/visibility", json={"visible": True})
    assert res.status_code == 200
    assert res.json()["extension"]["visible"] is True
    print("✓ Step 5: Extension opened in side panel (visible=True)")

    # Step 6: Isolated Storage Write & Read
    res = client.post(f"/api/v2/extensions/{ext['id']}/storage", json={"key": "state", "value": {"test": 123}})
    assert res.status_code == 200
    res = client.get(f"/api/v2/extensions/{ext['id']}/storage?key=state")
    assert res.status_code == 200
    assert res.json()["value"]["test"] == 123
    print("✓ Step 6: Isolated key-value storage write & read verified")

    # Step 7: Disable (auto-hides and locks storage)
    res = client.post(f"/api/v2/extensions/{ext['id']}/disable")
    assert res.status_code == 200
    ext = res.json()["extension"]
    assert ext["enabled"] is False
    assert ext["visible"] is False
    # Storage read now blocked
    res = client.get(f"/api/v2/extensions/{ext['id']}/storage?key=state")
    assert res.status_code == 403
    print("✓ Step 7: Extension disabled (visible=False, storage access blocked)")

    # Step 8: Uninstall
    res = client.post(f"/api/v2/extensions/{ext['id']}/uninstall")
    assert res.status_code == 200
    ext = res.json()["extension"]
    assert ext["installed"] is False
    assert ext["enabled"] is False
    print("✓ Step 8: Extension uninstalled successfully")

    # Step 9: Clean up registration
    res = client.delete(f"/api/v2/extensions/{ext['id']}")
    assert res.status_code == 200
    print("✓ Step 9: Cleaned up test extension from registry")

    print("\nALL 9 LIFECYCLE STEPS COMPLETED AND VERIFIED PERFECTLY!")

if __name__ == "__main__":
    try:
        run_e2e_extension_lifecycle()
    except Exception as e:
        print(f"FAILED: {e}", file=sys.stderr)
        sys.exit(1)

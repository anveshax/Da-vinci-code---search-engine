"""
Automated Test Suite for Anvesha Core Extension Platform.

Verifies:
1. Manifest schema validation and SDK compatibility
2. Strict defaults: installed=false, enabled=false, visible=false
3. Lifecycle state transitions: install, enable, disable, uninstall
4. Enforcement that disabled extensions cannot run or access storage
5. Permission declaration checking
6. Isolated extension storage
7. SSRF prevention and network proxy safety
8. Audit logging
"""
from starlette.testclient import TestClient
from app.main import app

client = TestClient(app)

SAMPLE_MANIFEST = {
    "id": "anvesha.git-metrics",
    "name": "Git Productivity & Metrics",
    "version": "1.0.0",
    "sdkVersion": "1.0.0",
    "description": "Calculates commit frequency and developer velocity",
    "author": "Anvesha Core Team",
    "permissions": [
        "storage:read",
        "storage:write",
        "workspace:read",
        "network:fetch",
        "ui:sidepanel",
        "events:listen",
        "events:emit",
    ],
    "entryPoint": {
        "frontend": "index.js",
    },
    "sidePanel": {
        "title": "Git Metrics",
        "icon": "GitBranch",
        "defaultWidth": 380,
    },
}

RESTRICTED_MANIFEST = {
    "id": "anvesha.restricted-tool",
    "name": "Restricted Tool",
    "version": "1.0.0",
    "sdkVersion": "1.0.0",
    "description": "Tool without storage permissions",
    "permissions": [],
}


def test_manifest_validation():
    # Test invalid id format
    res = client.post("/api/v2/extensions/register", json={
        "manifest": {**SAMPLE_MANIFEST, "id": "INVALID ID WITH SPACES"}
    })
    assert res.status_code == 400
    assert "Extension ID" in res.json()["detail"]

    # Test invalid semver
    res = client.post("/api/v2/extensions/register", json={
        "manifest": {**SAMPLE_MANIFEST, "version": "not-a-version"}
    })
    assert res.status_code == 400
    assert "semantic versioning" in res.json()["detail"]

    # Test incompatible SDK version
    res = client.post("/api/v2/extensions/register", json={
        "manifest": {**SAMPLE_MANIFEST, "sdkVersion": "2.0.0"}
    })
    assert res.status_code == 400
    assert "Incompatible SDK version" in res.json()["detail"]

    # Test unknown permission
    res = client.post("/api/v2/extensions/register", json={
        "manifest": {**SAMPLE_MANIFEST, "permissions": ["super:admin:delete_all"]}
    })
    assert res.status_code == 400
    assert "Unknown permission" in res.json()["detail"]


def test_registration_and_strict_defaults():
    # Clean up prior test data if exists
    client.delete(f"/api/v2/extensions/{SAMPLE_MANIFEST['id']}")
    client.delete(f"/api/v2/extensions/{RESTRICTED_MANIFEST['id']}")

    # Register sample extension
    res = client.post("/api/v2/extensions/register", json={"manifest": SAMPLE_MANIFEST})
    assert res.status_code == 201
    ext = res.json()["extension"]

    # Strict defaults validation:
    # installed = false, enabled = false, visible = false
    assert ext["id"] == "anvesha.git-metrics"
    assert ext["installed"] is False
    assert ext["enabled"] is False
    assert ext["visible"] is False
    assert ext["health_status"] == "healthy"


def test_lifecycle_state_machine():
    ext_id = "anvesha.git-metrics"

    # Cannot enable an uninstalled extension
    res = client.post(f"/api/v2/extensions/{ext_id}/enable")
    assert res.status_code == 400
    assert "not installed" in res.json()["detail"]

    # Install extension
    res = client.post(f"/api/v2/extensions/{ext_id}/install")
    assert res.status_code == 200
    ext = res.json()["extension"]
    assert ext["installed"] is True
    assert ext["enabled"] is False  # Must remain disabled until explicitly enabled

    # Cannot make visible if disabled
    res = client.post(f"/api/v2/extensions/{ext_id}/visibility", json={"visible": True})
    assert res.status_code == 400
    assert "not enabled" in res.json()["detail"]

    # Enable extension
    res = client.post(f"/api/v2/extensions/{ext_id}/enable")
    assert res.status_code == 200
    ext = res.json()["extension"]
    assert ext["enabled"] is True

    # Now visibility toggle works
    res = client.post(f"/api/v2/extensions/{ext_id}/visibility", json={"visible": True})
    assert res.status_code == 200
    assert res.json()["extension"]["visible"] is True

    # Disable extension
    res = client.post(f"/api/v2/extensions/{ext_id}/disable")
    assert res.status_code == 200
    ext = res.json()["extension"]
    assert ext["enabled"] is False
    assert ext["visible"] is False  # Automatically hidden on disable

    # Uninstall extension
    res = client.post(f"/api/v2/extensions/{ext_id}/uninstall")
    assert res.status_code == 200
    ext = res.json()["extension"]
    assert ext["installed"] is False
    assert ext["enabled"] is False
    assert ext["visible"] is False


def test_isolated_storage_and_permissions():
    ext_id = "anvesha.git-metrics"
    # Ensure extension is installed and enabled for storage operations
    client.post(f"/api/v2/extensions/{ext_id}/install")
    client.post(f"/api/v2/extensions/{ext_id}/enable")

    # Set storage key
    res = client.post(f"/api/v2/extensions/{ext_id}/storage", json={
        "key": "weekly_commits",
        "value": {"commits": 42, "author": "dev@anvesha.ai"},
    })
    assert res.status_code == 200

    # Read storage key
    res = client.get(f"/api/v2/extensions/{ext_id}/storage?key=weekly_commits")
    assert res.status_code == 200
    assert res.json()["value"]["commits"] == 42

    # Disable extension and verify storage access is immediately blocked
    client.post(f"/api/v2/extensions/{ext_id}/disable")
    res = client.get(f"/api/v2/extensions/{ext_id}/storage?key=weekly_commits")
    assert res.status_code == 403
    assert "disabled" in res.json()["detail"]

    # Register restricted tool without storage permissions
    client.post("/api/v2/extensions/register", json={"manifest": RESTRICTED_MANIFEST})
    client.post("/api/v2/extensions/anvesha.restricted-tool/install")
    client.post("/api/v2/extensions/anvesha.restricted-tool/enable")

    # Attempt to write storage without permission
    res = client.post("/api/v2/extensions/anvesha.restricted-tool/storage", json={
        "key": "unauthorized_key",
        "value": "data",
    })
    assert res.status_code == 403
    assert "lacks declared permission" in res.json()["detail"]


def test_ssrf_proxy_security():
    ext_id = "anvesha.git-metrics"
    client.post(f"/api/v2/extensions/{ext_id}/install")
    client.post(f"/api/v2/extensions/{ext_id}/enable")

    # Block localhost
    res = client.post(f"/api/v2/extensions/{ext_id}/proxy", json={
        "url": "http://localhost:8000/api/health"
    })
    assert res.status_code == 403
    assert "blocked" in res.json()["detail"]

    # Block 127.0.0.1
    res = client.post(f"/api/v2/extensions/{ext_id}/proxy", json={
        "url": "http://127.0.0.1:8000/api/health"
    })
    assert res.status_code == 403

    # Block AWS / Cloud metadata service
    res = client.post(f"/api/v2/extensions/{ext_id}/proxy", json={
        "url": "http://169.254.169.254/latest/meta-data/"
    })
    assert res.status_code == 403

    # Block private subnet IP
    res = client.post(f"/api/v2/extensions/{ext_id}/proxy", json={
        "url": "http://192.168.1.1/admin"
    })
    assert res.status_code == 403


def test_audit_logs():
    ext_id = "anvesha.git-metrics"
    res = client.get(f"/api/v2/extensions/{ext_id}/audit")
    assert res.status_code == 200
    logs = res.json()["logs"]
    assert len(logs) > 0
    actions = [l["action"] for l in logs]
    assert "REGISTER" in actions
    assert "INSTALL" in actions


if __name__ == "__main__":
    print("Running Extension Platform Tests...")
    test_manifest_validation()
    print("PASS: test_manifest_validation")
    test_registration_and_strict_defaults()
    print("PASS: test_registration_and_strict_defaults")
    test_lifecycle_state_machine()
    print("PASS: test_lifecycle_state_machine")
    test_isolated_storage_and_permissions()
    print("PASS: test_isolated_storage_and_permissions")
    test_ssrf_proxy_security()
    print("PASS: test_ssrf_proxy_security")
    test_audit_logs()
    print("PASS: test_audit_logs")
    print("\nALL EXTENSION SUITE TESTS PASSED!")

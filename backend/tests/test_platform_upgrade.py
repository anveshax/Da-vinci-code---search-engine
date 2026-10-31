"""
Exhaustive Verification Test Suite for Codebase Intelligence Commercial Platform.
"""
from starlette.testclient import TestClient
from app.main import app
from engine.web_search import is_safe_url

client = TestClient(app)


def test_root():
    res = client.get("/")
    assert res.status_code == 200
    data = res.json()
    assert "version" in data
    assert data["health_endpoint"] == "/api/health"
    assert data["v2_health_endpoint"] == "/api/v2/search/health"


def test_health_telemetry():
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert "telemetry" in data
    assert "python_version" in data["telemetry"]


def test_v2_search_health():
    res = client.get("/api/v2/search/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert "ai_provider" in data
    assert "codebase_engine" in data
    assert data["indexed_files_count"] > 0


def test_codebase_dependencies():
    res = client.get("/api/v2/codebase/dependencies")
    assert res.status_code == 200
    data = res.json()
    assert data["total_nodes"] > 0
    assert "nodes" in data
    assert "edges" in data


def test_codebase_impact_analysis():
    res = client.post("/api/v2/codebase/impact", json={"file_path": "backend/app/core/config.py"})
    assert res.status_code == 200
    data = res.json()
    assert "total_affected" in data
    assert "impact_risk" in data
    assert data["total_affected"] > 0


def test_codebase_test_gaps():
    res = client.get("/api/v2/codebase/test-gaps")
    assert res.status_code == 200
    data = res.json()
    assert "total_source_modules" in data
    assert "coverage_percentage" in data
    assert "gaps" in data


def test_codebase_security_insights():
    res = client.get("/api/v2/codebase/security-insights")
    assert res.status_code == 200
    data = res.json()
    assert "total_findings" in data
    assert isinstance(data["findings"], list)


def test_search_suggestions():
    res = client.get("/api/v2/search/suggest?q=scanner")
    assert res.status_code == 200
    data = res.json()
    assert "suggestions" in data
    assert len(data["suggestions"]) > 0


def test_search_streaming_sse():
    with client.stream("POST", "/api/v2/search/stream", json={"query": "scanner", "mode": "code"}) as resp:
        assert resp.status_code == 200
        events = []
        for line in resp.iter_lines():
            if line and line.startswith("data: "):
                events.append(line)
        assert len(events) >= 4, f"Expected at least 4 SSE events, got {len(events)}"


def test_file_content_security_sandbox():
    res = client.get("/api/file/content?path=backend/requirements.txt")
    assert res.status_code == 200
    assert "fastapi" in res.json()["content"]

    res_bad = client.get("/api/file/content?path=../../../../etc/passwd")
    assert res_bad.status_code == 404


def test_ssrf_safety_checks():
    assert not is_safe_url("http://localhost:8000")
    assert not is_safe_url("http://127.0.0.1:8000")
    assert not is_safe_url("http://169.254.169.254/latest/meta-data/")
    assert not is_safe_url("http://10.0.0.1/admin")
    assert not is_safe_url("http://192.168.1.1/")
    assert not is_safe_url("javascript:alert(1)")


def test_projects_crud():
    # List projects
    res = client.get("/api/v2/projects")
    assert res.status_code == 200
    assert len(res.json()["projects"]) > 0

    # Create project
    create_res = client.post("/api/v2/projects", json={
        "name": "Test Microservice",
        "description": "Integration test project",
        "custom_instructions": "Write concise, type-safe Python code."
    })
    assert create_res.status_code == 200
    proj_id = create_res.json()["id"]

    # Delete project
    del_res = client.delete(f"/api/v2/projects/{proj_id}")
    assert del_res.status_code == 200


def test_conversations_and_branching():
    # Create conversation
    res = client.post("/api/v2/conversations", json={"title": "Auth Architecture Query", "search_mode": "auto"})
    assert res.status_code == 200
    conv_id = res.json()["id"]

    # Append message
    msg_res = client.post(f"/api/v2/conversations/{conv_id}/messages", json={
        "role": "user",
        "content": "How do we secure the JWT cookies?"
    })
    assert msg_res.status_code == 200
    msg_id = msg_res.json()["id"]

    # Branch conversation
    branch_res = client.post(f"/api/v2/conversations/{conv_id}/branch", json={"up_to_message_id": msg_id})
    assert branch_res.status_code == 200
    assert branch_res.json()["parent_conversation_id"] == conv_id

    # Clean up
    client.delete(f"/api/v2/conversations/{conv_id}")
    client.delete(f"/api/v2/conversations/{branch_res.json()['id']}")


def test_artifacts_crud():
    # Create artifact
    res = client.post("/api/v2/artifacts", json={
        "title": "ADR 001 - In-Memory AST Scanning",
        "content": "# ADR 001\nContext: We need sub-second symbol searches without heavy external vector DBs.",
        "artifact_type": "architecture_adr"
    })
    assert res.status_code == 200
    art_id = res.json()["id"]

    # List
    list_res = client.get("/api/v2/artifacts")
    assert list_res.status_code == 200
    assert any(a["id"] == art_id for a in list_res.json()["artifacts"])

    # Clean up
    client.delete(f"/api/v2/artifacts/{art_id}")


def test_debugging_assistant():
    res = client.post("/api/v2/codebase/debug", json={
        "error_message": "NameError: name 'scanner' is not defined",
        "stack_trace": 'File "backend/app/api/search.py", line 88, in search_codebase\n  matches = scanner.search(payload.query)'
    })
    assert res.status_code == 200
    data = res.json()
    assert "matched_files" in data
    assert "analysis" in data


def test_prompt_library():
    res = client.get("/api/v2/prompts")
    assert res.status_code == 200
    prompts = res.json()["prompts"]
    assert len(prompts) >= 5
    assert any(p["category"] == "Security" for p in prompts)


def test_platform_settings():
    save_res = client.post("/api/v2/settings/test_theme", json={"value": "charcoal-dark"})
    assert save_res.status_code == 200

    get_res = client.get("/api/v2/settings")
    assert get_res.status_code == 200
    assert get_res.json()["settings"].get("test_theme") == "charcoal-dark"


if __name__ == "__main__":
    test_root()
    print("PASS: test_root")
    test_health_telemetry()
    print("PASS: test_health_telemetry")
    test_v2_search_health()
    print("PASS: test_v2_search_health")
    test_codebase_dependencies()
    print("PASS: test_codebase_dependencies")
    test_codebase_impact_analysis()
    print("PASS: test_codebase_impact_analysis")
    test_codebase_test_gaps()
    print("PASS: test_codebase_test_gaps")
    test_codebase_security_insights()
    print("PASS: test_codebase_security_insights")
    test_search_suggestions()
    print("PASS: test_search_suggestions")
    test_search_streaming_sse()
    print("PASS: test_search_streaming_sse")
    test_file_content_security_sandbox()
    print("PASS: test_file_content_security_sandbox")
    test_ssrf_safety_checks()
    print("PASS: test_ssrf_safety_checks")
    test_projects_crud()
    print("PASS: test_projects_crud")
    test_conversations_and_branching()
    print("PASS: test_conversations_and_branching")
    test_artifacts_crud()
    print("PASS: test_artifacts_crud")
    test_debugging_assistant()
    print("PASS: test_debugging_assistant")
    test_prompt_library()
    print("PASS: test_prompt_library")
    test_platform_settings()
    print("PASS: test_platform_settings")
    print("\nALL 17 PLATFORM VERIFICATION TESTS PASSED SUCCESSFULLY!")

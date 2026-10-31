"""
Comprehensive test suite for ANVESHA Persistent Chat History System.

Tests:
1. Database Schema & Persistence (conversations and messages tables)
2. CRUD Operations: Create, Read, Update, Delete, Pin/Unpin
3. Continuous Message Appending & Ordering Preservation
4. Automatic Title Generation
5. Search across Conversation Titles & Message Content
6. Backend Restart & Persistence Verification
7. REST API Endpoints verification (FastAPI TestClient)
8. Search Stream Auto-Saving integration
"""
import time
import json
from fastapi.testclient import TestClient

from app.main import app
from app.core.db import PlatformDB, get_db_connection, init_db


def get_test_client():
    init_db()
    return TestClient(app)


def test_database_schema_and_indexes():
    """Verify conversations and messages tables have all required columns and indexes."""
    with get_db_connection() as conn:
        conv_cols = [c[1] for c in conn.execute("PRAGMA table_info(conversations)").fetchall()]
        assert "id" in conv_cols
        assert "title" in conv_cols
        assert "project_id" in conv_cols
        assert "search_mode" in conv_cols
        assert "ai_model" in conv_cols
        assert "message_count" in conv_cols
        assert "is_pinned" in conv_cols
        assert "created_at" in conv_cols
        assert "updated_at" in conv_cols

        msg_cols = [c[1] for c in conn.execute("PRAGMA table_info(messages)").fetchall()]
        assert "id" in msg_cols
        assert "conversation_id" in msg_cols
        assert "role" in msg_cols
        assert "content" in msg_cols
        assert "sources_json" in msg_cols
        assert "citations_json" in msg_cols
        assert "attachments_json" in msg_cols
        assert "model" in msg_cols
        assert "created_at" in msg_cols

        indexes = [r[1] for r in conn.execute("PRAGMA index_list(conversations)").fetchall()]
        assert any("updated" in idx for idx in indexes)


def test_title_generator():
    """Verify smart, Google-class title generation from user queries."""
    assert PlatformDB.generate_conversation_title("what is quantum computing") == "Quantum computing"
    assert PlatformDB.generate_conversation_title("how to clean useEffect in react") == "Clean useEffect in react"
    assert PlatformDB.generate_conversation_title("search for fastest sorting algorithm") == "Fastest sorting algorithm"
    assert PlatformDB.generate_conversation_title("") == "New Search"


def test_conversation_lifecycle_and_pinning():
    """Verify full CRUD lifecycle and pin/unpin toggling in SQLite database."""
    # 1. Create
    conv = PlatformDB.create_conversation(
        title="Test Architecture Discussion",
        project_id="test_proj",
        search_mode="auto",
        ai_model="gemini-2.5-flash",
    )
    conv_id = conv["id"]
    assert conv["title"] == "Test Architecture Discussion"
    assert conv["message_count"] == 0
    assert conv["is_pinned"] is False

    # 2. Add Messages
    m1 = PlatformDB.add_message(
        conversation_id=conv_id,
        role="user",
        content="What is event-driven architecture?",
    )
    assert m1["role"] == "user"
    assert m1["content"] == "What is event-driven architecture?"

    m2 = PlatformDB.add_message(
        conversation_id=conv_id,
        role="assistant",
        content="Event-driven architecture is a software design pattern...",
        sources=[{"title": "EDA Overview", "url": "https://example.com/eda"}],
        citations=[{"text": "EDA Overview"}],
    )
    assert m2["role"] == "assistant"
    assert len(m2["sources"]) == 1

    # 3. Read details
    fetched = PlatformDB.get_conversation(conv_id)
    assert fetched is not None
    assert fetched["message_count"] == 2
    assert len(fetched["messages"]) == 2
    assert fetched["messages"][0]["role"] == "user"
    assert fetched["messages"][1]["role"] == "assistant"
    assert len(fetched["messages"][1]["sources"]) == 1

    # 4. Toggle Pin
    pinned_conv = PlatformDB.toggle_pin_conversation(conv_id, is_pinned=True)
    assert pinned_conv["is_pinned"] is True

    unpinned_conv = PlatformDB.toggle_pin_conversation(conv_id, is_pinned=False)
    assert unpinned_conv["is_pinned"] is False

    # 5. Rename
    renamed = PlatformDB.rename_conversation(conv_id, "Updated EDA Discussion")
    assert renamed["title"] == "Updated EDA Discussion"

    # 6. Delete
    deleted = PlatformDB.delete_conversation(conv_id)
    assert deleted is True
    assert PlatformDB.get_conversation(conv_id) is None


def test_search_conversations():
    """Verify text search across conversation titles and message contents."""
    c = PlatformDB.create_conversation(title="Machine Learning Pipelines")
    PlatformDB.add_message(c["id"], "user", "How do transformers implement multi-head attention?")
    PlatformDB.add_message(c["id"], "assistant", "Multi-head attention projects queries, keys, and values...")

    # Search by title keyword
    results_title = PlatformDB.search_conversations("Pipelines")
    assert any(item["id"] == c["id"] for item in results_title)

    # Search by message content keyword
    results_content = PlatformDB.search_conversations("multi-head attention")
    assert any(item["id"] == c["id"] for item in results_content)

    # Cleanup
    PlatformDB.delete_conversation(c["id"])


def test_backend_restart_persistence():
    """Verify that restarting the backend/reconnecting keeps all conversations and messages intact."""
    conv = PlatformDB.create_conversation(title="Restart Persistence Validation")
    PlatformDB.add_message(conv["id"], "user", "Does this message survive a backend restart?")
    PlatformDB.add_message(conv["id"], "assistant", "Yes, persisted permanently in SQLite WAL mode.")

    conv_id = conv["id"]

    # Simulate backend restart by calling init_db() and re-querying from a fresh connection
    init_db()
    with get_db_connection() as conn:
        row = conn.execute("SELECT * FROM conversations WHERE id = ?", (conv_id,)).fetchone()
        assert row is not None
        assert row["title"] == "Restart Persistence Validation"

        msg_rows = conn.execute("SELECT * FROM messages WHERE conversation_id = ?", (conv_id,)).fetchall()
        assert len(msg_rows) == 2

    # Cleanup
    PlatformDB.delete_conversation(conv_id)


def test_api_endpoints(client):
    """Verify all REST API endpoints under /api/v2/conversations."""
    # 1. POST /api/v2/conversations
    res = client.post("/api/v2/conversations", json={
        "title": "API Test Conversation",
        "project_id": "default",
        "search_mode": "web",
    })
    assert res.status_code == 200
    data = res.json()
    cid = data["id"]
    assert data["title"] == "API Test Conversation"

    # 2. GET /api/v2/conversations
    list_res = client.get("/api/v2/conversations")
    assert list_res.status_code == 200
    conv_list = list_res.json()["conversations"]
    assert any(c["id"] == cid for c in conv_list)

    # 3. POST /api/v2/conversations/{id}/messages
    msg_res = client.post(f"/api/v2/conversations/{cid}/messages", json={
        "role": "user",
        "content": "API message test query",
    })
    assert msg_res.status_code == 200
    assert msg_res.json()["content"] == "API message test query"

    # 4. GET /api/v2/conversations/{id}
    detail_res = client.get(f"/api/v2/conversations/{cid}")
    assert detail_res.status_code == 200
    conv_detail = detail_res.json()
    assert conv_detail["message_count"] == 1
    assert len(conv_detail["messages"]) == 1

    # 5. POST /api/v2/conversations/{id}/pin
    pin_res = client.post(f"/api/v2/conversations/{cid}/pin?is_pinned=true")
    assert pin_res.status_code == 200
    assert pin_res.json()["is_pinned"] is True

    # 6. GET /api/v2/conversations/search?q=...
    search_res = client.get(f"/api/v2/conversations/search?q=API message test")
    assert search_res.status_code == 200
    matches = search_res.json()["conversations"]
    assert any(m["id"] == cid for m in matches)

    # 7. PATCH /api/v2/conversations/{id} (rename)
    patch_res = client.patch(f"/api/v2/conversations/{cid}?title=Renamed API Conversation")
    assert patch_res.status_code == 200
    assert patch_res.json()["title"] == "Renamed API Conversation"

    # 8. DELETE /api/v2/conversations/{id}
    del_res = client.delete(f"/api/v2/conversations/{cid}")
    assert del_res.status_code == 200
    assert client.get(f"/api/v2/conversations/{cid}").status_code == 404

    # 9. DELETE /api/v2/conversations (Clear all history)
    c1 = PlatformDB.create_conversation("Clear Test 1")
    c2 = PlatformDB.create_conversation("Clear Test 2")
    clear_res = client.delete("/api/v2/conversations")
    assert clear_res.status_code == 200
    assert clear_res.json()["deleted_count"] >= 2
    assert len(PlatformDB.list_conversations()) == 0


def test_search_stream_auto_saving(client):
    """Verify that /api/v2/search/stream automatically saves conversations and messages."""
    # Direct mode is fast and doesn't require external web search
    payload = {
        "query": "explain quicksort in one sentence",
        "mode": "direct",
    }
    with client.stream("POST", "/api/v2/search/stream", json=payload) as response:
        assert response.status_code == 200
        assigned_conv_id = None
        for line in response.iter_lines():
            if line.startswith("data: "):
                data_obj = json.loads(line[6:])
                if data_obj.get("event") == "search_started":
                    assigned_conv_id = data_obj["data"].get("conversation_id")
                elif data_obj.get("event") == "completed":
                    if not assigned_conv_id:
                        assigned_conv_id = data_obj["data"].get("conversation_id")

    assert assigned_conv_id is not None
    # Verify in DB
    conv = PlatformDB.get_conversation(assigned_conv_id)
    assert conv is not None
    assert conv["message_count"] >= 2
    assert conv["messages"][0]["role"] == "user"
    assert "quicksort" in conv["messages"][0]["content"].lower()
    assert conv["messages"][1]["role"] == "assistant"
    assert len(conv["messages"][1]["content"]) > 0

    # Test follow-up in the same conversation
    followup_payload = {
        "query": "what is its worst-case time complexity?",
        "mode": "direct",
        "conversation_id": assigned_conv_id,
    }
    with client.stream("POST", "/api/v2/search/stream", json=followup_payload) as response:
        assert response.status_code == 200
        for _ in response.iter_lines():
            pass

    # Verify conversation grew to 4 messages
    conv_after = PlatformDB.get_conversation(assigned_conv_id)
    assert conv_after["message_count"] >= 4
    assert conv_after["messages"][2]["role"] == "user"
    assert "worst-case" in conv_after["messages"][2]["content"].lower()

    # Cleanup
    PlatformDB.delete_conversation(assigned_conv_id)


if __name__ == "__main__":
    init_db()
    c = get_test_client()
    print("Running test_database_schema_and_indexes()...")
    test_database_schema_and_indexes()
    print("✓ Schema and indexes verified.")

    print("Running test_title_generator()...")
    test_title_generator()
    print("✓ Title generator verified.")

    print("Running test_conversation_lifecycle_and_pinning()...")
    test_conversation_lifecycle_and_pinning()
    print("✓ Lifecycle, pinning, and ordering verified.")

    print("Running test_search_conversations()...")
    test_search_conversations()
    print("✓ Search across titles and message content verified.")

    print("Running test_backend_restart_persistence()...")
    test_backend_restart_persistence()
    print("✓ Backend restart persistence verified.")

    print("Running test_api_endpoints()...")
    test_api_endpoints(c)
    print("✓ REST API endpoints verified.")

    print("Running test_search_stream_auto_saving()...")
    test_search_stream_auto_saving(c)
    print("✓ Search stream continuous auto-saving verified.")

    print("\nALL PERSISTENT CHAT HISTORY TESTS PASSED SUCCESSFULLY! (7/7)")



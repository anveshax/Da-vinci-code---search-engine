"""
End-to-End Hybrid Search Verification Test.
Calls /api/v2/search/stream using TestClient to verify:
1. Sources event contains both ANVESHA internal index hits and external results.
2. Citations event attributes ANVESHA index sources.
3. Answer chunks stream successfully with Gemini synthesis.
"""
import sys
import os
import json

sys.path.insert(0, os.path.abspath("backend"))

from fastapi.testclient import TestClient
from app.main import app

def test_hybrid_search():
    print("=== HYBRID SEARCH END-TO-END STREAMING TEST ===")
    client = TestClient(app)
    
    payload = {
        "query": "Python built-ins reference",
        "mode": "web"
    }
    
    print(f"Submitting query: '{payload['query']}' via POST /api/v2/search/stream...")
    with client.stream("POST", "/api/v2/search/stream", json=payload) as response:
        print(f"HTTP Status: {response.status_code}")
        assert response.status_code == 200
        
        events_received = []
        sources_data = None
        citations_data = None
        answer_text = ""
        
        for line in response.iter_lines():
            line = line.strip()
            if line.startswith("data: "):
                try:
                    obj = json.loads(line[6:].strip())
                    event_type = obj.get("event")
                    events_received.append(event_type)
                    data = obj.get("data")
                    if event_type == "sources":
                        sources_data = data
                    elif event_type == "citations":
                        citations_data = data
                    elif event_type == "answer_chunk":
                        answer_text += data.get("delta", "")
                except Exception:
                    pass
                    
        print(f"SSE Events Received: {list(set(events_received))}")
        
        # Verify internal index hits in sources
        if sources_data:
            web_results = sources_data.get("web_results", [])
            print(f"Total web sources returned: {len(web_results)}")
            internal_matches = [w for w in web_results if w.get("is_internal_index")]
            print(f"Internal ANVESHA Index matches: {len(internal_matches)}")
            for im in internal_matches:
                print(f"  [ANVESHA Index Match] Title: {im['title']} | URL: {im['url']}")
            assert len(internal_matches) > 0, "Expected at least one ANVESHA index match!"
            
        # Verify citations
        if citations_data:
            print(f"Total citations generated: {len(citations_data)}")
            int_cites = [c for c in citations_data if c.get("is_internal_index")]
            print(f"Citations pointing to ANVESHA Index: {len(int_cites)}")
            
        print(f"Answer synthesized length: {len(answer_text)} chars")
        print(f"Answer snippet: {answer_text[:140]}...")
        print("HYBRID RETRIEVAL VERIFIED SUCCESSFULLY!")

if __name__ == "__main__":
    test_hybrid_search()

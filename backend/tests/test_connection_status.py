"""
Connection Status & CORS Preflight Test Suite.

Verifies:
1. /api/health endpoint returns status: "healthy" and telemetry.
2. CORS allows local frontend origins on all dynamic development ports (5173, 5174, 4173, etc.).
3. CORS preflight (OPTIONS) returns 200 with Access-Control-Allow-Origin for valid origins.
4. CORS rejects unauthorized third-party origins with 400.
5. Vercel production deployment regex matching.
"""
import unittest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


class TestConnectionStatus(unittest.TestCase):

    def test_01_backend_health_endpoint_response(self):
        """Verifies GET /api/health returns 200 with healthy status and host telemetry."""
        resp = client.get("/api/health")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data.get("status"), "healthy")
        self.assertIn("service", data)
        self.assertIn("timestamp", data)
        self.assertIn("telemetry", data)
        telemetry = data["telemetry"]
        self.assertIn("python_version", telemetry)
        self.assertIn("uptime_seconds", telemetry)
        self.assertIn("workspace_root", telemetry)

    def test_02_cors_preflight_on_standard_dev_ports(self):
        """Verifies CORS preflight succeeds on Vite standard port (5173)."""
        origins = [
            "http://localhost:5173",
            "http://127.0.0.1:5173"
        ]
        for origin in origins:
            resp = client.options("/api/health", headers={
                "Origin": origin,
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Headers": "accept"
            })
            self.assertEqual(resp.status_code, 200, f"Failed preflight for {origin}")
            self.assertEqual(resp.headers.get("access-control-allow-origin"), origin)
            self.assertEqual(resp.headers.get("access-control-allow-credentials"), "true")

    def test_03_cors_preflight_on_dynamic_dev_and_preview_ports(self):
        """Verifies CORS preflight succeeds when Vite increments port (5174, 5175, 4173)."""
        dynamic_origins = [
            "http://localhost:5174",
            "http://127.0.0.1:5174",
            "http://localhost:5175",
            "http://localhost:4173",
            "http://127.0.0.1:4173",
            "http://localhost:3000"
        ]
        for origin in dynamic_origins:
            resp = client.options("/api/health", headers={
                "Origin": origin,
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Headers": "accept"
            })
            self.assertEqual(resp.status_code, 200, f"Failed preflight for dynamic port {origin}")
            self.assertEqual(resp.headers.get("access-control-allow-origin"), origin)

    def test_04_cors_preflight_for_production_vercel(self):
        """Verifies CORS allows Vercel production deployment URLs."""
        vercel_origins = [
            "https://anvesha.vercel.app",
            "https://codebase-intelligence-prod.vercel.app"
        ]
        for origin in vercel_origins:
            resp = client.options("/api/health", headers={
                "Origin": origin,
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Headers": "accept"
            })
            self.assertEqual(resp.status_code, 200, f"Failed preflight for Vercel origin {origin}")
            self.assertEqual(resp.headers.get("access-control-allow-origin"), origin)

    def test_05_cors_blocks_unauthorized_external_origins(self):
        """Verifies CORS correctly blocks unauthorized domains."""
        blocked_origins = [
            "https://malicious-attacker.com",
            "http://localhost.evil.com",
            "https://phishing-site.org"
        ]
        for origin in blocked_origins:
            resp = client.options("/api/health", headers={
                "Origin": origin,
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Headers": "accept"
            })
            self.assertEqual(resp.status_code, 400, f"Expected 400 for unauthorized origin {origin}")
            self.assertIsNone(resp.headers.get("access-control-allow-origin"))


if __name__ == "__main__":
    unittest.main()

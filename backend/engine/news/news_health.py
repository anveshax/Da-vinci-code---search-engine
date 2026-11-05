"""
News Health Monitor for ANVESHA Worldwide News Platform.
Tracks runtime health status, latencies, and availability across all news providers and feeds.
"""
from typing import Dict, List, Optional, Any
from datetime import datetime, timezone
from .models import ProviderHealth


class NewsHealthMonitor:
    def __init__(self):
        self._health_store: Dict[str, ProviderHealth] = {}

    def register_health(self, health: ProviderHealth):
        self._health_store[health.source_id] = health

    def record_success(self, source_id: str, source_name: str, provider: str, response_time_ms: float):
        now_iso = datetime.now(timezone.utc).isoformat()
        if source_id not in self._health_store:
            self._health_store[source_id] = ProviderHealth(
                source_id=source_id,
                source_name=source_name,
                provider=provider,
            )
        record = self._health_store[source_id]
        record.status = "healthy"
        record.last_success_at = now_iso
        record.last_attempt_at = now_iso
        record.consecutive_failures = 0
        record.response_time_ms = round(response_time_ms, 2)
        record.error_message = None

    def record_failure(self, source_id: str, source_name: str, provider: str, error_msg: str):
        now_iso = datetime.now(timezone.utc).isoformat()
        if source_id not in self._health_store:
            self._health_store[source_id] = ProviderHealth(
                source_id=source_id,
                source_name=source_name,
                provider=provider,
            )
        record = self._health_store[source_id]
        record.consecutive_failures += 1
        record.last_attempt_at = now_iso
        record.status = "degraded" if record.consecutive_failures < 3 else "down"
        record.error_message = error_msg

    def get_summary(self) -> Dict[str, Any]:
        """Returns consolidated health summary across all monitored providers and feeds."""
        all_records = list(self._health_store.values())
        healthy_count = sum(1 for r in all_records if r.status == "healthy")
        degraded_count = sum(1 for r in all_records if r.status == "degraded")
        down_count = sum(1 for r in all_records if r.status == "down")

        overall_status = "healthy"
        if down_count > 0 and healthy_count > 0:
            overall_status = "degraded"
        elif healthy_count == 0 and len(all_records) > 0:
            overall_status = "down"

        return {
            "status": overall_status,
            "total_monitored_sources": len(all_records),
            "healthy": healthy_count,
            "degraded": degraded_count,
            "down": down_count,
            "providers": [r.model_dump() for r in all_records],
            "checked_at": datetime.now(timezone.utc).isoformat()
        }

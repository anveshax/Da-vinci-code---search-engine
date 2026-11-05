"""
News Background Polling Scheduler & SSE Notification Broadcaster for ANVESHA.
Runs periodic background synchronization and broadcasts update events to connected clients.
"""
import asyncio
import time
from typing import Set, Optional, Callable, Awaitable
from datetime import datetime, timezone


class NewsScheduler:
    def __init__(self, refresh_interval_sec: int = 300):
        self.refresh_interval_sec = refresh_interval_sec
        self.is_running = False
        self._task: Optional[asyncio.Task] = None
        self._subscribers: Set[asyncio.Queue] = set()
        self._sync_callback: Optional[Callable[[], Awaitable[None]]] = None

    def register_sync_callback(self, cb: Callable[[], Awaitable[None]]):
        self._sync_callback = cb

    async def start(self):
        """Starts background refresh scheduler."""
        if self.is_running:
            return
        self.is_running = True
        self._task = asyncio.create_task(self._run_loop())

    async def stop(self):
        """Stops background refresh scheduler."""
        self.is_running = False
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

    async def _run_loop(self):
        # Initial slight delay to let application finish startup
        await asyncio.sleep(2.0)
        while self.is_running:
            try:
                if self._sync_callback:
                    await self._sync_callback()
                    await self.broadcast_update({
                        "event": "news_updated",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "message": "Fresh worldwide stories synchronized."
                    })
            except Exception as e:
                print("NewsScheduler background sync error:", e)

            # Wait for next scheduled refresh interval
            try:
                await asyncio.sleep(self.refresh_interval_sec)
            except asyncio.CancelledError:
                break

    async def broadcast_update(self, data: dict):
        """Broadcasts an update event to all active SSE queues."""
        for queue in list(self._subscribers):
            try:
                await queue.put(data)
            except Exception:
                self._subscribers.discard(queue)

    def subscribe(self) -> asyncio.Queue:
        """Subscribes an SSE connection to live update events."""
        q = asyncio.Queue()
        self._subscribers.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue):
        """Removes a subscriber."""
        self._subscribers.discard(q)

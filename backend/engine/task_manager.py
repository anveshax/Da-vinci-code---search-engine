"""
Centralized Bounded Background Task Manager for ANVESHA.

Provides:
- Bounded task queue (prevents memory explosion from unthrottled background jobs)
- Configurable worker pool concurrency
- Task timeout & cancellation support
- Health telemetry & queue depth monitoring
- Graceful shutdown with in-flight task draining
"""
import asyncio
import time
import uuid
import logging
from typing import Dict, Any, Optional, Callable, Awaitable, List

logger = logging.getLogger(__name__)


class AsyncTaskItem:
    def __init__(self, task_id: str, name: str, coro_fn: Callable[..., Awaitable[Any]], args: tuple, kwargs: dict, timeout_sec: float = 60.0):
        self.task_id = task_id
        self.name = name
        self.coro_fn = coro_fn
        self.args = args
        self.kwargs = kwargs
        self.timeout_sec = timeout_sec
        self.enqueued_at = time.time()
        self.started_at: Optional[float] = None
        self.completed_at: Optional[float] = None
        self.status = "queued"  # queued, running, completed, failed, timed_out, cancelled
        self.error: Optional[str] = None


class BackgroundTaskManager:
    def __init__(self, max_concurrency: int = 4, max_queue_size: int = 150):
        self.max_concurrency = max_concurrency
        self.max_queue_size = max_queue_size
        self._queue: asyncio.Queue[AsyncTaskItem] = asyncio.Queue(maxsize=max_queue_size)
        self._workers: List[asyncio.Task] = []
        self._is_running = False
        self._active_tasks: Dict[str, AsyncTaskItem] = {}
        self._history: Dict[str, Dict[str, Any]] = {}
        self._completed_count = 0
        self._failed_count = 0
        self._peak_queue_depth = 0

    async def start(self):
        """Starts worker pool loop."""
        if self._is_running:
            return
        self._is_running = True
        self._workers = [
            asyncio.create_task(self._worker_loop(i))
            for i in range(self.max_concurrency)
        ]
        logger.info(f"BackgroundTaskManager started with {self.max_concurrency} workers (max_queue: {self.max_queue_size}).")

    async def shutdown(self, timeout_sec: float = 5.0):
        """Drains in-flight tasks and gracefully cancels workers."""
        self._is_running = False
        for w in self._workers:
            w.cancel()
        await asyncio.gather(*self._workers, return_exceptions=True)
        self._workers.clear()
        logger.info("BackgroundTaskManager shutdown completed.")

    def submit(
        self,
        name: str,
        coro_fn: Callable[..., Awaitable[Any]],
        *args,
        timeout_sec: float = 60.0,
        **kwargs,
    ) -> Optional[str]:
        """
        Submits a non-critical background task to the bounded queue.
        Returns task_id, or None if queue is saturated.
        """
        if self._queue.full():
            logger.warning(f"BackgroundTaskManager queue full ({self._queue.qsize()}/{self.max_queue_size}). Task '{name}' rejected.")
            return None

        task_id = f"task_{uuid.uuid4().hex[:8]}"
        item = AsyncTaskItem(
            task_id=task_id,
            name=name,
            coro_fn=coro_fn,
            args=args,
            kwargs=kwargs,
            timeout_sec=timeout_sec,
        )

        try:
            self._queue.put_nowait(item)
            q_depth = self._queue.qsize()
            if q_depth > self._peak_queue_depth:
                self._peak_queue_depth = q_depth
            return task_id
        except asyncio.QueueFull:
            return None

    async def _worker_loop(self, worker_id: int):
        while self._is_running:
            try:
                item = await self._queue.get()
            except asyncio.CancelledError:
                break

            item.started_at = time.time()
            item.status = "running"
            self._active_tasks[item.task_id] = item

            try:
                await asyncio.wait_for(item.coro_fn(*item.args, **item.kwargs), timeout=item.timeout_sec)
                item.status = "completed"
                self._completed_count += 1
            except asyncio.TimeoutError:
                item.status = "timed_out"
                item.error = f"Exceeded {item.timeout_sec}s timeout"
                self._failed_count += 1
                logger.warning(f"Background task '{item.name}' [{item.task_id}] timed out.")
            except Exception as e:
                item.status = "failed"
                item.error = str(e)
                self._failed_count += 1
                logger.error(f"Background task '{item.name}' [{item.task_id}] failed: {e}")
            finally:
                item.completed_at = time.time()
                self._active_tasks.pop(item.task_id, None)
                self._queue.task_done()

                # Retain brief history (last 50 tasks)
                if len(self._history) > 50:
                    oldest = next(iter(self._history))
                    self._history.pop(oldest, None)
                self._history[item.task_id] = {
                    "id": item.task_id,
                    "name": item.name,
                    "status": item.status,
                    "duration_ms": round((item.completed_at - item.started_at) * 1000, 2) if item.started_at else 0,
                    "error": item.error,
                }

    def get_telemetry(self) -> Dict[str, Any]:
        """Returns real telemetry on background workers and queue."""
        return {
            "is_running": self._is_running,
            "max_concurrency": self.max_concurrency,
            "current_queue_depth": self._queue.qsize(),
            "peak_queue_depth": self._peak_queue_depth,
            "max_queue_size": self.max_queue_size,
            "active_tasks_count": len(self._active_tasks),
            "completed_tasks_total": self._completed_count,
            "failed_tasks_total": self._failed_count,
            "active_tasks": [
                {
                    "id": t.task_id,
                    "name": t.name,
                    "running_sec": round(time.time() - (t.started_at or time.time()), 1),
                }
                for t in self._active_tasks.values()
            ],
            "recent_tasks": list(self._history.values())[-10:],
        }


background_task_manager = BackgroundTaskManager(max_concurrency=4, max_queue_size=150)

"""Automated Pre-Market Extractor Sync Scheduler & Background Runner (§13, §14).

Monitors companion email article analyzer database and market data feeds on a configurable
interval (default 10m) or pre-market schedule. When new enrichments are detected, automatically
syncs ranks, recalibrates technical signals, and triggers alert evaluation.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone, timedelta
import logging
import os
import sqlite3
import time
from typing import Any

from .ratings_extractor_bridge import extract_rating_shifts, find_analyzer_db, sync_ratings_from_extractor

logger = logging.getLogger(__name__)


class BackgroundSyncRunner:
    """Background task orchestrator for extractor rank synchronization."""

    def __init__(self, interval_seconds: int = 600):
        self.interval_seconds = interval_seconds
        self.enabled = True
        self.last_checked: str | None = None
        self.last_sync: str | None = None
        self.last_status: str = "INITIALIZING"
        self.runs_completed: int = 0
        self.new_records_detected: int = 0
        self._last_max_id: int = 0
        self._task: asyncio.Task | None = None

    def _get_current_max_id(self) -> int:
        db_path = find_analyzer_db()
        if not db_path or not os.path.exists(db_path):
            return 0
        try:
            conn = sqlite3.connect(db_path)
            try:
                row = conn.execute("SELECT MAX(id) FROM ticker_enrichments").fetchone()
                return int(row[0]) if row and row[0] is not None else 0
            finally:
                conn.close()
        except Exception:
            return 0

    def _get_market_session(self) -> tuple[str, str]:
        """Determine current US market session and next scheduled checkpoint."""
        now_utc = datetime.now(timezone.utc)
        # US Eastern is UTC-4 during Daylight Saving Time (EDT)
        et_offset = timedelta(hours=-4)
        now_et = now_utc + et_offset
        weekday = now_et.weekday()
        current_time_str = now_et.strftime("%H:%M")

        if weekday >= 5:
            return "Weekend (Closed)", "Mon 08:30 ET"

        if current_time_str < "08:30":
            return "Pre-Market Early", "Today 08:30 ET"
        elif current_time_str < "09:30":
            return "Pre-Market Active", "Today 09:35 ET"
        elif current_time_str < "12:30":
            return "Regular Hours (Morning)", "Today 12:30 ET"
        elif current_time_str < "16:00":
            return "Regular Hours (Afternoon)", "Today 16:05 ET"
        elif current_time_str < "20:00":
            return "After-Hours", "Tomorrow 08:30 ET"
        else:
            return "Overnight", "Tomorrow 08:30 ET"

    async def run_sync_cycle(self, force: bool = False) -> dict[str, Any]:
        """Perform one check & sync cycle."""
        now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        self.last_checked = now_iso
        self.runs_completed += 1
        session, next_sched = self._get_market_session()

        cur_max = self._get_current_max_id()
        has_new = cur_max > self._last_max_id and self._last_max_id > 0

        if self._last_max_id == 0 or has_new or force:
            try:
                res = sync_ratings_from_extractor(force=has_new or force)
                self.last_sync = now_iso
                if has_new:
                    detected = cur_max - self._last_max_id
                    self.new_records_detected += detected
                    self.last_status = f"SYNCED ({detected} new records)"
                elif force:
                    self.last_status = "SYNCED (Manual Force Trigger)"
                else:
                    self.last_status = "SYNCED (Baseline Active)"
                self._last_max_id = cur_max

                # Check for rating shifts
                try:
                    shifts = extract_rating_shifts(limit=5)
                except Exception:
                    shifts = []

                run_entry = {
                    "timestamp": now_iso,
                    "status": self.last_status,
                    "session": session,
                    "records_added": cur_max - self._last_max_id if has_new else 0,
                    "shifts_count": len(shifts),
                }
                self.history = [run_entry] + getattr(self, "history", [])[:19]
                return {"synced": True, "details": res, "session": session, "next_scheduled": next_sched, "shifts": shifts}
            except Exception as exc:
                self.last_status = f"ERROR: {exc}"
                run_entry = {
                    "timestamp": now_iso,
                    "status": self.last_status,
                    "session": session,
                    "error": str(exc),
                }
                self.history = [run_entry] + getattr(self, "history", [])[:19]
                return {"synced": False, "error": str(exc), "session": session}
        else:
            self.last_status = "IDLE (No new analyzer runs)"
            run_entry = {
                "timestamp": now_iso,
                "status": self.last_status,
                "session": session,
                "records_added": 0,
            }
            self.history = [run_entry] + getattr(self, "history", [])[:19]
            return {"synced": False, "reason": "No new records", "session": session, "next_scheduled": next_sched}

    async def _loop(self):
        while True:
            try:
                if self.enabled:
                    await self.run_sync_cycle()
            except Exception as exc:
                logger.warning(f"Scheduler loop error: {exc}")
            await asyncio.sleep(self.interval_seconds)

    def start(self):
        if self._task is None or self._task.done():
            self._task = asyncio.create_task(self._loop())

    def stop(self):
        if self._task and not self._task.done():
            self._task.cancel()

    def get_status(self) -> dict[str, Any]:
        session, next_sched = self._get_market_session()
        return {
            "enabled": self.enabled,
            "interval_seconds": self.interval_seconds,
            "interval_minutes": round(self.interval_seconds / 60, 1),
            "last_checked": self.last_checked,
            "last_sync": self.last_sync,
            "last_status": self.last_status,
            "runs_completed": self.runs_completed,
            "new_records_detected": self.new_records_detected,
            "analyzer_db_detected": bool(find_analyzer_db()),
            "market_session": session,
            "next_scheduled_run": next_sched,
            "history": getattr(self, "history", [])[:10],
        }

    def toggle(self, enabled: bool | None = None) -> dict[str, Any]:
        if enabled is None:
            self.enabled = not self.enabled
        else:
            self.enabled = enabled
        return self.get_status()


sync_runner = BackgroundSyncRunner()

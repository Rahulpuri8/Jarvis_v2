"""
Background Scheduler, Alarms, and Reminders tool implementations using APScheduler.
Allows JARVIS to schedule one-off timers, recurring cron routines, and system alerts.
"""

from __future__ import annotations

import datetime
import uuid
from typing import Any, Dict, List, Optional

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.date import DateTrigger
from apscheduler.triggers.interval import IntervalTrigger

from ..core.models import ToolDefinition, ToolRiskLevel
from ..core.registry import ToolRegistry


class SchedulerManager:
    """Singleton managing background jobs and timers."""

    _instance: Optional[SchedulerManager] = None

    def __init__(self) -> None:
        self._scheduler = BackgroundScheduler(daemon=True)
        self._scheduler.start()

    @classmethod
    def get_instance(cls) -> SchedulerManager:
        if cls._instance is None:
            cls._instance = SchedulerManager()
        return cls._instance

    @property
    def scheduler(self) -> BackgroundScheduler:
        if not self._scheduler.running:
            self._scheduler.start()
        return self._scheduler


_sched_mgr = SchedulerManager.get_instance()


def _execute_reminder_callback(title: str, message: str, action_tool: Optional[str] = None, arguments: Optional[Dict[str, Any]] = None):
    """Callback executed when a scheduled timer fires."""
    from .system import send_notification
    send_notification(title=title, message=message)


# ---------------------------------------------------------------------------
# Tool Handlers
# ---------------------------------------------------------------------------


def create_timer(
    delay_seconds: int = 60,
    message: str = "Reminder from JARVIS",
    title: str = "⏰ JARVIS Timer",
    action_tool: Optional[str] = None,
    arguments: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Schedule a one-off delayed reminder or tool execution."""
    if delay_seconds <= 0:
        delay_seconds = 5

    run_time = datetime.datetime.now() + datetime.timedelta(seconds=delay_seconds)
    job_id = f"timer_{uuid.uuid4().hex[:8]}"

    _sched_mgr.scheduler.add_job(
        _execute_reminder_callback,
        trigger=DateTrigger(run_date=run_time),
        args=[title, message, action_tool, arguments or {}],
        id=job_id,
        name=f"Timer: {message[:40]}",
        replace_existing=True,
    )

    return {
        "job_id": job_id,
        "status": "scheduled",
        "delay_seconds": delay_seconds,
        "run_at": run_time.strftime("%Y-%m-%d %H:%M:%S"),
        "message": f"Timer set for {delay_seconds} seconds: '{message}'",
    }


def create_cron(
    job_name: str,
    cron_expression: Optional[str] = None,
    interval_seconds: Optional[int] = None,
    message: str = "Scheduled routine triggered",
    title: str = "🔄 JARVIS Routine",
    action_tool: Optional[str] = None,
    arguments: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Schedule a recurring routine via 5-field cron or interval."""
    job_id = f"cron_{uuid.uuid4().hex[:8]}"

    if cron_expression:
        trigger = CronTrigger.from_crontab(cron_expression)
    elif interval_seconds and interval_seconds > 0:
        trigger = IntervalTrigger(seconds=interval_seconds)
    else:
        # Default every 1 hour
        trigger = IntervalTrigger(hours=1)

    job = _sched_mgr.scheduler.add_job(
        _execute_reminder_callback,
        trigger=trigger,
        args=[title, message, action_tool, arguments or {}],
        id=job_id,
        name=job_name,
        replace_existing=True,
    )

    next_run = job.next_run_time.strftime("%Y-%m-%d %H:%M:%S") if job.next_run_time else "unknown"

    return {
        "job_id": job_id,
        "job_name": job_name,
        "status": "active",
        "next_run_time": next_run,
        "message": f"Scheduled recurring job '{job_name}' (Next run: {next_run})",
    }


def list_jobs() -> Dict[str, Any]:
    """List all currently active scheduled jobs and timers."""
    jobs = _sched_mgr.scheduler.get_jobs()
    job_list = []

    for j in jobs:
        next_run = j.next_run_time.strftime("%Y-%m-%d %H:%M:%S") if j.next_run_time else None
        job_list.append({
            "id": j.id,
            "name": j.name,
            "next_run_time": next_run,
            "trigger": str(j.trigger),
        })

    return {
        "total_jobs": len(job_list),
        "jobs": job_list,
        "message": f"Currently {len(job_list)} active scheduled job(s).",
    }


def cancel_job(job_id: str) -> Dict[str, Any]:
    """Cancel a scheduled job or timer by its ID."""
    try:
        _sched_mgr.scheduler.remove_job(job_id)
        return {
            "canceled": True,
            "job_id": job_id,
            "message": f"Successfully canceled scheduled job '{job_id}'.",
        }
    except Exception as e:
        return {
            "canceled": False,
            "job_id": job_id,
            "message": f"Job '{job_id}' not found or already executed: {str(e)}",
        }


# ---------------------------------------------------------------------------
# Registration
# ---------------------------------------------------------------------------


def register_scheduler_tools(registry: ToolRegistry) -> None:
    """Register all scheduling and timer tools into the registry."""

    registry.register(
        ToolDefinition(
            name="scheduler.create_timer",
            description="Set a one-off delayed reminder, alarm, or timer in seconds or minutes.",
            category="scheduler",
            arguments_schema={
                "type": "object",
                "properties": {
                    "delay_seconds": {"type": "integer", "description": "Seconds from now to trigger the reminder", "default": 60},
                    "message": {"type": "string", "description": "Reminder text notification"},
                    "title": {"type": "string", "default": "⏰ JARVIS Timer"},
                },
                "required": ["delay_seconds", "message"],
            },
            risk_level=ToolRiskLevel.LOW_RISK,
            permissions=["scheduler:manage", "system:notify"],
        ),
        create_timer,
    )

    registry.register(
        ToolDefinition(
            name="scheduler.create_cron",
            description="Create a recurring scheduled routine using cron expression or interval.",
            category="scheduler",
            arguments_schema={
                "type": "object",
                "properties": {
                    "job_name": {"type": "string", "description": "Descriptive name for the routine"},
                    "cron_expression": {"type": "string", "description": "Standard 5-field cron (e.g. '0 9 * * 1-5')"},
                    "interval_seconds": {"type": "integer", "description": "Seconds interval between runs"},
                    "message": {"type": "string", "description": "Notification message to trigger"},
                },
                "required": ["job_name"],
            },
            risk_level=ToolRiskLevel.LOW_RISK,
            permissions=["scheduler:manage", "system:notify"],
        ),
        create_cron,
    )

    registry.register(
        ToolDefinition(
            name="scheduler.list_jobs",
            description="List all active scheduled jobs, reminders, and timers.",
            category="scheduler",
            arguments_schema={"type": "object", "properties": {}},
            risk_level=ToolRiskLevel.READ_ONLY,
            permissions=["scheduler:manage"],
        ),
        list_jobs,
    )

    registry.register(
        ToolDefinition(
            name="scheduler.cancel_job",
            description="Cancel an active scheduled job or timer by its job_id.",
            category="scheduler",
            arguments_schema={
                "type": "object",
                "properties": {
                    "job_id": {"type": "string", "description": "ID of the job to cancel"},
                },
                "required": ["job_id"],
            },
            risk_level=ToolRiskLevel.LOW_RISK,
            permissions=["scheduler:manage"],
        ),
        cancel_job,
    )

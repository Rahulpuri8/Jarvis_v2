"""
Calendar Management Tool Suite for JARVIS
Supports Google Calendar API with seamless local sandbox/mock fallback
"""

import json
import os
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from dateutil import parser as date_parser

from ..core.models import ToolDefinition, ToolRiskLevel


class CalendarManager:
    _instance: Optional["CalendarManager"] = None

    def __init__(self, data_dir: Optional[str] = None):
        self.data_dir = data_dir or os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
        os.makedirs(self.data_dir, exist_ok=True)
        self.sandbox_file = os.path.join(self.data_dir, "sandbox_calendar.json")
        self.credentials_path = os.environ.get(
            "CALENDAR_CREDENTIALS_PATH",
            os.path.join(os.path.dirname(os.path.dirname(__file__)), "credentials.json"),
        )
        self.token_path = os.environ.get(
            "CALENDAR_TOKEN_PATH",
            os.path.join(os.path.dirname(os.path.dirname(__file__)), "token.json"),
        )
        self._init_sandbox_data()

    @classmethod
    def get_instance(cls) -> "CalendarManager":
        if cls._instance is None:
            cls._instance = CalendarManager()
        return cls._instance

    def _init_sandbox_data(self) -> None:
        """Initialize default sandbox calendar schedule if no file exists"""
        if not os.path.exists(self.sandbox_file):
            now = datetime.now()
            today_str = now.strftime("%Y-%m-%d")
            tomorrow_str = (now + timedelta(days=1)).strftime("%Y-%m-%d")

            sample_events = [
                {
                    "id": "evt_001",
                    "title": "Daily Engineering Standup",
                    "start_time": f"{today_str}T09:30:00",
                    "end_time": f"{today_str}T10:00:00",
                    "location": "Google Meet: https://meet.google.com/abc-defg-hij",
                    "description": "Daily team sync: progress, blockers, release status.",
                    "attendees": ["alex.dev@innovate.tech", "sarah.lead@innovate.tech", "me@jarvis.ai"],
                    "status": "confirmed",
                },
                {
                    "id": "evt_002",
                    "title": "Q3 Architecture & Workflow Planning RFC",
                    "start_time": f"{today_str}T15:00:00",
                    "end_time": f"{today_str}T16:00:00",
                    "location": "Conference Room A / Remote",
                    "description": "Reviewing local LLM routing and tool execution pipeline.",
                    "attendees": ["sarah.lead@innovate.tech", "me@jarvis.ai"],
                    "status": "confirmed",
                },
                {
                    "id": "evt_003",
                    "title": "Sprint 42 Demo & Retrospective",
                    "start_time": f"{tomorrow_str}T14:00:00",
                    "end_time": f"{tomorrow_str}T15:30:00",
                    "location": "Google Meet: https://meet.google.com/xyz-uvwx-rst",
                    "description": "Demonstrating Playwright browser tools and APScheduler background alerts.",
                    "attendees": ["team@innovate.tech"],
                    "status": "confirmed",
                },
            ]
            with open(self.sandbox_file, "w", encoding="utf-8") as f:
                json.dump(sample_events, f, indent=2)

    def _load_sandbox(self) -> List[Dict[str, Any]]:
        try:
            with open(self.sandbox_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return []

    def _save_sandbox(self, events: List[Dict[str, Any]]) -> None:
        with open(self.sandbox_file, "w", encoding="utf-8") as f:
            json.dump(events, f, indent=2)

    def _get_calendar_service(self):
        """Attempts to load real Google Calendar API service via OAuth2 token if available"""
        if not os.path.exists(self.token_path) and not os.path.exists(self.credentials_path):
            return None
        try:
            from google.oauth2.credentials import Credentials
            from googleapiclient.discovery import build

            if os.path.exists(self.token_path):
                creds = Credentials.from_authorized_user_file(
                    self.token_path,
                    ["https://www.googleapis.com/auth/calendar"],
                )
                if creds and creds.valid:
                    return build("calendar", "v3", credentials=creds)
        except Exception:
            pass
        return None

    def list_events(self, days_ahead: int = 7, date: Optional[str] = None) -> Dict[str, Any]:
        """List upcoming calendar events for a specified date range"""
        service = self._get_calendar_service()
        if service:
            try:
                now = datetime.utcnow()
                if date and date.lower() != "today":
                    start_dt = date_parser.parse(date)
                else:
                    start_dt = now

                end_dt = start_dt + timedelta(days=days_ahead)

                events_result = service.events().list(
                    calendarId="primary",
                    timeMin=start_dt.isoformat() + "Z",
                    timeMax=end_dt.isoformat() + "Z",
                    singleEvents=True,
                    orderBy="startTime",
                ).execute()

                items = events_result.get("items", [])
                event_list = []
                for item in items:
                    start = item.get("start", {}).get("dateTime", item.get("start", {}).get("date"))
                    end = item.get("end", {}).get("dateTime", item.get("end", {}).get("date"))
                    event_list.append({
                        "id": item.get("id"),
                        "title": item.get("summary", "(Untitled Event)"),
                        "start_time": start,
                        "end_time": end,
                        "location": item.get("location", ""),
                        "description": item.get("description", ""),
                        "attendees": [a.get("email") for a in item.get("attendees", [])],
                        "link": item.get("htmlLink", ""),
                    })
                return {
                    "mode": "live_google_calendar",
                    "count": len(event_list),
                    "days_ahead": days_ahead,
                    "events": event_list,
                }
            except Exception as e:
                return {"mode": "error", "error": f"Google Calendar API error: {str(e)}"}

        # Sandbox Fallback
        events = self._load_sandbox()
        now = datetime.now()
        start_date = now.date()
        if date and date.lower() != "today":
            try:
                start_date = date_parser.parse(date).date()
            except Exception:
                pass
        end_date = start_date + timedelta(days=days_ahead)

        filtered = []
        for e in events:
            try:
                e_dt = date_parser.parse(e.get("start_time", "")).date()
                if start_date <= e_dt <= end_date:
                    filtered.append(e)
            except Exception:
                filtered.append(e)

        # Sort by start_time
        filtered.sort(key=lambda x: x.get("start_time", ""))

        return {
            "mode": "sandbox",
            "count": len(filtered),
            "days_ahead": days_ahead,
            "events": filtered,
            "note": "Operating in local sandbox mode. Link Google Calendar in Settings for live sync.",
        }

    def get_event(self, event_id: str) -> Dict[str, Any]:
        """Get complete event details by ID"""
        service = self._get_calendar_service()
        if service:
            try:
                item = service.events().get(calendarId="primary", eventId=event_id).execute()
                return {
                    "mode": "live_google_calendar",
                    "id": item.get("id"),
                    "title": item.get("summary", ""),
                    "start_time": item.get("start", {}).get("dateTime", item.get("start", {}).get("date")),
                    "end_time": item.get("end", {}).get("dateTime", item.get("end", {}).get("date")),
                    "location": item.get("location", ""),
                    "description": item.get("description", ""),
                    "attendees": [a.get("email") for a in item.get("attendees", [])],
                    "link": item.get("htmlLink", ""),
                }
            except Exception as e:
                return {"mode": "error", "error": f"Could not fetch event {event_id}: {str(e)}"}

        # Sandbox
        events = self._load_sandbox()
        for e in events:
            if e.get("id") == event_id:
                return {"mode": "sandbox", **e}
        return {"error": f"Event with ID '{event_id}' not found."}

    def create_event(
        self,
        title: str,
        start_time: str,
        end_time: Optional[str] = None,
        description: str = "",
        location: str = "",
        attendees: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Create a new calendar meeting or reminder event"""
        # Parse start and end time
        try:
            start_dt = date_parser.parse(start_time)
        except Exception:
            start_dt = datetime.now() + timedelta(hours=1)

        if end_time:
            try:
                end_dt = date_parser.parse(end_time)
            except Exception:
                end_dt = start_dt + timedelta(hours=1)
        else:
            end_dt = start_dt + timedelta(hours=1)

        service = self._get_calendar_service()
        if service:
            try:
                event_body = {
                    "summary": title,
                    "location": location,
                    "description": description,
                    "start": {"dateTime": start_dt.isoformat(), "timeZone": "UTC"},
                    "end": {"dateTime": end_dt.isoformat(), "timeZone": "UTC"},
                }
                if attendees:
                    event_body["attendees"] = [{"email": a} for a in attendees]

                created = service.events().insert(calendarId="primary", body=event_body).execute()
                return {
                    "mode": "live_google_calendar",
                    "id": created.get("id"),
                    "title": title,
                    "start_time": start_dt.isoformat(),
                    "end_time": end_dt.isoformat(),
                    "link": created.get("htmlLink"),
                    "status": "created",
                }
            except Exception as e:
                return {"mode": "error", "error": f"Failed to create Google Calendar event: {str(e)}"}

        # Sandbox
        event_id = f"evt_{uuid.uuid4().hex[:8]}"
        new_event = {
            "id": event_id,
            "title": title,
            "start_time": start_dt.isoformat(),
            "end_time": end_dt.isoformat(),
            "location": location,
            "description": description,
            "attendees": attendees or [],
            "status": "confirmed",
        }
        events = self._load_sandbox()
        events.append(new_event)
        self._save_sandbox(events)
        return {
            "mode": "sandbox",
            "id": event_id,
            "title": title,
            "start_time": start_dt.isoformat(),
            "end_time": end_dt.isoformat(),
            "status": "created",
            "note": "Event created in sandbox calendar store.",
        }

    def delete_event(self, event_id: str) -> Dict[str, Any]:
        """Cancel or remove a calendar event [Requires User Approval]"""
        service = self._get_calendar_service()
        if service:
            try:
                service.events().delete(calendarId="primary", eventId=event_id).execute()
                return {
                    "mode": "live_google_calendar",
                    "id": event_id,
                    "status": "deleted",
                }
            except Exception as e:
                return {"mode": "error", "error": f"Failed to delete event: {str(e)}"}

        # Sandbox
        events = self._load_sandbox()
        initial_len = len(events)
        events = [e for e in events if e.get("id") != event_id]
        if len(events) < initial_len:
            self._save_sandbox(events)
            return {"mode": "sandbox", "id": event_id, "status": "deleted"}
        return {"error": f"Event '{event_id}' not found."}

    def today_briefing(self) -> Dict[str, Any]:
        """Generate a complete schedule briefing for today"""
        today_events = self.list_events(days_ahead=1, date="today")
        events = today_events.get("events", [])

        now = datetime.now()
        upcoming = []
        for e in events:
            try:
                e_start = date_parser.parse(e.get("start_time", ""))
                # Compare time if on same day
                is_upcoming = e_start >= now or e_start.date() > now.date()
                upcoming.append({
                    "title": e.get("title"),
                    "time": e_start.strftime("%I:%M %p"),
                    "location": e.get("location", "N/A"),
                    "attendees_count": len(e.get("attendees", [])),
                    "is_upcoming": is_upcoming,
                })
            except Exception:
                upcoming.append({
                    "title": e.get("title"),
                    "time": e.get("start_time"),
                    "location": e.get("location", "N/A"),
                    "is_upcoming": True,
                })

        briefing_text = f"Today's Schedule ({now.strftime('%A, %B %d')}):\n"
        if not upcoming:
            briefing_text += "No scheduled meetings or calendar events for today. Your day is completely clear!"
        else:
            briefing_text += f"You have {len(upcoming)} scheduled event(s):\n"
            for idx, item in enumerate(upcoming, 1):
                status_icon = "⏳ Upcoming" if item.get("is_upcoming") else "✅ Past"
                briefing_text += f"{idx}. [{item['time']}] {item['title']} ({status_icon})\n"

        return {
            "mode": today_events.get("mode", "sandbox"),
            "date": now.strftime("%Y-%m-%d"),
            "day_name": now.strftime("%A"),
            "total_events": len(upcoming),
            "events": upcoming,
            "briefing": briefing_text,
        }


# ==========================================
# Tool Wrappers for JARVIS Tool Gateway
# ==========================================

calendar_manager = CalendarManager.get_instance()


def calendar_list_events(days_ahead: int = 7, date: Optional[str] = None, **kwargs) -> Dict[str, Any]:
    return calendar_manager.list_events(days_ahead=days_ahead, date=date)


def calendar_get_event(event_id: str = "", id: str = "", **kwargs) -> Dict[str, Any]:
    target_id = event_id or id or kwargs.get("id", "")
    return calendar_manager.get_event(event_id=target_id)


def calendar_create_event(
    title: str = "",
    start_time: str = "",
    end_time: Optional[str] = None,
    description: str = "",
    location: str = "",
    attendees: Optional[List[str]] = None,
    **kwargs,
) -> Dict[str, Any]:
    summary = title or kwargs.get("summary", "New Event")
    start = start_time or kwargs.get("start", datetime.now().isoformat())
    end = end_time or kwargs.get("end")
    return calendar_manager.create_event(
        title=summary,
        start_time=start,
        end_time=end,
        description=description,
        location=location,
        attendees=attendees,
    )


def calendar_delete_event(event_id: str = "", id: str = "", **kwargs) -> Dict[str, Any]:
    target_id = event_id or id or kwargs.get("id", "")
    return calendar_manager.delete_event(event_id=target_id)


def calendar_today_briefing(**kwargs) -> Dict[str, Any]:
    return calendar_manager.today_briefing()


def register_calendar_tools(registry) -> None:
    registry.register(
        ToolDefinition(
            name="calendar.list_events",
            description="List upcoming calendar events and meetings.",
            category="calendar",
            arguments_schema={
                "type": "object",
                "properties": {
                    "days_ahead": {"type": "integer", "description": "Number of days ahead to look (default: 7)"},
                    "date": {"type": "string", "description": "Start date (e.g. 'today', '2026-09-06')"},
                },
            },
            risk_level=ToolRiskLevel.READ_ONLY,
            permissions=["calendar:read"],
        ),
        calendar_list_events,
    )

    registry.register(
        ToolDefinition(
            name="calendar.get_event",
            description="Get full details, attendees, and link for a specific calendar event.",
            category="calendar",
            arguments_schema={
                "type": "object",
                "properties": {
                    "event_id": {"type": "string", "description": "ID of the calendar event"},
                },
                "required": ["event_id"],
            },
            risk_level=ToolRiskLevel.READ_ONLY,
            permissions=["calendar:read"],
        ),
        calendar_get_event,
    )

    registry.register(
        ToolDefinition(
            name="calendar.create_event",
            description="Create a new calendar event, meeting, or appointment.",
            category="calendar",
            arguments_schema={
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "Title or summary of the meeting"},
                    "start_time": {"type": "string", "description": "Start time ISO string or date/time format"},
                    "end_time": {"type": "string", "description": "Optional end time (defaults to start_time + 1 hr)"},
                    "description": {"type": "string", "description": "Description / agenda of the meeting"},
                    "location": {"type": "string", "description": "Meeting location or video call link"},
                    "attendees": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "List of attendee email addresses",
                    },
                },
                "required": ["title", "start_time"],
            },
            risk_level=ToolRiskLevel.LOW_RISK,
            permissions=["calendar:manage"],
        ),
        calendar_create_event,
    )

    registry.register(
        ToolDefinition(
            name="calendar.delete_event",
            description="Cancel or delete a calendar event by ID. Requires user approval.",
            category="calendar",
            arguments_schema={
                "type": "object",
                "properties": {
                    "event_id": {"type": "string", "description": "ID of the event to cancel"},
                },
                "required": ["event_id"],
            },
            risk_level=ToolRiskLevel.EXTERNAL_WRITE,
            permissions=["calendar:manage"],
        ),
        calendar_delete_event,
    )

    registry.register(
        ToolDefinition(
            name="calendar.today_briefing",
            description="Get an organized daily agenda briefing with upcoming meetings and schedule status.",
            category="calendar",
            arguments_schema={"type": "object", "properties": {}},
            risk_level=ToolRiskLevel.READ_ONLY,
            permissions=["calendar:read"],
        ),
        calendar_today_briefing,
    )


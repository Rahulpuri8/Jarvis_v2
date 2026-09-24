import pytest
from datetime import datetime, timedelta
from runtime.core.gateway import ToolGateway
from runtime.core.models import ToolRequest
from runtime.core.registry import ToolRegistry
from runtime.tools.email import (
    register_email_tools,
    email_list_unread,
    email_search,
    email_read,
    email_draft,
    email_send,
)
from runtime.tools.calendar import (
    register_calendar_tools,
    calendar_list_events,
    calendar_today_briefing,
    calendar_create_event,
    calendar_get_event,
    calendar_delete_event,
)


def test_email_tools_registration():
    reg = ToolRegistry()
    register_email_tools(reg)
    tools = reg.list_tools()
    tool_names = [t.name for t in tools]

    expected = [
        "email.list_unread",
        "email.search",
        "email.read",
        "email.draft",
        "email.send",
    ]
    for name in expected:
        assert name in tool_names
        defn, handler = reg.get(name)
        assert defn.category == "email"
        assert callable(handler)


def test_calendar_tools_registration():
    reg = ToolRegistry()
    register_calendar_tools(reg)
    tools = reg.list_tools()
    tool_names = [t.name for t in tools]

    expected = [
        "calendar.list_events",
        "calendar.get_event",
        "calendar.create_event",
        "calendar.delete_event",
        "calendar.today_briefing",
    ]
    for name in expected:
        assert name in tool_names
        defn, handler = reg.get(name)
        assert defn.category == "calendar"
        assert callable(handler)


def test_email_list_unread():
    res = email_list_unread(limit=5)
    assert "count" in res
    assert "emails" in res
    assert len(res["emails"]) > 0
    assert "subject" in res["emails"][0]
    assert "sender" in res["emails"][0]


def test_email_search():
    res = email_search(query="Architecture")
    assert "emails" in res
    assert len(res["emails"]) > 0
    assert any("Architecture" in e.get("subject", "") or "Architecture" in e.get("body", "") for e in res["emails"])


def test_email_read_and_draft_and_send():
    # Read
    read_res = email_read(email_id="msg_001")
    assert "subject" in read_res
    assert "body" in read_res

    # Draft
    draft_res = email_draft(
        to="sarah.lead@innovate.tech",
        subject="Re: Q3 Architecture Review",
        body="I have reviewed the RFC and approved the tool gateway changes.",
    )
    assert draft_res["status"] == "draft_created"
    assert "draft_id" in draft_res

    # Send
    send_res = email_send(
        to="sarah.lead@innovate.tech",
        subject="Re: Q3 Architecture Review",
        body="Approved!",
    )
    assert send_res["status"] == "sent"
    assert "message_id" in send_res


def test_calendar_list_and_briefing():
    today = datetime.now().strftime("%Y-%m-%dT10:00:00")
    calendar_create_event(title="Test Briefing Meeting", start_time=today)
    list_res = calendar_list_events(days_ahead=7)
    assert "events" in list_res
    assert len(list_res["events"]) > 0

    briefing_res = calendar_today_briefing()
    assert "briefing" in briefing_res
    assert "total_events" in briefing_res
    assert "Today's Schedule" in briefing_res["briefing"]


def test_calendar_create_get_delete():
    tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%dT16:00:00")
    create_res = calendar_create_event(
        title="1-on-1 Sync with Alex",
        start_time=tomorrow,
        description="Discuss Playwright integration",
        attendees=["alex.dev@innovate.tech"],
    )
    assert create_res["status"] == "created"
    event_id = create_res["id"]
    assert event_id is not None

    # Get
    get_res = calendar_get_event(event_id=event_id)
    assert get_res["title"] == "1-on-1 Sync with Alex"

    # Delete
    del_res = calendar_delete_event(event_id=event_id)
    assert del_res["status"] == "deleted"


@pytest.mark.asyncio
async def test_email_gateway_invocation():
    reg = ToolRegistry()
    register_email_tools(reg)
    gateway = ToolGateway(registry=reg)

    req = ToolRequest(tool="email.list_unread", arguments={"limit": 3})
    res = await gateway.execute(req)
    assert res.success is True
    assert "emails" in res.data
